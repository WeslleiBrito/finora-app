// Adicionar estes tipos/interfaces:

export type YieldConvention =
  | "CDI_EXPONENTIAL_252"
  | "SAVINGS_MONTHLY_ANNIVERSARY"
  | "IPCA_MONTHLY";

export interface TierRequestDTO {
  minBalance: number;
  maxBalance: number | null;
  rateMultiplier: number;
  requiredMonthlyMovement?: number | null;
}

export interface TierResponseDTO {
  id: string;
  minBalance: number;
  maxBalance: number | null;
  rateMultiplier: number;
  requiredMonthlyMovement: number | null;
}

export interface CreateProductDTO {
  accountId: string;
  name: string;
  indexer: string;
  type: string;
  convention: YieldConvention;
  tiers: TierRequestDTO[];
}

export interface CreateBoxDTO {
  productId: string;
  name: string;
}

// Ajustar ProductDashboardDTO para incluir convention e tiers:
export interface ProductDashboardDTO {
  id: string;
  name: string;
  type: string;
  indexer: string;
  convention: YieldConvention;
  displayRate: number;
  status: string;
  totalProductBalance: number;
  tiers: TierResponseDTO[];
  boxes: BoxDetailDTO[];
}

export interface LotDetailDTO {
  id: string;
  purchaseDate: string;
  ageInDays: number;
  remainingPrincipal: number;
  projectedGrossBalance: number;
  projectedNetBalance: number;
  currentIrTaxProvision: number;
  currentIofTaxProvision: number;
  transactions: InvestmentTransactionResponseDTO[];
}

export interface InvestmentTransactionResponseDTO {
  id: string;
  type: "APPORT" | "RESCUE" | "DAILY_YIELD";
  referenceDate: string;
  description: string;
  grossAmount: number;
  netAmount: number;
  irTaxRetained: number;
  iofTaxRetained: number;
  appliedMarketRate?: number;
}

export interface BoxDetailDTO {
  id: string;
  name: string;
  totalPrincipal: number;
  totalGrossBalance: number;
  totalTaxes: number;
  totalNetBalance: number;
  activeLots: LotDetailDTO[];
}

// Ajustar InvestmentApportDTO (payload de envio, sem os campos de exibição):
export interface CreateApportDTO {
  accountId: string;
  boxId: string;
  amount: number;
  purchaseDate: string;
}

export interface InvestmentApportDTO {
  accountId: string;
  productId?: string;
  boxId?: string;
  productName?: string;
  boxName?: string;
  indexer?: string;
  type?: string;
  tiers?: Array<{
    minBalance: number;
    maxBalance: number | null;
    rateMultiplier: number;
  }>;
  amount: number;
  purchaseDate: string;
}

export interface InvestmentRescueDTO {
  boxId: string;
  requestedAmount: number;
}


// Tipagem para os detalhes de ordenação
export interface Sort {
  empty: boolean;
  sorted: boolean;
  unsorted: boolean;
}

// Tipagem para os metadados da página atual
export interface Pageable {
  pageNumber: number;
  pageSize: number;
  sort: Sort;
  offset: number;
  paged: boolean;
  unpaged: boolean;
}

// O mapeamento fiel da resposta (Page<T>) do Spring Boot
export interface PageResponse<T> {
  content: T[];
  pageable: Pageable;
  totalElements: number;
  totalPages: number;
  last: boolean;
  size: number;
  number: number;
  sort: Sort;
  numberOfElements: number;
  first: boolean;
  empty: boolean;
}

export interface CategoryTotalDTO {
  name: string;
  value: number;
}

export interface InstrumentTotalDTO {
  name: string;
  value: number;
}

export interface MonthlyChartDTO {
  month: string;
  entradas: number;
  saidas: number;
}

export interface CreditCardSummaryDTO {
  globalLimit: number;
  globalAvailable: number;
  globalUsed: number;
  bestCard: { cardName: string; daysToPay: number; nextDue: string } | null;
  snowballChartData: { month: string; total: number }[];
}

export interface DashboardSummaryDTO {
  totalBalance: number;
  toReceive: number;
  toPay: number;
  dueSoonCount: number;
  outflowByCategory: CategoryTotalDTO[];
  outflowByInstrument: InstrumentTotalDTO[];
  inflowByCategory: CategoryTotalDTO[];
  inflowByInstrument: InstrumentTotalDTO[];
  chartData: MonthlyChartDTO[];
}

