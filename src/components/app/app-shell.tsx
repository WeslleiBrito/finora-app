import { Link, useRouterState } from "@tanstack/react-router";
import {
  CreditCard,
  FileText,
  Landmark,
  LayoutDashboard,
  ReceiptText,
  Settings2,
  Sparkles,
  UserRound,
  ArrowDownToLine,
  ArrowUpFromLine,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

const nav = [
  { to: "/dashboard", label: "Início", icon: LayoutDashboard },
  { to: "/contas", label: "Contas", icon: Landmark },
  { to: "/cartoes", label: "Cartões", icon: CreditCard },
  { to: "/pagar", label: "A Pagar", icon: ArrowDownToLine },
  { to: "/receber", label: "A Receber", icon: ArrowUpFromLine },
  { to: "/transacoes", label: "Extrato", icon: ReceiptText },
] as const;

const secondary = [
  { to: "/cadastros", label: "Cadastros", icon: Settings2 },
  { to: "/perfil", label: "Perfil", icon: UserRound },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r bg-sidebar p-5 lg:flex">
        <Link to="/dashboard" className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Sparkles className="size-5" />
          </span>
          <span className="font-display text-lg font-bold">Poupi</span>
        </Link>

        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {nav.map((item) => (
            <SideLink key={item.to} {...item} active={pathname.startsWith(item.to)} />
          ))}
          <div className="my-3 border-t" />
          {secondary.map((item) => (
            <SideLink key={item.to} {...item} active={pathname.startsWith(item.to)} />
          ))}
        </nav>

        <div className="rounded-2xl bg-sidebar-accent p-3">
          <p className="text-sm font-semibold text-sidebar-accent-foreground">{user?.name ?? "Visitante"}</p>
          <p className="truncate text-xs text-muted-foreground">{user?.email ?? ""}</p>
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-background/90 px-4 py-3 backdrop-blur lg:hidden">
        <Link to="/dashboard" className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="size-4" />
          </span>
          <span className="font-display font-bold">Poupi</span>
        </Link>
        <Link to="/perfil" className="flex size-9 items-center justify-center rounded-full bg-secondary">
          <UserRound className="size-4" />
        </Link>
      </header>

      <main className="px-4 pb-28 pt-5 sm:px-6 lg:ml-64 lg:px-10 lg:pb-14 lg:pt-8">
        <div className="mx-auto w-full max-w-6xl space-y-6">{children}</div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t bg-background/95 px-2 py-2 backdrop-blur lg:hidden">
        {nav.map(({ to, label, icon: Icon }) => {
          const active = pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex min-w-16 flex-col items-center gap-1 rounded-xl px-2 py-1 text-[11px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg transition-colors",
                  active && "bg-primary/12",
                )}
              >
                <Icon className="size-4" />
              </span>
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function SideLink({
  to,
  label,
  icon: Icon,
  active,
}: {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-primary text-sidebar-primary-foreground"
          : "text-sidebar-foreground hover:bg-sidebar-accent",
      )}
    >
      <Icon className="size-4" />
      {label}
    </Link>
  );
}
