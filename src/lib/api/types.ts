// Tipos derivados das DTOs do backend Spring Boot (OpenAPI /v3/api-docs).

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
  closeDay: number;
  dueDay: number;
  creditLimit: number;
  availableLimit: number;
  revolvingInterest: number;
  fine: number;
  status: PaymentInstrumentStatus;
  cardBrand: CardBrandResponseDTO;
  bank?: BankResponseDTO;
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
  personId: UUID;
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
}

export interface CreateInvoiceRequestDTO {
  operationTypeId: UUID;
  totalAmount: number;
  personId: UUID;
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
  cardBrand: UUID;
  bank?: UUID;
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
  addressesList: AddressDTO[];
  phoneList: PhoneDTO[];
  emailList: EmailDTO[];
}

export interface PersonCreateLegalRequestDTO {
  name: string;
  CNPJ: string;
  tradeName?: string;
  addressesList: AddressDTO[];
  phoneList: PhoneDTO[];
  emailList: EmailDTO[];
}

export interface ReversalRequestDTO {
  reason?: string
}