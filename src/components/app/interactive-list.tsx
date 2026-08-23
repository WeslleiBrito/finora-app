import { ChevronRight } from "lucide-react";
import { ActiveBadge } from "@/components/app/status-badge";

export interface ListItemProps {
  id: string;
  title: string;
  subtitle?: string | undefined;
  active: boolean;
  raw: any;
}

export function InteractiveList({
  items,
  onSelect,
}: {
  items: ListItemProps[];
  onSelect?: (item: ListItemProps) => void;
}) {
  return (
    <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <li
          key={item.id}
          onClick={() => onSelect && onSelect(item)}
          className={`group flex items-center justify-between rounded-2xl border bg-card p-4 shadow-sm transition-all ${
            onSelect ? "cursor-pointer hover:border-primary/50 hover:bg-secondary/30 hover:shadow-md" : ""
          }`}
        >
          <div className="space-y-0.5 pr-2">
            <p className="text-sm font-semibold transition-colors group-hover:text-primary">
              {item.title}
            </p>
            {item.subtitle && <p className="text-xs text-muted-foreground">{item.subtitle}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {item.raw.category !== "pessoas" && <ActiveBadge active={item.active} />}
            {onSelect && (
              <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            )}
          </div>
        </li>
      ))}
      {items.length === 0 && (
        <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
          Nenhum registro encontrado.
        </p>
      )}
    </ul>
  );
}