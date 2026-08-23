import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, CalendarClock, PiggyBank } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/app/page-header";
import { SummaryCard } from "@/components/app/summary-card";
import { InstallmentStatusBadge } from "@/components/app/status-badge";
import { accountsQuery, invoicesQuery, operationTypesQuery, transactionsQuery } from "@/lib/api/queries";
import { daysUntil, formatDate, formatMoney } from "@/lib/format";

export const Route = createFileRoute("/_privado/dashboard")({
  head: () => ({
    meta: [
      { title: "Resumo financeiro — Poupi" },
      { name: "description", content: "Saldo consolidado, parcelas a vencer e movimentações recentes." },
      { property: "og:title", content: "Resumo financeiro — Poupi" },
      { property: "og:description", content: "Saldo consolidado, parcelas a vencer e movimentações recentes." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const accounts = useQuery(accountsQuery);
  const invoices = useQuery(invoicesQuery);
  const transactions = useQuery(transactionsQuery);
  const operationTypes = useQuery(operationTypesQuery);

  const totalBalance = (accounts.data ?? [])
    .filter((a) => a.status === "ACTIVE")
    .reduce((sum, a) => sum + a.balance, 0);

  const typeById = new Map((operationTypes.data ?? []).map((t) => [t.id, t]));
  const openInstallments = (invoices.data ?? [])
    .filter((i) => i.status !== "CANCELLED")
    .flatMap((invoice) =>
      invoice.installments
        .filter((p) => p.status === "OPEN" ||p.status === "PARTIALLY_PAID")
        .map((p) => ({ invoice, installment: p, type: typeById.get(invoice.operationTypeId) })),
    )
    .sort((a, b) => a.installment.dueDate.localeCompare(b.installment.dueDate));

  const toReceive = openInstallments
    .filter((i) => i.type?.movementType === "RECEIPT")
    .reduce((sum, i) => sum + (i.installment.amount - i.installment.totalPaid), 0);
  const toPay = openInstallments
    .filter((i) => i.type?.movementType === "PAYMENT")
    .reduce((sum, i) => sum + (i.installment.amount - i.installment.totalPaid), 0);

  const dueSoon = openInstallments.filter((i) => daysUntil(i.installment.dueDate) <= 15);

  const chartData = buildMonthlyChart(transactions.data ?? []);

  return (
    <>
      <PageHeader
        title="Olá! Aqui está o seu mês"
        description="Um resumo rápido de quanto você tem, quanto entra e quanto sai."
        action={
          <Link
            to="/faturas/nova"
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Nova fatura
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Saldo consolidado"
          value={formatMoney(totalBalance)}
          hint={`${accounts.data?.length ?? 0} contas cadastradas`}
          icon={<PiggyBank className="size-5" />}
        />
        <SummaryCard
          label="A receber"
          value={formatMoney(toReceive)}
          hint="Parcelas de entrada em aberto"
          tone="inflow"
          icon={<ArrowUpRight className="size-5" />}
        />
        <SummaryCard
          label="A pagar"
          value={formatMoney(toPay)}
          hint="Parcelas de saída em aberto"
          tone="outflow"
          icon={<ArrowDownRight className="size-5" />}
        />
        <SummaryCard
          label="Vencendo em 15 dias"
          value={String(dueSoon.length)}
          hint={dueSoon.length ? "Confira antes que vire juros" : "Nada urgente por aqui"}
          tone="pending"
          icon={<CalendarClock className="size-5" />}
        />
      </div>

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
                <Tooltip
                  formatter={(value: number) => formatMoney(value)}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "var(--card)",
                  }}
                />
                <Bar dataKey="entradas" fill="var(--inflow)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="saidas" fill="var(--outflow)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Próximas parcelas</h2>
            <Link to="/faturas" className="text-sm font-semibold text-primary">
              Ver todas
            </Link>
          </div>
          <ul className="mt-4 space-y-3">
            {openInstallments.slice(0, 5).map(({ invoice, installment, type }) => (
              <li key={installment.id} className="rounded-xl border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link
                      to="/faturas/$id"
                      params={{ id: invoice.id }}
                      className="text-sm font-semibold hover:underline"
                    >
                      {type?.name ?? "Operação"} · parcela {installment.parcelNumber}/{invoice.quantityInstallments}
                    </Link>
                    <p className="text-xs text-muted-foreground">Vence em {formatDate(installment.dueDate)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-money text-sm font-bold">
                      {formatMoney(installment.amount - installment.totalPaid)}
                    </p>
                    <InstallmentStatusBadge status={installment.status} />
                  </div>
                </div>
              </li>
            ))}
            {openInstallments.length === 0 ? (
              <li className="rounded-xl bg-inflow-soft p-4 text-sm text-inflow">
                Tudo em dia — nenhuma parcela em aberto.
              </li>
            ) : null}
          </ul>
        </section>
      </div>
    </>
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
