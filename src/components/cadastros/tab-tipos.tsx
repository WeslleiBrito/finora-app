import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Power, Info } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InteractiveList, type ListItemProps } from "@/components/app/interactive-list";
import { ActiveBadge } from "@/components/app/status-badge";

import { operationTypesQuery, operationGroupsQuery } from "@/lib/api/queries";
import { api } from "@/lib/api/store";
import type { MovementType } from "@/lib/api/types";

export function TabTipos() {
  const queryClient = useQueryClient();
  const types = useQuery(operationTypesQuery);
  const groups = useQuery(operationGroupsQuery);

  // Estados do Modal Principal (Tipo de Operação)
  const [openModal, setOpenModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ListItemProps | null>(null);

  const [name, setName] = useState("");
  const [movementType, setMovementType] = useState<MovementType>("PAYMENT");
  const [groupId, setGroupId] = useState("");

  // Estados do Sub-Modal (Criação Rápida de Grupo)
  const [openGroupModal, setOpenGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");

  const resetForm = () => {
    setSelectedItem(null);
    setName("");
    setMovementType("PAYMENT");
    setGroupId("");
  };

  const openForEdit = (item: ListItemProps) => {
    setSelectedItem(item);
    setName(item.raw.name || "");
    setMovementType(item.raw.movementType || "PAYMENT");
    setGroupId(item.raw.operationGroup?.id || "");
    setOpenModal(true);
  };

  // Mutação: Salvar Tipo de Operação
  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = { name, movementType, operationGroupId: groupId };
      return selectedItem ? api.updateOperationType(selectedItem.id, payload) : api.createOperationType(payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["operation-types"] });
      toast.success(selectedItem ? "Tipo atualizado!" : "Tipo criado!");
      setOpenModal(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Mutação: Ativar/Inativar Tipo de Operação
  const toggleStatus = useMutation({
    mutationFn: () => api.toggleOperationTypeStatus(selectedItem!.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["operation-types"] });
      toast.success("Status alterado!");
      setOpenModal(false);
    }
  });

  // 🌟 NOVA MUTAÇÃO: Criação rápida de Grupo
  const saveGroupMutation = useMutation({
    mutationFn: () => api.createOperationGroup({ name: newGroupName }),
    onSuccess: (newGroup) => {
      void queryClient.invalidateQueries({ queryKey: ["operation-groups"] });
      toast.success("Grupo criado e vinculado!");
      
      // Mágica do UX: Seleciona automaticamente o grupo recém-criado!
      if (newGroup?.id) setGroupId(newGroup.id);
      
      setOpenGroupModal(false);
      setNewGroupName("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const isSystemItem = selectedItem?.raw?.isSystem === true;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { resetForm(); setOpenModal(true); }} className="rounded-full">
          <Plus className="mr-2 size-4" /> Novo Tipo
        </Button>
      </div>

      <InteractiveList
        items={(types.data ?? []).map((t) => ({
          id: t.id,
          title: t.name,
          subtitle: `${t.operationGroup?.name ?? "Sem grupo"} — ${t.movementType === "RECEIPT" ? "Entrada" : "Saída"}`,
          active: t.statusEntity === "ACTIVE",
          raw: t,
        }))}
        onSelect={openForEdit}
      />

      {/* ======================================================== */}
      {/* MODAL PRINCIPAL (TIPO DE OPERAÇÃO)                         */}
      {/* ======================================================== */}
      <Dialog open={openModal} onOpenChange={(val) => { setOpenModal(val); if (!val) resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center justify-between pr-4">
              <DialogTitle className="flex items-center gap-2">
                {selectedItem ? <Pencil className="size-4 text-primary" /> : <Plus className="size-4 text-primary" />}
                {selectedItem ? "Detalhes do Tipo de Operação" : "Novo Tipo"}
              </DialogTitle>
              {selectedItem && <ActiveBadge active={selectedItem.active} />}
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {isSystemItem && (
              <div className="flex items-center gap-2 rounded-lg bg-secondary/50 p-3 text-xs text-muted-foreground">
                <Info className="size-4 shrink-0" />
                <p>Este é um registro padrão do sistema. Os dados não podem ser editados, apenas ativados ou inativados.</p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Nome do Tipo</Label>
              <Input 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                disabled={isSystemItem} 
              />
            </div>
            <div className="space-y-2">
              <Label>Direção</Label>
              <Select 
                value={movementType} 
                onValueChange={(v) => setMovementType(v as MovementType)} 
                disabled={isSystemItem}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PAYMENT">Saída (A Pagar)</SelectItem>
                  <SelectItem value="RECEIPT">Entrada (A Receber)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* 🌟 CAMPO DE GRUPO COM BOTÃO DE ATALHO */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Grupo Vinculado</Label>
                
                {/* O Atalho! */}
                {!isSystemItem && (
                  <Button 
                    type="button"
                    variant="ghost" 
                    size="sm" 
                    className="h-auto p-0 text-xs text-primary hover:bg-transparent hover:underline"
                    onClick={() => setOpenGroupModal(true)}
                  >
                    <Plus className="mr-1 size-3" /> Criar novo
                  </Button>
                )}
              </div>
              
              <Select 
                value={groupId} 
                onValueChange={setGroupId} 
                disabled={isSystemItem}
              >
                <SelectTrigger><SelectValue placeholder="Selecione um grupo" /></SelectTrigger>
                <SelectContent>
                  {(groups.data ?? []).map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between gap-2">
            {selectedItem ? (
              <Button type="button" variant="outline" className="rounded-full gap-1 text-xs" disabled={toggleStatus.isPending} onClick={() => toggleStatus.mutate()}>
                <Power className="size-3.5" />
                {selectedItem.active ? "Inativar" : "Reativar"}
              </Button>
            ) : <div />}
            
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setOpenModal(false)} className="rounded-full">
                {isSystemItem ? "Fechar" : "Cancelar"}
              </Button>
              
              {!isSystemItem && (
                <Button disabled={!name || !groupId || saveMutation.isPending} onClick={() => saveMutation.mutate()} className="rounded-full">
                  {saveMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======================================================== */}
      {/* SUB-MODAL: CRIAÇÃO RÁPIDA DE GRUPO                         */}
      {/* ======================================================== */}
      <Dialog open={openGroupModal} onOpenChange={(val) => { setOpenGroupModal(val); if (!val) setNewGroupName(""); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="size-4 text-primary" />
              Criação Rápida de Grupo
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome do Novo Grupo</Label>
              <Input 
                autoFocus
                placeholder="Ex: Assinaturas, Lanches, etc..."
                value={newGroupName} 
                onChange={(e) => setNewGroupName(e.target.value)} 
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenGroupModal(false)} className="rounded-full">Cancelar</Button>
            <Button 
              disabled={!newGroupName || saveGroupMutation.isPending} 
              onClick={() => saveGroupMutation.mutate()} 
              className="rounded-full"
            >
              {saveGroupMutation.isPending ? "Criando..." : "Criar e Vincular"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}