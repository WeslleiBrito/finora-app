import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { InvoiceStatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { accountsQuery, invoicesQuery, operationTypesQuery, peopleQuery } from "@/lib/api/queries";
import type { InvoiceStatus } from "@/lib/api/types";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_privado/faturas/")({
  head: () => ({
    meta: [
      { title: "Faturas — Poupi" },
      { name: "description", content: "Todas as faturas parceladas com valor total, pago e saldo restante." },
      { property: "og:title", content: "Faturas — Poupi" },
      { property: "og:description", content: "Todas as faturas parceladas com valor total, pago e saldo restante." },
    ],
  }),
  component: InvoicesPage,
});

const filters: { value: InvoiceStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "Todas" },
  { value: "OPEN", label: "Em aberto" },
  { value: "PARTIALLY_PAID", label: "Parciais" },
  { value: "FINALIZED", label: "Quitadas" },
  { value: "CANCELLED", label: "Canceladas" },
];

function InvoicesPage() {
  const invoices = useQuery(invoicesQuery);
  const types = useQuery(operationTypesQuery);
  const people = useQuery(peopleQuery);
  const accounts = useQuery(accountsQuery);
  const [filter, setFilter] = useState<InvoiceStatus | "ALL">("ALL");

  const typeById = new Map((types.data ?? []).map((t) => [t.id, t]));
  const personById = new Map((people.data ?? []).map((p) => [p.id, p]));
  const accountById = new Map((accounts.data ?? []).map((a) => [a.id, a]));

  const list = (invoices.data ?? []).filter((i) => filter === "ALL" || i.status === filter);

  return (
    <>
      <PageHeader
        title="Faturas"
        description="Cada compra ou recebimento parcelado vira uma fatura com suas parcelas."
        action={
          <Button asChild className="rounded-full">
            <Link to="/faturas/nova">Nova fatura</Link>
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
              filter === f.value
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:bg-secondary",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {list.map((invoice) => {
          const type = typeById.get(invoice.operationTypeId);
          const paidPct = invoice.totalAmount
            ? Math.round((invoice.totalPaid / invoice.totalAmount) * 100)
            : 0;
          return (
            <Link
              key={invoice.id}
              to="/faturas/$id"
              params={{ id: invoice.id }}
              className="rounded-2xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold">{type?.name ?? "Operação"}</h2>
                  <p className="text-xs text-muted-foreground">
                    {personById.get(invoice.personId)?.name ?? "—"} ·{" "}
                    {accountById.get(invoice.accountId)?.name ?? "—"}
                  </p>
                </div>
                <InvoiceStatusBadge status={invoice.status} />
              </div>

              <div className="mt-4 flex items-end justify-between">
                <div>
                  <p className="text-money text-2xl font-bold">{formatMoney(invoice.totalAmount)}</p>
                  <p className="text-xs text-muted-foreground">
                    {invoice.quantityInstallments}x · emitida em {formatDate(invoice.issueDate)}
                  </p>
                </div>
                <div className="text-right text-xs">
                  <p className="text-inflow font-semibold">Pago {formatMoney(invoice.totalPaid)}</p>
                  <p className="text-outflow font-semibold">Falta {formatMoney(invoice.remainingBalance)}</p>
                </div>
              </div>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-inflow" style={{ width: `${paidPct}%` }} />
              </div>
            </Link>
          );
        })}
        {list.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nenhuma fatura neste filtro.
          </p>
        ) : null}
      </div>
    </>
  );
}
