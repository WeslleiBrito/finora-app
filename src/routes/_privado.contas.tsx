import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Banknote, Landmark, PiggyBank, TrendingUp, Wallet } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { ActiveBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { accountsQuery, banksQuery } from "@/lib/api/queries";
import { api } from "@/lib/api/store";
import type { AccountKind } from "@/lib/api/types";
import { formatMoney } from "@/lib/format";

export const Route = createFileRoute("/_privado/contas")({
  head: () => ({
    meta: [
      { title: "Contas — Poupi" },
      { name: "description", content: "Gerencie contas corrente, poupança, investimento, pagamento e carteira." },
      { property: "og:title", content: "Contas — Poupi" },
      { property: "og:description", content: "Gerencie contas corrente, poupança, investimento e carteira." },
    ],
  }),
  component: AccountsPage,
});

const kindMeta: Record<AccountKind, { label: string; icon: typeof Wallet; tone: string }> = {
  CHECKING: { label: "Conta corrente", icon: Landmark, tone: "bg-primary/10 text-primary" },
  SAVINGS: { label: "Poupança", icon: PiggyBank, tone: "bg-inflow-soft text-inflow" },
  INVESTMENT: { label: "Investimento", icon: TrendingUp, tone: "bg-grape-soft text-grape" },
  PAYMENT: { label: "Conta pagamento", icon: Banknote, tone: "bg-pending-soft text-pending-foreground" },
  WALLET: { label: "Carteira", icon: Wallet, tone: "bg-outflow-soft text-outflow" },
};

function AccountsPage() {
  const accounts = useQuery(accountsQuery);
  const banks = useQuery(banksQuery);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<AccountKind>("CHECKING");
  const [bankId, setBankId] = useState<string>("");
  const [balance, setBalance] = useState("0");
  const [overdraft, setOverdraft] = useState("0");

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
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Conta criada");
      setOpen(false);
      setName("");
      setBalance("0");
      setBankId("");
      setOverdraft("0");
    },
  });

  const toggle = useMutation({
    mutationFn: (id: string) => api.toggleAccountStatus(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Status atualizado");
    },
  });

  return (
    <>
      <PageHeader
        title="Suas contas"
        description="Onde o seu dinheiro está guardado hoje."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-full">Nova conta</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova conta</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="acc-name">Apelido da conta</Label>
                  <Input id="acc-name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={kind} onValueChange={(v) => setKind(v as AccountKind)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(kindMeta).map(([value, meta]) => (
                        <SelectItem key={value} value={value}>
                          {meta.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {kind !== "WALLET" ? (
                  <div className="space-y-2">
                    <Label>Banco</Label>
                    <Select value={bankId} onValueChange={setBankId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {(banks.data ?? []).map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="acc-balance">Saldo inicial</Label>
                    <Input
                      id="acc-balance"
                      type="number"
                      step="0.01"
                      value={balance}
                      onChange={(e) => setBalance(e.target.value)}
                    />
                  </div>
                  {kind === "CHECKING" ? (
                    <div className="space-y-2">
                      <Label htmlFor="acc-overdraft">Cheque especial</Label>
                      <Input
                        id="acc-overdraft"
                        type="number"
                        step="0.01"
                        value={overdraft}
                        onChange={(e) => setOverdraft(e.target.value)}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
              <DialogFooter>
                <Button
                  className="rounded-full"
                  disabled={!name || create.isPending}
                  onClick={() => create.mutate()}
                >
                  Criar conta
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {(accounts.data ?? []).map((account) => {
          const meta = kindMeta[account.type] ?? {
            label: account.type,
            icon: Wallet,
            tone: "bg-muted text-muted-foreground",
          };
          const Icon = meta.icon;
          return (
            <article key={account.id} className="rounded-2xl border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <span className={`flex size-10 items-center justify-center rounded-xl ${meta.tone}`}>
                  <Icon className="size-5" />
                </span>
                <ActiveBadge active={account.status === "ACTIVE"} />
              </div>
              <h2 className="mt-4 text-base font-bold">{account.name}</h2>
              <p className="text-xs text-muted-foreground">
                {meta.label}
                {account.bank ? ` · ${account.bank.name}` : ""}
              </p>
              <p className="text-money mt-3 text-2xl font-bold">{formatMoney(account.balance)}</p>
              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                {account.agency ? <p>Ag. {account.agency} · Cc. {account.number}</p> : null}
                {account.overdraftLimit ? <p>Cheque especial: {formatMoney(account.overdraftLimit)}</p> : null}
                {account.yieldRate ? <p>Rendimento: {account.yieldRate}% a.a.</p> : null}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-4 w-full rounded-full"
                onClick={() => toggle.mutate(account.id)}
              >
                {account.status === "ACTIVE" ? "Inativar" : "Reativar"}
              </Button>
            </article>
          );
        })}
      </div>
    </>
  );
}
