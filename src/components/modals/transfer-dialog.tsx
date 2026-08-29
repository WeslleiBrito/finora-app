import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft, Wallet, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { accountsQuery } from "@/lib/api/queries";
import { api } from "@/lib/api/store";
import { formatMoney, todayIso } from "@/lib/format";

interface TransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TransferDialog({ open, onOpenChange }: TransferDialogProps) {
  const queryClient = useQueryClient();
  const accounts = useQuery(accountsQuery);

  const [sourceAccountId, setSourceAccountId] = useState("");
  const [destinationAccountId, setDestinationAccountId] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [transferDate, setTransferDate] = useState(todayIso());
  const [observations, setObservations] = useState("");

  const resetForm = () => {
    setSourceAccountId("");
    setDestinationAccountId("");
    setAmount("");
    setTransferDate(todayIso());
    setObservations("");
  };

  const transfer = useMutation({
    mutationFn: () => api.transferAccounts({
      sourceAccountId,
      destinationAccountId,
      amount: Number(amount),
      transferDate,
      observations
    }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Transferência realizada com sucesso!");
      onOpenChange(false);
      resetForm();
    },
    onError: (err: any) => toast.error(err.message || "Erro ao transferir"),
  });

  // 🌟 Lógicas de Validação em Tempo Real
  const sourceAcc = (accounts.data ?? []).find((a: any) => a.id === sourceAccountId);
  
  // 🌟 REGRA CORRIGIDA: Limite de Cheque Especial só entra na soma se for Conta Corrente
  const availableBalance = (sourceAcc?.balance || 0) + (sourceAcc?.type === "CHECKING" ? (sourceAcc?.overdraftLimit || 0) : 0);
  
  const isSameAccount = sourceAccountId && destinationAccountId && sourceAccountId === destinationAccountId;
  const isAmountInvalid = Number(amount) > availableBalance;
  
  const canSave = sourceAccountId && destinationAccountId && !isSameAccount && Number(amount) > 0 && !isAmountInvalid && transferDate;

  return (
    <Dialog open={open} onOpenChange={(val) => { onOpenChange(val); if (!val) resetForm(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="size-5 text-primary" /> Transferir entre Contas
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* CONTA DE ORIGEM */}
          <div className="space-y-2 p-3 bg-muted/20 border rounded-lg">
            <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1">
              <ArrowRightLeft className="size-3 text-outflow" /> De (Origem)
            </Label>
            <Select value={sourceAccountId} onValueChange={setSourceAccountId}>
              <SelectTrigger><SelectValue placeholder="Selecione de onde o dinheiro vai sair" /></SelectTrigger>
              <SelectContent>
                {(accounts.data ?? []).map((a: any) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {sourceAcc && (
              <div className="flex justify-between items-center text-xs mt-2 px-1">
                <span className="text-muted-foreground flex items-center gap-1"><Wallet className="size-3"/> Saldo disponível:</span>
                <span className={`font-semibold ${isAmountInvalid ? 'text-destructive' : 'text-primary'}`}>
                  {formatMoney(availableBalance)}
                </span>
              </div>
            )}
          </div>

          {/* CONTA DE DESTINO */}
          <div className="space-y-2 p-3 bg-muted/20 border rounded-lg">
            <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1">
              <ArrowRightLeft className="size-3 text-inflow" /> Para (Destino)
            </Label>
            <Select value={destinationAccountId} onValueChange={setDestinationAccountId}>
              <SelectTrigger className={isSameAccount ? "border-destructive text-destructive" : ""}>
                <SelectValue placeholder="Selecione para onde o dinheiro vai" />
              </SelectTrigger>
              <SelectContent>
                {(accounts.data ?? []).map((a: any) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isSameAccount && (
              <p className="text-[10px] text-destructive flex items-center gap-1 mt-1">
                <AlertTriangle className="size-3" /> A conta de destino não pode ser a mesma de origem.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input 
                type="number" 
                step="0.01" 
                placeholder="0.00" 
                value={amount} 
                onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : "")} 
                className={isAmountInvalid ? "border-destructive text-destructive font-bold" : "font-bold text-lg"}
              />
              {isAmountInvalid && (
                <p className="text-[10px] text-destructive flex items-center gap-1 mt-1">
                  <AlertTriangle className="size-3" /> Saldo insuficiente.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observação (Opcional)</Label>
            <Input placeholder="Ex: Depósito do caixa na conta bancária" value={observations} onChange={(e) => setObservations(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!canSave || transfer.isPending} onClick={() => transfer.mutate()}>
            {transfer.isPending ? "Transferindo..." : "Confirmar Transferência"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}