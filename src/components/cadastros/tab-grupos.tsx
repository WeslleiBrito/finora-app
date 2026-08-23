import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Power, Info } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InteractiveList, type ListItemProps } from "@/components/app/interactive-list";
import { ActiveBadge } from "@/components/app/status-badge";

import { operationGroupsQuery } from "@/lib/api/queries";
import { api } from "@/lib/api/store";

export function TabGrupos() {
  const queryClient = useQueryClient();
  const groups = useQuery(operationGroupsQuery);

  const [openModal, setOpenModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ListItemProps | null>(null);
  const [name, setName] = useState("");

  const resetForm = () => { setSelectedItem(null); setName(""); };

  const openForEdit = (item: ListItemProps) => {
    setSelectedItem(item);
    setName(item.raw.name || "");
    setOpenModal(true);
  };

  const saveMutation = useMutation({
    mutationFn: () => selectedItem ? api.updateOperationGroup(selectedItem.id, { name }) : api.createOperationGroup({ name }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["operation-groups"] });
      toast.success(selectedItem ? "Grupo atualizado!" : "Grupo criado!");
      setOpenModal(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const toggleStatus = useMutation({
    mutationFn: () => api.toggleOperationGroupStatus(selectedItem!.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["operation-groups"] });
      toast.success("Status alterado!");
      setOpenModal(false);
    }
  });

  // 🌟 Identifica se o item selecionado é nativo do sistema
  const isSystemItem = selectedItem?.raw?.isSystem === true;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { resetForm(); setOpenModal(true); }} className="rounded-full">
          <Plus className="mr-2 size-4" /> Novo Grupo
        </Button>
      </div>

      <InteractiveList
        items={(groups.data ?? []).map((g) => ({
          id: g.id, title: g.name, subtitle: "Agrupador", active: g.status === "ACTIVE", raw: g,
        }))}
        onSelect={openForEdit}
      />

      <Dialog open={openModal} onOpenChange={(val) => { setOpenModal(val); if (!val) resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center justify-between pr-4">
              <DialogTitle className="flex items-center gap-2">
                {selectedItem ? <Pencil className="size-4 text-primary" /> : <Plus className="size-4 text-primary" />}
                {selectedItem ? "Detalhes do Grupo" : "Novo Grupo"}
              </DialogTitle>
              {selectedItem && <ActiveBadge active={selectedItem.active} />}
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2">
             {/* 🌟 Aviso amigável para o usuário */}
             {isSystemItem && (
              <div className="flex items-center gap-2 rounded-lg bg-secondary/50 p-3 text-xs text-muted-foreground">
                <Info className="size-4 shrink-0" />
                <p>Este é um registro padrão do sistema. Os dados não podem ser editados, apenas ativados ou inativados.</p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Nome do Grupo</Label>
              <Input 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                disabled={isSystemItem} 
              />
            </div>
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between gap-2">
            {selectedItem ? (
              <Button type="button" variant="outline" className="rounded-full gap-1 text-xs" disabled={toggleStatus.isPending} onClick={() => toggleStatus.mutate()}>
                <Power className="size-3.5" />{selectedItem.active ? "Inativar" : "Reativar"}
              </Button>
            ) : <div />}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setOpenModal(false)} className="rounded-full">
                {isSystemItem ? "Fechar" : "Cancelar"}
              </Button>
              
              {/* 🌟 Esconde o botão Salvar se for do sistema */}
              {!isSystemItem && (
                <Button disabled={!name || saveMutation.isPending} onClick={() => saveMutation.mutate()} className="rounded-full">
                  Salvar
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}