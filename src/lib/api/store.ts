import { auth } from "../firebase";
import type {
  AccountResponseDTO,
  BankResponseDTO,
  CardBrandResponseDTO,
  CreateInvoiceRequestDTO,
  CreateManualAdjustmentTransactionRequestDTO,
  CreateTransactionDTO,
  CreditCardCreateRequestDTO,
  CreditCardDetailsDTO,
  CreditCardSummaryDTO,
  DashboardSummaryDTO,
  InstallmentDTO,
  InstallmentSummaryDTO,
  InvestmentRescueDTO,
  InvoiceResponseDTO,
  MovementType,
  OperationGroupResponseDTO,
  OperationTypeResponseDTO,
  PageResponse,
  PersonCreateLegalRequestDTO,
  PersonCreatePhysicalRequestDTO,
  CreateProductDTO,
  CreateBoxDTO,
  ProductDashboardDTO,
  CreateApportDTO,
  PersonResponseDTO,
  ReversalRequestDTO,
  TransactionResponseDTO,
  UUID,
} from "./types";

// URL base da sua API (ajuste se mudar o túnel do Cloudflare)
const API_BASE_URL = "/api";

/**
 * Função centralizada para fazer requisições à API.
 * Injeta automaticamente os cabeçalhos de segurança necessários.
 */
async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await auth.currentUser?.getIdToken();

  if (!token) {
    throw new Error("Usuário não autenticado no Firebase");
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "X-Auth-Token": token, // Enviado para suprir os controllers que exigem este header específico
      ...options.headers,
    },
  });

  if (!response.ok) {
    let errorMessage = `Erro ${response.status}: ${response.statusText}`;
    try {
      const errorData = await response.json();
      if (errorData.message) errorMessage = errorData.message;
    } catch (_) { }
    throw new Error(errorMessage);
  }

  if (response.status === 204) return {} as T;

  return response.json();
}


