import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit3, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { accountsQuery, paymentInstrumentsQuery } from "@/lib/api/queries";
import { api } from "@/lib/api/store";
import { formatMoney } from "@/lib/format";

interface EditInstallmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  installment: any;
}

export function EditInstallmentDialog({ open, onOpenChange, installment }: EditInstallmentDialogProps) {
  const queryClient = useQueryClient();
  const accounts = useQuery(accountsQuery);
  const instruments = useQuery(paymentInstrumentsQuery);

  const [amount, setAmount] = useState<number | "">("");
  const [dueDate, setDueDate] = useState("");
  const [accountId, setAccountId] = useState("");
  const [instrumentId, setInstrumentId] = useState("");

  // Carrega os dados da parcela ao abrir
  useEffect(() => {
    if (open && installment) {
      setAmount(installment.amount);
      setDueDate(installment.dueDate);
      setAccountId(installment.accountId || "");
      setInstrumentId(installment.paymentInstrumentId || "");
    }
  }, [open, installment]);

  // Cálculos de Trava
  const amortized = (installment?.totalPaid || 0) + (installment?.totalDiscount || 0);
  const isAmountInvalid = Number(amount) < amortized;

  // Lógica de Instrumentos (Mesma regra inteligente de sempre)
  const selectedAccount = (accounts.data ?? []).find((a: any) => a.id === accountId);
  const isWallet = selectedAccount?.type === "WALLET";
  
  const validInstruments = (instruments.data ?? []).filter((i: any) => {
    if (i.instrumentNature !== "PAYMENT") return false;
    if (isWallet) return i.paymentType === "CASH";
    return i.paymentType !== "CASH";
  });

  const update = useMutation({
    mutationFn: () => api.updateInstallment(installment.id, {
      amount: Number(amount),
      dueDate,
      accountId,
      ...(instrumentId ? { paymentInstrumentId: instrumentId } : {})
    }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Parcela atualizada com sucesso!");
      onOpenChange(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  if (!installment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit3 className="size-5 text-primary" /> Editar Parcela {installment.parcelNumber}ª
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Valor da Parcela (R$)</Label>
            <Input 
              type="number" 
              step="0.01" 
              value={amount} 
              onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : "")} 
              className={isAmountInvalid ? "border-destructive text-destructive" : ""}
            />
            {isAmountInvalid && (
              <p className="text-[10px] text-destructive flex items-center gap-1">
                <AlertTriangle className="size-3" /> O valor não pode ser menor que o já amortizado ({formatMoney(amortized)}).
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Vencimento</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Conta Provisão</Label>
            <Select value={accountId} onValueChange={(val) => { setAccountId(val); setInstrumentId(""); }}>
              <SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
              <SelectContent>
                {(accounts.data ?? []).map((a: any) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Forma de Pagamento (Opcional)</Label>
            <Select value={instrumentId} onValueChange={setInstrumentId} disabled={!accountId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {validInstruments.map((i: any) => (
                  <SelectItem key={i.id} value={i.id}>{i.cardHolderName || i.paymentType}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={isAmountInvalid || !amount || !dueDate || !accountId || update.isPending} onClick={() => update.mutate()}>
            {update.isPending ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}