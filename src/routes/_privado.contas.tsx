import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Banknote, Landmark, PiggyBank, TrendingUp, Wallet, History, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { ActiveBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

  // 🌟 ESTADOS DO MODAL DE EXTRATO
  const [statementOpen, setStatementOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<any>(null);

  const create = useMutation({
    mutationFn: () => {
      if (kind === "WALLET") {
        return api.createAccount({
          kind: "WALLET",
          name: name,
          initialValue: Number(balance) || 0
        });
      }

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

  const openStatement = (account: any) => {
    setSelectedAccount(account);
    setStatementOpen(true);
  };

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

      {/* 🌟 GRID DE CONTAS */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {(accounts.data ?? []).map((account) => {
          const meta = kindMeta[account.type as AccountKind] ?? {
            label: account.type,
            icon: Wallet,
            tone: "bg-muted text-muted-foreground",
          };
          const Icon = meta.icon;
          return (
            <article key={account.id} className="rounded-2xl border bg-card p-5 shadow-sm flex flex-col">
              <div className="flex items-start justify-between">
                <span className={`flex size-10 items-center justify-center rounded-xl ${meta.tone}`}>
                  <Icon className="size-5" />
                </span>
                <ActiveBadge active={account.status === "ACTIVE"} />
              </div>
              
              <div className="flex-1">
                <h2 className="mt-4 text-base font-bold">{account.name}</h2>
                <p className="text-xs text-muted-foreground">
                  {meta.label}
                  {account.bank ? ` · ${account.bank.name}` : ""}
                </p>
                <p className={`mt-3 text-2xl font-bold ${account.balance < 0 ? 'text-destructive' : 'text-foreground'}`}>
                  {formatMoney(account.balance)}
                </p>
                
                <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                  {account.agency ? <p>Ag. {account.agency} · Cc. {account.number}</p> : null}
                  {account.overdraftLimit ? <p>Cheque especial: {formatMoney(account.overdraftLimit)}</p> : null}
                  {account.yieldRate ? <p>Rendimento: {account.yieldRate}% a.a.</p> : null}
                </div>
              </div>

              {/* 🌟 BOTÕES DE AÇÃO DO CARD */}
              <div className="mt-5 flex gap-2 w-full pt-4 border-t">
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full rounded-full bg-secondary/50 hover:bg-secondary"
                  onClick={() => openStatement(account)}
                >
                  <History className="size-3 mr-2" /> Extrato
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full rounded-full"
                  onClick={() => toggle.mutate(account.id)}
                >
                  {account.status === "ACTIVE" ? "Inativar" : "Reativar"}
                </Button>
              </div>
            </article>
          );
        })}
      </div>

      {/* 🌟 MODAL DE EXTRATO (Histórico de Transações) */}
      <Dialog open={statementOpen} onOpenChange={setStatementOpen}>
        <DialogContent className="sm:max-w-2xl p-0 overflow-hidden max-h-[85vh] flex flex-col">
          <DialogHeader className="p-6 pb-4 border-b bg-muted/30 shrink-0">
            <DialogTitle className="flex items-center justify-between">
              <span>Extrato da Conta</span>
              <Badge variant="outline" className="text-sm font-normal">
                {selectedAccount?.name}
              </Badge>
            </DialogTitle>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Saldo Atual:</span>
              <span className={`text-xl font-bold ${selectedAccount?.balance < 0 ? 'text-destructive' : 'text-primary'}`}>
                {formatMoney(selectedAccount?.balance || 0)}
              </span>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            <Table>
              <TableHeader className="bg-muted/10 sticky top-0 backdrop-blur-md">
                <TableRow>
                  <TableHead className="w-[100px]">Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedAccount?.transactions && selectedAccount.transactions.length > 0 ? (
                  // Ordenando as transações da mais recente para a mais antiga
                  [...selectedAccount.transactions]
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .map((tx: any) => {
                      const isInflow = tx.movementDirection === "INFLOW";
                      
                      return (
                        <TableRow key={tx.id}>
                          <TableCell className="text-xs whitespace-nowrap">
                            {format(parseISO(tx.paymentDate), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {isInflow ? (
                                <ArrowDownCircle className="size-4 text-inflow shrink-0" />
                              ) : (
                                <ArrowUpCircle className="size-4 text-outflow shrink-0" />
                              )}
                              <div className="flex flex-col">
                                <span className="text-sm font-medium">
                                  {tx.observations || (tx.movementType === "REVERSAL" ? "Estorno" : "Transação")}
                                </span>
                                {tx.movementType === "REVERSAL" && (
                                  <span className="text-[10px] text-muted-foreground uppercase">Devolução</span>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className={`text-right font-bold ${isInflow ? "text-inflow" : "text-outflow"}`}>
                            {isInflow ? "+" : "-"}{formatMoney(tx.effectiveAmount)}
                          </TableCell>
                        </TableRow>
                      );
                    })
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="h-32 text-center text-muted-foreground">
                      <History className="size-8 mx-auto mb-2 opacity-20" />
                      Nenhuma movimentação registrada nesta conta.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          
          <DialogFooter className="p-4 border-t bg-muted/20 shrink-0">
            <Button variant="outline" className="w-full sm:w-auto rounded-full" onClick={() => setStatementOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}