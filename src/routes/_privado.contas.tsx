import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { format, parseISO } from "date-fns";
import {
  Banknote,
  Landmark,
  PiggyBank,
  TrendingUp,
  Wallet,
  History,
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowRightLeft,
  Info,
  Undo2,
  Settings2,
  AlertTriangle
} from "lucide-react";
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
import { formatMoney, todayIso } from "@/lib/format";
import { TransferDialog } from "@/components/modals/transfer-dialog";
import { cn } from "@/lib/utils";

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

  // Estados para Nova Conta
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<AccountKind>("CHECKING");
  const [bankId, setBankId] = useState<string>("");
  const [balance, setBalance] = useState("0");
  const [overdraft, setOverdraft] = useState("0");

  // Estados dos Modais
  const [transferModalOpen, setTransferModalOpen] = useState(false);

  // O Extrato agora usa apenas o ID para sempre buscar os dados frescos do React Query
  const [statementOpen, setStatementOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  // 🌟 CORREÇÃO DE TIPAGEM: Garante que ou acha a conta ou retorna null, acalmando o TS.
  const selectedAccount = selectedAccountId
    ? (accounts.data ?? []).find((a: any) => a.id === selectedAccountId) || null
    : null;

  // Estados do Ajuste Manual
  const [adjustmentModalOpen, setAdjustmentModalOpen] = useState(false);
  const [newBalance, setNewBalance] = useState("");
  const [adjustmentDate, setAdjustmentDate] = useState(todayIso());
  const [adjustmentReason, setAdjustmentReason] = useState("");

  const create = useMutation({
    mutationFn: () => {
      if (kind === "WALLET") {
        return api.createAccount({ kind: "WALLET", name: name, initialValue: Number(balance) || 0 });
      }
      const defaultBase = { name, initialValue: Number(balance) || 0, bankId: bankId || undefined };
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

  // Mutação do Ajuste Manual
  const adjustBalanceMutation = useMutation({
    mutationFn: (payload: any) => api.createManualAdjustments({ dto: [payload] }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Saldo ajustado com sucesso!");
      setAdjustmentModalOpen(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Mutação de Estorno
  const reverse = useMutation({
    mutationFn: (params: { id: string; reason: string }) =>
      api.reverseTransaction(params.id, { reason: params.reason }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Transação estornada com sucesso!");
    },
    onError: (err: any) => toast.error(err.message || "Falha ao estornar a transação"),
  });

  const openStatement = (id: string) => {
    setSelectedAccountId(id);
    setStatementOpen(true);
  };

  const openAdjustment = (account: any) => {
    setSelectedAccountId(account.id);
    setNewBalance(account.balance.toString());
    setAdjustmentDate(todayIso());
    setAdjustmentReason("Ajuste manual de saldo");
    setAdjustmentModalOpen(true);
  };

  // ==========================================
  // REGRAS DE VALIDAÇÃO DO AJUSTE MANUAL
  // ==========================================
  const currentBalance = selectedAccount?.balance || 0;
  const targetBalance = Number(newBalance) || 0;
  const diff = targetBalance - currentBalance;

  const isWallet = selectedAccount?.type === "WALLET";
  const isChecking = selectedAccount?.type === "CHECKING";
  const overdraftLimit = selectedAccount?.overdraftLimit || 0;

  let adjustmentError = "";
  if (isWallet && targetBalance < 0) {
    adjustmentError = "Carteiras físicas não podem ter saldo negativo.";
  } else if (isChecking && targetBalance < -overdraftLimit) {
    adjustmentError = `O saldo ultrapassa o limite do cheque especial (${formatMoney(overdraftLimit)}).`;
  } else if (!isChecking && !isWallet && targetBalance < 0) {
    adjustmentError = "Este tipo de conta não permite saldo negativo.";
  } else if (diff === 0 && newBalance !== "") {
    adjustmentError = "O novo saldo deve ser diferente do atual.";
  }

  const canAdjust = selectedAccount && newBalance !== "" && !adjustmentError && adjustmentDate;

  return (
    <>
      <PageHeader
        title="Suas contas"
        description="Onde o seu dinheiro está guardado hoje."
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" className="rounded-full bg-background" onClick={() => setTransferModalOpen(true)}>
              <ArrowRightLeft className="size-4 mr-2" /> Transferir
            </Button>

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
          </div>
        }
      />

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

              <div className="mt-5 grid grid-cols-3 gap-2 w-full pt-4 border-t">
                <Button variant="secondary" size="sm" className="rounded-lg bg-secondary/50 text-xs px-0" onClick={() => openStatement(account.id)}>
                  <History className="size-3 mr-1.5" /> Extrato
                </Button>
                <Button variant="outline" size="sm" className="rounded-lg text-xs px-0" onClick={() => openAdjustment(account)}>
                  <Settings2 className="size-3 mr-1.5" /> Ajustar
                </Button>
                <Button variant="ghost" size="sm" className="rounded-lg text-xs px-0" onClick={() => toggle.mutate(account.id)}>
                  {account.status === "ACTIVE" ? "Inativar" : "Reativar"}
                </Button>
              </div>
            </article>
          );
        })}
      </div>

      {/* MODAL DO EXTRATO */}
      <Dialog open={statementOpen} onOpenChange={(val) => { setStatementOpen(val); if (!val) setSelectedAccountId(null); }}>
        <DialogContent className="sm:max-w-4xl p-0 overflow-hidden max-h-[85vh] flex flex-col">
          <DialogHeader className="p-6 pb-4 border-b bg-muted/30 shrink-0">
            <DialogTitle className="flex items-center justify-between">
              <span>Extrato da Conta</span>
              <Badge variant="outline" className="text-sm font-normal">
                {selectedAccount?.name}
              </Badge>
            </DialogTitle>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Saldo Atual:</span>
              <span className={`text-xl font-bold ${(selectedAccount?.balance || 0) < 0 ? 'text-destructive' : 'text-primary'}`}>
                {formatMoney(selectedAccount?.balance || 0)}
              </span>
            </div>

            {(selectedAccount?.initialValue || 0) > 0 && (
              <div className="mt-3 flex items-start gap-2 bg-inflow/10 p-3 rounded-lg border border-inflow/30 text-xs text-foreground">
                <Info className="size-4 shrink-0 mt-0.5 text-inflow" />
                <p>O saldo atual reflete as transações abaixo, adicionadas ao <strong className="text-inflow">saldo inicial de {formatMoney(selectedAccount?.initialValue || 0)}</strong> informado na criação desta conta.</p>
              </div>
            )}
            {(selectedAccount?.initialValue || 0) < 0 && (
              <div className="mt-3 flex items-start gap-2 bg-destructive/10 p-3 rounded-lg border border-destructive/30 text-xs text-foreground">
                <Info className="size-4 shrink-0 mt-0.5 text-destructive" />
                <p>Atenção: O saldo atual está calculado a partir de um <strong className="text-destructive">saldo inicial negativo de {formatMoney(selectedAccount?.initialValue || 0)}</strong> informado na criação desta conta.</p>
              </div>
            )}
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            <Table>
              <TableHeader className="bg-muted/10 sticky top-0 backdrop-blur-md z-10">
                <TableRow>
                  <TableHead className="w-[100px] h-8 text-xs">Data</TableHead>
                  <TableHead className="h-8 text-xs">Descrição</TableHead>
                  <TableHead className="text-right h-8 text-xs">Valor</TableHead>
                  <TableHead className="text-center w-[100px] h-8 text-xs">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(selectedAccount?.transactions?.length ?? 0) > 0 ? (
                  [...(selectedAccount?.transactions || [])]
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .map((tx: any) => {
                      const isInflow = tx.movementDirection === "INFLOW";
                      const isReversal = tx.movementType === "REVERSAL";

                      const availableBalance = (selectedAccount?.balance || 0) + (selectedAccount?.type === "CHECKING" ? (selectedAccount?.overdraftLimit || 0) : 0);
                      const blocksReversalDueToFunds = isInflow && tx.effectiveAmount > availableBalance;

                      return (
                        <TableRow key={tx.id} className={isReversal ? "bg-muted/10 opacity-80" : ""}>
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
                                  {tx.observations || (isReversal ? "Estorno" : "Transação")}
                                </span>
                                {isReversal && (
                                  <span className="text-[10px] text-muted-foreground uppercase">Devolução</span>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className={`text-right font-bold ${isInflow ? "text-inflow" : "text-outflow"}`}>
                            {isInflow ? "+" : "-"}{formatMoney(tx.effectiveAmount)}
                          </TableCell>
                          <TableCell className="text-center">
                            {!isReversal && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className={cn(
                                  "rounded-full text-xs h-7",
                                  tx.reversed || blocksReversalDueToFunds
                                    ? "text-muted-foreground opacity-50 cursor-not-allowed"
                                    : "hover:text-destructive hover:bg-destructive/10"
                                )}
                                disabled={tx.reversed || reverse.isPending || blocksReversalDueToFunds}
                                onClick={() => {
                                  if (window.confirm("Deseja realmente estornar esta transação?")) {
                                    reverse.mutate({ id: tx.id, reason: "Estorno via extrato" });
                                  }
                                }}
                                title={blocksReversalDueToFunds ? "Saldo insuficiente para estornar esta entrada." : "Estornar"}
                              >
                                {tx.reversed ? "Estornada" : blocksReversalDueToFunds ? "Sem Saldo" : (
                                  <><Undo2 className="size-3 mr-1" /> Estornar</>
                                )}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                      <History className="size-8 mx-auto mb-2 opacity-20" />
                      Nenhuma movimentação registrada.
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

      {/* MODAL DE AJUSTE MANUAL */}
      <Dialog open={adjustmentModalOpen} onOpenChange={(val) => { setAdjustmentModalOpen(val); if (!val) { setNewBalance(""); setAdjustmentReason(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="size-5 text-primary" /> Ajuste Manual de Saldo
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-3 bg-muted/20 border rounded-lg flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1"><Wallet className="size-4" /> Saldo Atual:</span>
              <span className="font-bold text-lg">{formatMoney(currentBalance)}</span>
            </div>

            <div className="grid gap-4">
              <div className="space-y-2">
                <Label>Defina o Novo Saldo Exato (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={newBalance}
                  onChange={(e) => setNewBalance(e.target.value)}
                  className={adjustmentError ? "border-destructive text-destructive" : ""}
                />
                {adjustmentError && (
                  <p className="text-[10px] text-destructive flex items-center gap-1 mt-1">
                    <AlertTriangle className="size-3" /> {adjustmentError}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Data do Ajuste</Label>
                <Input type="date" value={adjustmentDate} onChange={(e) => setAdjustmentDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Motivo (Opcional)</Label>
                <Input placeholder="Ex: Correção de lançamento esquecido" value={adjustmentReason} onChange={(e) => setAdjustmentReason(e.target.value)} />
              </div>
            </div>

            {newBalance !== "" && !adjustmentError && diff !== 0 && (
              <div className={`p-3 rounded-lg border flex items-center justify-between text-sm mt-2 ${diff > 0 ? 'bg-inflow/10 border-inflow/20 text-inflow' : 'bg-outflow/10 border-outflow/20 text-outflow'}`}>
                <span className="font-semibold text-xs uppercase tracking-wider">Impacto do Ajuste:</span>
                <span className="font-bold">{diff > 0 ? "+" : ""}{formatMoney(diff)}</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setAdjustmentModalOpen(false)}>Cancelar</Button>
            <Button
              disabled={!canAdjust || adjustBalanceMutation.isPending}
              onClick={() => {
                if (!selectedAccount) return; // 🌟 Trava que garante para o TypeScript que a conta existe

                adjustBalanceMutation.mutate({
                  accountId: selectedAccount.id,
                  paymentInstrumentId: null,
                  paymentDate: adjustmentDate,
                  amount: Math.abs(diff),
                  direction: diff >= 0 ? "INFLOW" : "OUTFLOW",
                  reason: adjustmentReason || "Ajuste de saldo manual"
                });
              }}
            >
              {adjustBalanceMutation.isPending ? "Ajustando..." : "Confirmar Ajuste"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TransferDialog open={transferModalOpen} onOpenChange={setTransferModalOpen} />
    </>
  );
}