import { cn } from "@/lib/utils";
import type { InstallmentStatus, InvoiceStatus, PaymentStatus } from "@/lib/api/types";

const invoiceLabels: Record<InvoiceStatus, { label: string; className: string }> = {
  OPEN: { label: "Em aberto", className: "bg-pending-soft text-pending-foreground" },
  PARTIALLY_PAID: { label: "Parcialmente paga", className: "bg-grape-soft text-grape" },
  FINALIZED: { label: "Quitada", className: "bg-inflow-soft text-inflow" },
  CANCELLED: { label: "Cancelada", className: "bg-muted text-muted-foreground" },
};

const installmentLabels: Record<PaymentStatus, { label: string; className: string }> = {
  OPEN: { label: "Em aberto", className: "bg-pending-soft text-pending-foreground" },
  FINALIZED: { label: "Paga", className: "bg-inflow-soft text-inflow" },
  PARTIALLY_PAID: { label: "Parcial", className: "bg-grape-soft text-grape" },
  CANCELLED: { label: "Cancelada", className: "bg-muted text-muted-foreground" },
};

const base = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold";

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const item = invoiceLabels[status];
  return <span className={cn(base, item.className)}>{item.label}</span>;
}

export function InstallmentStatusBadge({ status }: { status: PaymentStatus }) {
  const item = installmentLabels[status];
  return <span className={cn(base, item.className)}>{item.label}</span>;
}

export function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span className={cn(base, active ? "bg-inflow-soft text-inflow" : "bg-muted text-muted-foreground")}>
      {active ? "Ativo" : "Inativo"}
    </span>
  );
}
