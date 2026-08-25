import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Landmark, Plus, AlertTriangle, Calculator, Wand2, FileText } from "lucide-react"; // 🌟 ADD FileText
import { toast } from "sonner";
import { format } from "date-fns";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { accountsQuery, paymentInstrumentsQuery } from "@/lib/api/queries";
import { api } from "@/lib/api/store";
import { formatMoney, todayIso } from "@/lib/format";
import { AccountDialog } from "./account-dialog";
import { PaymentTypeMeta } from "@/lib/constants";

// 🌟 IMPORTANDO O NOVO MODAL
import { InvoiceHistoryDialog } from "./invoice-history-dialog"; 

interface BatchPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  installments: any[]; 
  onSuccess: () => void; 
}

type ItemData = {
  amount: number | "";
  interest: number | "";
  fine: number | "";
  discount: number | "";
  accountId: string;
  instrumentId: string;
  paymentDate: string;
};

export function BatchPaymentDialog({ open, onOpenChange, installments, onSuccess }: BatchPaymentDialogProps) {
  const queryClient = useQueryClient();
  const accounts = useQuery(accountsQuery);
  const instruments = useQuery(paymentInstrumentsQuery);

  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [items, setItems] = useState<Record<string, ItemData>>({});
  const [globalInstrumentId, setGlobalInstrumentId] = useState("");
  
  // 🌟 ESTADOS PARA O MODAL DE HISTÓRICO DA FATURA
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);

  useEffect(() => {
    if (open && installments.length > 0) {
      setGlobalInstrumentId(""); 
      const initial: Record<string, ItemData> = {};
      installments.forEach(inst => {
        initial[inst.id] = {
          amount: inst.remainingBalance,
          interest: 0,
          fine: 0,
          discount: 0,
          accountId: inst.accountId || "",
          instrumentId: inst.paymentInstrumentId || "", 
          paymentDate: todayIso()
        };
      });
      setItems(initial);
    }
  }, [open, installments]);

  const handleGlobalInstrumentChange = (val: string) => {
    setGlobalInstrumentId(val);
    setItems(prev => {
      const nextItems: Record<string, ItemData> = {};
      Object.keys(prev).forEach(key => {
        const currentItem = prev[key];
        if (currentItem) {
          nextItems[key] = { ...currentItem, instrumentId: val };
        }
      });
      return nextItems;
    });
  };

  const updateItem = (id: string, field: keyof ItemData, value: any) => {
    setItems(prev => {
      const currentItem = prev[id] || { amount: 0, interest: 0, fine: 0, discount: 0, accountId: "", instrumentId: "", paymentDate: todayIso() };
      const updated = { ...currentItem, [field]: value };
      if (field === "accountId") updated.instrumentId = ""; 
      return { ...prev, [id]: updated };
    });
  };

  let totalEffective = 0;
  let totalPrincipal = 0;
  let missingAccounts = false;
  const accountEffectiveSums: Record<string, number> = {};

  const transactionsPayload = installments.map(inst => {
    const data = items[inst.id] || { amount: 0, interest: 0, fine: 0, discount: 0, accountId: "", instrumentId: "", paymentDate: todayIso() };
    if (!data.accountId) missingAccounts = true;

    const numAmount = Number(data.amount) || 0;
    const numInterest = Number(data.interest) || 0;
    const numFine = Number(data.fine) || 0;
    const numDiscount = Number(data.discount) || 0;
    
    const effective = numAmount + numInterest + numFine - numDiscount;
    totalPrincipal += numAmount;
    totalEffective += Math.max(0, effective);

    if (data.accountId) accountEffectiveSums[data.accountId] = (accountEffectiveSums[data.accountId] || 0) + effective;

    return {
      installmentId: inst.id,
      accountId: data.accountId,
      paymentDate: data.paymentDate,
      amount: numAmount,
      interest: numInterest,
      fine: numFine,
      discount: numDiscount,
      observations: "Baixa em lote",
      ...(data.instrumentId ? { paymentInstrumentId: data.instrumentId } : {})
    };
  });

  let hasWalletError = false;
  Object.entries(accountEffectiveSums).forEach(([accId, total]) => {
    const acc = (accounts.data ?? []).find((a: any) => a.id === accId);
    if (acc?.type === "WALLET" && total > acc.balance) hasWalletError = true;
  });

  const payBatch = useMutation({
    mutationFn: () => api.createTransaction({ transactions: transactionsPayload }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success(`${installments.length} transações processadas com sucesso!`);
      onSuccess(); 
      onOpenChange(false);
    },
    onError: (err: any) => toast.error(err.message || "Erro ao processar lote."),
  });

  const canSave = !missingAccounts && totalPrincipal > 0 && !hasWalletError;
  const globalValidInstruments = (instruments.data ?? []).filter((i: any) => i.instrumentNature === "PAYMENT");

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl p-0 overflow-hidden flex flex-col max-h-[90vh]">
          
          <DialogHeader className="p-6 pb-4 border-b bg-muted/30">
            <DialogTitle className="flex items-center justify-between text-xl">
              <span className="flex items-center gap-2"><CheckCircle2 className="size-5 text-primary" /> Cockpit de Liquidação em Lote</span>
              <Button type="button" variant="outline" size="sm" onClick={() => setAccountModalOpen(true)}>
                <Plus className="mr-1 size-3" /> Nova Conta Rápida
              </Button>
            </DialogTitle>
          </DialogHeader>

          <div className="bg-muted/10 border-b px-6 py-3 flex items-center justify-between shadow-sm z-10">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Wand2 className="size-3 text-primary" /> Preenchimento Rápido
            </span>
            <div className="flex items-center gap-3">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Aplicar Forma a Todas:</Label>
              <Select value={globalInstrumentId} onValueChange={handleGlobalInstrumentChange}>
                <SelectTrigger className="h-8 text-xs w-[220px] bg-background border-primary/20">
                  <SelectValue placeholder="Selecione para replicar..." />
                </SelectTrigger>
                <SelectContent>
                  {globalValidInstruments.map((i: any) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.cardHolderName || PaymentTypeMeta[i.paymentType] || i.paymentType}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {hasWalletError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg flex items-center gap-2">
                <AlertTriangle className="size-4" /> Uma ou mais transações estouram o limite da Carteira (Dinheiro Físico). Revise os saldos.
              </div>
            )}

            <div className="space-y-4">
              {installments.map((inst) => {
                const data = items[inst.id] || { amount: 0, interest: 0, fine: 0, discount: 0, accountId: "", instrumentId: "", paymentDate: todayIso() };
                const newBalance = Math.max(0, inst.remainingBalance - (Number(data.amount) || 0));
                const rowAcc = (accounts.data ?? []).find((a: any) => a.id === data.accountId);
                const isWallet = rowAcc?.type === "WALLET";
                
                const validInstruments = (instruments.data ?? []).filter((i: any) => {
                  if (i.instrumentNature !== "PAYMENT") return false;
                  if (isWallet) return i.paymentType === "CASH";
                  return i.paymentType !== "CASH";
                });

                return (
                  <div key={inst.id} className="p-4 border rounded-xl bg-card shadow-sm space-y-4 hover:border-primary/30 transition-colors">
                    <div className="flex justify-between items-start border-b pb-3">
                      <div>
                        {/* 🌟 BOTÃO DE HISTÓRICO ADICIONADO AO LADO DO NOME */}
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm text-primary">{inst.personName}</p>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-muted-foreground hover:text-primary hover:bg-primary/10"
                            title="Ver histórico da fatura"
                            onClick={() => {
                              setSelectedInvoice(inst.invoiceData);
                              setHistoryModalOpen(true);
                            }}
                          >
                            <FileText className="size-3" />
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Venc: {format(new Date(inst.dueDate), "dd/MM/yyyy")} | Saldo da Fatura: <span className="font-semibold text-foreground">{formatMoney(inst.remainingBalance)}</span>
                        </p>
                      </div>
                      {newBalance > 0 ? (
                         <span className="text-[10px] font-medium bg-pending/10 text-pending px-2 py-1 rounded-md">Restará {formatMoney(newBalance)}</span>
                      ) : (
                         <span className="text-[10px] font-medium bg-inflow/10 text-inflow px-2 py-1 rounded-md">Será Quitada</span>
                      )}
                    </div>

                    <div className="grid md:grid-cols-7 gap-3">
                      <div className="md:col-span-2 space-y-1">
                        <Label className="text-[10px] text-muted-foreground"><Landmark className="inline size-3 mr-1"/>Conta</Label>
                        <Select value={data.accountId} onValueChange={(val) => updateItem(inst.id, "accountId", val)}>
                          <SelectTrigger className="h-8 text-xs bg-muted/20 border-primary/20"><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            {(accounts.data ?? []).map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="md:col-span-2 space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Instrumento</Label>
                        <Select value={data.instrumentId} onValueChange={(val) => updateItem(inst.id, "instrumentId", val)} disabled={!data.accountId}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Automático/Opcional" /></SelectTrigger>
                          <SelectContent>
                            {validInstruments.map((i: any) => (
                              <SelectItem key={i.id} value={i.id}>
                                {i.cardHolderName || PaymentTypeMeta[i.paymentType] || i.paymentType}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="md:col-span-3 grid grid-cols-4 gap-2 bg-secondary/20 p-2 rounded-lg border">
                        <div className="space-y-1">
                          <Label className="text-[9px] text-muted-foreground font-bold">Principal(R$)</Label>
                          <Input type="number" step="0.01" className="h-7 text-xs font-bold" value={data.amount} onChange={(e) => updateItem(inst.id, "amount", e.target.value ? Number(e.target.value) : "")} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[9px] text-muted-foreground">Juros (+)</Label>
                          <Input type="number" step="0.01" className="h-7 text-[10px]" value={data.interest} onChange={(e) => updateItem(inst.id, "interest", e.target.value ? Number(e.target.value) : "")} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[9px] text-muted-foreground">Multa (+)</Label>
                          <Input type="number" step="0.01" className="h-7 text-[10px]" value={data.fine} onChange={(e) => updateItem(inst.id, "fine", e.target.value ? Number(e.target.value) : "")} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[9px] text-muted-foreground">Desc. (-)</Label>
                          <Input type="number" step="0.01" className="h-7 text-[10px] text-destructive" value={data.discount} onChange={(e) => updateItem(inst.id, "discount", e.target.value ? Number(e.target.value) : "")} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>

          <div className="p-6 border-t bg-muted/50 flex justify-between items-center gap-4">
            <div className="flex gap-6 text-sm">
              <div>
                <p className="text-muted-foreground text-[10px] mb-1 uppercase tracking-wider font-bold">Total Principal</p>
                <p className="font-semibold text-lg">{formatMoney(totalPrincipal)}</p>
              </div>
              <div className="border-l pl-6">
                <p className="text-muted-foreground text-[10px] mb-1 uppercase tracking-wider font-bold flex items-center gap-1">
                  <Calculator className="size-3"/> Total Efetivo a Sair
                </p>
                <p className="text-2xl font-black text-primary">{formatMoney(totalEffective)}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button className="rounded-full shadow-md px-8" disabled={!canSave || payBatch.isPending} onClick={() => payBatch.mutate()}>
                Efetivar Lote
              </Button>
            </div>
          </div>

        </DialogContent>
      </Dialog>

      <AccountDialog open={accountModalOpen} onOpenChange={setAccountModalOpen} onSuccess={() => {}} />
      
      {/* 🌟 RENDERIZA O MODAL DE HISTÓRICO DA FATURA (SOBREPONDO O LOTE SE ABERTO) */}
      <InvoiceHistoryDialog 
        open={historyModalOpen} 
        onOpenChange={setHistoryModalOpen} 
        invoice={selectedInvoice} 
      />
    </>
  );
}