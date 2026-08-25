import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CreditCard, PieChart, Receipt, ShieldCheck, Sparkles, Wallet } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Poupi — organize contas, cartões e faturas" },
      {
        name: "description",
        content:
          "Um jeito leve de acompanhar contas bancárias, cartões de crédito, faturas parceladas e cada pagamento do mês.",
      },
      { property: "og:title", content: "Poupi — organize contas, cartões e faturas" },
      {
        property: "og:description",
        content: "Contas, cartões, faturas parceladas e extrato em um app leve e colorido.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: Wallet,
    title: "Todas as contas juntas",
    text: "Corrente, poupança, investimento e carteira com saldo consolidado.",
    tone: "bg-inflow-soft text-inflow",
  },
  {
    icon: CreditCard,
    title: "Cartões sob controle",
    text: "Limite usado, dia de fechamento e vencimento sempre à vista.",
    tone: "bg-grape-soft text-grape",
  },
  {
    icon: Receipt,
    title: "Faturas parceladas",
    text: "Crie a fatura, gere as parcelas e registre cada pagamento.",
    tone: "bg-pending-soft text-pending-foreground",
  },
  {
    icon: PieChart,
    title: "Relatórios claros",
    text: "Entradas x saídas por período, sem planilha e sem jargão.",
    tone: "bg-primary/10 text-primary",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Sparkles className="size-5" />
          </span>
          <span className="font-display text-lg font-bold">Poupi</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/login"
            className="rounded-full px-4 py-2 text-sm font-semibold text-foreground hover:bg-secondary"
          >
            Entrar
          </Link>
          <Link
            to="/cadastro"
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Criar conta
          </Link>
        </div>
      </header>

      <main>
        <section className="mx-auto grid w-full max-w-6xl gap-10 px-5 pb-16 pt-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:pt-16">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
              <ShieldCheck className="size-3.5" /> Seus dados, do seu jeito
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight sm:text-5xl">
              O seu dinheiro explicado em <span className="text-primary">palavras simples</span>.
            </h1>
            <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
              Contas, cartões, faturas parceladas e pagamentos em um só lugar. Nada de planilha, nada de
              termos difíceis — só o que você precisa saber para decidir hoje.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                to="/cadastro"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Começar agora <ArrowRight className="size-4" />
              </Link>
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 rounded-full border px-6 py-3 text-sm font-semibold transition-colors hover:bg-secondary"
              >
                Ver demonstração
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border bg-card p-6 shadow-lg">
            <p className="text-sm text-muted-foreground">Saldo disponível</p>
            <p className="text-money mt-1 text-4xl font-extrabold">R$ 51.681,75</p>
            <div className="mt-6 space-y-3">
              <PreviewRow label="Entradas do mês" value="+ R$ 9.800,00" tone="text-inflow" />
              <PreviewRow label="Saídas do mês" value="− R$ 3.817,40" tone="text-outflow" />
              <PreviewRow label="Parcelas a vencer" value="R$ 4.700,00" tone="text-pending-foreground" />
            </div>
            <div className="mt-6 rounded-2xl bg-pending-soft p-4 text-sm text-pending-foreground">
              Você tem <strong>3 parcelas</strong> vencendo nos próximos 15 dias.
            </div>
          </div>
        </section>

        <section className="border-y bg-card/60">
          <div className="mx-auto grid w-full max-w-6xl gap-5 px-5 py-14 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ icon: Icon, title, text, tone }) => (
              <div key={title} className="rounded-2xl border bg-card p-5">
                <span className={`flex size-10 items-center justify-center rounded-xl ${tone}`}>
                  <Icon className="size-5" />
                </span>
                <h2 className="mt-4 text-base font-bold">{title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function PreviewRow({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-secondary/60 px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-money text-sm font-bold ${tone}`}>{value}</span>
    </div>
  );
}
