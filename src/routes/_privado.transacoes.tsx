import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { accountsQuery, invoicesQuery, operationTypesQuery, transactionsQuery } from "@/lib/api/queries";
import { api } from "@/lib/api/store";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_privado/transacoes")({
  head: () => ({
    meta: [
      { title: "Extrato — Poupi" },
      { name: "description", content: "Todas as movimentações efetivadas, com juros, descontos e estornos." },
      { property: "og:title", content: "Extrato — Poupi" },
      { property: "og:description", content: "Todas as movimentações efetivadas, com juros, descontos e estornos." },
    ],
  }),
  component: TransactionsPage,
});

const filters = [
  { value: "ALL", label: "Todas" },
  { value: "INFLOW", label: "Entradas" },
  { value: "OUTFLOW", label: "Saídas" },
] as const;

function TransactionsPage() {
  const transactions = useQuery(transactionsQuery);
  const accounts = useQuery(accountsQuery);
  const invoices = useQuery(invoicesQuery);
  const types = useQuery(operationTypesQuery);
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<(typeof filters)[number]["value"]>("ALL");

  const accountById = new Map((accounts.data ?? []).map((a) => [a.id, a]));
  const typeById = new Map((types.data ?? []).map((t) => [t.id, t]));
  const invoiceByInstallment = new Map(
    (invoices.data ?? []).flatMap((invoice) => invoice.installments.map((p) => [p.id, invoice] as const)),
  );

  const reverse = useMutation({
    mutationFn: (id: string) => api.reverseTransaction(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Transação estornada");
    },
  });

  const list = (transactions.data ?? []).filter(
    (t) => filter === "ALL" || t.movementDirection === filter,
  );

  return (
    <>
      <PageHeader title="Extrato" description="Cada pagamento ou recebimento efetivado nas suas contas." />

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

      <ul className="space-y-3">
        {list.map((t) => {
          const inflow = t.movementDirection === "INFLOW";
          const invoice = invoiceByInstallment.get(t.installmentId);
          const type = invoice ? typeById.get(invoice.operationTypeId) : undefined;
          return (
            <li
              key={t.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex size-10 items-center justify-center rounded-xl",
                    inflow ? "bg-inflow-soft text-inflow" : "bg-outflow-soft text-outflow",
                  )}
                >
                  {inflow ? <ArrowUpRight className="size-5" /> : <ArrowDownRight className="size-5" />}
                </span>
                <div>
                  <p className="text-sm font-semibold">
                    {type?.name ?? "Movimentação"}
                    {t.movementType === "REVERSAL" ? " (estorno)" : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(t.paymentDate)} · {accountById.get(t.accountId)?.name ?? "—"}
                    {invoice ? (
                      <>
                        {" · "}
                        <Link
                          to="/faturas/$id"
                          params={{ id: invoice.id }}
                          className="font-semibold text-primary hover:underline"
                        >
                          ver fatura
                        </Link>
                      </>
                    ) : null}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className={cn("text-money text-sm font-bold", inflow ? "text-inflow" : "text-outflow")}>
                    {inflow ? "+" : "−"}
                    {formatMoney(t.effectiveAmount)}
                  </p>
                  {t.discount > 0 || t.interest > 0 || t.fine > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {t.discount > 0 ? `desc. ${formatMoney(t.discount)} ` : ""}
                      {t.interest > 0 ? `juros ${formatMoney(t.interest)} ` : ""}
                      {t.fine > 0 ? `multa ${formatMoney(t.fine)}` : ""}
                    </p>
                  ) : null}
                </div>
                {t.movementType !== "REVERSAL" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    disabled={t.reversed || reverse.isPending}
                    onClick={() => reverse.mutate(t.id)}
                  >
                    <Undo2 className="size-4" />
                    {t.reversed ? "Estornada" : "Estornar"}
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
        {list.length === 0 ? (
          <li className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nenhuma movimentação registrada ainda.
          </li>
        ) : null}
      </ul>
    </>
  );
}
