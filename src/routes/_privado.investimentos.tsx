import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { TrendingUp, PiggyBank, Landmark, Plus, ArrowDownRight, ArrowUpRight, History } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { SummaryCard } from "@/components/app/summary-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { accountsQuery, investmentDashboardsQuery } from "@/lib/api/queries";
import { api } from "@/lib/api/store";
import { formatMoney, parseLocalDate, todayIso } from "@/lib/format";
import { format } from "date-fns";

export const Route = createFileRoute("/_privado/investimentos")({
  head: () => ({
    meta: [
      { title: "Investimentos   Poupi" },
      { name: "description", content: "Acompanhe seus rendimentos de Renda Fixa e CDI." },
    ],
  }),
  component: InvestmentsPage,
});

function InvestmentsPage() {
  const queryClient = useQueryClient();
  const accountsRes = useQuery(accountsQuery);
  const accounts = accountsRes.data ?? [];
  
  // Filtro de conta para buscar as sacolas
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");

  const { data: dashboards, isLoading } = useQuery(investmentDashboardsQuery(selectedAccountId));

  // Estados dos Modais
  const [apportModalOpen, setApportModalOpen] = useState(false);
  const [rescueModalOpen, setRescueModalOpen] = useState(false);
  const [statementModalOpen, setStatementModalOpen] = useState(false);
  const [selectedInvestment, setSelectedInvestment] = useState<any>(null);

  // Formulário de Aporte
  const [name, setName] = useState("");
  const [type, setType] = useState("CDB");
  const [indexer, setIndexer] = useState("CDI");
  const [contractedRate, setContractedRate] = useState("100");
  const [amount, setAmount] = useState("");
  const [maturityDate, setMaturityDate] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(todayIso());

  // Formulário de Resgate
  const [rescueAmount, setRescueAmount] = useState("");

  const globalPrincipal = useMemo(() => (dashboards ?? []).reduce((acc, inv) => acc + inv.totalPrincipal, 0), [dashboards]);
  const globalBalance = useMemo(() => (dashboards ?? []).reduce((acc, inv) => acc + inv.netBalance, 0), [dashboards]);
  const globalProfit = globalBalance - globalPrincipal;

  const apportMutation = useMutation({
    mutationFn: () => api.createApport({
      accountId: selectedAccountId,
      type,
      name,
      indexer,
      contractedRate: Number(contractedRate),
      amount: Number(amount),
      maturityDate: maturityDate || null,
      purchaseDate
    }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["investments", selectedAccountId] });
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Aporte realizado com sucesso!");
      setApportModalOpen(false);
      setName(""); setAmount(""); setMaturityDate("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const rescueMutation = useMutation({
    mutationFn: () => api.executeRescue({
      fixedIncomeId: selectedInvestment?.id,
      rescueAmount: Number(rescueAmount),
      rescueDate: todayIso(),
      accountId: selectedAccountId
    }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["investments", selectedAccountId] });
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Resgate creditado na conta com sucesso!");
      setRescueModalOpen(false);
      setRescueAmount("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="space-y-6 pb-12">
      <PageHeader 
        title="Renda Fixa" 
        description="O dinheiro trabalhando por você com cálculos automáticos de IR e IOF."
        action={
          <Button 
            className="rounded-full bg-primary" 
            disabled={!selectedAccountId}
            onClick={() => setApportModalOpen(true)}
          >
            <Plus className="mr-2 size-4" /> Novo Aporte
          </Button>
        }
      />

      <div className="flex items-center gap-4 bg-muted/20 p-4 rounded-xl border">
        <Label className="text-sm font-semibold whitespace-nowrap">Exibir custódia da conta:</Label>
        <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
          <SelectTrigger className="w-[300px] bg-background">
            <SelectValue placeholder="Selecione uma conta..." />
          </SelectTrigger>
          <SelectContent>
            {accounts.filter(a => a.type !== "WALLET").map((a: any) => (
              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedAccountId ? (
        <div className="py-12 text-center text-muted-foreground border-2 border-dashed rounded-xl bg-muted/5">
          Selecione uma conta acima para visualizar seus investimentos.
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <SummaryCard label="Total Investido" value={formatMoney(globalPrincipal)} icon={<Landmark className="size-5" />} />
            <SummaryCard label="Saldo Líquido Atual" value={formatMoney(globalBalance)} tone="inflow" icon={<PiggyBank className="size-5" />} />
            <SummaryCard label="Lucro Acumulado" value={formatMoney(globalProfit)} tone="inflow" icon={<TrendingUp className="size-5" />} />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {isLoading ? (
              <div className="col-span-full py-8 text-center">Carregando carteira...</div>
            ) : (dashboards ?? []).length === 0 ? (
              <div className="col-span-full py-12 text-center text-muted-foreground border-2 border-dashed rounded-xl">
                Nenhuma aplicação ativa nesta conta.
              </div>
            ) : (
              (dashboards ?? []).map((inv: any) => (
                <article key={inv.id} className="rounded-2xl border bg-card p-5 shadow-sm hover:border-primary/50 transition-colors flex flex-col">
                  <div className="flex justify-between items-start">
                    <div>
                      <Badge variant="secondary" className="mb-2">{inv.type}</Badge>
                      <h3 className="font-bold text-lg leading-tight">{inv.name}</h3>
                      <p className="text-xs text-muted-foreground mt-1">Rentabilidade: {inv.contractedRate}% do {inv.indexer}</p>
                    </div>
                    <Badge variant="outline" className="bg-inflow/10 text-inflow border-none">Ativo</Badge>
                  </div>
                  
                  <div className="mt-6 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Valor Aplicado</span>
                      <span className="font-medium">{formatMoney(inv.totalPrincipal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Rendimento Líquido</span>
                      <span className="font-bold text-inflow">+{formatMoney(inv.totalProfit)}</span>
                    </div>
                    <div className="flex justify-between text-base pt-2 border-t mt-2">
                      <span className="font-semibold">Saldo Atual</span>
                      <span className="font-bold text-primary">{formatMoney(inv.netBalance)}</span>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t grid grid-cols-2 gap-2 mt-auto">
                    <Button variant="outline" size="sm" className="rounded-lg text-xs" onClick={() => { setSelectedInvestment(inv); setStatementModalOpen(true); }}>
                      <History className="size-3 mr-1" /> Extrato
                    </Button>
                    <Button variant="secondary" size="sm" className="rounded-lg text-xs bg-primary/10 text-primary hover:bg-primary/20" onClick={() => { setSelectedInvestment(inv); setRescueModalOpen(true); }}>
                      <ArrowUpRight className="size-3 mr-1" /> Resgatar
                    </Button>
                  </div>
                </article>
              ))
            )}
          </div>
        </>
      )}

      {/* MODAL DE APORTE */}
      <Dialog open={apportModalOpen} onOpenChange={setApportModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Aporte</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Nome do Investimento</Label>
              <Input placeholder="Ex: Reserva expansão Burite..." value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CDB">CDB</SelectItem>
                    <SelectItem value="LCI">LCI (Isento)</SelectItem>
                    <SelectItem value="LCA">LCA (Isento)</SelectItem>
                    <SelectItem value="RDB">RDB</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Indexador</Label>
                <Select value={indexer} onValueChange={setIndexer}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CDI">CDI</SelectItem>
                    <SelectItem value="IPCA">IPCA</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Taxa Contratada (%)</Label>
                <Input type="number" value={contractedRate} onChange={(e) => setContractedRate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Valor do Aporte (R$)</Label>
                <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data da Aplicação</Label>
                <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Vencimento (Opcional)</Label>
                <Input type="date" value={maturityDate} onChange={(e) => setMaturityDate(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setApportModalOpen(false)}>Cancelar</Button>
            <Button disabled={!name || !amount || apportMutation.isPending} onClick={() => apportMutation.mutate()}>
              Confirmar Aplicação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DE RESGATE */}
      <Dialog open={rescueModalOpen} onOpenChange={setRescueModalOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Solicitar Resgate</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-muted/30 p-3 rounded-lg flex justify-between items-center text-sm border">
              <span className="text-muted-foreground">Saldo Disponível:</span>
              <span className="font-bold text-primary">{formatMoney(selectedInvestment?.netBalance || 0)}</span>
            </div>
            <div className="space-y-2">
              <Label>Valor a Resgatar (R$)</Label>
              <Input type="number" step="0.01" value={rescueAmount} onChange={(e) => setRescueAmount(e.target.value)} />
              <p className="text-[10px] text-muted-foreground mt-1">O sistema utilizará a regra PEPS (Primeiro a Entrar, Primeiro a Sair) para minimizar impostos.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRescueModalOpen(false)}>Cancelar</Button>
            <Button variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20" disabled={!rescueAmount || Number(rescueAmount) > (selectedInvestment?.netBalance || 0) || rescueMutation.isPending} onClick={() => rescueMutation.mutate()}>
              Efetuar Resgate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DE EXTRATO IMUTÁVEL */}
      <Dialog open={statementModalOpen} onOpenChange={setStatementModalOpen}>
        <DialogContent className="sm:max-w-3xl p-0 overflow-hidden max-h-[85vh] flex flex-col">
          <DialogHeader className="p-6 pb-4 border-b bg-muted/30 shrink-0">
            <DialogTitle className="flex items-center justify-between">
              <span>Extrato Imutável - {selectedInvestment?.name}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            <Table>
              <TableHeader className="bg-muted/10 sticky top-0 backdrop-blur-md z-10">
                <TableRow>
                  <TableHead className="w-[100px] text-xs">Data Ref.</TableHead>
                  <TableHead className="text-xs">Operação</TableHead>
                  <TableHead className="text-right text-xs">Valor Bruto</TableHead>
                  <TableHead className="text-right text-xs">Impostos (IR/IOF)</TableHead>
                  <TableHead className="text-right text-xs">Líquido Creditado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(selectedInvestment?.history || []).map((tx: any) => {
                  const isApport = tx.type === "APPORT";
                  const isRescue = tx.type === "RESCUE";
                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="text-xs whitespace-nowrap">{format(parseLocalDate(tx.referenceDate), "dd/MM/yyyy")}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm font-medium">
                          {isApport ? <ArrowDownRight className="size-4 text-primary" /> : isRescue ? <ArrowUpRight className="size-4 text-outflow" /> : <TrendingUp className="size-4 text-inflow" />}
                          {tx.description}
                          {!isApport && !isRescue && <Badge variant="secondary" className="text-[9px] ml-2">CDI: {tx.appliedMarketRate}%</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm">{formatMoney(tx.grossAmount)}</TableCell>
                      <TableCell className="text-right text-sm text-destructive">{formatMoney(tx.irTax + tx.iofTax)}</TableCell>
                      <TableCell className={`text-right font-bold ${isRescue ? "text-outflow" : "text-inflow"}`}>
                        {isRescue ? "-" : "+"}{formatMoney(tx.amount)}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {(selectedInvestment?.history || []).length === 0 && (
                  <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Nenhuma movimentação registrada.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}