import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CreditCard } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { ActiveBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { banksQuery, cardBrandsQuery, cardsQuery } from "@/lib/api/queries";
import { api } from "@/lib/api/store";
import { formatMoney } from "@/lib/format";

export const Route = createFileRoute("/_privado/cartoes")({
  head: () => ({
    meta: [
      { title: "Cartões de crédito — Poupi" },
      { name: "description", content: "Limite disponível, fechamento e vencimento de cada cartão." },
      { property: "og:title", content: "Cartões de crédito — Poupi" },
      { property: "og:description", content: "Limite disponível, fechamento e vencimento de cada cartão." },
    ],
  }),
  component: CardsPage,
});

function CardsPage() {
  const cards = useQuery(cardsQuery);
  const brands = useQuery(cardBrandsQuery);
  const banks = useQuery(banksQuery);
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [limit, setLimit] = useState("1000");
  const [closingDay, setClosingDay] = useState("5");
  const [dueDay, setDueDay] = useState("12");
  const [brandId, setBrandId] = useState("");
  const [bankId, setBankId] = useState("");

  const create = useMutation({
    mutationFn: () =>
      api.createCreditCard({
        name,
        creditLimit: Number(limit) || 0,
        closingDay: Number(closingDay) || 1,
        dueDay: Number(dueDay) || 1,
        cardBrand: brandId,
        ...(bankId ? { bank: bankId } : {}),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["credit-cards"] });
      toast.success("Cartão cadastrado");
      setOpen(false);
      setName("");
    },
  });

  const toggle = useMutation({
    mutationFn: (id: string) => api.toggleCardStatus(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["credit-cards"] });
      toast.success("Status do cartão atualizado");
    },
  });

  return (
    <>
      <PageHeader
        title="Cartões de crédito"
        description="Quanto do limite já foi usado e quando fecha cada fatura."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-full">Novo cartão</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo cartão de crédito</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="card-name">Nome do cartão</Label>
                  <Input id="card-name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Bandeira</Label>
                    <Select value={brandId} onValueChange={setBrandId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {(brands.data ?? []).map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Banco</Label>
                    <Select value={bankId} onValueChange={setBankId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {(banks.data ?? []).map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="card-limit">Limite</Label>
                    <Input id="card-limit" type="number" value={limit} onChange={(e) => setLimit(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="card-close">Fechamento</Label>
                    <Input
                      id="card-close"
                      type="number"
                      min={1}
                      max={31}
                      value={closingDay}
                      onChange={(e) => setClosingDay(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="card-due">Vencimento</Label>
                    <Input
                      id="card-due"
                      type="number"
                      min={1}
                      max={31}
                      value={dueDay}
                      onChange={(e) => setDueDay(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  className="rounded-full"
                  disabled={!name || !brandId || create.isPending}
                  onClick={() => create.mutate()}
                >
                  Cadastrar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {(cards.data ?? []).map((card) => {
          const used = card.creditLimit - card.availableLimit;
          const pct = card.creditLimit ? Math.round((used / card.creditLimit) * 100) : 0;
          return (
            <article key={card.id} className="rounded-2xl border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <span className="flex size-10 items-center justify-center rounded-xl bg-grape-soft text-grape">
                  <CreditCard className="size-5" />
                </span>
                <ActiveBadge active={card.status === "ACTIVE"} />
              </div>
              <h2 className="mt-4 text-base font-bold">{card.cardHolderName}</h2>
              <p className="text-xs text-muted-foreground">
                {card.cardBrand.name}
                {card.bank ? ` · ${card.bank.name}` : ""}
              </p>

              <div className="mt-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-money text-xl font-bold">{formatMoney(card.availableLimit)}</span>
                  <span className="text-xs text-muted-foreground">de {formatMoney(card.creditLimit)}</span>
                </div>
                <Progress value={pct} className="mt-2 h-2" />
                <p className="mt-1 text-xs text-muted-foreground">{pct}% do limite usado</p>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div className="rounded-lg bg-secondary/60 p-2">
                  <dt>Fecha dia</dt>
                  <dd className="font-semibold text-foreground">{card.closeDay}</dd>
                </div>
                <div className="rounded-lg bg-secondary/60 p-2">
                  <dt>Vence dia</dt>
                  <dd className="font-semibold text-foreground">{card.dueDay}</dd>
                </div>
                <div className="rounded-lg bg-secondary/60 p-2">
                  <dt>Juros rotativo</dt>
                  <dd className="font-semibold text-foreground">{card.revolvingInterest}%</dd>
                </div>
                <div className="rounded-lg bg-secondary/60 p-2">
                  <dt>Multa</dt>
                  <dd className="font-semibold text-foreground">{card.fine}%</dd>
                </div>
              </dl>

              <Button
                variant="outline"
                size="sm"
                className="mt-4 w-full rounded-full"
                onClick={() => toggle.mutate(card.id)}
              >
                {card.status === "ACTIVE" ? "Bloquear" : "Reativar"}
              </Button>
            </article>
          );
        })}
      </div>
    </>
  );
}