export interface InstallmentSummaryDTO {
  totalPaid: number;
  totalThisMonth: number;
  totalOverdue: number;
  totalOpen: number;
  chartData: { name: string; total: number }[];
}

export type UUID = string;

export type StatusEntity = "ACTIVE" | "INACTIVATED";
export type PaymentInstrumentStatus = "ACTIVE" | "INACTIVE";
export type MovementType = "RECEIPT" | "PAYMENT" | "REVERSAL" | "MANUAL_ADJUSTMENT";
export type MovementDirection = "INFLOW" | "OUTFLOW";
export type InvoiceStatus = "OPEN" | "FINALIZED" | "CANCELLED" | "PARTIALLY_PAID";
export type PaymentStatus = "OPEN" | "FINALIZED" | "CANCELLED" | "PARTIALLY_PAID";
export type InstallmentStatus = "OPEN" | "PAID" | "PARTIALLY_PAID" | "OVERDUE" | "CANCELLED";
export type instrumentNature = "PURCHASE" | "PAYMENT";
export type PersonType = "INDIVIDUAL" | "LEGAL_ENTITY";
export type PaymentType =
  | "CREDIT_CARD"
  | "DEBIT_CARD"
  | "PIX"
  | "BANK_TRANSFER"
  | "CASH"
  | "BOLETO"
  | "TICKET";
export type AccountKind = "CHECKING" | "SAVINGS" | "INVESTMENT" | "PAYMENT" | "WALLET";
export type PersonRole = "CUSTOMER" | "SUPPLIER" | "BOTH"

export interface BankResponseDTO {
  id: UUID;
  name: string;
  code?: string;
  status: StatusEntity;
}

export interface CardBrandResponseDTO {
  id: UUID;
  name: string;
  status: StatusEntity;
}

export interface OperationGroupResponseDTO {
  id: UUID;
  name: string;
  isSystem: boolean;
  status: StatusEntity;
}

export interface OperationTypeResponseDTO {
  id: UUID;
  name: string;
  movementType: MovementType;
  isSystem: boolean;
  statusEntity: StatusEntity;
  operationGroup: OperationGroupResponseDTO;
}

export interface PersonResponseDTO {
  id: UUID;
  name: string;
  nickname?: string;
  cpf?: string;
  cnpj?: string;
  tradeName?: string;
  personType: PersonType;
  role: PersonRole;
  phones: PhoneResponseDTO[];
  emails: EmailResponseDTO[];
  addresses: AddressResponseDTO[];
  invoices: InvoiceResponseDTO[];
}

export interface PersonResponseCompactDTO {
  id: string;
  name: string;
}

/** O schema AccountResponseDTO vem vazio no OpenAPI; formato inferido do domínio. */
export interface AccountResponseDTO {
  id: UUID;
  name: string;
  type: AccountKind;
  initialValue: number;
  balance: number;
  bank?: BankResponseDTO;
  agency?: string;
  number?: string;
  overdraftLimit?: number;
  yieldRate?: number;
  status: StatusEntity;
  transactions: TransactionResponseDTO[];
}

export interface CreditCardDetailsDTO {
  id: UUID;
  paymentType: PaymentType;
  createdAt: string;
  instrumentNature: instrumentNature;
  expirationDate?: string;
  cardHolderName: string;
  closingDay: number;
  dueDay: number;
  creditLimit: number;
  availableLimit: number;
  revolvingInterest: number;
  fine: number;
  status: PaymentInstrumentStatus;
  cardBrand: CardBrandResponseDTO;
  bank?: BankResponseDTO;
  installments: InstallmentResponseDTO[]
}

export interface InstallmentResponseDTO {
  id: UUID;
  invoiceId: UUID;
  paymentInstrumentId: UUID;
  parcelNumber: number;
  amount: number;
  totalPaid: number;
  totalInterest: number;
  totalFine: number;
  movementType: MovementType;
  status: PaymentStatus;
  dueDate: string;
  createdAt: Date;
  transactions: Array<TransactionResponseDTO>
}

export interface InvoiceResponseDTO {
  id: UUID;
  accountId: UUID;
  operationTypeId: UUID;
  person: PersonResponseCompactDTO;
  issueDate: string;
  status: InvoiceStatus;
  quantityInstallments: number;
  totalAmount: number;
  totalPaid: number;
  totalDiscount: number;
  remainingBalance: number;
  installments: InstallmentResponseDTO[];
}

