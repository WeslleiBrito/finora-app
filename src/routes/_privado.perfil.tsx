import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LogOut, Mail, ShieldCheck, UserRound } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_privado/perfil")({
  head: () => ({
    meta: [
      { title: "Perfil — Poupi" },
      { name: "description", content: "Seus dados de conta sincronizados com a autenticação Firebase." },
      { property: "og:title", content: "Perfil — Poupi" },
      { property: "og:description", content: "Seus dados de conta sincronizados com a autenticação Firebase." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <>
      <PageHeader title="Seu perfil" description="Dados sincronizados com o backend via /api/users/sync." />

      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <UserRound className="size-7" />
          </span>
          <div>
            <h2 className="text-lg font-bold">{user?.name ?? "Visitante"}</h2>
            <p className="text-sm text-muted-foreground">{user?.email ?? ""}</p>
          </div>
        </div>

        <dl className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-secondary/60 p-4">
            <dt className="flex items-center gap-2 text-xs text-muted-foreground">
              <Mail className="size-3.5" /> E-mail
            </dt>
            <dd className="mt-1 text-sm font-semibold">{user?.email ?? "—"}</dd>
          </div>
          <div className="rounded-xl bg-secondary/60 p-4">
            <dt className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5" /> Autenticação
            </dt>
            <dd className="mt-1 truncate text-sm font-semibold">Firebase (simulado)</dd>
          </div>
        </dl>

        <Button
          variant="outline"
          className="mt-6 rounded-full"
          onClick={() => {
            signOut();
            void navigate({ to: "/" });
          }}
        >
          <LogOut className="size-4" /> Sair da conta
        </Button>
      </section>

      <section className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
        Protótipo com dados simulados. Na integração real, este perfil virá de{" "}
        <code className="rounded bg-secondary px-1">GET /api/users/me</code> após o login Firebase.
      </section>
    </>
  );
}
