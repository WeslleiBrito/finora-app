import { createFileRoute } from "@tanstack/react-router";
import { FinancialDashboard } from "@/components/templates/financial-dashboard";

export const Route = createFileRoute("/_privado/receber")({
  head: () => ({ meta: [{ title: "Contas a Receber" }] }),
  component: ContasAReceberPage,
});

function ContasAReceberPage() {
  // Chama o template genérico configurado para ENTRADAS
  return <FinancialDashboard direction="RECEIPT" />;
}