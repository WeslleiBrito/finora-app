import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";

export const Route = createFileRoute("/_privado/receber")({
  component: ContasAReceberPage,
});

function ContasAReceberPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="A Receber" description="Gerencie seus recebimentos e clientes." />
      <div className="p-8 text-center text-muted-foreground border-2 border-dashed rounded-xl">
        Em breve: Lista de contas a receber!
      </div>
    </div>
  );
}