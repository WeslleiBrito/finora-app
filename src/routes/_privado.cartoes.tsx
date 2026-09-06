import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CreditCard, Sparkles, TrendingUp, AlertTriangle, CalendarDays, Wallet, ReceiptText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { PageHeader } from "@/components/app/page-header";
import { SummaryCard } from "@/components/app/summary-card";
import { ActiveBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

// 🌟 Consumindo as queries do novo back-end
import { banksQuery, cardBrandsQuery, cardsQuery, creditCardSummaryQuery } from "@/lib/api/queries";
import { api } from "@/lib/api/store";
import { formatMoney, parseLocalDate } from "@/lib/format";
import { PayInvoiceDialog } from "@/components/modals/pay-invoice-dialog";

export const Route = createFileRoute("/_privado/cartoes")({
  head: () => ({
    meta: [
      { title: "Cartões de crédito — Poupi" },
      { name: "description", content: "Gestão inteligente de limites, fechamento e faturas." },
    ],
  }),
  component: CardsPage,
});

function CardsPage() {
  const queryClient = useQueryClient();
  const cards = useQuery(cardsQuery);
  const brands = useQuery(cardBrandsQuery);
  const banks = useQuery(banksQuery);
  
  // 🌟 O NOVO RESUMO DO BACK-END
  const { data: summary, isLoading: isLoadingSummary } = useQuery(creditCardSummaryQuery);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [limit, setLimit] = useState("1000");
  const [closingDay, setClosingDay] = useState("5");
  const [dueDay, setDueDay] = useState("12");
  const [brandId, setBrandId] = useState("");
  const [bankId, setBankId] = useState("");
  const [revolvingInterest, setRevolvingInterest] = useState("0");
  const [fine, setFine] = useState("0");

  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const [payModalOpen, setPayModalOpen] = useState(false);
  const [selectedMonthToPay, setSelectedMonthToPay] = useState<string | null>(null);

  // 🌟 Busca dinâmica das faturas SÓ para o cartão clicado (com size alto para vir tudo)
  const { data: cardInstallmentsResponse, isLoading: isLoadingFaturas } = useQuery({
    queryKey: ["installments", { direction: "OUTFLOW", instrumentId: selectedCardId }],
    queryFn: () => api.searchInstallments({ direction: "OUTFLOW", instrumentId: selectedCardId, size: 500 }),
    enabled: !!selectedCardId && invoiceModalOpen,
  });

  const create = useMutation({
    mutationFn: () =>
      api.createCreditCard({
        name, creditLimit: Number(limit) || 0, closingDay: Number(closingDay) || 1, dueDay: Number(dueDay) || 1,
        cardBrandId: brandId, revolvingInterest: Number(revolvingInterest) || 0, fine: Number(fine) || 0, ...(bankId ? { bankId } : {}),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["credit-cards"] });
      void queryClient.invalidateQueries({ queryKey: ["credit-card-summary"] });
      toast.success("Cartão cadastrado");
      setOpen(false);
      setName(""); setLimit("1000"); setClosingDay("5"); setDueDay("12");
      setBrandId(""); setBankId(""); setRevolvingInterest("0"); setFine("0");
    },
    onError: (err: any) => toast.error(err.message || "Erro ao cadastrar cartão"),
  });

  const toggle = useMutation({
    mutationFn: (id: string) => api.toggleCardStatus(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["credit-cards"] });
      void queryClient.invalidateQueries({ queryKey: ["credit-card-summary"] });
      toast.success("Status do cartão atualizado");
    },
  });

  const cardsList = cards.data ?? [];

  // Agrupa as parcelas do cartão selecionado por mês (direto no front, pois já filtramos na query)
  const virtualInvoices = useMemo(() => {
    if (!cardInstallmentsResponse?.content) return {};

    return cardInstallmentsResponse.content.reduce((acc: any, inst: any) => {
      if (!inst.dueDate) return acc;

      const month = inst.dueDate.slice(0, 7);
      if (!acc[month]) acc[month] = { installments: [], total: 0, paid: 0 };

      acc[month].installments.push(inst);
      acc[month].total += inst.amount;
      acc[month].paid += (inst.totalPaid || 0);

      return acc;
    }, {} as Record<string, { installments: any[], total: number, paid: number }>);
  }, [cardInstallmentsResponse]);

  return (
    <>
      <PageHeader
        title="Gestão de Cartões"
        description="Controle seus limites, faturas e projeções."
        action={<Button className="rounded-full" onClick={() => setOpen(true)}>Novo cartão</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 mb-8">
        <SummaryCard
          label="Limite Global Comprometido"
          value={formatMoney(summary?.globalUsed || 0)}
          hint={`Disponível: ${formatMoney(summary?.globalAvailable || 0)} de ${formatMoney(summary?.globalLimit || 0)}`}
          tone="outflow"
          icon={<CreditCard className="size-5" />}
        />

        {summary?.bestCard ? (
          <div className="rounded-2xl border bg-card p-5 shadow-sm bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
            <div className="flex items-center gap-2 text-primary font-bold mb-2">
              <Sparkles className="size-5" /> Melhor cartão hoje
            </div>
            <p className="text-xl font-bold">{summary.bestCard.cardName}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Comprando hoje, você ganha <strong>{summary.bestCard.daysToPay} dias</strong> para pagar.
              <br />(Vencimento base: {parseLocalDate(summary.bestCard.nextDue).toLocaleDateString('pt-BR')})
            </p>
          </div>
        ) : (
          <SummaryCard label="Melhor cartão hoje" value="—" hint="Cadastre cartões ativos" icon={<Sparkles className="size-5" />} />
        )}

        <SummaryCard
          label="Cartões Cadastrados"
          value={String(cardsList.length)}
          hint={`${cardsList.filter((c: any) => c.status === "ACTIVE").length} ativos e liberados`}
          icon={<Wallet className="size-5" />}
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Wallet className="size-5 text-muted-foreground" /> Suas Carteiras
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            {cardsList.map((card: any) => {
              const used = card.creditLimit - card.availableLimit;
              const pct = card.creditLimit ? (used / card.creditLimit) * 100 : 0;

              let progressColor = "bg-primary";
              let riskAlert = null;
              if (pct >= 80) {
                progressColor = "bg-destructive";
                riskAlert = <span className="text-[10px] text-destructive flex items-center gap-1 font-bold mt-1"><AlertTriangle className="size-3" /> Risco: Alto uso de limite.</span>;
              } else if (pct >= 60) {
                progressColor = "bg-pending";
              }

              return (
                <article key={card.id} className="relative overflow-hidden rounded-2xl border bg-card p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-bl-full -z-10" />

                  <div className="flex items-start justify-between">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-secondary/80">
                      <CreditCard className="size-5 text-foreground" />
                    </span>
                    <ActiveBadge active={card.status === "ACTIVE"} />
                  </div>

                  <h2 className="mt-4 text-lg font-bold tracking-tight">{card.cardHolderName || card.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    {card.cardBrand?.name} {card.bank ? `· ${card.bank.name}` : ""}
                  </p>

                  <div className="mt-6">
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="text-sm font-semibold text-muted-foreground">Disponível</span>
                      <span className="text-lg font-bold">{formatMoney(card.availableLimit)}</span>
                    </div>

                    <div className="h-2 w-full bg-secondary rounded-full overflow-hidden flex items-center">
                      <div className={`h-full ${progressColor} transition-all`} style={{ width: `${pct}%` }} />
                    </div>

                    <div className="flex justify-between items-center mt-1">
                      <p className="text-[10px] text-muted-foreground">{Math.round(pct)}% utilizado de {formatMoney(card.creditLimit)}</p>
                    </div>
                    {riskAlert}
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-2 w-full pt-4 border-t">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="rounded-lg text-xs"
                      onClick={() => { setSelectedCardId(card.id); setInvoiceModalOpen(true); }}
                    >
                      <ReceiptText className="size-3 mr-1.5" /> Faturas
                    </Button>
                    <Button variant="outline" size="sm" className="rounded-lg text-xs" onClick={() => toggle.mutate(card.id)}>
                      {card.status === "ACTIVE" ? "Bloquear" : "Reativar"}
                    </Button>
                  </div>
                </article>
              );
            })}

            {cardsList.length === 0 && (
              <div className="sm:col-span-2 p-8 border-2 border-dashed rounded-2xl text-center text-muted-foreground">
                <CreditCard className="size-8 mx-auto mb-2 opacity-50" />
                <p>Nenhum cartão cadastrado.</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <TrendingUp className="size-5 text-muted-foreground" /> Projeção Futura
          </h2>
          <section className="rounded-2xl border bg-card p-5 shadow-sm">
            <p className="text-sm text-muted-foreground mb-4">
              A "Bola de Neve" mostra o quanto do seu limite já está comprometido nos próximos meses apenas com compras parceladas.
            </p>
            <div className="h-64">
              {isLoadingSummary ? (
                <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-muted-foreground" /></div>
              ) : summary?.snowballChartData && summary.snowballChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.snowballChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis tickLine={false} axisLine={false} fontSize={12} width={60} />
                    <Tooltip
                      formatter={(value: any) => formatMoney(Number(value))}
                      contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)" }}
                    />
                    <Bar dataKey="total" fill="var(--outflow)" radius={[6, 6, 0, 0]} name="Faturas" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground border-2 border-dashed rounded-xl">
                  Nenhuma compra parcelada no futuro. Parabéns!
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle>Novo cartão de crédito</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do cartão (Apelido)</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Bandeira</Label>
                <Select value={brandId} onValueChange={setBrandId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {(brands.data ?? []).map((b: any) => (<SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Banco</Label>
                <Select value={bankId} onValueChange={setBankId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {(banks.data ?? []).map((b: any) => (<SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2"><Label>Limite (R$)</Label><Input type="number" value={limit} onChange={(e) => setLimit(e.target.value)} /></div>
              <div className="space-y-2"><Label>Fechamento</Label><Input type="number" min={1} max={31} value={closingDay} onChange={(e) => setClosingDay(e.target.value)} /></div>
              <div className="space-y-2"><Label>Vencimento</Label><Input type="number" min={1} max={31} value={dueDay} onChange={(e) => setDueDay(e.target.value)} /></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Juros Rotativo (%)</Label><Input type="number" step="0.01" value={revolvingInterest} onChange={(e) => setRevolvingInterest(e.target.value)} /></div>
              <div className="space-y-2"><Label>Multa (%)</Label><Input type="number" step="0.01" value={fine} onChange={(e) => setFine(e.target.value)} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button className="rounded-full" disabled={!name || !brandId || create.isPending} onClick={() => create.mutate()}>
              Cadastrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={invoiceModalOpen} onOpenChange={(val) => { setInvoiceModalOpen(val); if (!val) setSelectedCardId(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 border-b bg-muted/30 shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <ReceiptText className="size-5 text-primary" /> Faturas do Cartão
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">Selecione o mês para visualizar as compras e realizar o pagamento.</p>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6">
            {isLoadingFaturas ? (
               <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" /></div>
            ) : Object.keys(virtualInvoices).length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
                Nenhuma compra encontrada para este cartão.
              </div>
            ) : (
              <Accordion type="single" collapsible className="w-full space-y-3">
                {Object.entries(virtualInvoices)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([month, data]: [string, any]) => {
                    const [yearStr, monthStr] = month.split("-");
                    const monthName = new Date(Number(yearStr), Number(monthStr) - 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
                    const isFullyPaid = Math.abs(data.total - data.paid) < 0.01;

                    return (
                      <AccordionItem key={month} value={month} className="border rounded-xl px-4 bg-card shadow-sm">
                        <AccordionTrigger className="hover:no-underline py-4">
                          <div className="flex flex-1 items-center justify-between pr-4">
                            <div className="flex items-center gap-3">
                              <CalendarDays className="size-5 text-muted-foreground" />
                              <span className="font-bold text-base capitalize">{monthName}</span>
                            </div>
                            <div className="text-right">
                              <span className={`text-lg font-bold ${isFullyPaid ? 'text-inflow' : 'text-foreground'}`}>
                                {formatMoney(data.total)}
                              </span>
                              {isFullyPaid ? (
                                <Badge variant="outline" className="ml-3 bg-inflow/10 text-inflow border-inflow/20">Paga</Badge>
                              ) : (
                                <Badge variant="outline" className="ml-3 bg-pending/10 text-pending-foreground border-pending/20">Falta {formatMoney(data.total - data.paid)}</Badge>
                              )}
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-2 pb-4">
                          <div className="space-y-3">
                            {data.installments.map((inst: any, i: number) => (
                              <div key={i} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
                                <div>
                                  <p className="font-semibold">{inst.personName || "Desconhecido"}</p>
                                  <p className="text-xs text-muted-foreground">Parcela {inst.parcelNumber} de {inst.quantityInstallments || "?"}</p>
                                </div>
                                <div className="text-right font-medium">
                                  {formatMoney(inst.amount)}
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="mt-4 pt-4 border-t flex justify-end">
                            <Button disabled={isFullyPaid} className="rounded-full bg-primary" onClick={() => { setSelectedMonthToPay(month); setPayModalOpen(true); }}>
                              Baixar Fatura de {monthName.split(" ")[0]}
                            </Button>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
              </Accordion>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {selectedMonthToPay && selectedCardId && virtualInvoices[selectedMonthToPay] && (
        <PayInvoiceDialog
          open={payModalOpen}
          onOpenChange={(val) => { setPayModalOpen(val); if (!val) setSelectedMonthToPay(null); }}
          monthStr={selectedMonthToPay}
          monthName={new Date(Number(selectedMonthToPay.split("-")[0]), Number(selectedMonthToPay.split("-")[1]) - 1).toLocaleString("pt-BR", { month: "long", year: "numeric" })}
          openInstallments={virtualInvoices[selectedMonthToPay].installments}
          paymentInstrumentId={selectedCardId}
        />
      )}
    </>
  );
}