import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueries, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { TrendingUp, PiggyBank, Landmark, Plus, ArrowDownRight, ArrowUpRight, History, Search } from "lucide-react";
import { PieChart, Pie, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
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
      { title: "Investimentos — Poupi" },
      { name: "description", content: "Acompanhe seus rendimentos de Renda Fixa e CDI." },
    ],
  }),
  component: InvestmentsPage,
});

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e'];

function InvestmentsPage() {
  const queryClient = useQueryClient();
  
  const accountsRes = useQuery(accountsQuery);
  const accounts = accountsRes.data ?? [];
  const validAccounts = accounts.filter((a: any) => a.type !== "WALLET");

  const investmentQueries = useQueries({
    queries: validAccounts.map((acc: any) => ({
      ...investmentDashboardsQuery(acc.id),
      enabled: !!acc.id,
    }))
  });

  const isLoading = accountsRes.isLoading || investmentQueries.some(q => q.isLoading);

  const allDashboards = useMemo(() => {
    return investmentQueries.flatMap((q, index) => {
      const acc = validAccounts[index];
      const data = (q.data as any[]) || [];
      return data.map(inv => ({ ...inv, accountId: acc?.id, accountName: acc?.name }));
    });
  }, [investmentQueries, validAccounts]);

  // =======================================================================
  // CONTROLE DE ESTADOS (Navegação em Profundidade)
  // =======================================================================
  const [selectedPapel, setSelectedPapel] = useState<any>(null);
  const [selectedLote, setSelectedLote] = useState<any>(null);
  
  const [papelModalOpen, setPapelModalOpen] = useState(false);
  const [loteModalOpen, setLoteModalOpen] = useState(false);
  const [rescueModalOpen, setRescueModalOpen] = useState(false);
  const [apportModalOpen, setApportModalOpen] = useState(false);

  const [apportTargetPapel, setApportTargetPapel] = useState<any>(null);

  // Formulários
  const [modalAccountId, setModalAccountId] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("CDB");
  const [indexer, setIndexer] = useState("CDI");
  const [contractedRate, setContractedRate] = useState("100");
  const [amount, setAmount] = useState("");
  const [maturityDate, setMaturityDate] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(todayIso());
  const [rescueAmount, setRescueAmount] = useState("");

  // =======================================================================
  // TOTALIZADORES GLOBAIS
  // =======================================================================
  const globalPrincipal = useMemo(() => allDashboards.reduce((acc, inv) => acc + inv.totalPrincipal, 0), [allDashboards]);
  const globalBalance = useMemo(() => allDashboards.reduce((acc, inv) => acc + inv.totalProjectedNetBalance, 0), [allDashboards]);
  const globalProfit = globalBalance - globalPrincipal;

  const allocationByType = useMemo(() => {
    const map = new Map<string, number>();
    allDashboards.forEach((inv: any) => map.set(inv.type, (map.get(inv.type) || 0) + inv.totalProjectedNetBalance));
    return Array.from(map.entries()).map(([name, value], index) => ({ name, value, fill: COLORS[index % COLORS.length] || '#10b981' }));
  }, [allDashboards]);

  const allocationByIndexer = useMemo(() => {
    const map = new Map<string, number>();
    allDashboards.forEach((inv: any) => map.set(inv.indexer, (map.get(inv.indexer) || 0) + inv.totalProjectedNetBalance));
    return Array.from(map.entries()).map(([name, value], index) => ({ name, value, fill: COLORS[(index + 2) % COLORS.length] || '#3b82f6' }));
  }, [allDashboards]);

  const performanceData = useMemo(() => {
    return allDashboards.map((inv: any) => ({
      name: inv.name,
      Principal: inv.totalPrincipal,
      Rentabilidade: inv.totalProjectedNetBalance - inv.totalPrincipal,
    }));
  }, [allDashboards]);

  // =======================================================================
  // MUTAÇÕES
  // =======================================================================
  const apportMutation = useMutation({
    mutationFn: () => api.createApport({
      accountId: apportTargetPapel ? apportTargetPapel.accountId : modalAccountId,
      fixedIncomeId: apportTargetPapel ? apportTargetPapel.id : undefined,
      type: apportTargetPapel ? undefined : type,
      name: apportTargetPapel ? undefined : name,
      indexer: apportTargetPapel ? undefined : indexer,
      contractedRate: apportTargetPapel ? undefined : Number(contractedRate),
      maturityDate: apportTargetPapel ? undefined : (maturityDate || null),
      amount: Number(amount),
      purchaseDate
    }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["investments"] });
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Aporte realizado com sucesso!");
      setApportModalOpen(false);
      setName(""); setAmount(""); setMaturityDate(""); setModalAccountId("");
      
      if (papelModalOpen && apportTargetPapel) {
        setPapelModalOpen(false);
      }
    },
    onError: (err: any) => toast.error(err.message),
  });

  const rescueMutation = useMutation({
    mutationFn: () => api.executeRescue({
      fixedIncomeId: selectedPapel?.id,
      rescueAmount: Number(rescueAmount),
      rescueDate: todayIso()
    }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["investments"] });
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Resgate solicitado com sucesso!");
      setRescueModalOpen(false);
      setPapelModalOpen(false);
      setRescueAmount("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // =======================================================================
  // FUNÇÕES DE NAVEGAÇÃO
  // =======================================================================
  const openNewPapelModal = () => {
    setApportTargetPapel(null);
    setApportModalOpen(true);
  };

  const openApportToExistingPapel = (papel: any) => {
    setApportTargetPapel(papel);
    setApportModalOpen(true);
  };

  const openPapelDashboard = (papel: any) => {
    setSelectedPapel(papel);
    setPapelModalOpen(true);
  };

  const openLoteDashboard = (lote: any) => {
    setSelectedLote(lote);
    setLoteModalOpen(true);
  };

  return (
    <div className="space-y-6 pb-12">
      <PageHeader 
        title="Gestão de Patrimônio" 
        description="Visão consolidada de todos os seus investimentos."
        action={
          <Button className="rounded-full bg-primary" onClick={openNewPapelModal}>
            <Plus className="mr-2 size-4" /> Novo Investimento
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Total Investido" value={formatMoney(globalPrincipal)} icon={<Landmark className="size-5" />} />
        <SummaryCard label="Saldo Líquido Atual" value={formatMoney(globalBalance)} tone="inflow" icon={<PiggyBank className="size-5" />} />
        <SummaryCard label="Lucro Acumulado" value={formatMoney(globalProfit)} tone="inflow" icon={<TrendingUp className="size-5" />} />
      </div>

      {allDashboards.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 mb-8">
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <h3 className="text-sm font-bold text-muted-foreground mb-4">Composição por Ativo</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={allocationByType} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} />
                  <RechartsTooltip formatter={(val: any) => formatMoney(Number(val || 0))} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Legend height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <h3 className="text-sm font-bold text-muted-foreground mb-4">Exposição por Indexador</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={allocationByIndexer} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} />
                  <RechartsTooltip formatter={(val: any) => formatMoney(Number(val || 0))} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Legend height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-5 shadow-sm md:col-span-2 xl:col-span-1">
            <h3 className="text-sm font-bold text-muted-foreground mb-4">Rentabilidade por Papel</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={performanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis 
                    dataKey="name" 
                    tickLine={false} 
                    axisLine={false} 
                    fontSize={10} 
                    tickFormatter={(val: string) => val?.length > 12 ? val.substring(0, 12) + '...' : val} 
                  />
                  <YAxis 
                    tickLine={false} 
                    axisLine={false} 
                    fontSize={10} 
                    tickFormatter={(val: number) => Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' })} 
                  />
                  <RechartsTooltip formatter={(val: any) => formatMoney(Number(val || 0))} cursor={{ fill: 'var(--muted)' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Legend height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Bar dataKey="Principal" stackId="a" fill="#3b82f6" radius={[0, 0, 4, 4]} />
                  <Bar dataKey="Rentabilidade" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* LISTAGEM DE PAPÉIS */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {isLoading ? (
          <div className="col-span-full py-8 text-center text-muted-foreground">Consolidando carteira de investimentos...</div>
        ) : allDashboards.length === 0 ? (
          <div className="col-span-full py-12 text-center text-muted-foreground border-2 border-dashed rounded-xl bg-muted/5">
            Você ainda não possui investimentos registrados.
          </div>
        ) : (
          allDashboards.map((inv: any) => (
            <article 
              key={inv.id} 
              className="rounded-2xl border bg-card p-5 shadow-sm hover:border-primary/50 transition-colors flex flex-col relative overflow-hidden cursor-pointer"
              onClick={() => openPapelDashboard(inv)}
            >
              <div className="absolute top-0 left-0 w-1 h-full bg-primary/80" />
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="text-[10px]">{inv.type}</Badge>
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{inv.accountName}</span>
                  </div>
                  <h3 className="font-bold text-lg leading-tight group-hover:text-primary">{inv.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">Rentabilidade: {inv.contractedRate}% do {inv.indexer}</p>
                </div>
                <Badge variant="outline" className="bg-inflow/10 text-inflow border-none">Ativo</Badge>
              </div>
              
              <div className="mt-6 space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Investido</span>
                  <span className="font-medium">{formatMoney(inv.totalPrincipal)}</span>
                </div>
                <div className="flex justify-between text-base pt-2 border-t mt-2">
                  <span className="font-semibold">Saldo Atual</span>
                  <span className="font-bold text-primary">{formatMoney(inv.totalProjectedNetBalance)}</span>
                </div>
              </div>
            </article>
          ))
        )}
      </div>

      {/* 1. MODAL DO PAPEL (DASHBOARD DO CONTRATO + LOTES) */}
      <Dialog open={papelModalOpen} onOpenChange={setPapelModalOpen}>
        <DialogContent className="sm:max-w-4xl p-0 overflow-hidden max-h-[85vh] flex flex-col">
          <DialogHeader className="p-6 pb-4 border-b bg-muted/30 shrink-0">
            <div className="flex justify-between items-start">
              <DialogTitle className="flex flex-col gap-1">
                <span className="text-2xl">{selectedPapel?.name}</span>
                <span className="text-sm font-normal text-muted-foreground">
                  {selectedPapel?.type} · {selectedPapel?.contractedRate}% do {selectedPapel?.indexer} · Conta: {selectedPapel?.accountName}
                </span>
              </DialogTitle>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" className="bg-primary/10 text-primary hover:bg-primary/20" onClick={() => openApportToExistingPapel(selectedPapel)}>
                  <Plus className="size-4 mr-2" /> Novo Aporte
                </Button>
                <Button variant="outline" size="sm" onClick={() => setRescueModalOpen(true)}>
                  <ArrowUpRight className="size-4 mr-2" /> Resgatar
                </Button>
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto bg-background p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="p-4 border rounded-xl bg-card">
                <p className="text-xs text-muted-foreground mb-1">Total Aportado</p>
                <p className="text-lg font-bold">{formatMoney(selectedPapel?.totalPrincipal)}</p>
              </div>
              <div className="p-4 border rounded-xl bg-card">
                <p className="text-xs text-muted-foreground mb-1">Saldo Bruto</p>
                <p className="text-lg font-bold">{formatMoney(selectedPapel?.totalProjectedGrossBalance)}</p>
              </div>
              <div className="p-4 border rounded-xl bg-card">
                <p className="text-xs text-muted-foreground mb-1">Impostos Retidos</p>
                <p className="text-lg font-bold text-destructive">-{formatMoney(selectedPapel?.totalProjectedTaxes)}</p>
              </div>
              <div className="p-4 border rounded-xl bg-inflow/10 border-inflow/20">
                <p className="text-xs text-inflow mb-1">Saldo Líquido</p>
                <p className="text-lg font-bold text-inflow">{formatMoney(selectedPapel?.totalProjectedNetBalance)}</p>
              </div>
            </div>

            <h3 className="font-bold text-lg mb-4">Aportes (Lotes)</h3>
            <div className="border rounded-xl overflow-hidden shadow-sm">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead>Data do Aporte</TableHead>
                    <TableHead>Idade</TableHead>
                    <TableHead className="text-right">Aportado</TableHead>
                    <TableHead className="text-right">Rendimento</TableHead>
                    <TableHead className="text-right">Saldo Líquido</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(selectedPapel?.activeLots || []).map((lot: any) => (
                    <TableRow key={lot.id} className="cursor-pointer hover:bg-muted/10 transition-colors" onClick={() => openLoteDashboard(lot)}>
                      <TableCell className="font-medium">{format(parseLocalDate(lot.purchaseDate), "dd/MM/yyyy")}</TableCell>
                      <TableCell>{lot.ageInDays} dias</TableCell>
                      <TableCell className="text-right">{formatMoney(lot.remainingPrincipal)}</TableCell>
                      <TableCell className="text-right text-inflow">+{formatMoney(lot.projectedNetBalance - lot.remainingPrincipal)}</TableCell>
                      <TableCell className="text-right font-bold">{formatMoney(lot.projectedNetBalance)}</TableCell>
                      <TableCell className="text-center">
                        <Button variant="ghost" size="sm" className="h-8 rounded-lg text-primary">
                          <Search className="size-4 mr-1" /> Extrato
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(selectedPapel?.activeLots || []).length === 0 && (
                    <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">Nenhum aporte ativo.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 2. MODAL DO LOTE (DASHBOARD DO LOTE + TRANSAÇÕES) */}
      <Dialog open={loteModalOpen} onOpenChange={setLoteModalOpen}>
        <DialogContent className="sm:max-w-4xl p-0 overflow-hidden max-h-[85vh] flex flex-col">
          <DialogHeader className="p-6 pb-4 border-b bg-muted/30 shrink-0">
            <DialogTitle className="flex items-center justify-between">
              <span>Extrato da Tranche</span>
              <Badge variant="outline" className="font-mono">{selectedLote?.ageInDays} dias rendendo</Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto bg-background p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="p-4 border rounded-xl bg-card">
                <p className="text-xs text-muted-foreground mb-1">Aporte Original</p>
                <p className="text-lg font-bold">{formatMoney(selectedLote?.remainingPrincipal)}</p>
              </div>
              <div className="p-4 border rounded-xl bg-card">
                <p className="text-xs text-muted-foreground mb-1">Saldo Bruto</p>
                <p className="text-lg font-bold">{formatMoney(selectedLote?.projectedGrossBalance)}</p>
              </div>
              <div className="p-4 border rounded-xl bg-card">
                <p className="text-xs text-muted-foreground mb-1">Impostos Acumulados</p>
                <p className="text-sm font-bold text-destructive">IR: {formatMoney(selectedLote?.currentIrTaxProvision)}</p>
                <p className="text-sm font-bold text-destructive">IOF: {formatMoney(selectedLote?.currentIofTaxProvision)}</p>
              </div>
              <div className="p-4 border rounded-xl bg-inflow/10 border-inflow/20">
                <p className="text-xs text-inflow mb-1">Saldo Líquido</p>
                <p className="text-lg font-bold text-inflow">{formatMoney(selectedLote?.projectedNetBalance)}</p>
              </div>
            </div>

            <h3 className="font-bold text-lg mb-4">Registro de Transações</h3>
            <div className="border rounded-xl overflow-hidden shadow-sm">
              <Table>
                <TableHeader className="bg-muted/10">
                  <TableRow>
                    <TableHead className="w-[100px] text-[11px] h-8">Data</TableHead>
                    <TableHead className="text-[11px] h-8">Fato Gerador</TableHead>
                    <TableHead className="text-right text-[11px] h-8">Valor Bruto</TableHead>
                    <TableHead className="text-right text-[11px] h-8">Imposto Retido</TableHead>
                    <TableHead className="text-right text-[11px] h-8">Valor Líquido</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(selectedLote?.transactions || []).map((tx: any) => {
                    const isApport = tx.type === "APPORT";
                    const isRescue = tx.type === "RESCUE";
                    return (
                      <TableRow key={tx.id}>
                        <TableCell className="text-xs whitespace-nowrap py-3">{format(parseLocalDate(tx.referenceDate), "dd/MM/yyyy")}</TableCell>
                        <TableCell className="py-3">
                          <div className="flex items-center gap-2 text-xs font-medium">
                            {isApport ? <ArrowDownRight className="size-3 text-primary" /> : isRescue ? <ArrowUpRight className="size-3 text-outflow" /> : <TrendingUp className="size-3 text-inflow" />}
                            {tx.description}
                            {!isApport && !isRescue && <Badge variant="secondary" className="text-[9px] ml-2">CDI: {tx.appliedMarketRate}%</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-xs py-3">{formatMoney(tx.grossAmount)}</TableCell>
                        <TableCell className="text-right text-xs text-destructive py-3">{formatMoney(tx.irTaxRetained + tx.iofTaxRetained)}</TableCell>
                        <TableCell className={`text-right font-bold text-xs py-3 ${isRescue ? "text-outflow" : "text-inflow"}`}>
                          {isRescue ? "-" : "+"}{formatMoney(tx.netAmount)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {(selectedLote?.transactions || []).length === 0 && (
                    <TableRow><TableCell colSpan={5} className="h-16 text-center text-xs text-muted-foreground">Nenhuma movimentação registrada.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ============================================================================== */}
      {/* MODAL UNIVERSAL DE APORTE (Controla Novo Papel vs Adição de Lote) */}
      {/* ============================================================================== */}
      <Dialog open={apportModalOpen} onOpenChange={setApportModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{apportTargetPapel ? `Novo Aporte em ${apportTargetPapel.name}` : "Novo Investimento de Capital"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            
            {!apportTargetPapel && (
              <>
                <div className="space-y-2">
                  <Label>Conta de Origem (Custódia)</Label>
                  <Select value={modalAccountId} onValueChange={setModalAccountId}>
                    <SelectTrigger><SelectValue placeholder="Selecione de onde o dinheiro vai sair..." /></SelectTrigger>
                    <SelectContent>
                      {validAccounts.map((a: any) => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Nome do Investimento</Label>
                  <Input placeholder="Ex: CDB Banco Inter..." value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo do Papel</Label>
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
                    <Label>Vencimento (Opcional)</Label>
                    <Input type="date" value={maturityDate} onChange={(e) => setMaturityDate(e.target.value)} />
                  </div>
                </div>
              </>
            )}

            {apportTargetPapel && (
              <div className="bg-muted/30 p-3 rounded-lg border text-sm text-muted-foreground mb-2">
                Este aporte será mantido sob as regras vigentes do contrato ({apportTargetPapel.contractedRate}% do {apportTargetPapel.indexer}) e debitado na conta {apportTargetPapel.accountName}.
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 border-t pt-4">
              <div className="space-y-2">
                <Label>Valor do Aporte (R$)</Label>
                <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Data da Aplicação</Label>
                <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setApportModalOpen(false)}>Cancelar</Button>
            <Button 
              disabled={(!apportTargetPapel && (!modalAccountId || !name)) || !amount || apportMutation.isPending} 
              onClick={() => apportMutation.mutate()}
            >
              Confirmar Aplicação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DE RESGATE DE PAPEL */}
      <Dialog open={rescueModalOpen} onOpenChange={setRescueModalOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Solicitar Resgate</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-muted/30 p-3 rounded-lg flex justify-between items-center text-sm border">
              <span className="text-muted-foreground">Saldo Disponível:</span>
              <span className="font-bold text-primary">{formatMoney(selectedPapel?.totalProjectedNetBalance || 0)}</span>
            </div>
            <div className="space-y-2">
              <Label>Valor a Resgatar (R$)</Label>
              <Input type="number" step="0.01" value={rescueAmount} onChange={(e) => setRescueAmount(e.target.value)} />
              <p className="text-[10px] text-muted-foreground mt-1">
                O crédito será feito na conta <strong>{selectedPapel?.accountName}</strong>. 
                O sistema utilizará a regra PEPS (Primeiro a Entrar, Primeiro a Sair).
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRescueModalOpen(false)}>Cancelar</Button>
            <Button variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20" disabled={!rescueAmount || Number(rescueAmount) > (selectedPapel?.totalProjectedNetBalance || 0) || rescueMutation.isPending} onClick={() => rescueMutation.mutate()}>
              Efetuar Resgate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}