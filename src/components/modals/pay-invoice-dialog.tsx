import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ReceiptText, AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

import { accountsQuery, paymentInstrumentsQuery } from "@/lib/api/queries";
import { api } from "@/lib/api/store";
import { formatMoney, todayIso } from "@/lib/format";
import { cn } from "@/lib/utils";

interface PayInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  monthStr: string;
  monthName: string;
  openInstallments: any[];
  paymentInstrumentId: string;
}

export function PayInvoiceDialog({
  open,
  onOpenChange,
  monthStr,
  monthName,
  openInstallments,
}: PayInvoiceDialogProps) {
  const queryClient = useQueryClient();
  const accounts = useQuery(accountsQuery);
  const paymentInstruments = useQuery(paymentInstrumentsQuery);

  const totalPending = useMemo(() => {
    return openInstallments.reduce((sum, inst) => sum + (inst.amount - (inst.totalPaid || 0)), 0);
  }, [openInstallments]);

  const [paymentAmountStr, setPaymentAmountStr] = useState("");
  const [interestStr, setInterestStr] = useState("0");
  const [fineStr, setFineStr] = useState("0");
  const [discountStr, setDiscountStr] = useState("0");
  const [accountId, setAccountId] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayIso());
  
  // 🌟 NOVO ESTADO: Forma de efetivação da transação (PIX, TED, etc)
  const [executionInstrumentId, setExecutionInstrumentId] = useState<string>("NONE");

  useEffect(() => {
    if (open) {
      setPaymentAmountStr(totalPending.toFixed(2));
      setInterestStr("0");
      setFineStr("0");
      setDiscountStr("0");
      setPaymentDate(todayIso());
      setAccountId("");
      setExecutionInstrumentId("NONE");
    }
  }, [open, totalPending]);

  const paymentAmount = Number(paymentAmountStr) || 0;
  const interest = Number(interestStr) || 0;
  const fine = Number(fineStr) || 0;
  const discount = Number(discountStr) || 0;

  // O MOTOR DO RATEIO (Cascata)
  const cascadeSimulation = useMemo(() => {
    let remainingMoneyToDistribute = paymentAmount;
    
    const activeInstallments = [...openInstallments]
        .filter(inst => (inst.amount - (inst.totalPaid || 0)) > 0)
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    const result = activeInstallments.map(inst => {
      const pendingOnThisInst = inst.amount - (inst.totalPaid || 0);
      let appliedPrincipal = 0;

      if (remainingMoneyToDistribute > 0) {
        if (remainingMoneyToDistribute >= pendingOnThisInst) {
          appliedPrincipal = pendingOnThisInst;
          remainingMoneyToDistribute -= pendingOnThisInst;
        } else {
          appliedPrincipal = remainingMoneyToDistribute;
          remainingMoneyToDistribute = 0;
        }
      }

      const stillPending = pendingOnThisInst - appliedPrincipal;
      const status = stillPending <= 0.01 ? "QUITADA" : appliedPrincipal > 0 ? "PARCIAL" : "AGUARDANDO";

      return {
        ...inst,
        pendingBefore: pendingOnThisInst,
        appliedPrincipal,
        stillPending,
        status,
      };
    });

    const affectedCount = result.filter(r => r.appliedPrincipal > 0).length;

    if (affectedCount > 0) {
        let remainingInterest = interest;
        let remainingFine = fine;
        let remainingDiscount = discount;

        const baseInterest = Number((interest / affectedCount).toFixed(2));
        const baseFine = Number((fine / affectedCount).toFixed(2));
        const baseDiscount = Number((discount / affectedCount).toFixed(2));

        for (let i = 0; i < result.length; i++) {
            if (result[i].appliedPrincipal > 0) {
                result[i].appliedInterest = baseInterest;
                result[i].appliedFine = baseFine;
                result[i].appliedDiscount = baseDiscount;
                
                remainingInterest -= baseInterest;
                remainingFine -= baseFine;
                remainingDiscount -= baseDiscount;
            } else {
                result[i].appliedInterest = 0;
                result[i].appliedFine = 0;
                result[i].appliedDiscount = 0;
            }
        }
        
        for (let i = result.length - 1; i >= 0; i--) {
            if (result[i].appliedPrincipal > 0) {
                 result[i].appliedInterest += remainingInterest;
                 result[i].appliedFine += remainingFine;
                 result[i].appliedDiscount += remainingDiscount;
                 break;
            }
        }
    } else {
        result.forEach(r => { r.appliedInterest = 0; r.appliedFine = 0; r.appliedDiscount = 0; });
    }

    return { details: result, leftoverMoney: remainingMoneyToDistribute };
  }, [openInstallments, paymentAmount, interest, fine, discount]);

  const payMutation = useMutation({
    mutationFn: (transactionsPayload: any[]) => api.createTransaction({ transactions: transactionsPayload }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      void queryClient.invalidateQueries({ queryKey: ["credit-cards"] });
      toast.success("Fatura baixada com sucesso!");
      onOpenChange(false);
    },
    onError: (err: any) => toast.error(err.message || "Erro ao processar pagamento"),
  });

  const handleConfirm = () => {
    if (!accountId) {
        toast.error("Selecione a conta de saída.");
        return;
    }

    const affected = cascadeSimulation.details.filter(d => d.appliedPrincipal > 0);
    
    if (affected.length === 0) {
        toast.error("O valor informado não afeta nenhuma parcela.");
        return;
    }

    const payload = affected.map(item => ({
        installmentId: item.id,
        accountId: accountId,
        // 🌟 CORREÇÃO DE REGRA DE NEGÓCIO: Aqui enviamos o instrumento de pagamento real (Ex: PIX), e não o Cartão!
        paymentInstrumentId: executionInstrumentId === "NONE" ? null : executionInstrumentId,
        paymentDate: paymentDate,
        amount: item.appliedPrincipal,
        interest: Math.max(0, item.appliedInterest),
        fine: Math.max(0, item.appliedFine),
        discount: Math.max(0, item.appliedDiscount),
        observations: `Pagamento de Fatura (${monthStr})`
    }));

    payMutation.mutate(payload);
  };

  const isPartialPayment = paymentAmount > 0 && paymentAmount < totalPending;
  const hasLeftover = cascadeSimulation.leftoverMoney > 0;
  const canSubmit = paymentAmount > 0 && accountId && !hasLeftover;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl p-0 overflow-hidden flex flex-col max-h-[90vh]">
        
        <DialogHeader className="p-6 pb-4 border-b bg-muted/30 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <ReceiptText className="size-5 text-primary" /> Baixar Fatura de {monthName}
          </DialogTitle>
          <div className="mt-4 flex bg-background border rounded-lg overflow-hidden divide-x">
             <div className="p-3 flex-1 flex justify-between items-center bg-muted/10">
                 <span className="text-sm font-medium text-muted-foreground">Total Pendente</span>
                 <span className="text-lg font-bold">{formatMoney(totalPending)}</span>
             </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 grid gap-6 lg:grid-cols-2">
            
            <div className="space-y-6">
                <div className="space-y-4 p-4 rounded-xl border bg-card shadow-sm">
                    <div className="space-y-2">
                        <Label className="text-sm font-bold flex items-center justify-between">
                            Valor Pago (R$) 
                            {isPartialPayment && <Badge variant="secondary" className="text-[10px] bg-pending/20 text-pending-foreground">Pagamento Parcial</Badge>}
                        </Label>
                        <Input 
                            type="number" step="0.01" 
                            className="text-lg font-bold h-12"
                            value={paymentAmountStr} 
                            onChange={(e) => setPaymentAmountStr(e.target.value)} 
                        />
                        {hasLeftover && (
                            <p className="text-[10px] text-destructive flex items-center gap-1">
                                <AlertTriangle className="size-3" /> Sobraram {formatMoney(cascadeSimulation.leftoverMoney)} sem destino. Valor excede a fatura.
                            </p>
                        )}
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                            <Label className="text-xs">Juros (R$)</Label>
                            <Input type="number" step="0.01" className="h-9 text-sm" value={interestStr} onChange={e => setInterestStr(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Multa (R$)</Label>
                            <Input type="number" step="0.01" className="h-9 text-sm" value={fineStr} onChange={e => setFineStr(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Desc. (R$)</Label>
                            <Input type="number" step="0.01" className="h-9 text-sm" value={discountStr} onChange={e => setDiscountStr(e.target.value)} />
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Data do Pagamento</Label>
                            <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Conta de Saída</Label>
                            <Select value={accountId} onValueChange={setAccountId}>
                                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                <SelectContent>
                                    {(accounts.data ?? [])
                                        .filter((a: any) => a.status === "ACTIVE")
                                        .map((a: any) => (
                                            <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* 🌟 NOVO CAMPO: Forma de Pagamento filtrada apenas por Instrumentos de Pagamento */}
                    <div className="space-y-2">
                        <Label>Forma de Efetivação (Opcional)</Label>
                        <Select value={executionInstrumentId} onValueChange={setExecutionInstrumentId}>
                            <SelectTrigger><SelectValue placeholder="Selecione a forma" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="NONE">Débito direto em conta</SelectItem>
                                {(paymentInstruments.data ?? [])
                                    .filter((p: any) => p.status === "ACTIVE" && p.instrumentNature === "PAYMENT")
                                    .map((p: any) => (
                                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* 🌟 CORREÇÃO DE CSS: Trocado para container nativo com altura máxima travada e overflow ajustado */}
            <div className="flex flex-col border rounded-xl bg-muted/10 overflow-hidden h-[500px]">
                <div className="p-4 border-b bg-muted/30 font-semibold text-sm flex items-center justify-between shrink-0">
                    Simulação de Distribuição
                    <span className="text-xs font-normal text-muted-foreground">{openInstallments.length} compras na fatura</span>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {cascadeSimulation.details.map((inst, idx) => (
                        <div key={idx} className={cn(
                            "p-3 rounded-lg border text-sm flex flex-col gap-2 transition-colors",
                            inst.status === "QUITADA" ? "bg-inflow/10 border-inflow/20" : 
                            inst.status === "PARCIAL" ? "bg-pending/10 border-pending/20" : "bg-card opacity-50"
                        )}>
                            <div className="flex justify-between items-start font-medium">
                                <span className="truncate pr-4">{inst.invoiceData?.person?.name || "Desconhecido"}</span>
                                <span className="shrink-0">{formatMoney(inst.pendingBefore)}</span>
                            </div>
                            
                            {inst.appliedPrincipal > 0 ? (
                                <div className="flex justify-between items-center text-xs mt-1 pt-2 border-t border-black/5 dark:border-white/5">
                                    <div className="flex items-center gap-1 text-muted-foreground truncate">
                                        <ArrowRight className="size-3 shrink-0" /> 
                                        <span className="truncate">Rateio: {formatMoney(inst.appliedPrincipal)}</span>
                                        {(inst.appliedInterest > 0 || inst.appliedFine > 0) && <span className="shrink-0 font-medium text-destructive">(+ Encargos)</span>}
                                        {inst.appliedDiscount > 0 && <span className="shrink-0 font-medium text-inflow">(- Desc)</span>}
                                    </div>
                                    {inst.status === "QUITADA" ? (
                                        <span className="text-inflow flex items-center gap-1 font-bold shrink-0 ml-2"><CheckCircle2 className="size-3"/> Quitada</span>
                                    ) : (
                                        <span className="text-pending-foreground font-bold shrink-0 ml-2">Falta {formatMoney(inst.stillPending)}</span>
                                    )}
                                </div>
                            ) : (
                                <div className="text-xs text-muted-foreground mt-1">Aguardando recursos...</div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>

        <DialogFooter className="p-4 border-t bg-muted/20 shrink-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button 
            disabled={!canSubmit || payMutation.isPending} 
            onClick={handleConfirm}
            className={cn(isPartialPayment && "bg-pending hover:bg-pending/90 text-pending-foreground")}
          >
            {payMutation.isPending ? "Processando..." : isPartialPayment ? "Confirmar Pagamento Parcial" : "Baixar Fatura Integral"}
          </Button>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}