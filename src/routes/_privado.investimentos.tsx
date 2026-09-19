import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueries, useQueryClient } from "@tanstack/react-query";
import { TrendingUp, PiggyBank, Landmark, Plus, ArrowDownRight, ArrowUpRight, Search, Trash2, Info, Target, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
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
import type {
  ProductDashboardDTO,
  BoxDetailDTO,
  LotDetailDTO,
  TierRequestDTO,
  YieldConvention,
  AccountResponseDTO,
  TierResponseDTO,
} from "@/lib/api/types";

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

const CONVENTION_LABELS: Record<YieldConvention, string> = {
  CDI_EXPONENTIAL_252: "CDI Exponencial (dias úteis)",
  SAVINGS_MONTHLY_ANNIVERSARY: "Poupança (aniversário mensal)",
  IPCA_MONTHLY: "IPCA + juros (crédito mensal)",
};

type EnrichedProduct = ProductDashboardDTO & { accountId: string; accountName: string };
type EnrichedBox = BoxDetailDTO & {
  productId: string;
  productName: string;
  displayRate: number;
  tiers: ProductDashboardDTO["tiers"];
  type: string;
  indexer: string;
  convention: YieldConvention;
  accountId: string;
  accountName: string;
};

const formatTierDisplay = (tiers: TierResponseDTO[] | undefined, indexer: string, fallbackRate?: number) => {
  if (!tiers || tiers.length === 0) return `${fallbackRate || 0}% do ${indexer}`;
  if (tiers.length === 1) return `${tiers[0]?.rateMultiplier ?? fallbackRate ?? 0}% do ${indexer}`;
  const maxRate = Math.max(...tiers.map(t => Number(t.rateMultiplier)));
  return `Até ${maxRate}% do ${indexer} (Escalonado)`;
};


interface TierFormRow {
  minBalance: string;
  maxBalance: string;
  rateMultiplier: string;
  requiredMonthlyMovement: string;
}

function InvestmentsPage() {
  const queryClient = useQueryClient();

  const accountsRes = useQuery(accountsQuery);
  const accounts: AccountResponseDTO[] = accountsRes.data ?? [];
  const validAccounts = useMemo(() => accounts.filter((a) => a.type !== "WALLET"), [accounts]);

  const investmentQueries = useQueries({
    queries: validAccounts.map((acc) => ({
      ...investmentDashboardsQuery(acc?.id ?? ""),
      enabled: !!acc?.id,
    }))
  });


  const isLoading = accountsRes.isLoading || investmentQueries.some(q => q.isLoading);

  // Helper central de invalidação — usado em TODAS as mutações de sucesso
  const refreshInvestmentData = () => {
    void queryClient.invalidateQueries({ queryKey: ["investments"] });
    void queryClient.invalidateQueries({ queryKey: ["accounts"] });
  };

  // EXTRAÇÃO DE PRODUTOS
  const allProducts: EnrichedProduct[] = useMemo(() => {
    return investmentQueries.flatMap((q, index) => {
      const acc = validAccounts[index];
      const prods = (q.data as ProductDashboardDTO[]) || [];
      return prods.map(p => ({ ...p, accountId: acc?.id ?? "", accountName: acc?.name ?? "" }));
    });
  }, [investmentQueries, validAccounts]);

  const productsWithoutBoxes = useMemo(
    () => allProducts.filter(p => !p.boxes || p.boxes.length === 0),
    [allProducts]
  );


  // EXTRAÇÃO DE CAIXINHAS
  const allBoxes: EnrichedBox[] = useMemo(() => {
    return allProducts.flatMap(prod =>
      (prod.boxes || []).map((box) => ({
        ...box,
        productId: prod.id,
        productName: prod.name,
        displayRate: prod.displayRate,
        tiers: prod.tiers || [],
        type: prod.type,
        indexer: prod.indexer,
        convention: prod.convention,
        accountId: prod.accountId,
        accountName: prod.accountName,
      }))
    );
  }, [allProducts]);


  // =======================================================================
  // CONTROLES DE MODAIS
  // =======================================================================
  const [createProductModalOpen, setCreateProductModalOpen] = useState(false);
  const [createBoxModalOpen, setCreateBoxModalOpen] = useState(false);
  const [apportModalOpen, setApportModalOpen] = useState(false);

  const [boxDashboardOpen, setBoxDashboardOpen] = useState(false);
  const [loteDashboardOpen, setLoteDashboardOpen] = useState(false);
  const [rescueModalOpen, setRescueModalOpen] = useState(false);

  // Chave composta (productId + boxId) para identificar a caixinha de forma única
  const [selectedBoxKey, setSelectedBoxKey] = useState<{ productId: string; boxId: string } | null>(null);
  const [selectedLoteId, setSelectedLoteId] = useState<string | null>(null);

  // Derivação do selectedBox usando chave composta
  const selectedBox = useMemo(
    () => allBoxes.find(
      (b) => b.productId === selectedBoxKey?.productId && b.id === selectedBoxKey?.boxId
    ) ?? null,
    [allBoxes, selectedBoxKey]
  );

  const selectedLote = useMemo(
    () => selectedBox?.activeLots.find((l: any) => l.id === selectedLoteId) ?? null,
    [selectedBox, selectedLoteId]
  );

  // FORMS — Produto
  const [modalAccountId, setModalAccountId] = useState("");
  const [productName, setProductName] = useState("");
  const [type, setType] = useState("CDB");
  const [indexer, setIndexer] = useState("CDI");
  const [convention, setConvention] = useState<YieldConvention>("CDI_EXPONENTIAL_252");
  const [tiers, setTiers] = useState<TierFormRow[]>([
    { minBalance: "0", maxBalance: "", rateMultiplier: "100", requiredMonthlyMovement: "" }
  ]);

  // FORMS — Caixinha
  const [selectedProductId, setSelectedProductId] = useState("");
  const [boxName, setBoxName] = useState("");

  // FORMS — Aporte / Resgate
  const [amount, setAmount] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(todayIso());
  const [rescueAmount, setRescueAmount] = useState("");

  // Helpers de Tiers
  const addTier = () => setTiers([
    ...tiers,
    { minBalance: "", maxBalance: "", rateMultiplier: "100", requiredMonthlyMovement: "" }
  ]);

  const removeTier = (index: number) => setTiers(tiers.filter((_, i) => i !== index));

  const updateTier = (
    index: number,
    field: keyof TierFormRow,
    value: string
  ) => {
    const newTiers = [...tiers];
    if (!newTiers[index]) return;
    newTiers[index] = { ...newTiers[index], [field]: value };
    setTiers(newTiers);
  };

  const resetProductForm = () => {
    setProductName("");
    setModalAccountId("");
    setConvention("CDI_EXPONENTIAL_252");
    setTiers([{ minBalance: "0", maxBalance: "", rateMultiplier: "100", requiredMonthlyMovement: "" }]);
  };

  // =======================================================================
  // MUTAÇÕES
  // =======================================================================

  // 1. Criar Produto
  const productMutation = useMutation({
    mutationFn: () => api.createProduct({
      accountId: modalAccountId,
      name: productName,
      indexer,
      type,
      convention,
      tiers: tiers.map<TierRequestDTO>(t => ({
        minBalance: Number(t.minBalance || 0),
        maxBalance: t.maxBalance ? Number(t.maxBalance) : null,
        rateMultiplier: Number(t.rateMultiplier || 0),
        requiredMonthlyMovement: t.requiredMonthlyMovement ? Number(t.requiredMonthlyMovement) : null,
      }))
    }),
    onSuccess: () => {
      refreshInvestmentData();
      toast.success("Produto/Banco cadastrado!");
      setCreateProductModalOpen(false);
      resetProductForm();
    },
    onError: (err: any) => toast.error(err.message),
  });

  // 2. Criar Caixinha
  const boxMutation = useMutation({
    mutationFn: () => api.createBox({
      productId: selectedProductId,
      name: boxName
    }),
    onSuccess: () => {
      refreshInvestmentData();
      toast.success("Objetivo criado com sucesso!");
      setCreateBoxModalOpen(false);
      setBoxName("");
      setSelectedProductId("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // 3. Aporte em Caixinha
  const apportMutation = useMutation({
    mutationFn: () => api.createApport({
      accountId: modalAccountId,
      boxId: selectedBox?.id ?? "",
      amount: Number(amount),
      purchaseDate
    }),
    onSuccess: () => {
      refreshInvestmentData();
      toast.success("Aporte realizado!");
      setApportModalOpen(false);
      setAmount("");
      setModalAccountId("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // 4. Resgate
  const rescueMutation = useMutation({
    mutationFn: () => api.executeRescue({
      boxId: selectedBox?.id ?? "",
      requestedAmount: Number(rescueAmount)
    }),
    onSuccess: () => {
      refreshInvestmentData();
      toast.success("Resgate processado com sucesso!");
      setRescueModalOpen(false);
      setBoxDashboardOpen(false);
      setRescueAmount("");
      setSelectedBoxKey(null);
      setSelectedLoteId(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const openApportModal = () => {
    if (!selectedBox) return;
    setModalAccountId(selectedBox.accountId);
    setApportModalOpen(true);
  };

  // =======================================================================
  // TOTALIZADORES
  // =======================================================================
  const globalPrincipal = useMemo(() => allBoxes.reduce((acc, box) => acc + box.totalPrincipal, 0), [allBoxes]);
  const globalBalance = useMemo(() => allBoxes.reduce((acc, box) => acc + box.totalNetBalance, 0), [allBoxes]);
  const globalProfit = globalBalance - globalPrincipal;

  const allocationByType = useMemo(() => {
    const map = new Map<string, number>();
    allBoxes.forEach((box) => map.set(box.type, (map.get(box.type) || 0) + box.totalNetBalance));
    return Array.from(map.entries()).map(([name, value], index) => ({ name, value, fill: COLORS[index % COLORS.length] || '#10b981' }));
  }, [allBoxes]);

  const allocationByIndexer = useMemo(() => {
    const map = new Map<string, number>();
    allBoxes.forEach((box) => map.set(box.indexer, (map.get(box.indexer) || 0) + box.totalNetBalance));
    return Array.from(map.entries()).map(([name, value], index) => ({ name, value, fill: COLORS[(index + 2) % COLORS.length] || '#3b82f6' }));
  }, [allBoxes]);

  const performanceData = useMemo(() => {
    return allBoxes.map((box) => ({
      name: box.name,
      Principal: box.totalPrincipal,
      Rentabilidade: box.totalNetBalance - box.totalPrincipal,
    }));
  }, [allBoxes]);

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Gestão de Patrimônio"
        description="Acompanhe seus rendimentos e organize seu capital em objetivos."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setCreateProductModalOpen(true)}>
              <Landmark className="mr-2 size-4" /> Novo Produto
            </Button>
            <Button className="bg-primary text-primary-foreground" onClick={() => setCreateBoxModalOpen(true)}>
              <Target className="mr-2 size-4" /> Nova Meta
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Total Investido" value={formatMoney(globalPrincipal)} icon={<Wallet className="size-5" />} />
        <SummaryCard label="Saldo Líquido Atual" value={formatMoney(globalBalance)} tone="inflow" icon={<PiggyBank className="size-5" />} />
        <SummaryCard label="Lucro Acumulado" value={formatMoney(globalProfit)} tone="inflow" icon={<TrendingUp className="size-5" />} />
      </div>

      {/* LISTAGEM DE PRODUTOS (cada um contendo suas caixinhas) */}
      <div className="space-y-6">
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">Consolidando carteira de investimentos...</div>
        ) : allProducts.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground border-2 border-dashed rounded-xl bg-muted/5">
            Você ainda não possui produtos cadastrados.
          </div>
        ) : (
          allProducts.map((prod) => (
            <div key={prod.id} className="rounded-2xl border bg-card shadow-sm overflow-hidden">
              {/* CABEÇALHO DO PRODUTO */}
              <div className="p-5 bg-muted/20 border-b flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Landmark className="size-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-base">{prod.name}</h3>
                      <Badge variant="secondary" className="text-[10px]">{prod.type}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {prod.accountName} · {formatTierDisplay(prod.tiers, prod.indexer, prod.displayRate)}
                      {prod.convention && ` · ${CONVENTION_LABELS[prod.convention]}`}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedProductId(prod.id);
                    setCreateBoxModalOpen(true);
                  }}
                >
                  <Plus className="size-4 mr-2" /> Nova Meta
                </Button>
              </div>

              {/* CAIXINHAS DENTRO DO PRODUTO */}
              <div className="p-5">
                {(prod.boxes || []).length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground border-2 border-dashed rounded-xl bg-muted/5">
                    Nenhuma meta criada neste produto ainda.
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {prod.boxes.map((box) => {
                      return (
                        <article
                          key={box.id}
                          className="rounded-xl border bg-background p-4 shadow-sm hover:border-primary/50 transition-colors flex flex-col relative overflow-hidden cursor-pointer"
                          onClick={() => {
                            setSelectedBoxKey({ productId: prod.id, boxId: box.id });
                            setSelectedLoteId(null);
                            setBoxDashboardOpen(true);
                          }}
                        >
                          <div className="absolute top-0 left-0 w-1 h-full bg-primary/80" />
                          <div className="flex justify-between items-start">
                            <h4 className="font-bold text-sm leading-tight">{box.name}</h4>
                            <Badge variant="outline" className="bg-inflow/10 text-inflow border-none text-[10px]">Ativa</Badge>
                          </div>

                          <div className="mt-4 space-y-1.5">
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Aportado</span>
                              <span className="font-medium">{formatMoney(box.totalPrincipal)}</span>
                            </div>
                            <div className="flex justify-between text-sm pt-1.5 border-t mt-1.5">
                              <span className="font-semibold">Saldo Atual</span>
                              <span className="font-bold text-primary">{formatMoney(box.totalNetBalance)}</span>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>


      {/* ============================================================================== */}
      {/* MODAL 1: CRIAR PRODUTO */}
      {/* ============================================================================== */}
      <Dialog open={createProductModalOpen} onOpenChange={setCreateProductModalOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Registrar Novo Produto</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2 max-h-[65vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label>Conta de Custódia (Onde o produto reside)</Label>
              <Select value={modalAccountId} onValueChange={setModalAccountId}>
                <SelectTrigger><SelectValue placeholder="Selecione a instituição..." /></SelectTrigger>
                <SelectContent>
                  {validAccounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nome do Produto</Label>
              <Input placeholder="Ex: CDB Nubank, Cofrinho PicPay..." value={productName} onChange={(e) => setProductName(e.target.value)} />
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

            <div className="space-y-2">
              <Label>Convenção de Rendimento</Label>
              <Select value={convention} onValueChange={(v) => setConvention(v as YieldConvention)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CDI_EXPONENTIAL_252">CDI Exponencial (dias úteis) — CDB, LCI, LCA</SelectItem>
                  <SelectItem value="SAVINGS_MONTHLY_ANNIVERSARY">Poupança (aniversário mensal)</SelectItem>
                  <SelectItem value="IPCA_MONTHLY">IPCA + juros (crédito mensal)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Define como o rendimento diário é calculado e em qual data é creditado.
              </p>
            </div>

            {/* Tiers */}
            <div className="space-y-3 border rounded-xl p-4 bg-muted/10 mt-2">
              <div className="flex items-center justify-between">
                <Label className="font-semibold text-primary">Faixas de Rendimento (Tiers)</Label>
                <Button type="button" variant="outline" size="sm" className="h-7 text-[10px]" onClick={addTier}>
                  <Plus className="size-3 mr-1" /> Adicionar Faixa
                </Button>
              </div>
              <div className="space-y-3">
                {tiers.map((tier, index) => (
                  <div key={index} className="space-y-2 border-b pb-3 last:border-b-0 last:pb-0">
                    <div className="flex items-end gap-2">
                      <div className="flex-1 space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Saldo Min. (R$)</Label>
                        <Input type="number" placeholder="0.00" value={tier.minBalance} onChange={(e) => updateTier(index, "minBalance", e.target.value)} />
                      </div>
                      <div className="flex-1 space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Saldo Máx. (R$)</Label>
                        <Input type="number" placeholder="Ilimitado" value={tier.maxBalance} onChange={(e) => updateTier(index, "maxBalance", e.target.value)} />
                      </div>
                      <div className="flex-1 space-y-1">
                        <Label className="text-[10px] text-muted-foreground">% do {indexer}</Label>
                        <Input type="number" value={tier.rateMultiplier} onChange={(e) => updateTier(index, "rateMultiplier", e.target.value)} />
                      </div>
                      {tiers.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" className="mb-[2px] text-destructive hover:bg-destructive/10" onClick={() => removeTier(index)}>
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">
                        Movimentação mínima mensal p/ esta faixa (opcional)
                      </Label>
                      <Input
                        type="number"
                        placeholder="Ex: 1000.00 (deixe vazio se não houver exigência)"
                        value={tier.requiredMonthlyMovement}
                        onChange={(e) => updateTier(index, "requiredMonthlyMovement", e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateProductModalOpen(false)}>Cancelar</Button>
            <Button disabled={!modalAccountId || !productName || tiers.some(t => !t.rateMultiplier) || productMutation.isPending} onClick={() => productMutation.mutate()}>
              Salvar Produto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================================== */}
      {/* MODAL 2: CRIAR CAIXINHA */}
      {/* ============================================================================== */}
      <Dialog open={createBoxModalOpen} onOpenChange={setCreateBoxModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Criar Nova Meta / Objetivo</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Produto Base</Label>
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger><SelectValue placeholder="Selecione onde a meta será alocada..." /></SelectTrigger>
                <SelectContent>
                  {allProducts.length === 0 ? (
                    <SelectItem value="none" disabled>Nenhum produto cadastrado</SelectItem>
                  ) : (
                    allProducts.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.accountName})</SelectItem>)
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nome do Objetivo</Label>
              <Input placeholder="Ex: Viagem, IPVA, Casamento..." value={boxName} onChange={(e) => setBoxName(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateBoxModalOpen(false)}>Cancelar</Button>
            <Button disabled={!selectedProductId || !boxName || boxMutation.isPending} onClick={() => boxMutation.mutate()}>
              Criar Objetivo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================================== */}
      {/* MODAL 3: APORTAR CAPITAL */}
      {/* ============================================================================== */}
      <Dialog open={apportModalOpen} onOpenChange={setApportModalOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Aportar na Meta: {selectedBox?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="bg-muted/30 p-3 rounded-lg border text-sm text-muted-foreground mb-2">
              Destino: Produto <strong>{selectedBox?.productName}</strong>.
              Regra: {formatTierDisplay(selectedBox?.tiers || [], selectedBox?.indexer || "")}.
            </div>

            <div className="space-y-2">
              <Label>Débito na Conta Corrente</Label>
              <Select value={modalAccountId} onValueChange={setModalAccountId}>
                <SelectTrigger><SelectValue placeholder="Selecione a origem do dinheiro..." /></SelectTrigger>
                <SelectContent>
                  {validAccounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Valor do Aporte (R$)</Label>
              <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Data da Aplicação</Label>
              <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setApportModalOpen(false)}>Cancelar</Button>
            <Button disabled={!modalAccountId || !amount || apportMutation.isPending} onClick={() => apportMutation.mutate()}>
              Confirmar Aporte
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DASHBOARD DA CAIXINHA */}
      <Dialog open={boxDashboardOpen} onOpenChange={setBoxDashboardOpen}>
        <DialogContent
          key={`${selectedBoxKey?.productId}-${selectedBoxKey?.boxId}`}
          className="sm:max-w-4xl p-0 overflow-hidden max-h-[85vh] flex flex-col"
        >
          <DialogHeader className="p-6 pb-4 border-b bg-muted/30 shrink-0">
            <div className="flex justify-between items-start">
              <DialogTitle className="flex flex-col gap-1">
                <span className="text-2xl">{selectedBox?.name}</span>
                <span className="text-sm font-normal text-muted-foreground">
                  {selectedBox?.productName} · {selectedBox?.type} · {formatTierDisplay(selectedBox?.tiers, selectedBox?.indexer ?? "", selectedBox?.displayRate)} · Conta: {selectedBox?.accountName}
                </span>
                {selectedBox?.convention && (
                  <span className="text-[10px] text-muted-foreground">
                    Convenção: {CONVENTION_LABELS[selectedBox.convention]}
                  </span>
                )}
              </DialogTitle>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" className="bg-primary/10 text-primary hover:bg-primary/20" onClick={openApportModal}>
                  <Plus className="size-4 mr-2" /> Novo Aporte
                </Button>
                <Button variant="outline" size="sm" onClick={() => setRescueModalOpen(true)}>
                  <ArrowUpRight className="size-4 mr-2" /> Resgatar
                </Button>
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto bg-background p-6">

            {selectedBox?.tiers && selectedBox.tiers.length > 1 && (
              <div className="mb-6 p-4 rounded-xl border border-primary/20 bg-primary/5 flex items-start gap-3">
                <Info className="size-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-2">Regra de Rendimento do Produto</h4>
                  <div className="flex flex-wrap gap-2">
                    {[...selectedBox.tiers].sort((a, b) => a.minBalance - b.minBalance).map((tier, i) => (
                      <Badge key={i} variant="outline" className="bg-background font-medium">
                        {tier.maxBalance ? `Até ${formatMoney(tier.maxBalance)}` : `Acima de ${formatMoney(tier.minBalance)}`}
                        <span className="ml-1.5 text-primary">rende {tier.rateMultiplier}%</span>
                        {tier.requiredMonthlyMovement && (
                          <span className="ml-1.5 text-[10px] text-muted-foreground">
                            (requer {formatMoney(tier.requiredMonthlyMovement)}/mês)
                          </span>
                        )}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="p-4 border rounded-xl bg-card">
                <p className="text-xs text-muted-foreground mb-1">Total Aportado</p>
                <p className="text-lg font-bold">{formatMoney(selectedBox?.totalPrincipal ?? 0)}</p>
              </div>
              <div className="p-4 border rounded-xl bg-card">
                <p className="text-xs text-muted-foreground mb-1">Saldo Bruto</p>
                <p className="text-lg font-bold">{formatMoney(selectedBox?.totalGrossBalance ?? 0)}</p>
              </div>
              <div className="p-4 border rounded-xl bg-card">
                <p className="text-xs text-muted-foreground mb-1">Impostos Retidos</p>
                <p className="text-lg font-bold text-destructive">-{formatMoney(selectedBox?.totalTaxes ?? 0)}</p>
              </div>
              <div className="p-4 border rounded-xl bg-inflow/10 border-inflow/20">
                <p className="text-xs text-inflow mb-1">Saldo Líquido</p>
                <p className="text-lg font-bold text-inflow">{formatMoney(selectedBox?.totalNetBalance ?? 0)}</p>
              </div>
            </div>

            <h3 className="font-bold text-lg mb-4">Aportes (Lotes FIFO)</h3>
            <div className="border rounded-xl overflow-hidden shadow-sm">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Idade</TableHead>
                    <TableHead className="text-right">Aportado</TableHead>
                    <TableHead className="text-right">Rendimento</TableHead>
                    <TableHead className="text-right">Saldo Líquido</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(selectedBox?.activeLots || []).map((lot) => (
                    <TableRow key={lot.id} className="cursor-pointer hover:bg-muted/10 transition-colors" onClick={() => { setSelectedLoteId(lot.id); setLoteDashboardOpen(true); }}>
                      <TableCell className="font-medium">{format(parseLocalDate(lot.purchaseDate), "dd/MM/yyyy")}</TableCell>
                      <TableCell>{lot.ageInDays} dias</TableCell>
                      <TableCell className="text-right">{formatMoney(lot.remainingPrincipal)}</TableCell>
                      <TableCell className="text-right text-inflow">+{formatMoney(lot.projectedNetBalance - lot.remainingPrincipal)}</TableCell>
                      <TableCell className="text-right font-bold">{formatMoney(lot.projectedNetBalance)}</TableCell>
                      <TableCell className="text-center">
                        <Button variant="ghost" size="sm" className="h-8 rounded-lg text-primary"><Search className="size-4 mr-1" /> Extrato</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(selectedBox?.activeLots || []).length === 0 && (
                    <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">Nenhum aporte ativo.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* DASHBOARD DO LOTE (Extrato) */}
      <Dialog open={loteDashboardOpen} onOpenChange={setLoteDashboardOpen}>
        <DialogContent
          key={selectedLoteId ?? "no-lote"}
          className="sm:max-w-4xl p-0 overflow-hidden max-h-[85vh] flex flex-col"
        >
          <DialogHeader className="p-6 pb-4 border-b bg-muted/30 shrink-0">
            <DialogTitle className="flex items-center justify-between">
              <span>Extrato da Tranche (Fatia do Lote)</span>
              <Badge variant="outline" className="font-mono">{selectedLote?.ageInDays} dias rendendo</Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto bg-background p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="p-4 border rounded-xl bg-card">
                <p className="text-xs text-muted-foreground mb-1">Aporte Original</p>
                <p className="text-lg font-bold">{formatMoney(selectedLote?.remainingPrincipal ?? 0)}</p>
              </div>
              <div className="p-4 border rounded-xl bg-card">
                <p className="text-xs text-muted-foreground mb-1">Saldo Bruto</p>
                <p className="text-lg font-bold">{formatMoney(selectedLote?.projectedGrossBalance ?? 0)}</p>
              </div>
              <div className="p-4 border rounded-xl bg-card">
                <p className="text-xs text-muted-foreground mb-1">Impostos Acumulados</p>
                <p className="text-sm font-bold text-destructive">IR: {formatMoney(selectedLote?.currentIrTaxProvision ?? 0)}</p>
                <p className="text-sm font-bold text-destructive">IOF: {formatMoney(selectedLote?.currentIofTaxProvision ?? 0)}</p>
              </div>
              <div className="p-4 border rounded-xl bg-inflow/10 border-inflow/20">
                <p className="text-xs text-inflow mb-1">Saldo Líquido</p>
                <p className="text-lg font-bold text-inflow">{formatMoney(selectedLote?.projectedNetBalance ?? 0)}</p>
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
                  {(selectedLote?.transactions || []).map((tx) => {
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

      {/* MODAL DE RESGATE */}
      <Dialog open={rescueModalOpen} onOpenChange={setRescueModalOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Solicitar Resgate</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-muted/30 p-3 rounded-lg flex justify-between items-center text-sm border">
              <span className="text-muted-foreground">Saldo Disponível:</span>
              <span className="font-bold text-primary">{formatMoney(selectedBox?.totalNetBalance || 0)}</span>
            </div>
            <div className="space-y-2">
              <Label>Valor a Resgatar (R$)</Label>
              <Input type="number" step="0.01" value={rescueAmount} onChange={(e) => setRescueAmount(e.target.value)} />
              <p className="text-[10px] text-muted-foreground mt-1">
                O crédito será feito na conta <strong>{selectedBox?.accountName}</strong>.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRescueModalOpen(false)}>Cancelar</Button>
            <Button variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20" disabled={!rescueAmount || Number(rescueAmount) > (selectedBox?.totalNetBalance || 0) || rescueMutation.isPending} onClick={() => rescueMutation.mutate()}>
              Efetuar Resgate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
