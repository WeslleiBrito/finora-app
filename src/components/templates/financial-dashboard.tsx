import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { format, isBefore, startOfDay } from "date-fns";
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
import { formatMoney, parseLocalDate } from "@/lib/format";
import { PaymentTypeMeta } from "@/lib/constants";
import { ConfirmDialog } from "@/components/modals/confirm-dialog";

// Modais
import { NewInvoiceDialog } from "@/components/modals/new-invoice-dialog";
import { InstallmentDetailsDialog } from "@/components/modals/installment-details-dialog";
import { BatchPaymentDialog } from "@/components/modals/batch-payment-dialog";
import { PaymentDialog } from "@/components/modals/payment-dialog";
import { EditInstallmentDialog } from "@/components/modals/edit-installment-dialog";
import {
  Plus, AlertCircle, ArrowDownToLine, CalendarClock, Search,
  Edit3, Trash2, CheckCircle2, Wallet, CreditCard, QrCode, Banknote, Barcode, Landmark, ChevronLeft, ChevronRight
} from "lucide-react";

interface FinancialDashboardProps {
  direction: "PAYMENT" | "RECEIPT";
}

export function FinancialDashboard({ direction }: FinancialDashboardProps) {
  const queryClient = useQueryClient();

  // Dicionário de Interface
  const ui = {
    PAYMENT: {
      title: "Contas a Pagar", description: "Painel gerencial de obrigações.", paidLabel: "Total Pago",
      overdueLabel: "Contas Atrasadas", chartTitle: "Previsão de Desembolso Futuro", chartDesc: "Soma de parcelas em aberto a pagar por mês.",
      overdueColor: "text-destructive", overdueBg: "bg-destructive/5", overdueBorder: "border-destructive/50",
      batchBtn: "Pagar Selecionadas", themeColor: "text-outflow", themeBg: "bg-outflow", themeBgHover: "hover:bg-outflow/90",
      themeBorder: "border-outflow/20", themeSoft: "bg-outflow/5", chartFill: "var(--outflow)"
    },
    RECEIPT: {
      title: "Contas a Receber", description: "Painel gerencial de recebíveis.", paidLabel: "Total Recebido",
      overdueLabel: "Recebimentos Atrasados", chartTitle: "Previsão de Recebimento Futuro", chartDesc: "Soma de parcelas em aberto a receber por mês.",
      overdueColor: "text-orange-500", overdueBg: "bg-orange-500/5", overdueBorder: "border-orange-500/50",
      batchBtn: "Receber Selecionadas", themeColor: "text-inflow", themeBg: "bg-inflow", themeBgHover: "hover:bg-inflow/90",
      themeBorder: "border-inflow/20", themeSoft: "bg-inflow/5", chartFill: "var(--inflow)"
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [installmentToDelete, setInstallmentToDelete] = useState<string | null>(null);

  // Estados de Filtro e Paginação
  const [page, setPage] = useState(0);
  const [searchName, setSearchName] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [accountFilter, setAccountFilter] = useState("ALL");
  const [instrumentFilter, setInstrumentFilter] = useState("ALL");

  // Zera a página sempre que um filtro mudar
  useEffect(() => { setPage(0); }, [searchName, statusFilter, dateFrom, dateTo, accountFilter, instrumentFilter]);
  const toMovementDirection = (
    direction: "PAYMENT" | "RECEIPT"
  ): "INFLOW" | "OUTFLOW" => {
    return direction === "PAYMENT" ? "OUTFLOW" : "INFLOW";
  };

  const filterParams = {
    direction: toMovementDirection(direction),
    searchName: searchName || undefined,
    startDate: dateFrom || undefined,
    endDate: dateTo || undefined,
    statusFilter,
    accountId: accountFilter !== "ALL" ? accountFilter : undefined,
    instrumentId: instrumentFilter !== "ALL" ? instrumentFilter : undefined,
  };

  const { data: summary } = useQuery({
    queryKey: ["installments-summary", filterParams],
    queryFn: () => api.getInstallmentsSummary(filterParams),
  });

  const { data: installmentsPage, isLoading } = useQuery({
    queryKey: ["installments", { ...filterParams, page }],
    queryFn: () => api.searchInstallments({ ...filterParams, page }),
    placeholderData: keepPreviousData, // Evita a tela piscar ao trocar de página
  });

  const accountsQueryRes = useQuery(accountsQuery);
  const accounts = accountsQueryRes.data || [];
  const instrumentsQueryRes = useQuery(paymentInstrumentsQuery);
  const instruments = instrumentsQueryRes.data || [];

  const deleteInstallmentMutation = useMutation({
    mutationFn: (installmentId: string) => api.deleteInstallment(installmentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["installments"] });
      void queryClient.invalidateQueries({ queryKey: ["installments-summary"] });
      toast.success("Parcela excluída com sucesso!");
      setDeleteDialogOpen(false);
      setInstallmentToDelete(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const processedInstallments = (installmentsPage?.content || []).map((inst: any) => {
    const remainingBalance = inst.amount - (inst.totalPaid || 0);
    const isOverdue = inst.status !== "FINALIZED" && isBefore(parseLocalDate(inst.dueDate), startOfDay(new Date()));
    return { ...inst, remainingBalance, isOverdue };
  });

  const toggleSelection = (installment: any) => {
    setSelectedInstallments((prev) => prev.some((item) => item.id === installment.id) ? prev.filter((item) => item.id !== installment.id) : [...prev, installment]);
  };

  const toggleAll = () => {
    const selectable = processedInstallments.filter(p => p.status !== "FINALIZED");
    if (selectedInstallments.length === selectable.length) setSelectedInstallments([]);
    else setSelectedInstallments(selectable);
  };

  const selectedTotal = selectedInstallments.reduce((acc, curr) => acc + curr.remainingBalance, 0);

  return (
    <div className="relative min-h-[80vh] space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <PageHeader title={ui.title} description={ui.description} />
        <Button className={`rounded-full text-white ${ui.themeBg} ${ui.themeBgHover} shadow-sm border-none`} onClick={() => setInvoiceModalOpen(true)}>
          <Plus className="mr-2 size-4" /> Novo Lançamento
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className={`${ui.themeSoft} ${ui.themeBorder}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={`text-sm font-medium ${ui.themeColor}`}>{ui.paidLabel}</CardTitle>
            <CheckCircle2 className={`size-4 ${ui.themeColor}`} />
          </CardHeader>
          <CardContent><div className={`text-2xl font-bold ${ui.themeColor}`}>{formatMoney(summary?.totalPaid || 0)}</div></CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vencendo este mês</CardTitle>
            <CalendarClock className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatMoney(summary?.totalThisMonth || 0)}</div></CardContent>
        </Card>

        <Card className={(summary?.totalOverdue || 0) > 0 ? ui.overdueBorder + " " + ui.overdueBg : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={`text-sm font-medium ${(summary?.totalOverdue || 0) > 0 ? ui.overdueColor : ""}`}>{ui.overdueLabel}</CardTitle>
            <AlertCircle className={`size-4 ${(summary?.totalOverdue || 0) > 0 ? ui.overdueColor : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent><div className={`text-2xl font-bold ${(summary?.totalOverdue || 0) > 0 ? ui.overdueColor : ""}`}>{formatMoney(summary?.totalOverdue || 0)}</div></CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total em Aberto</CardTitle>
            <ArrowDownToLine className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatMoney(summary?.totalOpen || 0)}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{ui.chartTitle}</CardTitle>
          <CardDescription>{ui.chartDesc}</CardDescription>
        </CardHeader>
        <CardContent className="pl-0">
          <div className="h-[200px] w-full mt-4">
            {!summary?.chartData || summary.chartData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sem dados futuros.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `R$ ${value}`} width={80} />
                  <Tooltip cursor={{ fill: 'transparent' }} formatter={(value: any) => [formatMoney(Number(value) || 0), "Total"]} labelStyle={{ color: '#000' }} />
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
          <Label className="text-xs text-muted-foreground flex items-center gap-1"><Wallet className="size-3" /> Conta</Label>
          <Select value={accountFilter} onValueChange={setAccountFilter}>
            <SelectTrigger className="bg-background text-xs"><SelectValue placeholder="Conta" /></SelectTrigger>
            <SelectContent><SelectItem value="ALL">Todas</SelectItem>{accounts.map((a: any) => (<SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>))}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground flex items-center gap-1"><CreditCard className="size-3" /> Forma</Label>
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

      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden flex flex-col min-h-[300px]">
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center p-8 text-muted-foreground text-sm">Carregando parcelas...</div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-[50px] text-center">
                  <Checkbox checked={processedInstallments.filter(p => p.status !== "FINALIZED").length > 0 && selectedInstallments.length === processedInstallments.filter(p => p.status !== "FINALIZED").length} onCheckedChange={toggleAll} />
                </TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>{direction === "PAYMENT" ? "Fornecedor" : "Cliente"}</TableHead>
                <TableHead>Parcela</TableHead>
                <TableHead>Forma</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor Restante</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {processedInstallments.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="h-32 text-center text-muted-foreground">Nenhum resultado encontrado.</TableCell></TableRow>
              ) : (
                processedInstallments.map((parcela: any) => {
                  const isSelected = selectedInstallments.some((item) => item.id === parcela.id);
                  const isPaid = parcela.status === "FINALIZED";
                  const parcelAmortized = (parcela.totalPaid || 0) + (parcela.totalDiscount || 0);
                  const canDelete = parcelAmortized === 0;

                  return (
                    <TableRow
                      key={parcela.id}
                      className={`cursor-pointer transition-colors ${isSelected ? ui.themeSoft : "hover:bg-muted/50"} ${parcela.isOverdue && !isSelected ? "bg-destructive/5" : ""} ${isPaid ? "opacity-70 bg-muted/10" : ""}`}
                      onClick={() => {
                        if (isPaid) { setSelectedInstallmentForDetails(parcela); setDetailsModalOpen(true); }
                        else { setSelectedInstallmentToPay({ ...parcela }); setPaymentModalOpen(true); }
                      }}
                    >
                      <TableCell className="text-center" onClick={(e) => e.stopPropagation()}><Checkbox checked={isSelected} disabled={isPaid} onCheckedChange={() => toggleSelection(parcela)} /></TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">{format(parseLocalDate(parcela.dueDate), "dd/MM/yyyy")}{parcela.isOverdue && <AlertCircle className="size-4 text-destructive" />}</div>
                      </TableCell>
                      <TableCell><p className="font-semibold text-sm">{parcela.personName || "Desconhecido"}</p></TableCell>
                      <TableCell><Badge variant="outline" className="text-xs font-mono">{parcela.parcelNumber}/{parcela.quantityInstallments || "?"}</Badge></TableCell>

                      <TableCell>
                        {parcela.paymentInstrumentId ? (
                          (() => {
                            const inst = instruments.find((i: any) => i.id === parcela.paymentInstrumentId);
                            if (!inst) return <span className="text-xs text-muted-foreground">Desconhecida</span>;
                            const name = inst.cardHolderName || PaymentTypeMeta[inst.paymentType] || inst.paymentType;
                            const isCreditCard = inst.paymentType === "CREDIT_CARD";
                            return (
                              <Badge variant={isCreditCard ? "default" : "secondary"} className={`text-[11px] font-medium flex items-center w-fit gap-1.5 px-2 py-0.5 ${isCreditCard ? 'bg-primary/10 text-primary border-none' : 'bg-secondary/50 text-muted-foreground'}`}>
                                {inst.paymentType === "CREDIT_CARD" && <CreditCard className="size-3" />}
                                {inst.paymentType === "PIX" && <QrCode className="size-3" />}
                                {inst.paymentType === "CASH" && <Banknote className="size-3" />}
                                {inst.paymentType === "BANK_SLIP" && <Barcode className="size-3" />}
                                {!["CREDIT_CARD", "PIX", "CASH", "BANK_SLIP"].includes(inst.paymentType) && <Landmark className="size-3" />}
                                <span className="truncate max-w-[120px]">{name}</span>
                              </Badge>
                            );
                          })()
                        ) : (
                          <Badge variant="outline" className="text-[11px] font-medium text-muted-foreground flex items-center w-fit gap-1.5 px-2 py-0.5 border-dashed"><Wallet className="size-3" /> Saldo da Conta</Badge>
                        )}
                      </TableCell>

                      <TableCell><Badge variant={isPaid ? "default" : parcela.isOverdue ? "destructive" : "secondary"}>{isPaid ? (direction === "PAYMENT" ? "Paga" : "Recebida") : parcela.isOverdue ? "Atrasada" : "A vencer"}</Badge></TableCell>
                      <TableCell className="text-right font-bold">{isPaid ? <span className="text-muted-foreground">{formatMoney(0)}</span> : formatMoney(parcela.remainingBalance)}</TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className={`size-8 text-muted-foreground hover:${ui.themeColor}`} onClick={() => { setSelectedInstallmentToEdit(parcela); setEditModalOpen(true); }}><Edit3 className="size-4" /></Button>
                          {canDelete && <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" disabled={deleteInstallmentMutation.isPending} onClick={() => {
                            setInstallmentToDelete(parcela.id);
                            setDeleteDialogOpen(true);
                          }}><Trash2 className="size-4" /></Button>}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        )}

        {/* 🌟 Controles de Paginação */}
        <div className="mt-auto border-t bg-muted/10 flex items-center justify-between px-4 py-3">
          <p className="text-xs text-muted-foreground">
            Mostrando {processedInstallments.length} resultados
          </p>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" className="h-8 shadow-sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
              <ChevronLeft className="mr-1 size-4" /> Anterior
            </Button>
            <span className="text-xs font-semibold">Página {page + 1} de {installmentsPage?.totalPages || 1}</span>
            <Button variant="outline" size="sm" className="h-8 shadow-sm" disabled={installmentsPage?.last ?? true} onClick={() => setPage((p) => p + 1)}>
              Próxima <ChevronRight className="ml-1 size-4" />
            </Button>
          </div>
        </div>
      </div>

      {selectedInstallments.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 animate-in slide-in-from-bottom-6 z-40">
          <div className={`flex items-center justify-between rounded-full border px-6 py-4 text-white shadow-2xl ${ui.themeBg} border-none`}>
            <div className="flex items-center gap-4">
              <div className="flex size-10 items-center justify-center rounded-full bg-white/20 font-bold">{selectedInstallments.length}</div>
              <div><p className="text-sm font-medium opacity-90">Total Selecionado</p><p className="text-xl font-bold">{formatMoney(selectedTotal)}</p></div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" className="text-white hover:bg-white/20 rounded-full" onClick={() => setSelectedInstallments([])}>Cancelar</Button>
              <Button variant="secondary" className={`rounded-full shadow-lg bg-background ${ui.themeColor} hover:bg-muted border-none`} onClick={() => { setBatchModalOpen(true); }}>{ui.batchBtn}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Modais */}
      <NewInvoiceDialog open={invoiceModalOpen} onOpenChange={setInvoiceModalOpen} defaultDirection={direction} />
      <InstallmentDetailsDialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen} installment={selectedInstallmentForDetails} />
      <BatchPaymentDialog open={batchModalOpen} onOpenChange={setBatchModalOpen} installments={selectedInstallments} onSuccess={() => { setSelectedInstallments([]); void queryClient.invalidateQueries({ queryKey: ["installments"] }); void queryClient.invalidateQueries({ queryKey: ["installments-summary"] }); }} />
      <PaymentDialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen} installment={selectedInstallmentToPay} onSuccess={() => { setSelectedInstallmentToPay(null); void queryClient.invalidateQueries({ queryKey: ["installments"] }); void queryClient.invalidateQueries({ queryKey: ["installments-summary"] }); }} />
      <EditInstallmentDialog open={editModalOpen} onOpenChange={setEditModalOpen} installment={selectedInstallmentToEdit} />
      <ConfirmDialog 
        open={deleteDialogOpen} 
        onOpenChange={(open) => {
          if (!open) {
            setDeleteDialogOpen(false);
            setInstallmentToDelete(null);
          }
        }}
        onConfirm={() => {
          if (installmentToDelete) {
            deleteInstallmentMutation.mutate(installmentToDelete);
          }
        }}
        isPending={deleteInstallmentMutation.isPending}
        title="Excluir Parcela"
        description="Tem certeza que deseja excluir esta parcela? Esta ação não pode ser desfeita."
        confirmText="Excluir"
      />
    </div>
  );
}