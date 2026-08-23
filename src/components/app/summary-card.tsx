import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SummaryCardProps {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  tone?: "primary" | "inflow" | "outflow" | "pending" | "grape";
}

const tones = {
  primary: "bg-primary/10 text-primary",
  inflow: "bg-inflow-soft text-inflow",
  outflow: "bg-outflow-soft text-outflow",
  pending: "bg-pending-soft text-pending-foreground",
  grape: "bg-grape-soft text-grape",
} as const;

export function SummaryCard({ label, value, hint, icon, tone = "primary" }: SummaryCardProps) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {icon ? (
          <span className={cn("flex size-9 items-center justify-center rounded-xl", tones[tone])}>{icon}</span>
        ) : null}
      </div>
      <p className="mt-3 text-money text-2xl font-bold text-card-foreground sm:text-3xl">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
