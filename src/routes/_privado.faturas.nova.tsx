import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NewInvoiceDialog } from "@/components/modals/new-invoice-dialog";
import type { MovementType } from "@/lib/api/types";

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
  
  // O estado do modal agora é controlado pela rota
  const [modalOpen, setModalOpen] = useState(false);
  const [direction, setDirection] = useState<MovementType>("PAYMENT");

  // Gatilho: Ao clicar na aba, define a direção e abre o modal instantaneamente
  const handleTabClick = (val: string) => {
    setDirection(val as MovementType);
    setModalOpen(true);
  };

  const handleClose = (isOpen: boolean) => {
    setModalOpen(isOpen);
    if (!isOpen) {
      // Opcional: Retorna para o dashboard ou listagem quando o usuário desiste e fecha o modal
      navigate({ to: "/dashboard" });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Novo Lançamento"
        description="Escolha a direção do lançamento abaixo para abrir o formulário."
      />

      <div className="max-w-md mt-4">
        {/* As Abas ficam na rota e agem como botões de abertura */}
        <Tabs value={modalOpen ? direction : ""} onValueChange={handleTabClick}>
          <TabsList className="grid w-full grid-cols-2 h-14 bg-muted/50">
            <TabsTrigger 
              value="PAYMENT" 
              className="text-sm flex items-center gap-2 hover:bg-outflow/10 hover:text-outflow transition-all"
            >
              <ArrowDownRight className="size-4" />
              Saída (Despesa)
            </TabsTrigger>
            <TabsTrigger 
              value="RECEIPT" 
              className="text-sm flex items-center gap-2 hover:bg-inflow/10 hover:text-inflow transition-all"
            >
              <ArrowUpRight className="size-4" />
              Entrada (Receita)
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* O componente isolado é invocado recebendo a direção e o controle de estado */}
      <NewInvoiceDialog 
        open={modalOpen} 
        onOpenChange={handleClose} 
        defaultDirection={direction} 
      />
    </div>
  );
}