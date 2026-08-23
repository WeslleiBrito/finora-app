import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CheckCircle2, CircleDashed, Undo2, Receipt, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

import { api } from "@/lib/api/store";
import { accountsQuery, paymentInstrumentsQuery } from "@/lib/api/queries";
import { formatMoney, todayIso } from "@/lib/format";

export const Route = createFileRoute("/_privado/faturas/$id")({
  component: FaturaDetailsPage,
});

function FaturaDetailsPage() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();

  // 1. Buscas (Queries)
  const { data: invoice, isLoading } = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => api.getInvoice(id),
  });
  const { data: accounts } = useQuery(accountsQuery);
  const { data: instruments } = useQuery(paymentInstrumentsQuery);

  // 2. Estados do Modal de Pagamento
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [selectedInstallment, setSelectedInstallment] = useState<any>(null);

  const [paymentDate, setPaymentDate] = useState(todayIso());
  const [accountId, setAccountId] = useState("");
  const [instrumentId, setInstrumentId] = useState("none");

  const [amount, setAmount] = useState(0); // Amortização (Nominal)
  const [interest, setInterest] = useState(0);
  const [fine, setFine] = useState(0);
  const [discount, setDiscount] = useState(0);

  // 3. Cálculos Dinâmicos do Modal
  const effectiveAmount = (amount || 0) + (interest || 0) + (fine || 0) - (discount || 0);

  // 4. Abrir Modal Preparado
  const openPaymentModal = (installment: any) => {
    setSelectedInstallment(installment);
    // Sugere pagar o saldo restante total da parcela
    const remaining = installment.amount - installment.totalPaid;
    setAmount(remaining);
    setInterest(0);
    setFine(0);
    setDiscount(0);
    setAccountId(invoice?.accountId || ""); // Puxa a conta padrão da fatura
    setPaymentDate(todayIso());
    setPayModalOpen(true);
  };

  // 5. Mutação: Pagar Parcela
  const payMutation = useMutation({
    mutationFn: () => {
      // Monta o payload base obrigatório
      const transactionPayload = {
        installmentId: selectedInstallment.id,
        accountId,
        paymentDate,
        amount,
        interest,
        fine,
        discount,
        // 🌟 AQUI ESTÁ A CORREÇÃO MÁGICA DO TYPESCRIPT
        ...(instrumentId !== "none" && { paymentInstrumentId: instrumentId })
      };

      return api.createTransaction({
        transactions: [transactionPayload]
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      toast.success("Pagamento registrado com sucesso!");
      setPayModalOpen(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  // 6. Mutação: Estornar Transação
  const reverseMutation = useMutation({
    mutationFn: (transactionId: string) => api.reverseTransaction(transactionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      toast.success("Estorno realizado com sucesso!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  if (isLoading) return <div className="p-8 text-center">Carregando detalhes...</div>;
  if (!invoice) return <div className="p-8 text-center text-destructive">Fatura não encontrada.</div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Detalhes da Fatura" description={`Emitida em ${format(new Date(invoice.issueDate), "dd/MM/yyyy")}`} />

      {/* ======================================================== */}
      {/* 📊 RESUMO DA FATURA                                        */}
      {/* ======================================================== */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Valor Total</p>
          <p className="text-2xl font-bold">{formatMoney(invoice.totalAmount)}</p>
        </div>
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Total Pago</p>
          <p className="text-2xl font-bold text-inflow">{formatMoney(invoice.totalPaid)}</p>
        </div>
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Saldo Restante</p>
          <p className="text-2xl font-bold text-destructive">{formatMoney(invoice.remainingBalance)}</p>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 🧾 LISTA DE PARCELAS E HISTÓRICO                           */}
      {/* ======================================================== */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="border-b bg-muted/20 p-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Receipt className="size-4" /> Cronograma de Parcelas
          </h3>
        </div>

        <div className="divide-y">
          {invoice.installments.map((parcel: any) => {
            const isPaid = parcel.isPaid === "FINALIZED";
            const remaining = parcel.amount - parcel.totalPaid;

            return (
              <div key={parcel.id} className="p-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between hover:bg-muted/10 transition-colors">

                {/* Info da Parcela */}
                <div className="flex gap-4">
                  <div className="mt-1">
                    {isPaid ? <CheckCircle2 className="size-6 text-inflow" /> : <CircleDashed className="size-6 text-muted-foreground" />}
                  </div>
                  <div>
                    <h4 className="font-bold flex items-center gap-2">
                      {parcel.parcelNumber}ª Parcela
                      <Badge variant={isPaid ? "default" : "secondary"}>
                        {isPaid ? "Quitada" : parcel.isPaid === "PARTIALLY_PAID" ? "Parcial" : "Aberta"}
                      </Badge>
                    </h4>
                    <p className="text-sm text-muted-foreground">Vence em {format(new Date(parcel.dueDate), "dd/MM/yyyy")}</p>

                    <div className="mt-2 text-sm">
                      <p>Valor nominal: <span className="font-medium">{formatMoney(parcel.amount)}</span></p>
                      {!isPaid && parcel.totalPaid > 0 && (
                        <p>Falta pagar: <span className="font-medium text-destructive">{formatMoney(remaining)}</span></p>
                      )}
                    </div>

                    {/* Histórico de Transações desta Parcela */}
                    {parcel.transactions?.length > 0 && (
                      <div className="mt-4 space-y-2 border-l-2 pl-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase">Histórico de Pagamentos</p>
                        {parcel.transactions.map((tx: any) => (
                          <div key={tx.id} className={`flex items-center gap-3 text-xs p-2 rounded ${tx.movementType === 'REVERSAL' ? 'bg-destructive/10' : 'bg-secondary/50'}`}>
                            <ArrowRightLeft className="size-3" />
                            <span className="flex-1">
                              {tx.movementType === 'REVERSAL' ? 'Estorno' : 'Pagamento'} em {format(new Date(tx.paymentDate), "dd/MM")}
                              {tx.discount > 0 && <span className="text-inflow ml-2">(-{formatMoney(tx.discount)})</span>}
                              {(tx.interest > 0 || tx.fine > 0) && <span className="text-destructive ml-2">(+J/M)</span>}
                            </span>
                            <span className="font-bold">{formatMoney(tx.effectiveAmount)}</span>

                            {/* Botão de Estorno (Só aparece se não for um estorno e não tiver sido estornada) */}
                            {tx.movementType !== 'REVERSAL' && !tx.reversed && (
                              <Button
                                variant="ghost" size="icon" className="size-6 h-6 w-6 text-destructive hover:bg-destructive/20"
                                onClick={() => {
                                  if (window.confirm("Deseja realmente estornar este pagamento? Os saldos retornarão ao estado anterior.")) {
                                    reverseMutation.mutate(tx.id);
                                  }
                                }}
                              >
                                <Undo2 className="size-3" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Ação */}
                {!isPaid && (
                  <Button onClick={() => openPaymentModal(parcel)} className="shrink-0 rounded-full">
                    Pagar Parcela
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODAL DE PAGAMENTO COM CÁLCULO DE VALOR EFETIVO            */}
      {/* ======================================================== */}
      <Dialog open={payModalOpen} onOpenChange={setPayModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Pagamento</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data do Pagamento</Label>
                <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Conta</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(accounts ?? []).map((a: any) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t pt-4">
              <div className="space-y-2">
                <Label>Amortização (Nominal)</Label>
                <Input type="number" step="0.01" value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))} />
                <p className="text-[10px] text-muted-foreground">Valor que abate a dívida</p>
              </div>
              <div className="space-y-2">
                <Label>Desconto concedido</Label>
                <Input type="number" step="0.01" value={discount || ""} onChange={(e) => setDiscount(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Juros</Label>
                <Input type="number" step="0.01" value={interest || ""} onChange={(e) => setInterest(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Multa</Label>
                <Input type="number" step="0.01" value={fine || ""} onChange={(e) => setFine(Number(e.target.value))} />
              </div>
            </div>

            {/* PREVIEW DO VALOR EFETIVO */}
            <div className="rounded-lg bg-secondary/50 p-4 mt-2 flex items-center justify-between">
              <span className="text-sm font-semibold">Valor Efetivo a pagar:</span>
              <span className="text-xl font-bold text-primary">{formatMoney(effectiveAmount)}</span>
            </div>
            <p className="text-xs text-center text-muted-foreground">
              Este é o valor exato que sairá/entrará na conta selecionada.
            </p>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setPayModalOpen(false)}>Cancelar</Button>
            <Button disabled={effectiveAmount <= 0 || !accountId || payMutation.isPending} onClick={() => payMutation.mutate()}>
              {payMutation.isPending ? "Processando..." : "Confirmar Pagamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}