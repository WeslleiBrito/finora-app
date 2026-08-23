import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Calculator, CheckCircle2, AlertCircle, Plus } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { accountsQuery, operationTypesQuery, peopleQuery, paymentInstrumentsQuery } from "@/lib/api/queries";
import { api } from "@/lib/api/store";
import type { InstallmentDTO, MovementType } from "@/lib/api/types";
import { addMonths, formatMoney, todayIso } from "@/lib/format";

export const Route = createFileRoute("/_privado/faturas/nova")({
  head: () => ({
    meta: [
      { title: "Novo Lançamento — Poupi" },
      { name: "description", content: "Cadastre uma operação parcelada e edite suas parcelas." },
    ],
  }),
  component: NewInvoicePage,
});

function NewInvoicePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const types = useQuery(operationTypesQuery);
  const people = useQuery(peopleQuery);
  const accounts = useQuery(accountsQuery);
  const instruments = useQuery(paymentInstrumentsQuery); // 🌟 Busca a lista completa de Instrumentos de Pagamento

  const [direction, setDirection] = useState<MovementType>("PAYMENT");

  // Campos Globais
  const [operationTypeId, setOperationTypeId] = useState("");
  const [personId, setPersonId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [globalInstrumentId, setGlobalInstrumentId] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [firstDueDate, setFirstDueDate] = useState(todayIso());

  // ... seus outros estados (operationTypeId, etc) ...

  // 🌟 ESTADOS DO SUB-MODAL DE PESSOA
  const [openPersonModal, setOpenPersonModal] = useState(false);
  const [newPersonName, setNewPersonName] = useState("");
  const [newPersonType, setNewPersonType] = useState<"PHYSICAL" | "LEGAL">("PHYSICAL");

  // 🌟 MUTAÇÃO RÁPIDA: Criar Pessoa (Somente com Nome)
  const createPersonMutation = useMutation({
    mutationFn: () => {
      const payload = { name: newPersonName }; // Enviando apenas o nome (CPF/CNPJ agora são opcionais no backend!)
      return newPersonType === "PHYSICAL"
        ? api.createPhysicalPerson(payload) // Você precisa garantir que a store.ts tenha essa chamada
        : api.createLegalPerson(payload);
    },
    onSuccess: (newPerson) => {
      void queryClient.invalidateQueries({ queryKey: ["people"] });
      toast.success("Contato criado e vinculado!");
      
      if (newPerson?.id) setPersonId(newPerson.id);
      
      setOpenPersonModal(false);
      setNewPersonName("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // 🌟 Estado das Parcelas (Agora é um estado editável, não apenas um useMemo)
  const [installments, setInstallments] = useState<InstallmentDTO[]>([]);

  const filteredTypes = useMemo(() => {
    return (types.data ?? []).filter((t) => t.movementType === direction);
  }, [types.data, direction]);

  const handleDirectionChange = (val: string) => {
    setDirection(val as MovementType);
    setOperationTypeId("");
  };

  // 🌟 Função para gerar as parcelas iniciais
  const handleGenerateInstallments = () => {
    if (!globalInstrumentId) {
      toast.error("Selecione um instrumento padrão primeiro!");
      return;
    }

    const total = Math.round((Number(totalAmount) || 0) * 100);
    const count = Math.max(1, Math.min(Number(quantity) || 1, 36));
    const base = Math.floor(total / count);

    const generated: InstallmentDTO[] = Array.from({ length: count }, (_, i) => ({
      parcelNumber: i + 1,
      amount: (i === count - 1 ? total - base * (count - 1) : base) / 100,
      dueDate: addMonths(firstDueDate, i),
      instrument: globalInstrumentId,
    }));

    setInstallments(generated);
  };

  // 🌟 Função para atualizar uma parcela específica
  // 🌟 Função para atualizar uma parcela específica
  const updateInstallment = (index: number, field: keyof InstallmentDTO, value: any) => {
    const updated = [...installments];
    // O "as InstallmentDTO" acalma o TypeScript, garantindo que a estrutura foi mantida
    updated[index] = { ...updated[index], [field]: value } as InstallmentDTO;
    setInstallments(updated);
  };

  const create = useMutation({
    mutationFn: () =>
      api.createInvoice({
        operationTypeId,
        personId,
        accountId,
        totalAmount: Number(totalAmount) || 0,
        installments,
      }),
    onSuccess: (invoice) => {
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Lançamento criado com sucesso");
      void navigate({ to: "/faturas/$id", params: { id: invoice.id } });
    },
    onError: (err: any) => toast.error(err.message),
  });

  // 🌟 Validações e Calculadores de Segurança
  const currentSum = installments.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
  const diff = (Number(totalAmount) || 0) - currentSum;
  const isSumValid = Math.abs(diff) < 0.01; // Margem de erro de arredondamento

  const canSave = 
    operationTypeId && 
    personId && 
    accountId && 
    installments.length > 0 && 
    isSumValid &&
    installments.every(i => i.instrument && i.dueDate && i.amount > 0);

  return (
    <>
      <PageHeader
        title="Novo Lançamento"
        description="Informe os dados da operação, gere as parcelas e ajuste como quiser."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
        {/* COLUNA ESQUERDA: DADOS GERAIS */}
        <section className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm h-fit">
          
          <Tabs value={direction} onValueChange={handleDirectionChange} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="PAYMENT">A Pagar (Saída)</TabsTrigger>
              <TabsTrigger value="RECEIPT">A Receber (Entrada)</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="space-y-2">
            <Label>Tipo de operação</Label>
            <Select value={operationTypeId} onValueChange={setOperationTypeId}>
              <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                {filteredTypes.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Pessoa / Empresa</Label>
              <Button 
                type="button" variant="ghost" size="sm" 
                className="h-auto p-0 text-xs text-primary hover:bg-transparent hover:underline"
                onClick={() => setOpenPersonModal(true)}
              >
                <Plus className="mr-1 size-3" /> Cadastro rápido
              </Button>
            </div>
            <Select value={personId} onValueChange={setPersonId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {(people.data ?? []).map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.nickname ?? p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Conta vinculada</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
              <SelectContent>
                {(accounts.data ?? []).map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="my-4 border-t pt-4">
            <h3 className="mb-3 text-sm font-semibold">Configuração das Parcelas</h3>
            
            <div className="space-y-2 mb-4">
              <Label>Instrumento Padrão</Label>
              <Select value={globalInstrumentId} onValueChange={setGlobalInstrumentId}>
                <SelectTrigger><SelectValue placeholder="Cartão, PIX, etc." /></SelectTrigger>
                <SelectContent>
                  {(instruments.data ?? []).map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                       {i.cardHolderName || i.paymentType} {/* Ajuste conforme o formato que volta da sua API */}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="total">Valor total</Label>
                <Input id="total" type="number" step="0.01" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="qty">Nº Parcelas</Label>
                <Input id="qty" type="number" min={1} max={36} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2 mt-3">
              <Label htmlFor="due">1º vencimento</Label>
              <Input id="due" type="date" value={firstDueDate} onChange={(e) => setFirstDueDate(e.target.value)} />
            </div>

            <Button 
              variant="secondary" 
              className="w-full rounded-full mt-4" 
              onClick={handleGenerateInstallments}
              disabled={!totalAmount || !globalInstrumentId}
            >
              <Calculator className="size-4 mr-2" />
              Gerar Parcelas
            </Button>
          </div>
        </section>

        {/* COLUNA DIREITA: TABELA DE PARCELAS EDITÁVEIS */}
        <section className="flex flex-col rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold">Edição de Parcelas</h2>
              <p className="text-sm text-muted-foreground">Total original: {formatMoney(Number(totalAmount) || 0)}</p>
            </div>
            
            {/* Aviso de Soma das Parcelas */}
            {installments.length > 0 && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${isSumValid ? 'bg-inflow-soft text-inflow' : 'bg-destructive/10 text-destructive'}`}>
                {isSumValid ? <CheckCircle2 className="size-4" /> : <AlertCircle className="size-4" />}
                Soma: {formatMoney(currentSum)}
              </div>
            )}
          </div>

          {installments.length === 0 ? (
            <div className="flex-1 flex items-center justify-center border-2 border-dashed rounded-xl p-8 text-center text-muted-foreground">
              Preencha os dados ao lado e clique em "Gerar Parcelas"
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto max-h-[500px] pr-2">
              {installments.map((p, index) => (
                <div key={p.parcelNumber} className="grid grid-cols-[auto_1fr_1fr_1fr] items-center gap-2 rounded-xl bg-secondary/30 p-3">
                  <span className="font-semibold text-sm w-6 text-center">{p.parcelNumber}ª</span>
                  
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Vencimento</Label>
                    <Input 
                      type="date" 
                      className="h-8 text-xs" 
                      value={p.dueDate} 
                      onChange={(e) => updateInstallment(index, 'dueDate', e.target.value)} 
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Valor (R$)</Label>
                    <Input 
                      type="number" 
                      step="0.01" 
                      className="h-8 text-xs" 
                      value={p.amount} 
                      onChange={(e) => updateInstallment(index, 'amount', Number(e.target.value))} 
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Instrumento</Label>
                    <Select 
                      value={p.instrument} 
                      onValueChange={(val) => updateInstallment(index, 'instrument', val)}
                    >
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(instruments.data ?? []).map((i) => (
                          <SelectItem key={i.id} value={i.id} className="text-xs">
                            {i.cardHolderName || i.paymentType}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 pt-4 border-t">
            {!isSumValid && installments.length > 0 && (
              <p className="text-xs text-destructive text-center mb-3">
                A soma das parcelas ({formatMoney(currentSum)}) difere do total do documento ({formatMoney(Number(totalAmount))}). Ajuste os valores.
              </p>
            )}
            <Button
              className="w-full rounded-full"
              disabled={!canSave || create.isPending}
              onClick={() => create.mutate()}
            >
              {create.isPending ? "Salvando..." : "Finalizar e Salvar Lançamento"}
            </Button>
          </div>
        </section>
      </div>
      <Dialog open={openPersonModal} onOpenChange={(val) => { setOpenPersonModal(val); if (!val) setNewPersonName(""); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="size-4 text-primary" />
              Novo Fornecedor / Cliente
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Tipo de Contato</Label>
              <Tabs 
                value={newPersonType} 
                onValueChange={(v) => setNewPersonType(v as "PHYSICAL" | "LEGAL")}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="PHYSICAL">Pessoa Física</TabsTrigger>
                  <TabsTrigger value="LEGAL">Empresa (PJ)</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="space-y-2">
              <Label>Nome ou Apelido</Label>
              <Input 
                autoFocus 
                placeholder={newPersonType === "PHYSICAL" ? "Ex: João Encanador" : "Ex: Padaria do Zé"}
                value={newPersonName} 
                onChange={(e) => setNewPersonName(e.target.value)} 
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenPersonModal(false)} className="rounded-full">Cancelar</Button>
            <Button 
              disabled={newPersonName.length < 3 || createPersonMutation.isPending} 
              onClick={() => createPersonMutation.mutate()} 
              className="rounded-full"
            >
              {createPersonMutation.isPending ? "Salvando..." : "Salvar e Vincular"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}