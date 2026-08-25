import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { InvoiceStatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { invoicesQuery, operationTypesQuery } from "@/lib/api/queries";
import type { InvoiceStatus } from "@/lib/api/types";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// 🌟 IMPORTANDO O MODAL COM O HISTÓRICO E O "COPO ENCHENDO"
import { InvoiceHistoryDialog } from "@/components/modals/invoice-history-dialog";

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
  
  const [filter, setFilter] = useState<InvoiceStatus | "ALL">("ALL");
  const [tab, setTab] = useState("RECEIPT");

  // 🌟 ESTADOS DO MODAL DE HISTÓRICO
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  
  const typeById = new Map((types.data ?? []).map((t) => [t.id, t]));

  // 🌟 FILTRAGEM INTELIGENTE POR ABA E STATUS
  const list = (invoices.data ?? []).filter((i) => {
    const type = typeById.get(i.operationTypeId);
    const matchesTab = type?.movementType === tab; // RECEIPT ou PAYMENT
    const matchesStatus = filter === "ALL" || i.status === filter;
    
    return matchesTab && matchesStatus;
  });

  const renderGrid = () => (
    <div className="grid gap-4 lg:grid-cols-2">
      {list.map((invoice) => {
        const type = typeById.get(invoice.operationTypeId);
        const paidPct = invoice.totalAmount
          ? Math.round((invoice.totalPaid / invoice.totalAmount) * 100)
          : 0;

        const isReceipt = type?.movementType === "RECEIPT";
        const progressColor = isReceipt ? "bg-inflow" : "bg-outflow";
        const textColor = isReceipt ? "text-inflow" : "text-outflow";

        return (
          <div
            key={invoice.id}
            onClick={() => {
              setSelectedInvoice({
                ...invoice,
                // Injeta o tipo na fatura para o modal saber se é entrada ou saída
                operationType: type 
              });
              setHistoryModalOpen(true);
            }}
            className="cursor-pointer rounded-2xl border bg-card p-5 shadow-sm transition-all hover:shadow-md hover:border-primary/50 group"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold group-hover:text-primary transition-colors">{type?.name ?? "Operação"}</h2>
                <p className="text-xs text-muted-foreground">
                  {invoice.person?.name}
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
                <p className={`${textColor} font-semibold`}>Pago {formatMoney(invoice.totalPaid)}</p>
                <p className="text-muted-foreground font-semibold">Falta {formatMoney(invoice.remainingBalance)}</p>
              </div>
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
              <div className={`h-full rounded-full ${progressColor}`} style={{ width: `${paidPct}%` }} />
            </div>
          </div>
        );
      })}
      {list.length === 0 ? (
        <div className="col-span-full rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground bg-muted/10">
          Nenhuma fatura encontrada neste filtro.
        </div>
      ) : null}
    </div>
  );

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

      <Tabs value={tab} onValueChange={setTab} className="mt-6">
        {/* 🌟 CABEÇALHO DOS FILTROS E ABAS */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <TabsList className="w-full lg:w-auto grid grid-cols-2 lg:flex">
            <TabsTrigger value="RECEIPT">Entradas (Receber)</TabsTrigger>
            <TabsTrigger value="PAYMENT">Saídas (Pagar)</TabsTrigger>
          </TabsList>

          <div className="flex flex-wrap gap-2">
            {filters.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                  filter === f.value
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "bg-card text-muted-foreground hover:bg-secondary",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <TabsContent value="RECEIPT" className="m-0 outline-none">
          {renderGrid()}
        </TabsContent>

        <TabsContent value="PAYMENT" className="m-0 outline-none">
          {renderGrid()}
        </TabsContent>
      </Tabs>

      {/* 🌟 MODAL QUE MOSTRA O HISTÓRICO E O COPO ENCHENDO */}
      <InvoiceHistoryDialog 
        open={historyModalOpen} 
        onOpenChange={setHistoryModalOpen} 
        invoice={selectedInvoice} 
      />
    </>
  );
}