import { createFileRoute } from "@tanstack/react-router";
import { FinancialDashboard } from "@/components/templates/financial-dashboard";

export const Route = createFileRoute("/_privado/pagar")({
  head: () => ({ meta: [{ title: "Contas a Pagar" }] }),
  component: ContasAPagarPage,
});

function ContasAPagarPage() {
  // Chama o template genérico configurado para SAÍDAS
  return <FinancialDashboard direction="PAYMENT" />;
}