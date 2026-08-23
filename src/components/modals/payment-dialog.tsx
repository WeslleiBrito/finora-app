import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, AlertTriangle, Plus, Calculator, History, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { accountsQuery, paymentInstrumentsQuery } from "@/lib/api/queries";

import { api } from "@/lib/api/store";
import { formatMoney, todayIso } from "@/lib/format";
import { AccountDialog } from "./account-dialog";
import { TransactionReversalDialog } from "./transaction-reversal-dialog";

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  installment: any;
  onSuccess?: () => void;
}

export function PaymentDialog({ open, onOpenChange, installment, onSuccess }: PaymentDialogProps) {
  const queryClient = useQueryClient();

  const accounts = useQuery(accountsQuery);
  const instruments = useQuery(paymentInstrumentsQuery);

  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);

  // Estados
  const [reversalModalOpen, setReversalModalOpen] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [instrumentId, setInstrumentId] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayIso());
  
  const [amount, setAmount] = useState<number | "">(0);
  const [interest, setInterest] = useState<number | "">(0);
  const [fine, setFine] = useState<number | "">(0);
  const [discount, setDiscount] = useState<number | "">(0);

  // Injeção dos dados autônomos da parcela
  useMemo(() => {
    if (open && installment) {
      setAmount(installment.remainingBalance);
      setInterest(0);
      setFine(0);
      setDiscount(0);
      setAccountId(installment.accountId || "");
      setInstrumentId(installment.paymentInstrumentId || ""); 
      setPaymentDate(todayIso()); 
    }
  }, [open, installment]);
  
  // Cálculos Efetivos
  const numAmount = Number(amount) || 0;
  const numInterest = Number(interest) || 0;
  const numFine = Number(fine) || 0;
  const numDiscount = Number(discount) || 0;

  const effectiveAmount = numAmount + numInterest + numFine - numDiscount;
  const newInstallmentBalance = Math.max(0, installment?.remainingBalance - numAmount);

  // ==========================================
  // REGRAS DE DOMÍNIO (KIND, SALDO E INSTRUMENTOS)
  // ==========================================
  const selectedAccount = (accounts.data ?? []).find((a: any) => a.id === accountId);
  const isWallet = selectedAccount?.type === "WALLET"; 
  const hasInsufficientWalletFunds = isWallet && effectiveAmount > (selectedAccount?.balance || 0);

  // Filtro Inteligente: Carteira só aceita CASH. Bancos não aceitam CASH.
  const validInstruments = (instruments.data ?? []).filter((i: any) => {
    
    // 🌟 NOVA REGRA: Só exibe instrumentos que servem para pagar!
    if (i.instrumentNature !== "PAYMENT") return false;

    // Regra da Carteira
    if (isWallet) return i.paymentType === "CASH";
    return i.paymentType !== "CASH";
  });

  const pay = useMutation({
    mutationFn: () => {
      return api.createTransaction({
        transactions: [{
          installmentId: installment.id,
          accountId,
          ...(instrumentId ? { paymentInstrumentId: instrumentId } : {}),
          paymentDate,
          amount: numAmount,
          interest: numInterest,
          fine: numFine,
          discount: numDiscount,
          observations: "Baixa manual"
        }]
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Pagamento registrado com sucesso!");
      onSuccess?.();
      onOpenChange(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  if (!installment) return null;

  const canSave = accountId && numAmount > 0 && !hasInsufficientWalletFunds;
  const transactions = installment.transactions || [];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        {/* 🌟 MODAL ALARGADO: sm:max-w-4xl */}
        <DialogContent className="sm:max-w-4xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
          
          {/* CABEÇALHO */}
          <div className="bg-muted/30 p-6 border-b shrink-0">
            <DialogTitle className="text-xl mb-4">Liquidação de Parcela</DialogTitle>
            <div className="flex items-center justify-between text-sm">
              <div>
                <p className="text-muted-foreground">Valor Original</p>
                <p className="font-semibold">{formatMoney(installment.amount)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Já Pago</p>
                <p className="font-semibold text-primary">{formatMoney(installment.totalPaid)}</p>
              </div>
              <div className="text-right">
                <p className="text-muted-foreground font-medium">Saldo Devedor</p>
                <p className="text-2xl font-bold text-destructive">{formatMoney(installment.remainingBalance)}</p>
              </div>
            </div>
          </div>

          {/* ÁREA DE SCROLL */}
          <div className="flex-1 overflow-y-auto">
            
            {/* FORMULÁRIO DE BAIXA */}
            <div className="grid md:grid-cols-2 gap-6 p-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Conta Provisão</Label>
                    <Button type="button" variant="ghost" size="sm" className="h-auto p-0 text-[10px] text-primary hover:bg-transparent hover:underline" onClick={() => setAccountModalOpen(true)}>
                      <Plus className="mr-1 size-3" /> Nova Conta
                    </Button>
                  </div>
                  <Select value={accountId} onValueChange={setAccountId}>
                    <SelectTrigger className={hasInsufficientWalletFunds ? "border-destructive text-destructive" : ""}>
                      <SelectValue placeholder="Selecione a conta" />
                    </SelectTrigger>
                    <SelectContent>
                      {(accounts.data ?? []).map((a: any) => (
                        <SelectItem key={a.id} value={a.id}>
                          <div className="flex justify-between w-full pr-4 gap-4">
                            <span>{a.name}</span>
                            <span className="text-muted-foreground text-xs">{formatMoney(a.balance)}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {hasInsufficientWalletFunds && (
                    <p className="text-[10px] text-destructive flex items-center gap-1 mt-1">
                      <AlertTriangle className="size-3" /> Saldo da Carteira ({formatMoney(selectedAccount.balance)}) insuficiente.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Instrumento de Pagamento</Label>
                  <Select value={instrumentId} onValueChange={setInstrumentId} disabled={!accountId}>
                    <SelectTrigger><SelectValue placeholder={isWallet ? "Dinheiro (Físico)" : "PIX, Cartão..."} /></SelectTrigger>
                    <SelectContent>
                      {validInstruments.map((i: any) => <SelectItem key={i.id} value={i.id}>{i.cardHolderName || i.paymentType}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Data do Pagamento</Label>
                  <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                </div>
              </div>

              <div className="space-y-4 bg-secondary/20 p-4 rounded-xl border">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Calculator className="size-3" /> Valores
                </h4>
                <div className="space-y-2">
                  <Label className="text-xs">Principal (Amortização)</Label>
                  <Input type="number" step="0.01" className="font-semibold" value={amount} onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : "")} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Juros (+)</Label>
                    <Input type="number" step="0.01" value={interest} onChange={(e) => setInterest(e.target.value ? Number(e.target.value) : "")} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Multa (+)</Label>
                    <Input type="number" step="0.01" value={fine} onChange={(e) => setFine(e.target.value ? Number(e.target.value) : "")} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Desconto (-)</Label>
                  <Input type="number" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value ? Number(e.target.value) : "")} />
                </div>
              </div>
            </div>

            {/* 🌟 HISTÓRICO DE TRANSAÇÕES DA PARCELA */}
            {transactions.length > 0 && (
              <div className="px-6 py-6 border-t bg-muted/10">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1">
                  <History className="size-3" /> Histórico de Lançamentos
                </h4>
                <div className="max-h-48 overflow-y-auto border rounded-lg bg-background">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs h-8">Data</TableHead>
                        {/* 🌟 NOVAS COLUNAS */}
                        <TableHead className="text-xs h-8">Conta</TableHead>
                        <TableHead className="text-xs h-8">Forma</TableHead>
                        <TableHead className="text-xs h-8">Operação</TableHead>
                        <TableHead className="text-xs h-8 text-right">Valor Efetivo</TableHead>
                        <TableHead className="w-[40px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((t: any) => {
                        const isAlreadyReversed = transactions.some((rev: any) => rev.reversedTransactionId === t.id);
                        const canReverse = t.movementType !== 'REVERSAL' && !isAlreadyReversed;

                        // 🌟 CRUZAMENTO DE DADOS: Pegando o nome da conta e do instrumento
                        const rowAccount = (accounts.data ?? []).find((a: any) => a.id === t.accountId);
                        const rowInstrument = (instruments.data ?? []).find((i: any) => i.id === t.paymentInstrumentId);

                        return (
                          <TableRow key={t.id}>
                            <TableCell className="text-xs py-2 whitespace-nowrap">{format(parseISO(t.paymentDate), 'dd/MM/yyyy')}</TableCell>
                            
                            {/* 🌟 RENDERIZANDO CONTA E FORMA */}
                            <TableCell className="text-xs py-2 max-w-[140px] truncate" title={rowAccount?.name}>
                              {rowAccount?.name || "Desconhecida"}
                            </TableCell>
                            <TableCell className="text-xs py-2 max-w-[120px] truncate">
                              {rowInstrument ? (rowInstrument.cardHolderName || rowInstrument.paymentType) : "-"}
                            </TableCell>

                            <TableCell className="text-xs py-2">
                              {t.movementType === 'REVERSAL' ? (
                                <span className="text-destructive font-medium">Estorno</span>
                              ) : (
                                <span className="text-primary font-medium">Pagamento</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs py-2 text-right font-medium">
                              {t.movementType === 'REVERSAL' ? "-" : ""}{formatMoney(t.effectiveAmount)}
                            </TableCell>
                            <TableCell className="text-center py-2 pr-2">
                              {canReverse && (
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => { setSelectedTransaction(t); setReversalModalOpen(true); }}
                                  title="Estornar transação"
                                >
                                  <RotateCcw className="size-3" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
            
          </div>

          {/* RODAPÉ FIXO */}
          <div className="bg-muted/50 p-6 border-t flex items-center justify-between shrink-0">
            <div className="flex gap-6 w-full text-sm">
              <div>
                <p className="text-muted-foreground mb-1">Impacto (Efetivo)</p>
                <p className="text-xl font-bold">{formatMoney(effectiveAmount)}</p>
              </div>
              <div className="border-l pl-6">
                <p className="text-muted-foreground mb-1">Status Futuro</p>
                {newInstallmentBalance > 0 ? (
                  <span className="inline-flex items-center gap-1 text-pending font-medium bg-pending/10 px-2 py-1 rounded-md text-xs">
                    <AlertTriangle className="size-3" /> Restará {formatMoney(newInstallmentBalance)}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-inflow font-medium bg-inflow/10 px-2 py-1 rounded-md text-xs">
                    <CheckCircle2 className="size-3" /> Será Quitada
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button className="rounded-full shadow-md" disabled={!canSave || pay.isPending} onClick={() => pay.mutate()}>
                Confirmar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <AccountDialog open={accountModalOpen} onOpenChange={setAccountModalOpen} onSuccess={(newId: string) => setAccountId(newId)} />
      
      {/* 🌟 A MÁGICA DA UX: O onSuccess do ReversalDialog fecha o modal pai! */}
      <TransactionReversalDialog 
        open={reversalModalOpen} 
        onOpenChange={setReversalModalOpen} 
        transaction={selectedTransaction}
        onSuccess={() => {
           setReversalModalOpen(false); // Fecha o modal de estorno
           onOpenChange(false); // Fecha o modal de pagamento (Pai) para forçar o clique novamente na tabela atualizada
        }}
      />
    </>
  );
}