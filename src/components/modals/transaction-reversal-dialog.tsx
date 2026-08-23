import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { api } from "@/lib/api/store";
import { formatMoney } from "@/lib/format";

interface TransactionReversalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: any;
  onSuccess?: () => void;
}

export function TransactionReversalDialog({ open, onOpenChange, transaction, onSuccess }: TransactionReversalDialogProps) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) setReason(""); 
  }, [open]);

  const reverse = useMutation({
    mutationFn: () => api.reverseTransaction(transaction.id, { reason }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Estorno realizado com sucesso!");
      onSuccess?.();
      onOpenChange(false);
    },
    onError: (err: any) => toast.error(err.message || "Erro ao tentar estornar."),
  });

  if (!transaction) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <RotateCcw className="size-5" /> Confirmar Estorno
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg flex items-start gap-2">
            <AlertTriangle className="size-5 shrink-0 mt-0.5" />
            <p>
              Você está prestes a anular esta transação. O valor será devolvido ao saldo da parcela e o impacto na conta será revertido.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-xl border">
            <div>
              <Label className="text-[10px] uppercase text-muted-foreground">Data do Pagamento</Label>
              <p className="font-medium text-sm">{format(parseISO(transaction.paymentDate), 'dd/MM/yyyy')}</p>
            </div>
            <div className="text-right">
              <Label className="text-[10px] uppercase text-muted-foreground">Valor Efetivo (Total)</Label>
              <p className="font-bold text-lg text-primary">{formatMoney(transaction.effectiveAmount)}</p>
            </div>
            
            {(transaction.interest > 0 || transaction.fine > 0 || transaction.discount > 0) && (
              <div className="col-span-2 grid grid-cols-3 gap-2 border-t pt-2 mt-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Principal</Label>
                  <p className="text-xs font-semibold">{formatMoney(transaction.amount)}</p>
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Juros/Multa</Label>
                  <p className="text-xs">{formatMoney(transaction.interest + transaction.fine)}</p>
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Desconto</Label>
                  <p className="text-xs text-destructive">{formatMoney(transaction.discount)}</p>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            {/* 🌟 Removido o asterisco e adicionado "(Opcional)" */}
            <Label>Justificativa do Estorno <span className="text-muted-foreground font-normal">(Opcional)</span></Label>
            <Input 
              placeholder="Ex: Pagamento lançado a maior..." 
              value={reason} 
              onChange={(e) => setReason(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button 
            variant="destructive" 
            disabled={reverse.isPending} // 🌟 Removida a validação de quantidade de caracteres
            onClick={() => reverse.mutate()}
          >
            {reverse.isPending ? "Processando..." : "Confirmar Estorno"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}