import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { formatMoney } from "@/lib/format";

interface InstallmentDetailsDialogProps {
  installment: any | null; // Recebe a parcela achata (com invoiceData e personName)
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InstallmentDetailsDialog({ installment, open, onOpenChange }: InstallmentDetailsDialogProps) {
  if (!installment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Detalhes da Parcela</DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* BLOCO 1: INFORMAÇÕES GERAIS */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-muted/20 p-4 rounded-xl">
            <div>
              <p className="text-xs text-muted-foreground">Fornecedor</p>
              <p className="font-semibold">{installment.personName}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Vencimento</p>
              <p className="font-semibold">{format(new Date(installment.dueDate), "dd/MM/yyyy")}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Parcela</p>
              <p className="font-semibold">{installment.parcelNumber} / {installment.invoiceData.quantityInstallments}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <Badge variant={installment.status === "OPEN" ? "secondary" : "default"}>{installment.status}</Badge>
            </div>
          </div>

          {/* BLOCO 2: COMPOSIÇÃO FINANCEIRA */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Valor Original</p>
              <p className="font-medium">{formatMoney(installment.amount)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Pago</p>
              <p className="font-medium text-primary">{formatMoney(installment.totalPaid || 0)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Juros Pagos</p>
              <p className="font-medium text-destructive">{formatMoney(installment.totalInterest || 0)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Multas Pagas</p>
              <p className="font-medium text-destructive">{formatMoney(installment.totalFine || 0)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Descontos</p>
              <p className="font-medium text-inflow">{formatMoney(installment.totalDiscount || 0)}</p>
            </div>
          </div>

          <hr />

          {/* BLOCO 3: HISTÓRICO DE TRANSAÇÕES */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Histórico de Transações</h3>
            <div className="border rounded-xl overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(!installment.transactions || installment.transactions.length === 0) ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                        Nenhuma transação registrada para esta parcela.
                      </TableCell>
                    </TableRow>
                  ) : (
                    installment.transactions.map((t: any) => (
                      <TableRow key={t.id}>
                        <TableCell>{format(new Date(t.paymentDate), "dd/MM/yyyy")}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{t.movementType}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatMoney(t.effectiveAmount || t.amount)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}