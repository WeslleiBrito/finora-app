import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calculator, CheckCircle2, AlertCircle, Search, CreditCard, QrCode, Banknote, Barcode, Landmark } from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { accountsQuery, operationTypesQuery, peopleQuery, paymentInstrumentsQuery } from "@/lib/api/queries";
import { api } from "@/lib/api/store";
import type { InstallmentDTO, MovementType } from "@/lib/api/types";
import { addMonths, formatMoney, todayIso } from "@/lib/format";
import { PaymentTypeMeta } from "@/lib/constants";

import { PersonDialog } from "./person-dialog";
import { AccountDialog } from "./account-dialog";
import { OperationTypeDialog } from "./operation-type-dialog";

interface NewInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDirection?: MovementType;
}

export function NewInvoiceDialog({ open, onOpenChange, defaultDirection = "PAYMENT" }: NewInvoiceDialogProps) {
  const queryClient = useQueryClient();

  const types = useQuery(operationTypesQuery);
  const people = useQuery(peopleQuery);
  const accounts = useQuery(accountsQuery);
  const instruments = useQuery(paymentInstrumentsQuery);

  const [personModalOpen, setPersonModalOpen] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [typeModalOpen, setTypeModalOpen] = useState(false);

  const [typeSearch, setTypeSearch] = useState("");
  const [personSearch, setPersonSearch] = useState("");

  const [direction, setDirection] = useState<MovementType>(defaultDirection);
  const [operationTypeId, setOperationTypeId] = useState("");
  const [personId, setPersonId] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [quantity, setQuantity] = useState("1");
  
  const [purchaseDate, setPurchaseDate] = useState(todayIso());
  const [firstDueDate, setFirstDueDate] = useState(todayIso());

  const [globalAccountId, setGlobalAccountId] = useState("");
  const [globalInstrumentId, setGlobalInstrumentId] = useState("");

  const [installments, setInstallments] = useState<any[]>([]);

  useEffect(() => {
    if (open) {
      setDirection(defaultDirection);
    }
  }, [defaultDirection, open]);

  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (!isOpen) {
      setOperationTypeId("");
      setPersonId("");
      setTotalAmount("");
      // 🌟 Mantivemos o Reset Limpo
      setQuantity("1");
      setInstallments([]);
      setGlobalAccountId("");
      setGlobalInstrumentId("");
      setTypeSearch("");
      setPersonSearch("");
      setPurchaseDate(todayIso());
      setFirstDueDate(todayIso());
    }
  };

  const isPayment = direction === "PAYMENT";
  const personLabel = isPayment ? "Fornecedor" : "Cliente";
  const colorClassText = isPayment ? "text-outflow" : "text-inflow";

  const filteredTypes = useMemo(() => {
    return (types.data ?? [])
      .filter((t: any) => t.movementType === direction)
      .filter((t: any) => t.name.toLowerCase().includes(typeSearch.toLowerCase()));
  }, [types.data, direction, typeSearch]);

  const filteredPeople = useMemo(() => {
    return (people.data ?? [])
      .filter((p: any) => {
        const isRoleValid = isPayment 
          ? (p.role === "SUPPLIER" || p.role === "BOTH") 
          : (p.role === "CUSTOMER" || p.role === "BOTH");
        if (!isRoleValid) return false;
        const searchName = p.nickname ?? p.name;
        return searchName.toLowerCase().includes(personSearch.toLowerCase());
      });
  }, [people.data, personSearch, isPayment]);

  const globalSelectedAccount = (accounts.data ?? []).find((a: any) => a.id === globalAccountId);
  const isGlobalWallet = globalSelectedAccount?.type === "WALLET";
  
  const validGlobalInstruments = (instruments.data ?? []).filter((i: any) => {
    if (isGlobalWallet) return i.paymentType === "CASH";
    return i.paymentType !== "CASH";
  });

  const isGlobalCreditCard = useMemo(() => {
    const inst = (instruments.data ?? []).find((i: any) => i.id === globalInstrumentId);
    return inst?.paymentType === "CREDIT_CARD";
  }, [globalInstrumentId, instruments.data]);

  useEffect(() => {
    if (globalAccountId && globalInstrumentId) {
      const currentInst = (instruments.data ?? []).find((i: any) => i.id === globalInstrumentId);
      if (isGlobalWallet && currentInst?.paymentType !== "CASH") setGlobalInstrumentId("");
      if (!isGlobalWallet && currentInst?.paymentType === "CASH") setGlobalInstrumentId("");
    }
  }, [globalAccountId]);

  const handleGenerateInstallments = () => {
    if (!globalAccountId || !globalInstrumentId) {
      toast.error("Selecione a Conta e o Instrumento padrão primeiro!");
      return;
    }
    const totalCents = Math.round((Number(totalAmount) || 0) * 100);
    // Removemos o limite de 36. Agora permite até 120 parcelas (10 anos).
    const count = Math.max(1, Math.min(Number(quantity) || 1, 120)); 
    
    // Calcula o valor base e pega o resto exato da divisão
    const baseCents = Math.floor(totalCents / count);
    let remainder = totalCents % count;

    const generated: Array<InstallmentDTO> = Array.from({ length: count }, (_, i) => {
      // Distribui os centavos de resto, 1 centavo por parcela, até acabar o resto
      const currentCents = baseCents + (remainder > 0 ? 1 : 0);
      remainder--;

      return {
        parcelNumber: i + 1,
        amount: currentCents / 100, // Converte de volta para Real (Ponto flutuante)
        dueDate: addMonths(firstDueDate, i),
        instrument: globalInstrumentId,
        accountId: globalAccountId,
        movementDirection: isPayment ? "OUTFLOW" : "INFLOW"
      };
    });
    setInstallments(generated);
  };

  const updateInstallment = (index: number, field: string, value: any) => {
    const updated = [...installments];
    updated[index] = { ...updated[index], [field]: value };
    if (field === "accountId") updated[index].instrument = "";
    setInstallments(updated);
  };

  const create = useMutation({
    mutationFn: () =>
      api.createInvoice({
        operationTypeId,
        personId,
        totalAmount: Number(totalAmount) || 0,
        purchaseDate, 
        installments, 
      }),
    onSuccess: (faturaCriada) => {
      // 1. Pega as parcelas já formatadas devolvidas pela sua API no momento da criação
      const novasParcelas = faturaCriada.installments || [];

      // Precisamos inferir o filtro atual de busca para atualizar o cache correto
      // O filtro assume que estamos na aba de direção atual e não há outros filtros complexos aplicados
      const filterParams = { direction: direction === "PAYMENT" ? "OUTFLOW" : "INFLOW", statusFilter: "ALL" };

      // 2. ATUALIZA O MINI-DASHBOARD (O Resumo) instantaneamente na memória
      queryClient.setQueryData(["installments-summary", filterParams], (oldSummary: any) => {
        if (!oldSummary) return oldSummary;
        
        // Calcula o valor total gerado nesta nova fatura
        const valorTotalCriado = novasParcelas.reduce((acc: number, p: any) => acc + (p.amount || 0), 0);
        
        return {
          ...oldSummary,
          totalOpen: (oldSummary.totalOpen || 0) + valorTotalCriado
        };
      });

      // 3. INJETA AS NOVAS PARCELAS NA LISTA INFINITA E REORDENA POR DATA
      queryClient.setQueryData(["installments", { ...filterParams, page: 0 }], (oldData: any) => {
        if (!oldData || !oldData.content) return oldData;

        // Anexa as novas parcelas à lista que o usuário já está vendo
        const listaAtualizada = [...oldData.content, ...novasParcelas];

        // Reordena do vencimento mais próximo (hoje) para o mais distante (futuro)
        listaAtualizada.sort((a, b) => {
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        });

        return {
          ...oldData,
          content: listaAtualizada,
          totalElements: (oldData.totalElements || 0) + novasParcelas.length // Atualiza o contador de resultados no rodapé
        };
      });

      // 4. Limpa a interface e exibe o sucesso sem delays
      toast.success("Lançamento registrado com sucesso!");
      handleOpenChange(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const currentSum = installments.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
  const isSumValid = Math.abs((Number(totalAmount) || 0) - currentSum) < 0.01;
  const canSave = operationTypeId && personId && purchaseDate && installments.length > 0 && isSumValid && installments.every(i => i.instrument && i.accountId && i.dueDate && i.amount > 0);

  const renderInstrumentOption = (i: any) => {
    const isCredit = i.paymentType === "CREDIT_CARD";
    const name = i.cardHolderName || PaymentTypeMeta?.[i.paymentType] || i.paymentType;
    return (
      <div className="flex items-center gap-1.5 w-full">
        {isCredit && <CreditCard className="size-3.5 text-primary shrink-0" />}
        {i.paymentType === "PIX" && <QrCode className="size-3.5 text-muted-foreground shrink-0" />}
        {i.paymentType === "CASH" && <Banknote className="size-3.5 text-muted-foreground shrink-0" />}
        {i.paymentType === "BANK_SLIP" && <Barcode className="size-3.5 text-muted-foreground shrink-0" />}
        {!["CREDIT_CARD", "PIX", "CASH", "BANK_SLIP"].includes(i.paymentType) && <Landmark className="size-3.5 text-muted-foreground shrink-0" />}
        
        <span className="truncate flex-1 text-left">{name}</span>
        
        {isCredit && (
          <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded uppercase font-bold shrink-0">
            Cartão
          </span>
        )}
      </div>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0">
          <div className="border-b bg-muted/20 p-6">
            <DialogTitle className="text-xl flex items-center gap-2">
              <span className={`size-3 rounded-full ${isPayment ? 'bg-outflow' : 'bg-inflow'}`} />
              Novo Lançamento
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">Gere as parcelas e ajuste como quiser.</p>
          </div>

          <div className="grid gap-0 lg:grid-cols-[1fr_1.3fr] p-6 pt-2">
            <section className="space-y-4 pr-6 lg:border-r">
              <div className={`w-full flex items-center justify-center p-3 rounded-lg bg-muted/50 border text-sm font-bold ${isPayment ? 'border-outflow/20 text-outflow' : 'border-inflow/20 text-inflow'}`}>
                Lançamento de {isPayment ? "Saída (Despesa)" : "Entrada (Receita)"}
              </div>

              <div className="space-y-2 mt-2">
                <div className="flex items-center justify-between">
                  <Label>Tipo de operação</Label>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    className={`h-auto p-0 text-[10px] hover:bg-transparent ${colorClassText}`}
                    onClick={() => setTypeModalOpen(true)}
                  >
                    Nova Categoria
                  </Button>
                </div>
                <Select value={operationTypeId} onValueChange={setOperationTypeId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <div className="p-2 sticky top-0 bg-popover z-10 border-b">
                      <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-3 w-3 text-muted-foreground" />
                        <Input 
                          placeholder="Buscar categoria..." 
                          className="pl-7 h-8 text-xs" 
                          value={typeSearch} 
                          onChange={(e) => setTypeSearch(e.target.value)}
                          onKeyDown={(e) => e.stopPropagation()} 
                        />
                      </div>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {filteredTypes.length === 0 ? (
                        <p className="text-xs text-center text-muted-foreground py-4">Nenhuma categoria encontrada.</p>
                      ) : (
                        filteredTypes.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)
                      )}
                    </div>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{personLabel}</Label>
                  <Button type="button" variant="ghost" size="sm" className={`h-auto p-0 text-[10px] hover:bg-transparent hover:underline ${colorClassText}`} onClick={() => setPersonModalOpen(true)}>
                    Novo {personLabel}
                  </Button>
                </div>
                <Select value={personId} onValueChange={setPersonId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <div className="p-2 sticky top-0 bg-popover z-10 border-b">
                      <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-3 w-3 text-muted-foreground" />
                        <Input 
                          placeholder={`Buscar ${personLabel.toLowerCase()}...`} 
                          className="pl-7 h-8 text-xs" 
                          value={personSearch} 
                          onChange={(e) => setPersonSearch(e.target.value)}
                          onKeyDown={(e) => e.stopPropagation()} 
                        />
                      </div>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {filteredPeople.length === 0 ? (
                        <p className="text-xs text-center text-muted-foreground py-4">Nenhum cadastro encontrado.</p>
                      ) : (
                        filteredPeople.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nickname ?? p.name}</SelectItem>)
                      )}
                    </div>
                  </SelectContent>
                </Select>
              </div>

              <div className="my-4 border-t pt-4">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">Configuração Padrão das Parcelas</h4>
                
                <div className="grid gap-3 sm:grid-cols-2 mb-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Conta Padrão</Label>
                      <Button type="button" variant="ghost" size="sm" className={`h-auto p-0 text-[9px] hover:bg-transparent hover:underline ${colorClassText}`} onClick={() => setAccountModalOpen(true)}>
                        Nova Conta
                      </Button>
                    </div>
                    <Select value={globalAccountId} onValueChange={setGlobalAccountId}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {(accounts.data ?? []).map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Instrumento Padrão</Label>
                    <Select value={globalInstrumentId} onValueChange={setGlobalInstrumentId} disabled={!globalAccountId}>
                      <SelectTrigger><SelectValue placeholder={isGlobalWallet ? "Dinheiro Físico" : "Selecione..."} /></SelectTrigger>
                      <SelectContent>
                        {validGlobalInstruments.map((i: any) => (
                          <SelectItem key={i.id} value={i.id}>{renderInstrumentOption(i)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs">Valor total do Lançamento</Label>
                    <Input type="number" step="0.01" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Nº Parcelas</Label>
                    <Input type="number" min={1} max={36} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 mt-3">
                  <div className={`space-y-2 ${isGlobalCreditCard ? "sm:col-span-2" : ""}`}>
                    <Label className="text-xs">Data da Compra/Emissão</Label>
                    <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
                  </div>
                  {!isGlobalCreditCard && (
                    <div className="space-y-2">
                      <Label className="text-xs">Data do 1º Vencimento</Label>
                      <Input type="date" value={firstDueDate} onChange={(e) => setFirstDueDate(e.target.value)} />
                    </div>
                  )}
                </div>

                <Button variant="secondary" className="w-full rounded-full mt-5" onClick={handleGenerateInstallments} disabled={!totalAmount || !globalInstrumentId || !globalAccountId}>
                  <Calculator className="size-4 mr-2" /> Gerar Parcelas
                </Button>
              </div>
            </section>

            <section className="flex flex-col pl-0 lg:pl-6 pt-6 lg:pt-0">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold">Edição Individual</h3>
                  <p className="text-xs text-muted-foreground">Personalize cada prestação.</p>
                </div>

                {installments.length > 0 && (
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium ${isSumValid ? 'bg-inflow-soft text-inflow' : 'bg-destructive/10 text-destructive'}`}>
                    {isSumValid ? <CheckCircle2 className="size-3" /> : <AlertCircle className="size-3" />}
                    Soma Total: {formatMoney(currentSum)}
                  </div>
                )}
              </div>

              {installments.length === 0 ? (
                <div className="flex-1 flex items-center justify-center border-2 border-dashed rounded-xl p-8 text-center text-sm text-muted-foreground">
                  Preencha a configuração ao lado para gerar as parcelas.
                </div>
              ) : (
                <div className="space-y-3 overflow-y-auto max-h-[380px] pr-2 pb-4">
                  {installments.map((p, index) => {
                    const rowAccount = (accounts.data ?? []).find((a: any) => a.id === p.accountId);
                    const isRowWallet = rowAccount?.type === "WALLET";
                    const validRowInstruments = (instruments.data ?? []).filter((i: any) => {
                      if (isRowWallet) return i.paymentType === "CASH";
                      return i.paymentType !== "CASH";
                    });

                    const rowInstrument = (instruments.data ?? []).find((i: any) => i.id === p.instrument);
                    const isRowCreditCard = rowInstrument?.paymentType === "CREDIT_CARD";

                    return (
                      <div key={p.parcelNumber} className="flex flex-col gap-2 rounded-xl bg-secondary/30 border p-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm w-6 text-center shrink-0">{p.parcelNumber}ª</span>
                          
                          {!isRowCreditCard && (
                            <div className="flex-1 space-y-1">
                              <Label className="text-[10px] text-muted-foreground">Vencimento</Label>
                              <Input type="date" className="h-8 text-xs px-2" value={p.dueDate} onChange={(e) => updateInstallment(index, 'dueDate', e.target.value)} />
                            </div>
                          )}

                          <div className="flex-1 space-y-1">
                            <Label className="text-[10px] text-muted-foreground">Valor (R$)</Label>
                            <Input type="number" step="0.01" className="h-8 text-xs px-2 font-semibold" value={p.amount} onChange={(e) => updateInstallment(index, 'amount', Number(e.target.value))} />
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pl-8">
                          <div className="flex-1 space-y-1">
                            <Label className="text-[10px] text-muted-foreground">Conta da Parcela:</Label>
                            <Select value={p.accountId} onValueChange={(val) => updateInstallment(index, 'accountId', val)}>
                              <SelectTrigger className="h-8 text-xs px-2 bg-background"><SelectValue placeholder="Selecione"/></SelectTrigger>
                              <SelectContent>
                                {(accounts.data ?? []).map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex-1 space-y-1">
                            <Label className="text-[10px] text-muted-foreground">Forma de Pagto</Label>
                            <Select value={p.instrument} onValueChange={(val) => updateInstallment(index, 'instrument', val)} disabled={!p.accountId}>
                              <SelectTrigger className={`h-8 text-xs px-2 ${!p.instrument ? 'border-destructive' : 'bg-background'}`}>
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                              <SelectContent>
                                {validRowInstruments.map((i: any) => (
                                  <SelectItem key={i.id} value={i.id}>{renderInstrumentOption(i)}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="mt-auto pt-4 border-t">
                {!isSumValid && installments.length > 0 && (
                  <p className="text-xs text-destructive text-center mb-3">A soma das parcelas ({formatMoney(currentSum)}) difere do total do lançamento.</p>
                )}
                <Button className={`w-full rounded-full ${isPayment ? 'bg-outflow hover:bg-outflow/90' : 'bg-inflow hover:bg-inflow/90'}`} disabled={!canSave || create.isPending} onClick={() => create.mutate()}>
                  {create.isPending ? "Salvando..." : "Confirmar e Salvar Lançamento"}
                </Button>
              </div>
            </section>
          </div>
        </DialogContent>
      </Dialog>

      <PersonDialog 
        open={personModalOpen} 
        onOpenChange={setPersonModalOpen} 
        direction={direction === "PAYMENT" ? "PAYMENT" : "RECEIPT"} 
        onSuccess={(newId) => setPersonId(newId)} 
      />
      <AccountDialog 
        open={accountModalOpen} 
        onOpenChange={setAccountModalOpen} 
        onSuccess={(newId: string) => setGlobalAccountId(newId)} 
      />
      <OperationTypeDialog
        open={typeModalOpen}
        onOpenChange={setTypeModalOpen}
        defaultDirection={direction}
        onSuccess={(newId: string) => setOperationTypeId(newId)}
      />
    </>
  );
}