import { queryOptions } from "@tanstack/react-query";
import { api } from "./store";
import { ProductDashboardDTO } from "./types";

export const accountsQuery = queryOptions({ queryKey: ["accounts"], queryFn: () => api.listAccounts() });
export const cardsQuery = queryOptions({ queryKey: ["credit-cards"], queryFn: () => api.listCreditCards() });
export const invoicesQuery = queryOptions({ queryKey: ["invoices"], queryFn: () => api.listInvoices() });
export const transactionsQuery = queryOptions({
  queryKey: ["transactions"],
  queryFn: () => api.listTransactions(),
});

export const dashboardSummaryQuery = queryOptions({
  queryKey: ["dashboard-summary"],
  queryFn: () => api.getDashboardSummary(),
});
export const creditCardSummaryQuery = queryOptions({
  queryKey: ["credit-card-summary"],
  queryFn: () => api.getCreditCardSummary(),
});
export const peopleQuery = queryOptions({ queryKey: ["people"], queryFn: () => api.listPeople() });
export const banksQuery = queryOptions({ queryKey: ["banks"], queryFn: () => api.listBanks() });
export const cardBrandsQuery = queryOptions({ queryKey: ["card-brands"], queryFn: () => api.listCardBrands() });
export const operationTypesQuery = queryOptions({
  queryKey: ["operation-types"],
  queryFn: () => api.listOperationTypes(),
});
export const operationGroupsQuery = queryOptions({
  queryKey: ["operation-groups"],
  queryFn: () => api.listOperationGroups(),
});

export const financeKeys = [
  ["accounts"],
  ["credit-cards"],
  ["invoices"],
  ["transactions"],
] as const;

export const paymentInstrumentsQuery = queryOptions({
  queryKey: ["payment-instruments"],
  queryFn: () => api.listPaymentInstruments(),
});


export const investmentDashboardsQuery = (accountId: string) => ({
  queryKey: ['investments', accountId],
  queryFn: () => api.getInvestmentDashboards(accountId),
});