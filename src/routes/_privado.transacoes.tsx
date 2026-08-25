import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
// 🌟 CORREÇÃO 1: Adicionado o History na importação do lucide-react
import { ArrowDownCircle, ArrowUpCircle, Undo2, Search, Wallet, CalendarClock, History } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO, isBefore, isAfter, startOfDay, subHours } from "date-fns";

import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

import { accountsQuery, invoicesQuery, operationTypesQuery, transactionsQuery } from "@/lib/api/queries";
import { api } from "@/lib/api/store";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_privado/transacoes")({
  head: () => ({
    meta: [
      { title: "Extrato — Poupi" },
      { name: "description", content: "Todas as movimentações efetivadas, com juros, descontos e estornos." },
    ],
  }),
  component: TransactionsPage,
});

const reversalMessages: Record<string, string> = {
  PAYMENT: "Estorno de despesa (baixa manual ou lote)",
  RECEIPT: "Estorno de receita (baixa manual ou lote)",
  MANUAL_ADJUSTMENT: "Estorno de ajuste manual de saldo",
  TRANSFER: "Estorno de transferência entre contas",
};

function TransactionsPage() {
  const queryClient = useQueryClient();
  
  const transactions = useQuery(transactionsQuery);
  const accounts = useQuery(accountsQuery);
  const invoices = useQuery(invoicesQuery);
  const types = useQuery(operationTypesQuery);

  const [filterType, setFilterType] = useState("ALL");
  const [accountFilter, setAccountFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchName, setSearchName] = useState("");

  const accountById = new Map((accounts.data ?? []).map((a) => [a.id, a]));
  const typeById = new Map((types.data ?? []).map((t) => [t.id, t]));
  const invoiceByInstallment = new Map(
    (invoices.data ?? []).flatMap((invoice: any) => 
      (invoice.installments || []).map((p: any) => [p.id, invoice] as const)
    ),
  );

  const reverse = useMutation({
    mutationFn: (params: { id: string; reason: string }) => 
      api.reverseTransaction(params.id, { reason: params.reason }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Transação estornada com sucesso!");
    },
    onError: (err: any) => toast.error(err.message || "Falha ao estornar a transação"),
  });

  const filteredList = useMemo(() => {
    let list = [...(transactions.data ?? [])];

    if (filterType !== "ALL") {
      list = list.filter((t) => t.movementDirection === filterType);
    }

    if (accountFilter !== "ALL") {
      list = list.filter((t) => t.accountId === accountFilter);
    }

    if (dateFrom) {
      const from = startOfDay(parseISO(dateFrom));
      list = list.filter((t) => !isBefore(startOfDay(parseISO(t.paymentDate)), from));
    }
    if (dateTo) {
      const to = startOfDay(parseISO(dateTo));
      list = list.filter((t) => !isAfter(startOfDay(parseISO(t.paymentDate)), to));
    }

    if (searchName.trim() !== "") {
      const searchLower = searchName.toLowerCase();
      list = list.filter((t) => {
        // 🌟 CORREÇÃO 2: 'as any' para forçar o TypeScript a entender que é um objeto dinâmico
        const invoice = invoiceByInstallment.get(t.installmentId) as any;
        const personName = invoice?.person?.nickname || invoice?.person?.name || "";
        const obs = t.observations || "";
        const typeName = invoice ? typeById.get(invoice.operationTypeId)?.name || "" : "";
        
        return personName.toLowerCase().includes(searchLower) ||
               obs.toLowerCase().includes(searchLower) ||
               typeName.toLowerCase().includes(searchLower);
      });
    }

    list.sort((a, b) => {
      if (a.createdAt > b.createdAt) return -1;
      if (a.createdAt < b.createdAt) return 1;
      return 0;
    });

    return list;
  }, [transactions.data, filterType, accountFilter, dateFrom, dateTo, searchName, invoiceByInstallment, typeById]);

  const getAdjustedTime = (dateString: string) => {
    if (!dateString) return "—";
    try {
      const adjustedDate = subHours(parseISO(dateString), 3);
      return format(adjustedDate, "HH:mm:ss");
    } catch {
      return "—";
    }
  };

  return (
    <>
      <PageHeader title="Extrato Geral" description="O livro-razão de todas as movimentações financeiras do sistema." />

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 bg-muted/20 p-4 rounded-xl border items-end mb-6">
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs text-muted-foreground flex items-center gap-1"><Search className="size-3" /> Busca</Label>
          <Input 
            placeholder="Nome, observação ou categoria..." 
            className="bg-background text-xs" 
            value={searchName} 
            onChange={(e) => setSearchName(e.target.value)} 
          />
        </div>
        
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Movimento</Label>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="bg-background text-xs"><SelectValue placeholder="Todas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas</SelectItem>
              <SelectItem value="INFLOW">Apenas Entradas</SelectItem>
              <SelectItem value="OUTFLOW">Apenas Saídas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground flex items-center gap-1"><Wallet className="size-3" /> Conta</Label>
          <Select value={accountFilter} onValueChange={setAccountFilter}>
            <SelectTrigger className="bg-background text-xs"><SelectValue placeholder="Conta" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas as Contas</SelectItem>
              {(accounts.data ?? []).map((a: any) => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Data Inicial</Label>
          <Input type="date" className="bg-background text-xs px-2" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Data Final</Label>
          <Input type="date" className="bg-background text-xs px-2" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>

        <div className="col-span-full flex justify-end mt-2 border-t pt-3">
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-xs h-8" 
            onClick={() => { setSearchName(""); setDateFrom(""); setDateTo(""); setFilterType("ALL"); setAccountFilter("ALL"); }}
          >
            Limpar Filtros
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="w-[140px]">Data e Hora</TableHead>
              <TableHead>Detalhes da Operação</TableHead>
              <TableHead>Conta</TableHead>
              <TableHead className="text-right">Valor Efetivo</TableHead>
              <TableHead className="w-[120px] text-center">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredList.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-40 text-center text-muted-foreground">
                  <History className="size-8 mx-auto mb-2 opacity-20" />
                  Nenhuma movimentação encontrada com estes filtros.
                </TableCell>
              </TableRow>
            ) : (
              filteredList.map((t) => {
                const inflow = t.movementDirection === "INFLOW";
                // 🌟 CORREÇÃO 2: 'as any' aplicado aqui também
                const invoice = invoiceByInstallment.get(t.installmentId) as any;
                const type = invoice ? typeById.get(invoice.operationTypeId) : undefined;
                const personName = invoice?.person?.nickname || invoice?.person?.name;
                const isReversal = t.movementType === "REVERSAL";

                return (
                  <TableRow key={t.id} className={isReversal ? "bg-muted/10 opacity-80" : ""}>
                    <TableCell className="whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-semibold text-sm">{format(parseISO(t.paymentDate), "dd/MM/yyyy")}</span>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <CalendarClock className="size-3" /> {getAdjustedTime(t.createdAt)}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-3">
                        {inflow ? (
                          <ArrowDownCircle className="size-5 text-inflow shrink-0" />
                        ) : (
                          <ArrowUpCircle className="size-5 text-outflow shrink-0" />
                        )}
                        <div className="flex flex-col max-w-[300px]">
                          <span className="font-semibold text-sm truncate">
                            {type?.name ?? "Movimentação"} {isReversal && <Badge variant="secondary" className="ml-1 text-[9px] py-0">Estorno</Badge>}
                          </span>
                          <span className="text-xs text-muted-foreground truncate" title={personName || t.observations}>
                            {personName ? `${personName} ${t.observations ? `· ${t.observations}` : ''}` : (t.observations || "—")}
                          </span>
                          {invoice && (
                            <Link to="/faturas/$id" params={{ id: invoice.id }} className="text-[10px] font-semibold text-primary hover:underline mt-0.5">
                              Ver Fatura Origem
                            </Link>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge variant="outline" className="text-xs font-normal">
                        {accountById.get(t.accountId)?.name ?? "—"}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex flex-col items-end">
                        <span className={cn("text-sm font-bold whitespace-nowrap", inflow ? "text-inflow" : "text-outflow")}>
                          {inflow ? "+" : "-"}{formatMoney(t.effectiveAmount)}
                        </span>
                        {(t.discount > 0 || t.interest > 0 || t.fine > 0) && (
                          <span className="text-[10px] text-muted-foreground mt-0.5 whitespace-nowrap">
                            {t.discount > 0 && `Desc: ${formatMoney(t.discount)} `}
                            {t.interest > 0 && `Juros: ${formatMoney(t.interest)} `}
                            {t.fine > 0 && `Multa: ${formatMoney(t.fine)}`}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="text-center">
                      {!isReversal && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className={cn("rounded-full text-xs h-8", t.reversed ? "text-muted-foreground" : "hover:text-destructive hover:bg-destructive/10")}
                          disabled={t.reversed || reverse.isPending}
                          onClick={() => {
                            if(window.confirm("Deseja realmente estornar esta transação?")) {
                              const reason = reversalMessages[t.movementType] || "Estorno de transação geral";
                              reverse.mutate({ id: t.id, reason });
                            }
                          }}
                        >
                          {t.reversed ? "Estornada" : (
                            <><Undo2 className="size-3 mr-1" /> Estornar</>
                          )}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}