import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, Landmark, PiggyBank, TrendingUp, Wallet, Plus } from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { banksQuery } from "@/lib/api/queries";
import { api } from "@/lib/api/store";
import type { AccountKind } from "@/lib/api/types";

// Usamos os mesmos ícones e labels do seu sistema original
const kindMeta: Record<AccountKind, { label: string; icon: any; tone: string }> = {
  CHECKING: { label: "Conta corrente", icon: Landmark, tone: "bg-primary/10 text-primary" },
  SAVINGS: { label: "Poupança", icon: PiggyBank, tone: "bg-inflow-soft text-inflow" },
  INVESTMENT: { label: "Investimento", icon: TrendingUp, tone: "bg-grape-soft text-grape" },
  PAYMENT: { label: "Conta pagamento", icon: Banknote, tone: "bg-pending-soft text-pending-foreground" },
  WALLET: { label: "Carteira", icon: Wallet, tone: "bg-outflow-soft text-outflow" },
};

export function AccountDialog({ open, onOpenChange, onSuccess }: any) {
  const queryClient = useQueryClient();
  const banks = useQuery(banksQuery);

  const [name, setName] = useState("");
  const [kind, setKind] = useState<AccountKind>("CHECKING");
  const [bankId, setBankId] = useState<string>("");
  const [balance, setBalance] = useState("0");
  const [overdraft, setOverdraft] = useState("0");

  // Limpa o form ao fechar o modal
  useEffect(() => {
    if (!open) {
      setName("");
      setKind("CHECKING");
      setBankId("");
      setBalance("0");
      setOverdraft("0");
    }
  }, [open]);

  const create = useMutation({
    mutationFn: () => {
      // 🌟 CORREÇÃO: Carteira manda os dados soltos na raiz, conforme o DTO do Java
      if (kind === "WALLET") {
        return api.createAccount({
          kind: "WALLET",
          name: name,
          initialValue: Number(balance) || 0
        });
      }

      // 🌟 Para os outros tipos, mantém o DTO complexo com baseAccount
      const defaultBase = {
        name,
        initialValue: Number(balance) || 0,
        bankId: bankId || undefined,
      };

      const payloadStrategy: Record<string, any> = {
        CHECKING: { kind, baseAccount: defaultBase, overdraftLimit: Number(overdraft) || 0 },
        SAVINGS: { kind, baseAccount: defaultBase },
        INVESTMENT: { kind, baseAccount: defaultBase },
        PAYMENT: { kind, baseAccount: defaultBase },
      };

      return api.createAccount(payloadStrategy[kind]);
    },
    onSuccess: (response: any) => {
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Conta criada com sucesso!");
      
      // Auto-seleciona a conta criada no select do modal de fatura (se a API retornar o ID)
      if (response && response.id) onSuccess?.(response.id); 
      
      onOpenChange(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="size-5" /> Nova Conta
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="acc-name">Apelido da conta</Label>
            <Input id="acc-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as AccountKind)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(kindMeta).map(([value, meta]) => (
                  <SelectItem key={value} value={value}>
                    <div className="flex items-center gap-2">
                      <meta.icon className="size-4 text-muted-foreground" />
                      {meta.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {kind !== "WALLET" ? (
            <div className="space-y-2">
              <Label>Banco</Label>
              <Select value={bankId} onValueChange={setBankId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(banks.data ?? []).map((b: any) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="acc-balance">Saldo inicial (R$)</Label>
              <Input id="acc-balance" type="number" step="0.01" value={balance} onChange={(e) => setBalance(e.target.value)} />
            </div>
            
            {kind === "CHECKING" ? (
              <div className="space-y-2">
                <Label htmlFor="acc-overdraft">Cheque especial</Label>
                <Input id="acc-overdraft" type="number" step="0.01" value={overdraft} onChange={(e) => setOverdraft(e.target.value)} />
              </div>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button className="rounded-full" disabled={!name || create.isPending || (kind !== "WALLET" && !bankId)} onClick={() => create.mutate()}>
            {create.isPending ? "Salvando..." : "Criar Conta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}