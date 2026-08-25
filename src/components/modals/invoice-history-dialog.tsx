import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatMoney } from "@/lib/format";
import { format, parseISO } from "date-fns";
import { History, Receipt, CheckCircle2, ListOrdered } from "lucide-react";
import { PaymentTypeMeta } from "@/lib/constants";
import { useQuery } from "@tanstack/react-query";
import { accountsQuery, paymentInstrumentsQuery } from "@/lib/api/queries";
import { InstallmentStatusBadge } from "@/components/app/status-badge";

interface InvoiceHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: any;
}

export function InvoiceHistoryDialog({ open, onOpenChange, invoice }: InvoiceHistoryDialogProps) {
  const accounts = useQuery(accountsQuery);
  const instruments = useQuery(paymentInstrumentsQuery);

  if (!invoice) return null;

  // Cálculos da Fatura
  const totalAmount = invoice.totalAmount || 0;
  const totalPaid = invoice.totalPaid || 0;
  const remaining = Math.max(0, totalAmount - totalPaid);
  
  const progressPercent = totalAmount > 0 ? Math.min(100, Math.round((totalPaid / totalAmount) * 100)) : 0;
  
  const totalInstallments = invoice.quantityInstallments || 1;
  const finalizedCount = (invoice.installments || []).filter((i: any) => i.status === "FINALIZED").length;
  const partialCount = (invoice.installments || []).filter((i: any) => i.status === "PARTIALLY_PAID").length;

  // 🌟 NOVO: Ordenar as parcelas para a tabela de resumo
  const installmentsList = [...(invoice.installments || [])].sort((a: any, b: any) => a.parcelNumber - b.parcelNumber);

  // Extrair e ordenar TODAS as transações de TODAS as parcelas
  const allTransactions = (invoice.installments || []).flatMap((inst: any) => {
    return (inst.transactions || []).map((t: any) => ({
      ...t,
      parcelNumber: inst.parcelNumber,
      movementTypeInstallment: inst.movementType
    }));
  }).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const isReceipt = invoice.operationType?.movementType === "RECEIPT" || (invoice.installments?.[0]?.movementType === "RECEIPT");
  const colorClass = isReceipt ? "bg-inflow text-inflow" : "bg-outflow text-outflow";
  const lightColorClass = isReceipt ? "bg-inflow/20" : "bg-outflow/20";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl p-0 overflow-hidden max-h-[85vh] flex flex-col">
        
        <DialogHeader className="p-6 pb-4 border-b bg-muted/30 shrink-0">
          <DialogTitle className="flex items-center justify-between text-xl">
            <span className="flex items-center gap-2">
              <Receipt className="size-5 text-primary" /> Detalhes da Fatura
            </span>
            <span className="text-sm font-normal text-muted-foreground bg-background px-3 py-1 rounded-full border shadow-sm">
              {invoice.person?.name || invoice.personName || "Fornecedor/Cliente"}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {/* TOTAIS E COPO ENCHENDO */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-4">
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">Progresso de Quitação</p>
                  <p className="text-2xl font-black">{progressPercent}% <span className="text-sm font-normal text-muted-foreground">concluído</span></p>
                </div>
                
                <div className="text-right">
                  <p className="text-sm text-muted-foreground mb-1">Parcelas Quitadas</p>
                  <div className="flex items-center justify-end gap-2">
                    {partialCount > 0 && (
                      <span className="text-[10px] bg-pending/10 text-pending px-2 py-0.5 rounded uppercase font-bold tracking-wider">
                        + {partialCount} Parcial
                      </span>
                    )}
                    <p className="font-bold flex items-center gap-1 text-xl">
                      {finalizedCount === totalInstallments && <CheckCircle2 className="size-5 text-inflow" />}
                      {finalizedCount}/{totalInstallments}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="h-6 w-full bg-secondary rounded-full overflow-hidden flex items-center relative border border-muted-foreground/20 shadow-inner">
                <div className={`h-full ${colorClass} transition-all duration-1000 ease-out`} style={{ width: `${progressPercent}%` }} />
              </div>
              
              <div className="flex justify-between text-sm font-medium">
                <span className={colorClass.split(' ')[1]}>{formatMoney(totalPaid)} (Pago)</span>
                <span className="text-muted-foreground">{formatMoney(remaining)} (Falta)</span>
              </div>
            </div>

            <div className="bg-muted/30 p-4 rounded-2xl border flex flex-col justify-center items-center text-center shadow-sm">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Valor Total</p>
              <p className="text-3xl font-black">{formatMoney(totalAmount)}</p>
              <span className={`mt-2 text-xs font-bold px-2 py-1 rounded-md uppercase ${lightColorClass} ${colorClass.split(' ')[1]}`}>
                {isReceipt ? "A Receber" : "A Pagar"}
              </span>
            </div>
          </div>

          {/* 🌟 UX MELHORADA: ABAS PARA DIVIDIR PARCELAS E TRANSAÇÕES */}
          <Tabs defaultValue="parcelas" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4 bg-muted/50 p-1 rounded-xl">
              <TabsTrigger value="parcelas" className="flex items-center gap-2 rounded-lg">
                <ListOrdered className="size-4" /> Resumo das Parcelas
              </TabsTrigger>
              <TabsTrigger value="transacoes" className="flex items-center gap-2 rounded-lg">
                <History className="size-4" /> Histórico de Transações
              </TabsTrigger>
            </TabsList>

            {/* ABA 1: TABELA DE PARCELAS */}
            <TabsContent value="parcelas" className="outline-none">
              <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
                <Table>
                  <TableHeader className="bg-muted/20">
                    <TableRow>
                      <TableHead className="w-[80px] text-center">Nº</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead className="text-right">Valor Original</TableHead>
                      <TableHead className="text-right">Valor Pago</TableHead>
                      <TableHead className="text-right">Saldo Restante</TableHead>
                      <TableHead className="text-right pr-4">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {installmentsList.map((inst) => {
                      const instPaid = inst.totalPaid || 0;
                      const instRemaining = Math.max(0, inst.amount - instPaid);

                      return (
                        <TableRow key={inst.id}>
                          <TableCell className="text-center font-mono font-bold text-xs bg-muted/5">
                            {inst.parcelNumber}/{totalInstallments}
                          </TableCell>
                          <TableCell className="text-xs font-medium">
                            {format(parseISO(inst.dueDate), 'dd/MM/yyyy')}
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            {formatMoney(inst.amount)}
                          </TableCell>
                          <TableCell className="text-right text-xs font-medium text-primary">
                            {formatMoney(instPaid)}
                          </TableCell>
                          <TableCell className="text-right text-xs font-bold">
                            {formatMoney(instRemaining)}
                          </TableCell>
                          <TableCell className="text-right pr-4">
                            <InstallmentStatusBadge status={inst.status} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* ABA 2: TABELA DE TRANSAÇÕES EXISTENTE */}
            <TabsContent value="transacoes" className="outline-none">
              {allTransactions.length === 0 ? (
                <p className="text-sm text-center py-10 text-muted-foreground border border-dashed rounded-xl bg-muted/5">
                  Nenhuma transação registrada nesta fatura ainda.
                </p>
              ) : (
                <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
                  <Table>
                    <TableHeader className="bg-muted/20">
                      <TableRow>
                        <TableHead className="w-[90px]">Data</TableHead>
                        <TableHead className="w-[80px] text-center">Ref.</TableHead>
                        <TableHead>Conta</TableHead>
                        <TableHead>Forma</TableHead>
                        <TableHead className="text-right pr-4">Valor Efetivo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allTransactions.map((t: any) => {
                        const rowAccount = (accounts.data ?? []).find((a: any) => a.id === t.accountId);
                        const rowInst = (instruments.data ?? []).find((i: any) => i.id === t.paymentInstrumentId);
                        const isReversal = t.movementType === 'REVERSAL';
                        const isInflow = t.movementDirection === 'INFLOW';

                        return (
                          <TableRow key={t.id} className={isReversal ? "opacity-60 bg-muted/10" : ""}>
                            <TableCell className="text-xs whitespace-nowrap">
                              {format(parseISO(t.paymentDate), 'dd/MM/yyyy')}
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="bg-muted px-2 py-1 rounded text-[10px] font-mono font-bold uppercase tracking-wider whitespace-nowrap">
                                Parc. {t.parcelNumber}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs max-w-[140px] truncate" title={rowAccount?.name}>
                              {rowAccount?.name || "-"}
                            </TableCell>
                            <TableCell className="text-xs">
                              {rowInst ? (rowInst.cardHolderName || PaymentTypeMeta[rowInst.paymentType] || rowInst.paymentType) : "-"}
                            </TableCell>
                            <TableCell className="text-right pr-4">
                              <div className="flex items-center justify-end gap-2">
                                {isReversal ? (
                                  <span className="text-[10px] text-destructive uppercase font-bold">Estorno</span>
                                ) : null}
                                <span className={`font-bold ${isInflow ? "text-inflow" : "text-outflow"}`}>
                                  {isInflow ? "+" : "-"}{formatMoney(t.effectiveAmount)}
                                </span>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

          </Tabs>

        </div>
      </DialogContent>
    </Dialog>
  );
}