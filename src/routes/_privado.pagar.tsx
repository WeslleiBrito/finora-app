import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format, isBefore, startOfDay, isSameMonth, parseISO, isAfter } from "date-fns";
import { Plus, AlertCircle, ArrowDownToLine, CalendarClock, Search, ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

import { api } from "@/lib/api/store";
import { formatMoney } from "@/lib/format";

// Modais
import { NewInvoiceDialog } from "@/components/modals/new-invoice-dialog";
import { InstallmentDetailsDialog } from "@/components/modals/installment-details-dialog";
import { BatchPaymentDialog } from "@/components/modals/batch-payment-dialog";
import { PaymentDialog } from "@/components/modals/payment-dialog";

export const Route = createFileRoute("/_privado/pagar")({
  head: () => ({ meta: [{ title: "Contas a Pagar" }] }),
  component: ContasAPagarPage,
});

function ContasAPagarPage() {
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedInstallmentForDetails, setSelectedInstallmentForDetails] = useState<any>(null);

  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedInstallmentToPay, setSelectedInstallmentToPay] = useState<any>(null);

  const [selectedInstallments, setSelectedInstallments] = useState<any[]>([]);

  // 🌟 ESTADOS DE FILTRO ATUALIZADOS (Agora com Datas)
  const [searchName, setSearchName] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" }>({
    key: "dueDate",
    direction: "asc"
  });

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: () => api.listInvoices(),
  });

  const allPayables = useMemo(() => {
    if (!invoices) return [];
    const today = startOfDay(new Date());

    return invoices.flatMap((invoice: any) =>
      invoice.installments
        .filter((inst: any) => inst.movementType === "PAYMENT" && inst.status !== "FINALIZED")
        .map((inst: any) => ({
          ...inst,
          invoiceData: invoice,
          personName: invoice.person?.name || "Fornecedor desconhecido",
          remainingBalance: inst.amount - (inst.totalPaid || 0),
          isOverdue: isBefore(new Date(inst.dueDate), today),
        }))
    );
  }, [invoices]);

  // 🌟 PROCESSAMENTO E FILTRAGEM (Incluindo Datas)
  const processedPayables = useMemo(() => {
    let result = allPayables.filter((p) => {
      // Filtro de Nome
      const matchName = p.personName.toLowerCase().includes(searchName.toLowerCase());

      // Filtro de Status
      let matchStatus = true;
      if (statusFilter === "OVERDUE") matchStatus = p.isOverdue;
      if (statusFilter === "UPCOMING") matchStatus = !p.isOverdue;

      // 🌟 Filtro de Datas
      let matchDate = true;
      const dueDate = startOfDay(new Date(p.dueDate));
      if (dateFrom && isBefore(dueDate, startOfDay(parseISO(dateFrom)))) matchDate = false;
      if (dateTo && isAfter(dueDate, startOfDay(parseISO(dateTo)))) matchDate = false;

      return matchName && matchStatus && matchDate;
    });

    result.sort((a, b) => {
      let valA, valB;
      switch (sortConfig.key) {
        case 'dueDate':
          valA = new Date(a.dueDate).getTime(); valB = new Date(b.dueDate).getTime(); break;
        case 'personName':
          valA = a.personName.toLowerCase(); valB = b.personName.toLowerCase(); break;
        default:
          valA = a[sortConfig.key]; valB = b[sortConfig.key];
      }
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [allPayables, searchName, statusFilter, dateFrom, dateTo, sortConfig]);

  // Indicadores de Cards
  const { totalOverdue, totalThisMonth } = useMemo(() => {
    const today = startOfDay(new Date());
    let overdue = 0; let thisMonth = 0;
    allPayables.forEach(p => {
      const dueDate = new Date(p.dueDate);
      if (p.isOverdue) overdue += p.remainingBalance;
      if (isSameMonth(dueDate, today)) thisMonth += p.remainingBalance;
    });
    return { totalOverdue: overdue, totalThisMonth: thisMonth };
  }, [allPayables]);

  // 🌟 DADOS DO GRÁFICO (Agrupando valores por mês)
  const chartData = useMemo(() => {
    const grouped = allPayables.reduce((acc, curr) => {
      // Ex: "08/2026"
      const monthYear = format(new Date(curr.dueDate), 'MM/yyyy');
      if (!acc[monthYear]) acc[monthYear] = 0;
      acc[monthYear] += curr.remainingBalance;
      return acc;
    }, {} as Record<string, number>);

    // Converte o objeto em array e ordena cronologicamente
    return Object.entries(grouped)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => {
        const [monthA, yearA] = a.name.split('/');
        const [monthB, yearB] = b.name.split('/');
        return new Date(`${yearA}-${monthA}-01`).getTime() - new Date(`${yearB}-${monthB}-01`).getTime();
      });
  }, [allPayables]);

  const toggleSelection = (installment: any) => {
    setSelectedInstallments((prev) =>
      prev.some((item) => item.id === installment.id)
        ? prev.filter((item) => item.id !== installment.id)
        : [...prev, installment]
    );
  };

  const toggleAll = () => {
    if (selectedInstallments.length === processedPayables.length) {
      setSelectedInstallments([]);
    } else {
      setSelectedInstallments(processedPayables);
    }
  };

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const selectedTotal = selectedInstallments.reduce((acc, curr) => acc + curr.remainingBalance, 0);

  const SortableHeader = ({ title, sortKey }: { title: string, sortKey: string }) => {
    const isActive = sortConfig.key === sortKey;
    return (
      <Button variant="ghost" size="sm" className="-ml-3 h-8" onClick={() => handleSort(sortKey)}>
        <span>{title}</span>
        {isActive ? (
          sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 size-3" /> : <ArrowDown className="ml-2 size-3" />
        ) : (
          <ChevronsUpDown className="ml-2 size-3 text-muted-foreground" />
        )}
      </Button>
    );
  };

  if (isLoading) return <div className="p-8 text-center">Carregando painel financeiro...</div>;

  return (
    <div className="relative min-h-[80vh] space-y-6 pb-24">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <PageHeader title="Contas a Pagar" description="Painel gerencial de obrigações." />
        <Button className="rounded-full" onClick={() => setInvoiceModalOpen(true)}>
          <Plus className="mr-2 size-4" /> Novo Lançamento
        </Button>
      </div>

      {/* DASHBOARD: CARDS & GRÁFICO */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* CARDS RESUMO */}
        <div className="space-y-4 col-span-1">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vencendo este mês</CardTitle>
              <CalendarClock className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{formatMoney(totalThisMonth)}</div></CardContent>
          </Card>

          <Card className={totalOverdue > 0 ? "border-destructive/50 bg-destructive/5" : ""}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className={`text-sm font-medium ${totalOverdue > 0 ? "text-destructive" : ""}`}>Contas Atrasadas</CardTitle>
              <AlertCircle className={`size-4 ${totalOverdue > 0 ? "text-destructive" : "text-muted-foreground"}`} />
            </CardHeader>
            <CardContent><div className={`text-2xl font-bold ${totalOverdue > 0 ? "text-destructive" : ""}`}>{formatMoney(totalOverdue)}</div></CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total em Aberto</CardTitle>
              <ArrowDownToLine className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{formatMoney(allPayables.reduce((acc, curr) => acc + curr.remainingBalance, 0))}</div></CardContent>
          </Card>
        </div>

        {/* 🌟 GRÁFICO DE BARRAS (Recharts) */}
        <Card className="col-span-1 md:col-span-2">
          <CardHeader>
            <CardTitle>Previsão de Desembolso</CardTitle>
            <CardDescription>Soma de parcelas a pagar por mês.</CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            <div className="h-[200px] w-full mt-4">
              {chartData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sem dados futuros.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis
                      stroke="#888888" fontSize={12} tickLine={false} axisLine={false}
                      tickFormatter={(value) => `R$ ${value}`}
                      width={80}
                    />
                    <Tooltip
                      cursor={{ fill: 'transparent' }}
                      formatter={(value: any) => [formatMoney(Number(value) || 0), "Total"]}
                      labelStyle={{ color: '#000' }}
                    />
                    <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 🌟 BARRA DE FILTROS SUPER COMPLETA */}
      <div className="flex flex-col md:flex-row items-end gap-4 bg-muted/20 p-4 rounded-xl border">
        <div className="w-full md:w-1/3 space-y-1">
          <Label className="text-xs text-muted-foreground">Buscar Fornecedor</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Digite o nome..." className="pl-8 bg-background" value={searchName} onChange={(e) => setSearchName(e.target.value)} />
          </div>
        </div>

        <div className="w-full md:w-auto space-y-1">
          <Label className="text-xs text-muted-foreground">Vencimento (A partir de)</Label>
          <Input type="date" className="bg-background w-full" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>

        <div className="w-full md:w-auto space-y-1">
          <Label className="text-xs text-muted-foreground">Vencimento (Até)</Label>
          <Input type="date" className="bg-background w-full" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>

        <div className="w-full md:w-48 space-y-1">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos os status</SelectItem>
              <SelectItem value="OVERDUE">Apenas Atrasadas</SelectItem>
              <SelectItem value="UPCOMING">A Vencer</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="w-full md:w-auto pb-[2px]">
          <Button variant="ghost" onClick={() => { setSearchName(""); setDateFrom(""); setDateTo(""); setStatusFilter("ALL"); }}>
            Limpar
          </Button>
        </div>
      </div>

      {/* TABELA */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="w-[50px] text-center">
                <Checkbox checked={processedPayables.length > 0 && selectedInstallments.length === processedPayables.length} onCheckedChange={toggleAll} />
              </TableHead>
              <TableHead><SortableHeader title="Vencimento" sortKey="dueDate" /></TableHead>
              <TableHead><SortableHeader title="Fornecedor" sortKey="personName" /></TableHead>
              <TableHead>Parcela</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right"><SortableHeader title="Valor Restante" sortKey="remainingBalance" /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {processedPayables.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">Nenhum resultado encontrado.</TableCell></TableRow>
            ) : (
              processedPayables.map((parcela) => {
                const isSelected = selectedInstallments.some((item) => item.id === parcela.id);
                return (
                  <TableRow
                    key={parcela.id}
                    className={`cursor-pointer transition-colors ${isSelected ? "bg-primary/5" : "hover:bg-muted/50"} ${parcela.isOverdue && !isSelected ? "bg-destructive/5" : ""}`}
                    onClick={() => { setSelectedInstallmentToPay(parcela); setPaymentModalOpen(true); }}
                  >
                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={isSelected} onCheckedChange={() => toggleSelection(parcela)} />
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {format(new Date(parcela.dueDate), "dd/MM/yyyy")}
                        {parcela.isOverdue && <AlertCircle className="size-4 text-destructive" />}
                      </div>
                    </TableCell>
                    <TableCell><p className="font-semibold text-sm">{parcela.personName}</p></TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs font-mono">{parcela.parcelNumber}/{parcela.invoiceData.quantityInstallments}</Badge>
                    </TableCell>
                    <TableCell><Badge variant={parcela.isOverdue ? "destructive" : "secondary"}>{parcela.isOverdue ? "Atrasada" : "A vencer"}</Badge></TableCell>
                    <TableCell className="text-right font-bold">{formatMoney(parcela.remainingBalance)}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* BARRA DE AÇÃO INFERIOR */}
      {selectedInstallments.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 animate-in slide-in-from-bottom-6 z-40">
          <div className="flex items-center justify-between rounded-full border bg-primary px-6 py-4 text-primary-foreground shadow-2xl">
            <div className="flex items-center gap-4">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary-foreground/20 font-bold">{selectedInstallments.length}</div>
              <div>
                <p className="text-sm font-medium opacity-90">Total Selecionado</p>
                <p className="text-xl font-bold">{formatMoney(selectedTotal)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" className="text-primary-foreground hover:bg-primary-foreground/20 hover:text-white rounded-full" onClick={() => setSelectedInstallments([])}>Cancelar</Button>
              <Button variant="secondary" className="rounded-full shadow-lg text-primary" onClick={() => setBatchModalOpen(true)}>Pagar Selecionadas</Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAIS */}
      <NewInvoiceDialog open={invoiceModalOpen} onOpenChange={setInvoiceModalOpen} defaultDirection="PAYMENT" />
      <InstallmentDetailsDialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen} installment={selectedInstallmentForDetails} />
      <BatchPaymentDialog 
        open={batchModalOpen} 
        onOpenChange={setBatchModalOpen} 
        installments={selectedInstallments} 
        onSuccess={() => setSelectedInstallments([])} 
      />

      <PaymentDialog 
        open={paymentModalOpen} 
        onOpenChange={setPaymentModalOpen} 
        installment={selectedInstallmentToPay}
        onSuccess={() => setSelectedInstallments([])} 
      />
    </div>
  );
}