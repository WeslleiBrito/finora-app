import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { SummaryCard } from "@/components/app/summary-card";
import { InstallmentStatusBadge } from "@/components/app/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { dashboardSummaryQuery, invoicesQuery, operationTypesQuery, accountsQuery, investmentDashboardsQuery } from "@/lib/api/queries";
import { formatDate, formatMoney } from "@/lib/format";
import { PaymentDialog } from "@/components/modals/payment-dialog";
import { NewInvoiceDialog } from "@/components/modals/new-invoice-dialog";
import { 
  ArrowDownRight, 
  ArrowUpRight, 
  PiggyBank, 
  CalendarClock, 
  LayoutList, 
  CreditCard,
  Landmark
} from "lucide-react";

export const Route = createFileRoute("/_privado/dashboard")({
  head: () => ({
    meta: [
      { title: "Resumo financeiro — Poupi" },
      { name: "description", content: "Patrimônio, saldo consolidado, parcelas a vencer e movimentações recentes." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const [raioXTab, setRaioXTab] = useState("OUTFLOW");
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedInstallmentToPay, setSelectedInstallmentToPay] = useState<any>(null);

  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invoiceDirection, setInvoiceDirection] = useState<"PAYMENT" | "RECEIPT">("PAYMENT");

  const { data: summary, isLoading } = useQuery(dashboardSummaryQuery);
  const invoices = useQuery(invoicesQuery);
  const operationTypes = useQuery(operationTypesQuery);
  const accountsRes = useQuery(accountsQuery);
  
  const accounts = accountsRes.data ?? [];

  // Busca em paralelo o dashboard de investimentos de todas as contas
  const investmentQueries = useQueries({
    queries: accounts.filter((a: any) => a.type !== "WALLET").map((acc: any) => ({
      ...investmentDashboardsQuery(acc.id),
      enabled: !!acc.id,
    }))
  });

  // CORREÇÃO 1: Usando o nome correto do DTO (totalProjectedNetBalance) e garantindo fallback Numérico
  const totalInvestments = investmentQueries.reduce((acc, query) => {
    const dbs = (query.data as any[]) ?? [];
    return acc + dbs.reduce((sum, inv) => sum + Number(inv.totalProjectedNetBalance || 0), 0);
  }, 0);

  // CORREÇÃO 2: Garantindo que o saldo das contas seja tratado como Número estrito
  const saldoContas = Number(summary?.totalBalance || 0);
  const patrimonioTotal = saldoContas + totalInvestments;

  const typeById = new Map((operationTypes.data || []).map((t) => [t.id, t]));
  
  const openInstallments = (invoices.data ?? [])
    .filter((i) => i.status !== "CANCELLED")
    .flatMap((invoice) =>
      invoice.installments
        .filter((p) => p.status === "OPEN" || p.status === "PARTIALLY_PAID")
        .map((p) => ({ invoice, installment: p, type: typeById.get(invoice.operationTypeId) })),
    )
    .sort((a, b) => a.installment.dueDate.localeCompare(b.installment.dueDate));

  const outflowCatData = summary?.outflowByCategory || [];
  const outflowInstData = summary?.outflowByInstrument || [];
  const inflowCatData = summary?.inflowByCategory || [];
  const inflowInstData = summary?.inflowByInstrument || [];

  const totalOutflows = outflowCatData.reduce((acc, curr) => acc + Number(curr.value || 0), 0);
  const totalInflows = inflowCatData.reduce((acc, curr) => acc + Number(curr.value || 0), 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-muted-foreground">
        Carregando painel financeiro...
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <PageHeader 
        title="Olá! Aqui está o seu mês" 
        description="Um resumo rápido de quanto você tem, quanto entra e quanto sai." 
        action={
          <div className="flex gap-2">
            <Button 
              className="rounded-full bg-outflow hover:bg-outflow/90 text-white border-none shadow-sm" 
              onClick={() => { setInvoiceDirection("PAYMENT"); setInvoiceModalOpen(true); }}
            >
              <ArrowDownRight className="mr-2 size-4" />
              Saída
            </Button>
            <Button 
              className="rounded-full bg-inflow hover:bg-inflow/90 text-white border-none shadow-sm" 
              onClick={() => { setInvoiceDirection("RECEIPT"); setInvoiceModalOpen(true); }}
            >
              <ArrowUpRight className="mr-2 size-4" />
              Entrada
            </Button>
          </div>
        } 
      />

      {/* Caixa de Patrimônio Injetada e Valores formatados de forma segura */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Patrimônio Total" value={formatMoney(patrimonioTotal)} hint="Contas + Investimentos" icon={<Landmark className="size-5" />} />
        <SummaryCard label="Saldo das Contas" value={formatMoney(saldoContas)} hint="Soma das contas ativas" icon={<PiggyBank className="size-5" />} />
        <SummaryCard label="A receber" value={formatMoney(Number(summary?.toReceive || 0))} hint="Parcelas de entrada em aberto" tone="inflow" icon={<ArrowUpRight className="size-5" />} />
        <SummaryCard label="A pagar" value={formatMoney(Number(summary?.toPay || 0))} hint="Parcelas de saída em aberto" tone="outflow" icon={<ArrowDownRight className="size-5" />} />
        <SummaryCard label="Vencendo em 15 dias" value={String(summary?.dueSoonCount || 0)} hint={summary?.dueSoonCount ? "Confira antes que vire juros" : "Nada urgente por aqui"} tone="pending" icon={<CalendarClock className="size-5" />} />
      </div>

      <Tabs value={raioXTab} onValueChange={setRaioXTab} className="mt-8 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Raio-X do Mês</h2>
          <TabsList>
            <TabsTrigger value="INFLOW">Entradas</TabsTrigger>
            <TabsTrigger value="OUTFLOW">Saídas</TabsTrigger>
          </TabsList>
        </div>

        {["INFLOW", "OUTFLOW"].map(tabType => {
          const isOutflow = tabType === "OUTFLOW";
          const currentCatData = isOutflow ? outflowCatData : inflowCatData;
          const currentInstData = isOutflow ? outflowInstData : inflowInstData;
          const currentTotal = isOutflow ? totalOutflows : totalInflows;
          const colorBg = isOutflow ? "bg-outflow" : "bg-inflow";
          const colorText = isOutflow ? "text-outflow" : "text-inflow";
          const wordGasto = isOutflow ? "gastou" : "recebeu";
          const wordPago = isOutflow ? "pagou" : "recebeu";
          const descText = isOutflow ? "Despesas pagas" : "Receitas baixadas";

          return (
            <TabsContent key={tabType} value={tabType} className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-2xl border bg-card p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <LayoutList className={`size-5 ${colorText}`} />
                  <div><h3 className="font-bold">Onde você {wordGasto}</h3><p className="text-xs text-muted-foreground">{descText} agrupadas por operação</p></div>
                </div>
                <div className="space-y-4">
                  {currentCatData.length === 0 ? (<p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">Sem registros neste mês.</p>) : (
                    currentCatData.map(item => {
                      const itemVal = Number(item.value || 0);
                      const pct = currentTotal > 0 ? Math.round((itemVal / currentTotal) * 100) : 0;
                      return (
                        <div key={item.name}>
                          <div className="flex justify-between text-sm mb-1"><span className="font-medium">{item.name}</span><span className="font-bold text-muted-foreground">{formatMoney(itemVal)}</span></div>
                          <div className="h-2 w-full bg-secondary rounded-full overflow-hidden flex items-center relative">
                            <div className={`h-full ${colorBg} transition-all`} style={{ width: `${pct}%` }} />
                            <span className="text-[10px] ml-2 text-muted-foreground absolute right-2 font-mono">{pct}%</span>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </section>

              <section className="rounded-2xl border bg-card p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <CreditCard className={`size-5 ${colorText}`} />
                  <div><h3 className="font-bold">Como você {wordPago}</h3><p className="text-xs text-muted-foreground">{descText} agrupadas por instrumento</p></div>
                </div>
                <div className="space-y-4">
                  {currentInstData.length === 0 ? (<p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">Sem registros neste mês.</p>) : (
                    currentInstData.map(item => {
                      const itemVal = Number(item.value || 0);
                      const pct = currentTotal > 0 ? Math.round((itemVal / currentTotal) * 100) : 0;
                      return (
                        <div key={item.name}>
                          <div className="flex justify-between text-sm mb-1"><span className="font-medium">{item.name}</span><span className="font-bold text-muted-foreground">{formatMoney(itemVal)}</span></div>
                          <div className="h-2 w-full bg-secondary rounded-full overflow-hidden flex items-center relative">
                            <div className={`h-full ${colorBg} transition-all`} style={{ width: `${pct}%` }} />
                            <span className="text-[10px] ml-2 text-muted-foreground absolute right-2 font-mono">{pct}%</span>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </section>
            </TabsContent>
          );
        })}
      </Tabs>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="text-lg font-bold">Entradas x saídas</h2>
          <p className="text-sm text-muted-foreground">Movimentações efetivadas por mês</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summary?.chartData || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} width={60} />
                <Tooltip formatter={(value: any) => formatMoney(Number(value || 0))} contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)" }} />
                <Bar dataKey="entradas" fill="var(--inflow)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="saidas" fill="var(--outflow)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-5 shadow-sm flex flex-col">
          <div className="flex items-center justify-between shrink-0">
            <h2 className="text-lg font-bold">Próximas parcelas</h2>
            <Link to="/faturas" className="text-sm font-semibold text-primary hover:underline">Ver todas</Link>
          </div>
          <div className="mt-4 flex-1 overflow-y-auto pr-2">
            <ul className="space-y-3">
              {openInstallments.slice(0, 5).map(({ invoice, installment, type }) => (
                <li 
                  key={installment.id} 
                  className="rounded-xl border p-3 bg-card hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => {
                    setSelectedInstallmentToPay({
                      ...installment,
                      invoiceData: invoice,
                      personName: invoice.person?.name || "Desconhecido", 
                      remainingBalance: Number(installment.amount || 0) - Number(installment.totalPaid || 0),
                    });
                    setPaymentModalOpen(true);
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold hover:text-primary transition-colors">{type?.name ?? "Operação"} · parcela {installment.parcelNumber}/{invoice.quantityInstallments}</p>
                      <p className="text-xs text-muted-foreground">Vence em {formatDate(installment.dueDate)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-money text-sm font-bold">{formatMoney(Number(installment.amount || 0) - Number(installment.totalPaid || 0))}</p>
                      <InstallmentStatusBadge status={installment.status} />
                    </div>
                  </div>
                </li>
              ))}
              {openInstallments.length === 0 ? (<li className="rounded-xl bg-inflow-soft p-4 text-sm text-inflow">Tudo em dia — nenhuma parcela em aberto.</li>) : null}
            </ul>
          </div>
        </section>
      </div>

      <PaymentDialog 
        open={paymentModalOpen} 
        onOpenChange={setPaymentModalOpen} 
        installment={selectedInstallmentToPay}
        onSuccess={() => setSelectedInstallmentToPay(null)} 
      />

      <NewInvoiceDialog 
        open={invoiceModalOpen} 
        onOpenChange={setInvoiceModalOpen} 
        defaultDirection={invoiceDirection} 
      />
    </div>
  );
}