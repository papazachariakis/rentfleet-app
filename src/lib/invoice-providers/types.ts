export type InvoiceProviderId = string;

export type ProviderInvoiceInput = {
  series: string;
  aa: number;
  issueDate: Date;
  invoiceType: string;
  vatCategory: number;
  grossAmount: number;
  netAmount: number;
  vatAmount: number;
  description: string;
  customerName: string;
  customerEmail?: string | null;
  customerAfm?: string | null;
  customerIsForeign?: boolean;
  bookingCode?: string | null;
  plateNumber?: string | null;
};

export type ProviderSendResult = {
  ok: boolean;
  provider: InvoiceProviderId;
  uid?: string;
  mark?: string;
  qrUrl?: string;
  externalId?: string;
  error?: string;
  rawResponse?: string;
  xml?: string;
};

export type InvoiceProviderOrg = {
  afm: string | null;
  taxMode: string;
  mydataUserId: string | null;
  mydataSubscriptionKey: string | null;
  mydataBranch: number;
  invoiceProvider: string;
  invoiceProviderApiKey: string | null;
  invoiceProviderOrgId: string | null;
  invoiceProviderBaseUrl: string | null;
  invoiceProviderMeta: string | null;
};
