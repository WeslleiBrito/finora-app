import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Landmark } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InteractiveList, type ListItemProps } from "@/components/app/interactive-list";
import { ActiveBadge } from "@/components/app/status-badge";

import { banksQuery } from "@/lib/api/queries";

export function TabBancos() {
  const banks = useQuery(banksQuery);
  const [selectedItem, setSelectedItem] = useState<ListItemProps | null>(null);

  return (
    <div className="space-y-4">
      <InteractiveList
        items={(banks.data ?? []).map((b) => ({
          id: b.id, title: b.name, subtitle: b.code ? `Código: ${b.code}` : "Banco", active: b.status === "ACTIVE", raw: b,
        }))}
        onSelect={setSelectedItem}
      />

      <Dialog open={selectedItem !== null} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center justify-between pr-4">
              <DialogTitle className="flex items-center gap-2">
                <Landmark className="size-4 text-primary" /> Detalhes do Banco
              </DialogTitle>
              {selectedItem && <ActiveBadge active={selectedItem.active} />}
            </div>
          </DialogHeader>

          {selectedItem && (
            <div className="space-y-3 rounded-xl bg-secondary/30 p-4">
              <div>
                <span className="text-xs text-muted-foreground">Nome da Instituição</span>
                <p className="font-semibold text-sm">{selectedItem.title}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Código COMPE</span>
                <p className="font-semibold text-sm">{selectedItem.raw?.code || "Não informado"}</p>
              </div>
              <p className="text-xs text-muted-foreground italic">
                Instituições bancárias são fornecidas pelo sistema e operam em modo somente leitura.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelectedItem(null)} className="rounded-full">Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}