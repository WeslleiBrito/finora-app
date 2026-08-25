import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, CalendarClock, PiggyBank, CreditCard, LayoutList } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/app/page-header";
import { SummaryCard } from "@/components/app/summary-card";
import { InstallmentStatusBadge } from "@/components/app/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { accountsQuery, invoicesQuery, operationTypesQuery, transactionsQuery, paymentInstrumentsQuery } from "@/lib/api/queries";
import { daysUntil, formatDate, formatMoney } from "@/lib/format";
import { PaymentDialog } from "@/components/modals/payment-dialog";

// Importando o dicionário inteligente criado acima
import { PaymentTypeMeta } from "@/lib/constants";

export const Route = createFileRoute("/_privado/dashboard")({
  head: () => ({
    meta: [
      { title: "Resumo financeiro — Poupi" },
      { name: "description", content: "Saldo consolidado, parcelas a vencer e movimentações recentes." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const [raioXTab, setRaioXTab] = useState("OUTFLOW");
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedInstallmentToPay, setSelectedInstallmentToPay] = useState<any>(null);

  const accounts = useQuery(accountsQuery);
  const invoices = useQuery(invoicesQuery);
  const transactions = useQuery(transactionsQuery);
  const operationTypes = useQuery(operationTypesQuery);
  const instruments = useQuery(paymentInstrumentsQuery);

  const totalBalance = (accounts.data ?? []).filter((a) => a.status === "ACTIVE").reduce((sum, a) => sum + a.balance, 0);
  const typeById = new Map((operationTypes.data ?? []).map((t) => [t.id, t]));
  
  // 🌟 HUMANIZANDO O INSTRUMENTO PARA O RAIO-X
  const instrumentById = new Map((instruments.data ?? []).map((i) => [i.id, i.cardHolderName || PaymentTypeMeta[i.paymentType] || i.paymentType]));

  const openInstallments = (invoices.data ?? [])
    .filter((i) => i.status !== "CANCELLED")
    .flatMap((invoice) =>
      invoice.installments
        .filter((p) => p.status === "OPEN" || p.status === "PARTIALLY_PAID")
        .map((p) => ({ invoice, installment: p, type: typeById.get(invoice.operationTypeId) })),
    )
    .sort((a, b) => a.installment.dueDate.localeCompare(b.installment.dueDate));

  const toReceive = openInstallments.filter((i) => i.type?.movementType === "RECEIPT").reduce((sum, i) => sum + (i.installment.amount - i.installment.totalPaid), 0);
  const toPay = openInstallments.filter((i) => i.type?.movementType === "PAYMENT").reduce((sum, i) => sum + (i.installment.amount - i.installment.totalPaid), 0);
  const dueSoon = openInstallments.filter((i) => daysUntil(i.installment.dueDate) <= 15);
  
  const chartData = buildMonthlyChart((transactions.data)?.filter((i) => i.movementType === "RECEIPT" || i.movementType === "PAYMENT") ?? []);

  const currentMonthPrefix = new Date().toISOString().slice(0, 7); 
  const opTypeByInstallmentId = new Map<string, string>();
  
  (invoices.data ?? []).forEach(inv => {
    const typeName = typeById.get(inv.operationTypeId)?.name ?? "Outros";
    inv.installments.forEach(inst => opTypeByInstallmentId.set(inst.id, typeName));
  });

  const thisMonthTransactions = (transactions.data ?? []).filter(t => t.paymentDate.startsWith(currentMonthPrefix) && !t.reversed && t.installmentId);

  const outflowByCategory = new Map<string, number>();
  const outflowByInstrument = new Map<string, number>();
  let totalOutflows = 0;

  const inflowByCategory = new Map<string, number>();
  const inflowByInstrument = new Map<string, number>();
  let totalInflows = 0;

  thisMonthTransactions.forEach(t => {
    const amount = t.effectiveAmount || 0;
    const catName = opTypeByInstallmentId.get(t.installmentId) ?? "Outros";
    const instName = t.paymentInstrumentId ? (instrumentById.get(t.paymentInstrumentId) ?? "Indefinido") : "Saldo da Conta / Dinheiro";

    if (t.movementDirection === "OUTFLOW") {
      totalOutflows += amount;
      outflowByCategory.set(catName, (outflowByCategory.get(catName) ?? 0) + amount);
      outflowByInstrument.set(instName, (outflowByInstrument.get(instName) ?? 0) + amount);
    } else if (t.movementDirection === "INFLOW") {
      totalInflows += amount;
      inflowByCategory.set(catName, (inflowByCategory.get(catName) ?? 0) + amount);
      inflowByInstrument.set(instName, (inflowByInstrument.get(instName) ?? 0) + amount);
    }
  });

  const outflowCatData = Array.from(outflowByCategory.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const outflowInstData = Array.from(outflowByInstrument.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  const inflowCatData = Array.from(inflowByCategory.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const inflowInstData = Array.from(inflowByInstrument.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-6 pb-12">
      <PageHeader title="Olá! Aqui está o seu mês" description="Um resumo rápido de quanto você tem, quanto entra e quanto sai." action={<Link to="/faturas/nova" className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">Nova fatura</Link>} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Saldo consolidado" value={formatMoney(totalBalance)} hint={`${accounts.data?.length ?? 0} contas cadastradas`} icon={<PiggyBank className="size-5" />} />
        <SummaryCard label="A receber" value={formatMoney(toReceive)} hint="Parcelas de entrada em aberto" tone="inflow" icon={<ArrowUpRight className="size-5" />} />
        <SummaryCard label="A pagar" value={formatMoney(toPay)} hint="Parcelas de saída em aberto" tone="outflow" icon={<ArrowDownRight className="size-5" />} />
        <SummaryCard label="Vencendo em 15 dias" value={String(dueSoon.length)} hint={dueSoon.length ? "Confira antes que vire juros" : "Nada urgente por aqui"} tone="pending" icon={<CalendarClock className="size-5" />} />
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
                      const pct = currentTotal > 0 ? Math.round((item.value / currentTotal) * 100) : 0;
                      return (
                        <div key={item.name}>
                          <div className="flex justify-between text-sm mb-1"><span className="font-medium">{item.name}</span><span className="font-bold text-muted-foreground">{formatMoney(item.value)}</span></div>
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
                      const pct = currentTotal > 0 ? Math.round((item.value / currentTotal) * 100) : 0;
                      return (
                        <div key={item.name}>
                          <div className="flex justify-between text-sm mb-1"><span className="font-medium">{item.name}</span><span className="font-bold text-muted-foreground">{formatMoney(item.value)}</span></div>
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
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} width={60} />
                <Tooltip formatter={(value: any) => formatMoney(Number(value))} contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)", }} />
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
                      personName: invoice.person?.name || "Desconhecido", // 🌟 BUG CORRIGIDO AQUI!
                      remainingBalance: installment.amount - (installment.totalPaid || 0),
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
                      <p className="text-money text-sm font-bold">{formatMoney(installment.amount - installment.totalPaid)}</p>
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
    </div>
  );
}

function buildMonthlyChart(transactions: { paymentDate: string; effectiveAmount: number; movementDirection: string }[]) {
  const byMonth = new Map<string, { month: string; entradas: number; saidas: number }>();
  for (const t of transactions) {
    const key = t.paymentDate.slice(0, 7);
    const entry = byMonth.get(key) ?? { month: key.slice(5) + "/" + key.slice(2, 4), entradas: 0, saidas: 0 };
    if (t.movementDirection === "INFLOW") entry.entradas += t.effectiveAmount;
    else entry.saidas += t.effectiveAmount;
    byMonth.set(key, entry);
  }
  return [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
}