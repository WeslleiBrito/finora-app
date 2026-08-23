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

import { cardBrandsQuery } from "@/lib/api/queries";
import { api } from "@/lib/api/store";

export function TabBandeiras() {
  const queryClient = useQueryClient();
  const brands = useQuery(cardBrandsQuery);

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
    mutationFn: () => selectedItem ? api.updateCardBrand(selectedItem.id, { name }) : api.createCardBrand({ name }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["card-brands"] });
      toast.success(selectedItem ? "Bandeira atualizada!" : "Bandeira criada!");
      setOpenModal(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const toggleStatus = useMutation({
    mutationFn: () => api.toggleCardBrandStatus(selectedItem!.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["card-brands"] });
      toast.success("Status alterado!");
      setOpenModal(false);
    }
  });

  // 🌟 Identifica se a bandeira é global (nativa do sistema)
  const isGlobalItem = selectedItem?.raw?.isGlobal === true;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { resetForm(); setOpenModal(true); }} className="rounded-full">
          <Plus className="mr-2 size-4" /> Nova Bandeira
        </Button>
      </div>

      <InteractiveList
        items={(brands.data ?? []).map((b) => ({
          id: b.id, 
          title: b.name, 
          subtitle: "Bandeira de Cartão", 
          active: b.status === "ACTIVE", 
          raw: b,
        }))}
        onSelect={openForEdit}
      />

      <Dialog open={openModal} onOpenChange={(val) => { setOpenModal(val); if (!val) resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center justify-between pr-4">
              <DialogTitle className="flex items-center gap-2">
                {selectedItem ? <Pencil className="size-4 text-primary" /> : <Plus className="size-4 text-primary" />}
                {selectedItem ? "Detalhes da Bandeira" : "Nova Bandeira"}
              </DialogTitle>
              {selectedItem && <ActiveBadge active={selectedItem.active} />}
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* 🌟 Aviso amigável para o usuário */}
            {isGlobalItem && (
              <div className="flex items-center gap-2 rounded-lg bg-secondary/50 p-3 text-xs text-muted-foreground">
                <Info className="size-4 shrink-0" />
                <p>Este é um registro global do sistema. Os dados não podem ser editados, apenas ativados ou inativados para a sua conta.</p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Nome da Bandeira</Label>
              <Input 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                disabled={isGlobalItem} // 🌟 Bloqueia edição se for global
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
                {isGlobalItem ? "Fechar" : "Cancelar"}
              </Button>
              
              {/* 🌟 Esconde o botão Salvar se for global */}
              {!isGlobalItem && (
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