export interface Supplier {
  id?: string;
  companyId: string;
  supplierName: string;
  supplierEmail?: string;
  totalAmountExVat: number;
  totalVatAmount: number;
  totalAmountIncVat: number;
  invoiceCount: number;
  grootboekrekening?: string;
  grootboekrekeningName?: string;
  lastInvoiceDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Grootboekrekening {
  id?: string;
  companyId: string;
  code: string;
  name: string;
  category: GrootboekCategory;
  type: 'debet' | 'credit';
  btw?: 'hoog' | 'laag' | 'geen' | 'verlegd';
  isDefault?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type GrootboekCategory =
  | 'vaste_activa'
  | 'vlottende_activa'
  | 'liquide_middelen'
  | 'eigen_vermogen'
  | 'langlopende_schulden'
  | 'kortlopende_schulden'
  | 'omzet'
  | 'kostprijs_omzet'
  | 'personeelskosten'
  | 'huisvestingskosten'
  | 'exploitatiekosten'
  | 'afschrijvingen'
  | 'financiele_baten_lasten'
  | 'overige';

export interface GrootboekTemplate {
  id?: string;
  name: string;
  userId: string;
  sourceCompanyId: string;
  entries: Array<{
    code: string;
    name: string;
    category: GrootboekCategory;
    type: 'debet' | 'credit';
    btw?: 'hoog' | 'laag' | 'geen' | 'verlegd';
  }>;
  createdAt: Date;
}

export interface Crediteur {
  id?: string;
  companyId: string;
  name: string;
  code: string;
  iban?: string;
  kvkNummer?: string;
  btwNummer?: string;
  email?: string;
  telefoon?: string;
  adres?: string;
  postcode?: string;
  plaats?: string;
  land?: string;
  standaardGrootboek?: string;
  standaardGrootboekNaam?: string;
  totalOpenstaand: number;
  totalBetaald: number;
  transactionCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Debiteur {
  id?: string;
  companyId: string;
  name: string;
  code: string;
  iban?: string;
  kvkNummer?: string;
  btwNummer?: string;
  email?: string;
  telefoon?: string;
  adres?: string;
  postcode?: string;
  plaats?: string;
  land?: string;
  standaardGrootboek?: string;
  standaardGrootboekNaam?: string;
  totalOpenstaand: number;
  totalBetaald: number;
  transactionCount: number;
  createdAt: Date;
  updatedAt: Date;
}
