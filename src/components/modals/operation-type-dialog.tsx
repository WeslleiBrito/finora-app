import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api/store";
import { operationGroupsQuery } from "@/lib/api/queries"; 

export function OperationTypeDialog({ open, onOpenChange, onSuccess, defaultDirection }: any) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [operationGroupId, setOperationGroupId] = useState("");

  const { data: groups } = useQuery(operationGroupsQuery);

  useEffect(() => {
    if (!open) {
      setName("");
      setOperationGroupId("");
    }
  }, [open]);

  const saveMutation = useMutation({
    mutationFn: () => api.createOperationType({ 
      name, 
      movementType: defaultDirection,
      operationGroupId
    }),
    onSuccess: (response: any) => {
      void queryClient.invalidateQueries({ queryKey: ["operationTypes"] });
      toast.success("Categoria criada!");
      onSuccess?.(response?.id);
      onOpenChange(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Plus className="size-4" /> Nova Categoria ({defaultDirection === "PAYMENT" ? "Despesa" : "Receita"})
          </DialogTitle>
        </DialogHeader>
        <div className="py-2 space-y-4">
          <div className="space-y-2">
            <Label>Nome da Categoria</Label>
            <Input autoFocus placeholder="Ex: Combustível, Salário..." value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Grupo de Operação</Label>
            <Select value={operationGroupId} onValueChange={setOperationGroupId}>
              <SelectTrigger><SelectValue placeholder="Selecione um grupo" /></SelectTrigger>
              <SelectContent>
                {/* 🌟 Correção aplicada: acessando o array diretamente */}
                {(groups ?? []).map((g: any) => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={name.length < 2 || !operationGroupId || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            {saveMutation.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}