export const api = {
  // ==========================================
  // BUSCAS SIMPLES (CADASTROS)
  // ==========================================
  async listBanks() {
    return fetchApi<BankResponseDTO[]>("/bank"); // Mapeia para BankController
  },

  async listCardBrands() {
    return fetchApi<CardBrandResponseDTO[]>("/card-brand"); // Mapeia para CardBrandController
  },

  async listOperationGroups() {
    return fetchApi<OperationGroupResponseDTO[]>("/operation-group"); // Mapeia para OperationGroupController
  },

  async listOperationTypes() {
    return fetchApi<OperationTypeResponseDTO[]>("/operation-type"); // Mapeia para OperationTypeController
  },

  async listPeople() {
    return fetchApi<PersonResponseDTO[]>("/person"); // Mapeia para PersonController
  },

  // Adicione dentro de "export const api = {"
  async searchTransactions(params: Record<string, any>) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== "" && value !== "ALL") {
        query.append(key, String(value));
      }
    });
    const response = await fetchApi<PageResponse<TransactionResponseDTO>>(`/transactions/search?${query.toString()}`);
    console.log(response);
    return response;
  },

  async getCreditCardSummary(): Promise<CreditCardSummaryDTO> {
    return fetchApi<CreditCardSummaryDTO>("/credit-card/summary");
  },
  // ==========================================
  // PARCELAS E RESUMOS DINÂMICOS
  // ==========================================
  async searchInstallments(params: Record<string, any>) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== "" && value !== "ALL") {
        query.append(key, String(value));
      }
    });
    return fetchApi<PageResponse<InstallmentDTO>>(`/installments/search?${query.toString()}`);
  },

  async getInstallmentsSummary(params: Record<string, any>) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== "" && value !== "ALL") {
        query.append(key, String(value));
      }
    });
    return fetchApi<InstallmentSummaryDTO>(`/installments/summary?${query.toString()}`);
  },

  // ==========================================
  // DASHBOARD
  // ==========================================
  async getDashboardSummary(): Promise<DashboardSummaryDTO> {
    return fetchApi<DashboardSummaryDTO>("/dashboard/summary");
  },

  // ==========================================
  // CONTAS
  // ==========================================
  async listAccounts(): Promise<AccountResponseDTO[]> {
    const response = await fetchApi<PageResponse<AccountResponseDTO>>("/account");
    // Se o Spring não devolver o objeto com content (ex: erro 500 ignorado), devolvemos um array vazio para não quebrar o .filter()
    return response.content || [];
  },

  async createAccount(input: any) {
    const kindEndpoint = input.kind.toLowerCase();

    // 🌟 CORREÇÃO: Se for WALLET, mandamos os dados diretamente na raiz
    if (input.kind === "WALLET") {
      return fetchApi<AccountResponseDTO>(`/account/create/${kindEndpoint}`, {
        method: "POST",
        body: JSON.stringify({
          name: input.name,
          initialValue: input.initialValue
        }),
      });
    }

    // Para as outras contas (CHECKING, SAVINGS, PAYMENT, INVESTMENT), mantém o formato com baseAccount
    return fetchApi<AccountResponseDTO>(`/account/create/${kindEndpoint}`, {
      method: "POST",
      body: JSON.stringify({
        baseAccount: input.baseAccount,
        overdraftLimit: input.overdraftLimit,
        interestRate: input.interestRate,
        provider: input.provider,
        riskLevel: input.riskLevel
      }),
    });
  },

  async toggleAccountStatus(id: UUID) {
    return fetchApi<AccountResponseDTO>(`/account/update-status/${id}`, {
      method: "PATCH",
    });
  },

  // ==========================================
  // CARTÕES DE CRÉDITO E INSTRUMENTOS
  // ==========================================
  async listCreditCards() {
    return fetchApi<CreditCardDetailsDTO[]>("/credit-card"); // Mapeia para CreditCardController
  },

  async createCreditCard(input: CreditCardCreateRequestDTO) {
    return fetchApi<CreditCardDetailsDTO>("/payment-instruments/credit-cards", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async toggleCardStatus(id: UUID) {
    return fetchApi<void>(`/payment-instruments/${id}/status`, {
      method: "PATCH",
    });
  },

  // ==========================================
  // FATURAS (INVOICES)
  // ==========================================
  async listInvoices(): Promise<InvoiceResponseDTO[]> {
    const response = await fetchApi<PageResponse<InvoiceResponseDTO>>("/invoice");
    return response.content || [];
  },

  async getInvoice(id: UUID) {
    return fetchApi<InvoiceResponseDTO>(`/invoice/${id}`);
  },

  async createInvoice(input: CreateInvoiceRequestDTO) {
    return fetchApi<InvoiceResponseDTO>("/invoice/create", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async deleteInvoice(id: UUID) {
    return fetchApi<void>(`/invoice/${id}`, {
      method: "DELETE"
    })
  },

  // ==========================================
  // TRANSAÇÕES (PAGAMENTOS/RECEBIMENTOS)
  // ==========================================
  async listTransactions(): Promise<TransactionResponseDTO[]> {
    const response = await fetchApi<PageResponse<TransactionResponseDTO>>("/transactions");
    return response.content
  },

  async createTransaction(input: { transactions: Array<CreateTransactionDTO> }) {
    // O backend retorna uma List<TransactionResponseDTO>, então pegamos a primeira
    const responses = await fetchApi<TransactionResponseDTO[]>("/transactions/create", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return responses[0];
  },

  async reverseTransaction(id: UUID, input: ReversalRequestDTO) {
    // Atenção: Esta rota precisará ser criada no seu Spring Boot!
    return fetchApi<TransactionResponseDTO>(`/transactions/${id}/reverse`, {
      method: "POST",
      body: JSON.stringify(input)
    });
  },

  // ==========================================
  // CRIAÇÕES DE CADASTRO BASE
  // ==========================================
  async createOperationGroup(input: { name: string }) {
    return fetchApi<OperationGroupResponseDTO>("/operation-group/create", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async createOperationType(input: { name: string; movementType: MovementType; operationGroupId: UUID }) {
    return fetchApi<OperationTypeResponseDTO>("/operation-type/create", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async createPhysicalPerson(input: any) {
    return fetchApi<PersonResponseDTO>("/person/create/physical", {
      method: "POST", body: JSON.stringify(input),
    });
  },

  async createLegalPerson(input: any) {
    return fetchApi<PersonResponseDTO>("/person/create/legal", {
      method: "POST", body: JSON.stringify(input),
    });
  },

  async createPerson(input: PersonCreatePhysicalRequestDTO | PersonCreateLegalRequestDTO) {
    const isLegal = "CNPJ" in input;
    const endpoint = isLegal ? "/person/create/legal" : "/person/create/physical";

    return fetchApi<PersonResponseDTO>(endpoint, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async createCardBrand(input: { name: string }) {
    return fetchApi<CardBrandResponseDTO>("/card-brand", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async listPaymentInstruments() {
    return fetchApi<any[]>("/payment-instruments");
  },

  // ==========================================
  // ATUALIZAÇÕES E STATUS DE CADASTROS BASE
  // ==========================================
  async updateOperationGroup(id: UUID, input: { name: string }) {
    return fetchApi<OperationGroupResponseDTO>(`/operation-group/update/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },

  async toggleOperationGroupStatus(id: UUID) {
    return fetchApi<void>(`/operation-group/update-status/${id}`, {
      method: "PATCH",
    });
  },

  async updateOperationType(id: UUID, input: { name: string; movementType: MovementType; operationGroupId: UUID }) {
    return fetchApi<OperationTypeResponseDTO>(`/operation-type/update/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },

  async toggleOperationTypeStatus(id: UUID) {
    return fetchApi<void>(`/operation-type/update-status/${id}`, {
      method: "PATCH",
    });
  },

  async updateCardBrand(id: UUID, input: { name: string }) {
    return fetchApi<CardBrandResponseDTO>(`/card-brand/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },

  async toggleCardBrandStatus(id: UUID) {
    return fetchApi<void>(`/card-brand/update-status/${id}`, {
      method: "PATCH",
    });
  },

  async updatePerson(id: string, input: any) {
    const isLegal = "CNPJ" in input || input.personType === "LEGAL_ENTITY";
    const endpoint = isLegal ? `/person/update/legal/${id}` : `/person/update/physical/${id}`;

    return fetchApi<PersonResponseDTO>(endpoint, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },

  // Adicione junto com o createPerson existente:

  async updatePhysicalPerson(id: string, payload: any): Promise<any> {
    return fetchApi(`/person/update/physical/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  async updateLegalPerson(id: string, payload: any): Promise<any> {
    return fetchApi(`/person/update/legal/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  // ==========================================
  // INVESTIMENTOS (RENDA FIXA)
  // ==========================================
  async getInvestmentDashboards(accountId: string): Promise<ProductDashboardDTO[]> {
    return fetchApi<ProductDashboardDTO[]>(`/investments/account/${accountId}/dashboards`);
  },


  async executeRescue(data: InvestmentRescueDTO) {
    return fetchApi<void>("/investments/rescue", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async deleteInstallment(id: string) {
    return fetchApi<void>(`/invoice/installment/${id}`, {
      method: "DELETE"
    });
  },

  // 3. Editar uma Parcela
  // Nota: A tipagem de retorno aqui pode ser o DTO da parcela, pois o Spring Boot devolve a parcela atualizada
  async updateInstallment(id: string, body: { amount: number; dueDate: string; accountId: string; paymentInstrumentId?: string }) {
    return fetchApi<any>(`/invoice/installment/${id}`, {
      method: "PUT",
      // Dependendo de como o seu fetchApi é construído por baixo dos panos, 
      // você passa o objeto direto ou precisa do JSON.stringify:
      body: JSON.stringify(body)
    });
  },

  async transferAccounts(body: {
    sourceAccountId: string;
    destinationAccountId: string;
    amount: number;
    transferDate: string;
    observations?: string
  }) {

    return fetchApi<any>(
      `/transactions/transfer`,
      {
        method: "POST",
        body: JSON.stringify(body)
      }
    )
  },

  async createManualAdjustments(body: CreateManualAdjustmentTransactionRequestDTO) {
    return fetchApi<any>(
      `/transactions/adjustments`,
      {
        method: "POST",
        body: JSON.stringify(body)
      }
    );
  },

  createProduct(data: CreateProductDTO) {
    return fetchApi<void>("/investments/products", {
      method: "POST",
      body: JSON.stringify(data)
    });
  },

  createBox(data: CreateBoxDTO) {
    return fetchApi<void>("/investments/boxes", {
      method: "POST",
      body: JSON.stringify(data)
    });
  },

  createApport(data: CreateApportDTO) {
    return fetchApi<void>("/investments/apport", {
      method: "POST",
      body: JSON.stringify(data)
    });
  }
};