export interface TransactionResponseDTO {
  id: UUID;
  installmentId: UUID;
  accountId: UUID;
  paymentInstrumentId?: UUID;
  amount: number;
  interest: number;
  fine: number;
  discount: number;
  effectiveAmount: number;
  movementType: MovementType;
  movementDirection: MovementDirection;
  reversedTransactionId?: UUID;
  reversed: boolean;
  paymentDate: string;
  createdAt: string;
  observations?: string;
}

export interface CreateTransactionDTO {
  amount: number;
  paymentDate: string;
  observations?: string;
  installmentId: UUID;
  accountId: UUID;
  paymentInstrumentId?: UUID;
  interest?: number;
  fine?: number;
  discount?: number;
}

export interface InstallmentDTO {
  parcelNumber: number; 
  amount: number;
  dueDate: string;
  instrument: UUID;
  accountId: UUID;
  movementDirection: MovementDirection;
}

export interface CreateInvoiceRequestDTO {
  operationTypeId: UUID;
  totalAmount: number;
  personId: UUID;
  purchaseDate: string;
  installments: InstallmentDTO[];
}

export interface BaseAccount {
  name: string;
  initialValue: number;
  bankId?: UUID;
}

export interface CreateAccountRequest {
  baseAccount?: BaseAccount;
  name?: string;
  kind: AccountKind;
  agency?: string;
  number?: string;
  overdraftLimit?: number;
  yieldRate?: number;
  riskLevel?: number;
  provider?: string;
  interestRate?: number;
  initialValue?: number
}

export interface CreditCardCreateRequestDTO {
  name: string;
  creditLimit: number;
  closingDay: number;
  dueDay: number;
  cardBrandId: UUID;
  bankId?: UUID;
  revolvingInterest?: number;
  fine?: number;
  expirationDate?: string;
}

export type PhoneType = "MOBILE" | "LANDLINE" | "COMMERCIAL"; // Ajuste conforme seu enum Java

export interface AddressResponseDTO {
  id: string;
  street: string;
  number: string;
  neighborhood: string;
  complement?: string;
  city: string;
  state: string;
  zipCode: string;
}

export interface AddressDTO {
  street: string;
  number: string;
  neighborhood: string;
  complement?: string;
  city: string;
  state: string;
  zipCode: string;
}

export interface PhoneResponseDTO {
  id: string;
  number: string;
  type: PhoneType;
}

export interface PhoneDTO {
  number: string;
  type: PhoneType;
}

export interface EmailResponseDTO {
  id: string;
  email: string;
}

export interface EmailDTO {
  email: string;
}

export interface PersonCreatePhysicalRequestDTO {
  name: string;
  CPF: string;
  nickname?: string;
  role: PersonRole;
  addressesList: AddressDTO[];
  phoneList: PhoneDTO[];
  emailList: EmailDTO[];
}

export interface PersonCreateLegalRequestDTO {
  name: string;
  CNPJ: string;
  tradeName?: string;
  role: PersonRole;
  addressesList: AddressDTO[];
  phoneList: PhoneDTO[];
  emailList: EmailDTO[];
}

export interface ReversalRequestDTO {
  reason?: string
}

// Dicionário de tradução e ícones
export const PaymentTypeMeta: Record<string, string> = {
  CREDIT_CARD: "Cartão de Crédito",
  DEBIT_CARD: "Cartão de Débito",
  PIX: "Pix",
  BANK_TRANSFER: "Transferência Bancária",
  CASH: "Dinheiro / Espécie",
  BOLETO: "Boleto Bancário",
  TICKET: "Vale / Ticket"
};

export interface CreateManualAdjustmentTransactionDTO {
  amount: number;
  direction: "INFLOW" | "OUTFLOW";
  paymentDate: string;
  reason: string;
  accountId: string;
  paymentInstrumentId?: string | null;
}

export interface CreateManualAdjustmentTransactionRequestDTO {
  dto: CreateManualAdjustmentTransactionDTO[];
}

export interface InvestmentTransactionDTO {
  id: string;
  type: "APPORT" | "RESCUE" | "DAILY_YIELD";
  amount: number;
  grossAmount: number;
  irTax: number;
  iofTax: number;
  referenceDate: string;
  appliedMarketRate: number;
  description: string;
}

