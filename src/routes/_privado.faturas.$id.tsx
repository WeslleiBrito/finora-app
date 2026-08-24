import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CheckCircle2, CircleDashed, Undo2, Receipt, ArrowRightLeft, Trash2, Edit3 } from "lucide-react";
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
import { EditInstallmentDialog } from "@/components/modals/edit-installment-dialog";

export const Route = createFileRoute("/_privado/faturas/$id")({
  component: FaturaDetailsPage,
});

function FaturaDetailsPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // 1. Buscas (Queries)
  const { data: invoice, isLoading } = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => api.getInvoice(id),
  });
  const { data: accounts } = useQuery(accountsQuery);
  const { data: instruments } = useQuery(paymentInstrumentsQuery);

  // 2. Estados dos Modais
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [selectedInstallment, setSelectedInstallment] = useState<any>(null);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedInstallmentToEdit, setSelectedInstallmentToEdit] = useState<any>(null);

  const [paymentDate, setPaymentDate] = useState(todayIso());
  const [accountId, setAccountId] = useState("");
  const [instrumentId, setInstrumentId] = useState("none");

  const [amount, setAmount] = useState(0); 
  const [interest, setInterest] = useState(0);
  const [fine, setFine] = useState(0);
  const [discount, setDiscount] = useState(0);

  // 3. Cálculos Dinâmicos do Modal de Pagamento
  const effectiveAmount = (amount || 0) + (interest || 0) + (fine || 0) - (discount || 0);

  // 4. Mutações de Exclusão (Novas Funcionalidades)
  const deleteInvoiceMutation = useMutation({
    mutationFn: () => api.deleteInvoice(id),
    onSuccess: () => {
      toast.success("Fatura e parcelas excluídas com sucesso!");
      navigate({ to: "/faturas" }); 
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteInstallmentMutation = useMutation({
    mutationFn: (installmentId: string) => api.deleteInstallment(installmentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      toast.success("Parcela excluída com sucesso!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // 5. Abrir Modal de Pagamento
  const openPaymentModal = (installment: any) => {
    setSelectedInstallment(installment);
    const remaining = installment.amount - installment.totalPaid;
    setAmount(remaining);
    setInterest(0);
    setFine(0);
    setDiscount(0);
    setAccountId(invoice?.accountId || ""); 
    setPaymentDate(todayIso());
    setPayModalOpen(true);
  };

  // 6. Mutação: Pagar Parcela
  const payMutation = useMutation({
    mutationFn: () => {
      const transactionPayload = {
        installmentId: selectedInstallment.id,
        accountId,
        paymentDate,
        amount,
        interest,
        fine,
        discount,
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

  // 7. Mutação: Estornar Transação
  const reverseMutation = useMutation({
    mutationFn: (transactionId: string) => api.reverseTransaction(transactionId, { reason: "" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      toast.success("Estorno realizado com sucesso!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  if (isLoading) return <div className="p-8 text-center">Carregando detalhes...</div>;
  if (!invoice) return <div className="p-8 text-center text-destructive">Fatura não encontrada.</div>;

  // 🌟 REGRA DE NEGÓCIO DA FATURA: Só deleta se nada foi pago!
  const invoiceAmortized = (invoice.totalPaid || 0) + (invoice.totalDiscount || 0);
  const canDeleteInvoice = invoiceAmortized === 0;

  return (
    <div className="space-y-6">
      
      {/* 🌟 HEADER COM BOTÃO DE EXCLUIR FATURA */}
      <PageHeader 
        title="Detalhes da Fatura" 
        description={`Emitida em ${format(new Date(invoice.issueDate), "dd/MM/yyyy")}`}
        action={
          canDeleteInvoice ? (
            <Button 
              variant="destructive" 
              className="rounded-full shadow-sm"
              disabled={deleteInvoiceMutation.isPending}
              onClick={() => {
                if (window.confirm("Deseja realmente excluir esta fatura inteira? Todas as parcelas em aberto serão apagadas. Esta ação é irreversível.")) {
                  deleteInvoiceMutation.mutate();
                }
              }}
            >
              <Trash2 className="size-4 mr-2" /> Excluir Lançamento
            </Button>
          ) : undefined
        }
      />

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
            const isPaid = parcel.status === "FINALIZED";
            const remaining = parcel.amount - parcel.totalPaid;
            
            // 🌟 REGRA DE NEGÓCIO DA PARCELA
            const parcelAmortized = (parcel.totalPaid || 0) + (parcel.totalDiscount || parcel.TotalDiscount || 0);
            const canDeleteInstallment = parcelAmortized === 0;

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
                        {isPaid ? "Quitada" : parcel.status === "PARTIALLY_PAID" ? "Parcial" : "Aberta"}
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
                        {parcel.transactions.map((tx: any) => {
                          const isAlreadyReversed = parcel.transactions.some((rev: any) => rev.reversedTransactionId === tx.id);
                          const canReverse = tx.movementType !== 'REVERSAL' && !isAlreadyReversed;

                          return (
                            <div key={tx.id} className={`flex items-center gap-3 text-xs p-2 rounded ${tx.movementType === 'REVERSAL' ? 'bg-destructive/10' : 'bg-secondary/50'}`}>
                              <ArrowRightLeft className="size-3" />
                              <span className="flex-1">
                                {tx.movementType === 'REVERSAL' ? 'Estorno' : 'Pagamento'} em {format(new Date(tx.paymentDate), "dd/MM")}
                                {tx.discount > 0 && <span className="text-inflow ml-2">(-{formatMoney(tx.discount)})</span>}
                                {(tx.interest > 0 || tx.fine > 0) && <span className="text-destructive ml-2">(+J/M)</span>}
                              </span>
                              <span className="font-bold">{formatMoney(tx.effectiveAmount)}</span>

                              {canReverse && (
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
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* 🌟 AÇÕES DA PARCELA (PAGAR / EDITAR / EXCLUIR) */}
                <div className="flex items-center gap-2 shrink-0">
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="rounded-full" 
                    title="Editar Vencimento ou Valor"
                    onClick={() => { setSelectedInstallmentToEdit(parcel); setEditModalOpen(true); }}
                  >
                    <Edit3 className="size-4 text-muted-foreground" />
                  </Button>

                  {canDeleteInstallment && (
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="rounded-full hover:bg-destructive/10 hover:text-destructive" 
                      title="Excluir Parcela"
                      disabled={deleteInstallmentMutation.isPending}
                      onClick={() => {
                        if (window.confirm("Deseja realmente excluir esta parcela? Se for a última parcela, a fatura inteira será excluída.")) {
                          deleteInstallmentMutation.mutate(parcel.id);
                        }
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}

                  {!isPaid && (
                    <Button onClick={() => openPaymentModal(parcel)} className="rounded-full">
                      Pagar
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODAL DE PAGAMENTO                                         */}
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

      {/* 🌟 MODAL DE EDIÇÃO DE PARCELA */}
      <EditInstallmentDialog 
        open={editModalOpen} 
        onOpenChange={setEditModalOpen} 
        installment={selectedInstallmentToEdit} 
      />
    </div>
  );
}