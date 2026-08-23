import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Building2, User as UserIcon, ChevronDown, ChevronUp } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api/store";

interface PersonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (newPersonId: string) => void;
}

export function PersonDialog({ open, onOpenChange, onSuccess }: PersonDialogProps) {
  const queryClient = useQueryClient();

  // 1. Estados da UX de Expansão
  const [isAdvanced, setIsAdvanced] = useState(false);
  const [personType, setPersonType] = useState<"PHYSICAL" | "LEGAL">("PHYSICAL");

  // 2. Estados dos Campos
  const [name, setName] = useState("");
  
  // Campos Avançados
  const [document, setDocument] = useState(""); // Serve para CPF ou CNPJ
  const [nickname, setNickname] = useState(""); // Apelido ou Nome Fantasia
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  // Limpa o formulário ao fechar
  const resetForm = () => {
    setName("");
    setDocument("");
    setNickname("");
    setPhone("");
    setEmail("");
    setIsAdvanced(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (!isOpen) resetForm();
  };

  // 3. Mutação
  const saveMutation = useMutation({
    mutationFn: () => {
      // Monta as listas opcionais apenas se houver preenchimento
      const phoneList = phone ? [{ number: phone, type: "MOBILE" }] : undefined;
      const emailList = email ? [{ email: email }] : undefined;

      if (personType === "PHYSICAL") {
        return api.createPhysicalPerson({
          name,
          CPF: document || undefined, // Manda undefined se estiver vazio
          nickname: nickname || undefined,
          phoneList,
          emailList,
        });
      } else {
        return api.createLegalPerson({
          name,
          CNPJ: document || undefined, // Manda undefined se estiver vazio
          tradeName: nickname || undefined,
          phoneList,
          emailList,
        });
      }
    },
    onSuccess: (response) => {
      void queryClient.invalidateQueries({ queryKey: ["people"] });
      toast.success(personType === "PHYSICAL" ? "Pessoa cadastrada com sucesso!" : "Empresa cadastrada com sucesso!");
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
            <Plus className="size-5 text-primary" />
            Novo Fornecedor / Cliente
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          
          {/* ========================================= */}
          {/* ÁREA BÁSICA (Sempre visível)              */}
          {/* ========================================= */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de Contato</Label>
              <Tabs value={personType} onValueChange={(v) => {
                setPersonType(v as "PHYSICAL" | "LEGAL");
                setDocument(""); // Limpa o documento ao trocar de tipo
              }}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="PHYSICAL" className="flex items-center gap-2">
                    <UserIcon className="size-4" /> Pessoa Física
                  </TabsTrigger>
                  <TabsTrigger value="LEGAL" className="flex items-center gap-2">
                    <Building2 className="size-4" /> Empresa (PJ)
                  </TabsTrigger>
                </TabsList>
              </Tabs>
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

          {/* ========================================= */}
          {/* BOTÃO DE EXPANSÃO                         */}
          {/* ========================================= */}
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

          {/* ========================================= */}
          {/* ÁREA AVANÇADA (Progressive Disclosure)    */}
          {/* ========================================= */}
          {isAdvanced && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{personType === "PHYSICAL" ? "CPF (Opcional)" : "CNPJ (Opcional)"}</Label>
                  <Input 
                    placeholder="Apenas números"
                    value={document} 
                    onChange={(e) => setDocument(e.target.value)} 
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>{personType === "PHYSICAL" ? "Apelido (Opcional)" : "Nome Fantasia (Opcional)"}</Label>
                  <Input 
                    placeholder="Como você prefere chamar"
                    value={nickname} 
                    onChange={(e) => setNickname(e.target.value)} 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Telefone Principal</Label>
                  <Input 
                    placeholder="(00) 00000-0000"
                    value={phone} 
                    onChange={(e) => setPhone(e.target.value)} 
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>E-mail Principal</Label>
                  <Input 
                    type="email"
                    placeholder="email@exemplo.com"
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                  />
                </div>
              </div>
              
              <p className="text-[10px] text-muted-foreground text-center">
                Você poderá adicionar endereços e mais contatos editando este perfil depois.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)} className="rounded-full">Cancelar</Button>
          <Button 
            disabled={name.length < 3 || saveMutation.isPending} 
            onClick={() => saveMutation.mutate()} 
            className="rounded-full"
          >
            {saveMutation.isPending ? "Salvando..." : "Salvar Contato"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}