import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, isBefore, startOfDay, isSameMonth, parseISO, isAfter } from "date-fns";
import { Plus, AlertCircle, ArrowDownToLine, CalendarClock, Search, ArrowDown, ArrowUp, ChevronsUpDown, Edit3, Trash2, CheckCircle2, Wallet, CreditCard } from "lucide-react";
import { toast } from "sonner";
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
import { accountsQuery, paymentInstrumentsQuery } from "@/lib/api/queries";
import { formatMoney } from "@/lib/format";
import { PaymentTypeMeta } from "@/lib/constants"; // 🌟 Importando do local correto

// Modais
import { NewInvoiceDialog } from "@/components/modals/new-invoice-dialog";
import { InstallmentDetailsDialog } from "@/components/modals/installment-details-dialog";
import { BatchPaymentDialog } from "@/components/modals/batch-payment-dialog";
import { PaymentDialog } from "@/components/modals/payment-dialog";
import { EditInstallmentDialog } from "@/components/modals/edit-installment-dialog";

interface FinancialDashboardProps {
  direction: "PAYMENT" | "RECEIPT";
}

export function FinancialDashboard({ direction }: FinancialDashboardProps) {
  const queryClient = useQueryClient();

  // 🌟 DICIONÁRIO DE INTERFACE E IDENTIDADE VISUAL
  const ui = {
    PAYMENT: {
      title: "Contas a Pagar",
      description: "Painel gerencial de obrigações.",
      paidLabel: "Total Pago",
      overdueLabel: "Contas Atrasadas",
      chartTitle: "Previsão de Desembolso Futuro",
      chartDesc: "Soma de parcelas em aberto a pagar por mês.",
      overdueColor: "text-destructive",
      overdueBg: "bg-destructive/5",
      overdueBorder: "border-destructive/50",
      batchBtn: "Pagar Selecionadas",
      themeColor: "text-outflow",
      themeBg: "bg-outflow",
      themeBgHover: "hover:bg-outflow/90",
      themeBorder: "border-outflow/20",
      themeSoft: "bg-outflow/5",
      chartFill: "var(--outflow)"
    },
    RECEIPT: {
      title: "Contas a Receber",
      description: "Painel gerencial de recebíveis.",
      paidLabel: "Total Recebido",
      overdueLabel: "Recebimentos Atrasados",
      chartTitle: "Previsão de Recebimento Futuro",
      chartDesc: "Soma de parcelas em aberto a receber por mês.",
      overdueColor: "text-orange-500",
      overdueBg: "bg-orange-500/5",
      overdueBorder: "border-orange-500/50",
      batchBtn: "Receber Selecionadas",
      themeColor: "text-inflow",
      themeBg: "bg-inflow",
      themeBgHover: "hover:bg-inflow/90",
      themeBorder: "border-inflow/20",
      themeSoft: "bg-inflow/5",
      chartFill: "var(--inflow)"
    }
  }[direction];

  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedInstallmentForDetails, setSelectedInstallmentForDetails] = useState<any>(null);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedInstallmentToPay, setSelectedInstallmentToPay] = useState<any>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedInstallmentToEdit, setSelectedInstallmentToEdit] = useState<any>(null);
  const [selectedInstallments, setSelectedInstallments] = useState<any[]>([]);

  const [searchName, setSearchName] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [accountFilter, setAccountFilter] = useState("ALL");
  const [instrumentFilter, setInstrumentFilter] = useState("ALL");

  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" }>({
    key: "dueDate",
    direction: "asc"
  });

  const invoicesQueryRes = useQuery({ queryKey: ["invoices"], queryFn: () => api.listInvoices() });
  const invoices = invoicesQueryRes.data ?? [];
  const accountsQueryRes = useQuery(accountsQuery);
  const accounts = accountsQueryRes.data ?? [];
  const instrumentsQueryRes = useQuery(paymentInstrumentsQuery);
  const instruments = instrumentsQueryRes.data ?? [];

  const deleteInstallmentMutation = useMutation({
    mutationFn: (installmentId: string) => api.deleteInstallment(installmentId),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["invoices"] }); toast.success("Parcela excluída com sucesso!"); },
    onError: (err: any) => toast.error(err.message),
  });

  const allPayables = useMemo(() => {
    const today = startOfDay(new Date());
    return invoices.flatMap((invoice: any) =>
      invoice.installments
        .filter((inst: any) => inst.movementType === direction)
        .map((inst: any) => ({
          ...inst,
          invoiceData: invoice,
          personName: invoice.person?.name || "Fornecedor desconhecido",
          remainingBalance: inst.amount - (inst.totalPaid || 0),
          isOverdue: inst.status !== "FINALIZED" && isBefore(new Date(inst.dueDate), today),
        }))
    );
  }, [invoices, direction]);

  const processedPayables = useMemo(() => {
    let result = allPayables.filter((p) => {
      const matchName = p.personName.toLowerCase().includes(searchName.toLowerCase());
      let matchStatus = true;
      if (statusFilter === "OVERDUE") matchStatus = p.isOverdue;
      if (statusFilter === "UPCOMING") matchStatus = !p.isOverdue && p.status !== "FINALIZED";
      if (statusFilter === "PAID") matchStatus = p.status === "FINALIZED";
      let matchDate = true;
      const dueDate = startOfDay(new Date(p.dueDate));
      if (dateFrom && isBefore(dueDate, startOfDay(parseISO(dateFrom)))) matchDate = false;
      if (dateTo && isAfter(dueDate, startOfDay(parseISO(dateTo)))) matchDate = false;
      let matchAccount = true;
      if (accountFilter !== "ALL" && p.accountId !== accountFilter) matchAccount = false;
      let matchInstrument = true;
      if (instrumentFilter !== "ALL" && p.paymentInstrumentId !== instrumentFilter) matchInstrument = false;
      return matchName && matchStatus && matchDate && matchAccount && matchInstrument;
    });

    result.sort((a, b) => {
      let valA, valB;
      switch (sortConfig.key) {
        case 'dueDate': valA = new Date(a.dueDate).getTime(); valB = new Date(b.dueDate).getTime(); break;
        case 'personName': valA = a.personName.toLowerCase(); valB = b.personName.toLowerCase(); break;
        default: valA = a[sortConfig.key]; valB = b[sortConfig.key];
      }
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return result;
  }, [allPayables, searchName, statusFilter, dateFrom, dateTo, accountFilter, instrumentFilter, sortConfig]);

  const { totalOverdue, totalThisMonth, totalPaid, totalOpen } = useMemo(() => {
    const today = startOfDay(new Date());
    let overdue = 0; let thisMonth = 0; let paid = 0; let open = 0;
    
    processedPayables.forEach(p => {
      const dueDate = new Date(p.dueDate);
      const effectivePaidForParcel = (p.transactions || []).reduce((acc: number, t: any) => {
        if (t.movementType === 'REVERSAL') return acc - (t.effectiveAmount || 0);
        return acc + (t.effectiveAmount || 0);
      }, 0);
      paid += effectivePaidForParcel; 
      if (p.status !== "FINALIZED") {
        open += p.remainingBalance;
        if (p.isOverdue) overdue += p.remainingBalance;
        if (isSameMonth(dueDate, today)) thisMonth += p.remainingBalance;
      }
    });
    return { totalOverdue: overdue, totalThisMonth: thisMonth, totalPaid: paid, totalOpen: open };
  }, [processedPayables]);

  const chartData = useMemo(() => {
    const grouped = processedPayables
      .filter(p => p.status !== "FINALIZED")
      .reduce((acc, curr) => {
        const monthYear = format(new Date(curr.dueDate), 'MM/yyyy');
        if (!acc[monthYear]) acc[monthYear] = 0;
        acc[monthYear] += curr.remainingBalance;
        return acc;
      }, {} as Record<string, number>);

    return Object.entries(grouped)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => {
        const [monthA, yearA] = a.name.split('/');
        const [monthB, yearB] = b.name.split('/');
        return new Date(`${yearA}-${monthA}-01`).getTime() - new Date(`${yearB}-${monthB}-01`).getTime();
      });
  }, [processedPayables]);

  const toggleSelection = (installment: any) => {
    setSelectedInstallments((prev) => prev.some((item) => item.id === installment.id) ? prev.filter((item) => item.id !== installment.id) : [...prev, installment]);
  };

  const toggleAll = () => {
    const selectable = processedPayables.filter(p => p.status !== "FINALIZED");
    if (selectedInstallments.length === selectable.length) setSelectedInstallments([]);
    else setSelectedInstallments(selectable);
  };

  const handleSort = (key: string) => { setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' })); };
  const selectedTotal = selectedInstallments.reduce((acc, curr) => acc + curr.remainingBalance, 0);

  const SortableHeader = ({ title, sortKey }: { title: string, sortKey: string }) => {
    const isActive = sortConfig.key === sortKey;
    return (
      <Button variant="ghost" size="sm" className="-ml-3 h-8" onClick={() => handleSort(sortKey)}>
        <span>{title}</span>
        {isActive ? (sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 size-3" /> : <ArrowDown className="ml-2 size-3" />) : (<ChevronsUpDown className="ml-2 size-3 text-muted-foreground" />)}
      </Button>
    );
  };

  if (invoicesQueryRes.isLoading) return <div className="p-8 text-center">Carregando painel financeiro...</div>;

  return (
    <div className="relative min-h-[80vh] space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <PageHeader title={ui.title} description={ui.description} />
        {/* 🌟 Botão com a cor do tema */}
        <Button className={`rounded-full text-white ${ui.themeBg} ${ui.themeBgHover} shadow-sm border-none`} onClick={() => setInvoiceModalOpen(true)}>
          <Plus className="mr-2 size-4" /> Novo Lançamento
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* 🌟 Card com a cor do tema */}
        <Card className={`${ui.themeSoft} ${ui.themeBorder}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={`text-sm font-medium ${ui.themeColor}`}>{ui.paidLabel}</CardTitle>
            <CheckCircle2 className={`size-4 ${ui.themeColor}`} />
          </CardHeader>
          <CardContent><div className={`text-2xl font-bold ${ui.themeColor}`}>{formatMoney(totalPaid)}</div></CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vencendo este mês</CardTitle>
            <CalendarClock className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatMoney(totalThisMonth)}</div></CardContent>
        </Card>

        <Card className={totalOverdue > 0 ? ui.overdueBorder + " " + ui.overdueBg : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={`text-sm font-medium ${totalOverdue > 0 ? ui.overdueColor : ""}`}>{ui.overdueLabel}</CardTitle>
            <AlertCircle className={`size-4 ${totalOverdue > 0 ? ui.overdueColor : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent><div className={`text-2xl font-bold ${totalOverdue > 0 ? ui.overdueColor : ""}`}>{formatMoney(totalOverdue)}</div></CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total em Aberto</CardTitle>
            <ArrowDownToLine className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatMoney(totalOpen)}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{ui.chartTitle}</CardTitle>
          <CardDescription>{ui.chartDesc}</CardDescription>
        </CardHeader>
        <CardContent className="pl-0">
          <div className="h-[200px] w-full mt-4">
            {chartData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sem dados futuros.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `R$ ${value}`} width={80} />
                  <Tooltip cursor={{ fill: 'transparent' }} formatter={(value: any) => [formatMoney(Number(value) || 0), "Total"]} labelStyle={{ color: '#000' }} />
                  {/* 🌟 Gráfico preenchido com a cor do tema */}
                  <Bar dataKey="total" fill={ui.chartFill} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 bg-muted/20 p-4 rounded-xl border items-end">
        <div className="space-y-1 sm:col-span-2 md:col-span-2 lg:col-span-2">
          <Label className="text-xs text-muted-foreground">{direction === "PAYMENT" ? "Fornecedor" : "Cliente"}</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar nome..." className="pl-8 bg-background text-xs" value={searchName} onChange={(e) => setSearchName(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1"><Label className="text-xs text-muted-foreground">Venc. (De)</Label><Input type="date" className="bg-background text-xs px-2" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></div>
        <div className="space-y-1"><Label className="text-xs text-muted-foreground">Venc. (Até)</Label><Input type="date" className="bg-background text-xs px-2" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="bg-background text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas</SelectItem>
              <SelectItem value="OVERDUE">Atrasadas</SelectItem>
              <SelectItem value="UPCOMING">A Vencer</SelectItem>
              <SelectItem value="PAID">{direction === "PAYMENT" ? "Pagas" : "Recebidas"}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground flex items-center gap-1"><Wallet className="size-3"/> Conta</Label>
          <Select value={accountFilter} onValueChange={setAccountFilter}>
            <SelectTrigger className="bg-background text-xs"><SelectValue placeholder="Conta" /></SelectTrigger>
            <SelectContent><SelectItem value="ALL">Todas</SelectItem>{accounts.map((a: any) => (<SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>))}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground flex items-center gap-1"><CreditCard className="size-3"/> Forma</Label>
          <Select value={instrumentFilter} onValueChange={setInstrumentFilter}>
            <SelectTrigger className="bg-background text-xs"><SelectValue placeholder="Forma" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas</SelectItem>
              {instruments.map((i: any) => (
                <SelectItem key={i.id} value={i.id}>{i.cardHolderName || PaymentTypeMeta[i.paymentType] || i.paymentType}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-full flex justify-end mt-2 border-t pt-3">
          <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => { setSearchName(""); setDateFrom(""); setDateTo(""); setStatusFilter("ALL"); setAccountFilter("ALL"); setInstrumentFilter("ALL"); }}>Limpar Filtros</Button>
        </div>
      </div>

      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="w-[50px] text-center">
                <Checkbox checked={processedPayables.filter(p => p.status !== "FINALIZED").length > 0 && selectedInstallments.length === processedPayables.filter(p => p.status !== "FINALIZED").length} onCheckedChange={toggleAll} />
              </TableHead>
              <TableHead><SortableHeader title="Vencimento" sortKey="dueDate" /></TableHead>
              <TableHead><SortableHeader title={direction === "PAYMENT" ? "Fornecedor" : "Cliente"} sortKey="personName" /></TableHead>
              <TableHead>Parcela</TableHead>
              <TableHead>Forma</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right"><SortableHeader title="Valor Restante" sortKey="remainingBalance" /></TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {processedPayables.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="h-32 text-center text-muted-foreground">Nenhum resultado encontrado.</TableCell></TableRow>
            ) : (
              processedPayables.map((parcela) => {
                const isSelected = selectedInstallments.some((item) => item.id === parcela.id);
                const isPaid = parcela.status === "FINALIZED";
                const parcelAmortized = (parcela.totalPaid || 0) + (parcela.totalDiscount || 0);
                const canDelete = parcelAmortized === 0;

                return (
                  <TableRow
                    key={parcela.id}
                    // 🌟 Linha de seleção pintada com a cor do tema
                    className={`cursor-pointer transition-colors ${isSelected ? ui.themeSoft : "hover:bg-muted/50"} ${parcela.isOverdue && !isSelected ? "bg-destructive/5" : ""} ${isPaid ? "opacity-70 bg-muted/10" : ""}`}
                    onClick={() => { 
                      if (isPaid) { 
                        setSelectedInstallmentForDetails(parcela); 
                        setDetailsModalOpen(true); 
                      } else { 
                        setSelectedInstallmentToPay({ ...parcela }); 
                        setPaymentModalOpen(true); 
                      } 
                    }}
                  >
                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}><Checkbox checked={isSelected} disabled={isPaid} onCheckedChange={() => toggleSelection(parcela)} /></TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">{format(new Date(parcela.dueDate), "dd/MM/yyyy")}{parcela.isOverdue && <AlertCircle className="size-4 text-destructive" />}</div>
                    </TableCell>
                    <TableCell><p className="font-semibold text-sm">{parcela.personName}</p></TableCell>
                    <TableCell><Badge variant="outline" className="text-xs font-mono">{parcela.parcelNumber}/{parcela.invoiceData.quantityInstallments}</Badge></TableCell>
                    
                    <TableCell>
                      {parcela.paymentInstrumentId ? (
                        <Badge variant="secondary" className="text-xs font-mono">
                          {(() => {
                            const inst = instruments.find((i: any) => i.id === parcela.paymentInstrumentId);
                            if (!inst) return "Desconhecida";
                            return inst.cardHolderName || PaymentTypeMeta[inst.paymentType] || "Outros";
                          })()}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground opacity-50">Não definida</span>
                      )}
                    </TableCell>

                    <TableCell><Badge variant={isPaid ? "default" : parcela.isOverdue ? "destructive" : "secondary"}>{isPaid ? (direction === "PAYMENT" ? "Paga" : "Recebida") : parcela.isOverdue ? "Atrasada" : "A vencer"}</Badge></TableCell>
                    <TableCell className="text-right font-bold">{isPaid ? <span className="text-muted-foreground">{formatMoney(0)}</span> : formatMoney(parcela.remainingBalance)}</TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {/* 🌟 Ícone de edição respeitando a cor do tema */}
                        <Button variant="ghost" size="icon" className={`size-8 text-muted-foreground hover:${ui.themeColor}`} onClick={() => { setSelectedInstallmentToEdit(parcela); setEditModalOpen(true); }}><Edit3 className="size-4" /></Button>
                        {canDelete && <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" disabled={deleteInstallmentMutation.isPending} onClick={() => { if (window.confirm("Deseja excluir?")) deleteInstallmentMutation.mutate(parcela.id); }}><Trash2 className="size-4" /></Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {selectedInstallments.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 animate-in slide-in-from-bottom-6 z-40">
          {/* 🌟 Barra Flutuante com a cor do tema */}
          <div className={`flex items-center justify-between rounded-full border px-6 py-4 text-white shadow-2xl ${ui.themeBg} border-none`}>
            <div className="flex items-center gap-4">
              <div className="flex size-10 items-center justify-center rounded-full bg-white/20 font-bold">{selectedInstallments.length}</div>
              <div><p className="text-sm font-medium opacity-90">Total Selecionado</p><p className="text-xl font-bold">{formatMoney(selectedTotal)}</p></div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" className="text-white hover:bg-white/20 rounded-full" onClick={() => setSelectedInstallments([])}>Cancelar</Button>
              <Button variant="secondary" className={`rounded-full shadow-lg bg-background ${ui.themeColor} hover:bg-muted border-none`} onClick={() => setBatchModalOpen(true)}>{ui.batchBtn}</Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAIS */}
      <NewInvoiceDialog open={invoiceModalOpen} onOpenChange={setInvoiceModalOpen} defaultDirection={direction} />
      <InstallmentDetailsDialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen} installment={selectedInstallmentForDetails} />
      <BatchPaymentDialog open={batchModalOpen} onOpenChange={setBatchModalOpen} installments={selectedInstallments} onSuccess={() => setSelectedInstallments([])} />
      <PaymentDialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen} installment={selectedInstallmentToPay} onSuccess={() => setSelectedInstallmentToPay(null)} />
      <EditInstallmentDialog open={editModalOpen} onOpenChange={setEditModalOpen} installment={selectedInstallmentToEdit} />
    </div>
  );
}