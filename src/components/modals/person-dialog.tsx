import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, User as UserIcon, ChevronDown, ChevronUp, UserPlus } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { api } from "@/lib/api/store";
import { PersonRole } from "@/lib/api/types"

interface PersonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // 🌟 Ampliando o tipo para string resolve o erro de 'MovementType' do TypeScript
  direction?: "PAYMENT" | "RECEIPT" | string; 
  onSuccess?: (newPersonId: string) => void;
}

export function PersonDialog({ open, onOpenChange, direction = "PAYMENT", onSuccess }: PersonDialogProps) {
  const queryClient = useQueryClient();

  const [isAdvanced, setIsAdvanced] = useState(false);
  const [personType, setPersonType] = useState<"PHYSICAL" | "LEGAL">("PHYSICAL");

  // 🌟 NOVO: Estado limpo e simples com Checkbox
  const [isBoth, setIsBoth] = useState(false);

  const [name, setName] = useState("");
  const [document, setDocument] = useState(""); 
  const [nickname, setNickname] = useState(""); 
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const isPayment = direction === "PAYMENT";
  
  // Reseta o checkbox sempre que o modal abrir
  useEffect(() => {
    if (open) {
      setIsBoth(false);
    }
  }, [open]);

  const titleLabel = isPayment ? "Novo Fornecedor" : "Novo Cliente";
  const iconColor = isPayment ? "text-outflow" : "text-inflow";
  const buttonBg = isPayment ? "bg-outflow hover:bg-outflow/90 text-white" : "bg-inflow hover:bg-inflow/90 text-white";

  const resetForm = () => {
    setName("");
    setDocument("");
    setNickname("");
    setPhone("");
    setEmail("");
    setIsBoth(false);
    setIsAdvanced(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (!isOpen) resetForm();
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const phoneList = phone ? [{ number: phone, type: "MOBILE" }] : undefined;
      const emailList = email ? [{ email: email }] : undefined;

      // 🌟 Define a "Role" (Vínculo) inteligentemente antes de enviar pro Backend
      const role: PersonRole = isBoth ? "BOTH" : (isPayment ? "SUPPLIER" : "CUSTOMER");

      if (personType === "PHYSICAL") {
        return api.createPhysicalPerson({
          name,
          CPF: document || undefined, 
          nickname: nickname || undefined,
          role, 
          phoneList,
          emailList,
        });
      } else {
        return api.createLegalPerson({
          name,
          CNPJ: document || undefined, 
          tradeName: nickname || undefined,
          role, 
          phoneList,
          emailList,
        });
      }
    },
    onSuccess: (response) => {
      void queryClient.invalidateQueries({ queryKey: ["people"] });
      toast.success("Cadastro realizado com sucesso!");
      onSuccess?.(response.id);
      handleOpenChange(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className={`size-5 ${iconColor}`} />
            {titleLabel}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-4">
            
            <div className="grid grid-cols-[1.5fr_1fr] gap-4 items-end">
              <div className="space-y-2">
                <Label>Tipo de Pessoa</Label>
                <Tabs value={personType} onValueChange={(v) => {
                  setPersonType(v as "PHYSICAL" | "LEGAL");
                  setDocument("");
                }}>
                  <TabsList className="grid w-full grid-cols-2 h-9">
                    <TabsTrigger value="PHYSICAL" className="flex items-center gap-1 text-xs">
                      <UserIcon className="size-3" /> Física
                    </TabsTrigger>
                    <TabsTrigger value="LEGAL" className="flex items-center gap-1 text-xs">
                      <Building2 className="size-3" /> Jurídica
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* 🌟 O CHECKBOX DE VÍNCULO MÚLTIPLO */}
              <div className="flex items-center space-x-2 h-9 border rounded-lg px-3 bg-muted/20">
                <Checkbox 
                  id="role-both" 
                  checked={isBoth} 
                  onCheckedChange={(checked) => setIsBoth(!!checked)} 
                />
                <Label htmlFor="role-both" className="text-xs font-medium cursor-pointer leading-none">
                  Também é {isPayment ? "Cliente" : "Fornecedor"}
                </Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Nome Completo ou Razão Social</Label>
              <Input 
                autoFocus
                placeholder={personType === "PHYSICAL" ? "Ex: Maria Silva" : "Ex: Distribuidora Silva LTDA"}
                value={name} 
                onChange={(e) => setName(e.target.value)} 
              />
            </div>
          </div>

          <div className="flex justify-center border-b pb-2">
            <Button 
              type="button" 
              variant="ghost" 
              size="sm"
              className="text-xs text-muted-foreground hover:text-primary rounded-full"
              onClick={() => setIsAdvanced(!isAdvanced)}
            >
              {isAdvanced ? (
                <><ChevronUp className="mr-1 size-3" /> Ocultar detalhes</>
              ) : (
                <><ChevronDown className="mr-1 size-3" /> Adicionar documento, telefone e e-mail</>
              )}
            </Button>
          </div>

          {isAdvanced && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{personType === "PHYSICAL" ? "CPF (Opcional)" : "CNPJ (Opcional)"}</Label>
                  <Input placeholder="Apenas números" value={document} onChange={(e) => setDocument(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{personType === "PHYSICAL" ? "Apelido (Opcional)" : "Nome Fantasia (Opcional)"}</Label>
                  <Input placeholder="Como você prefere chamar" value={nickname} onChange={(e) => setNickname(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Telefone Principal</Label>
                  <Input placeholder="(00) 00000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>E-mail Principal</Label>
                  <Input type="email" placeholder="email@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)} className="rounded-full">Cancelar</Button>
          <Button 
            disabled={name.length < 3 || saveMutation.isPending} 
            onClick={() => saveMutation.mutate()} 
            className={`rounded-full ${buttonBg}`}
          >
            {saveMutation.isPending ? "Salvando..." : "Salvar Cadastro"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}