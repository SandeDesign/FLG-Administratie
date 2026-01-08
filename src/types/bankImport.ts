export interface EditHistoryEntry {
  timestamp: number;
  userId: string;
  userName: string;
  fieldChanged: string;
  oldValue: any;
  newValue: any;
}

export interface BankTransaction {
  id: string;
  date: Date | number;
  amount: number;
  description: string;
  beneficiary?: string;
  reference?: string;
  accountNumber?: string;
  transactionType?: 'debit' | 'credit';
  type: 'incoming' | 'outgoing';
  status: 'confirmed' | 'pending' | 'unmatched';
  companyId: string;
  importId: string;
  matchedInvoiceId?: string;
  matchedInvoiceType?: 'outgoing' | 'incoming';
  confidence?: number;
  editHistory?: EditHistoryEntry[];
  createdAt: number;
  updatedAt: number;
}

export interface MatchedInvoice {
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  clientName: string;
  invoiceDate: Date;
  confidence: number;
  type: 'outgoing' | 'incoming';
  status?: string;
}

export interface MatchResult {
  transaction: BankTransaction;
  matchedInvoice?: MatchedInvoice;
  status: 'confirmed' | 'pending' | 'unmatched';
  confidence: number;
  possibleMatches?: MatchedInvoice[];
  manuallyLinked?: boolean;
  linkedInvoiceId?: string;
  linkedInvoiceType?: 'outgoing' | 'incoming';
}

export interface MatchedPayment {
  id: string;
  invoiceId: string;
  invoiceType: 'outgoing' | 'incoming';
  invoiceNumber: string;
  transactionId: string;
  importId: string;
  companyId: string;
  matchedAt: number;
  matchedBy: string;
  matchedByName: string;
}

export interface BankImport {
  id: string;
  companyId: string;
  companyName: string;
  importedAt: number;
  importedBy: string;
  importedByName: string;
  totalLines: number;
  format: 'CSV' | 'MT940';
  confirmedCount: number;
  pendingCount: number;
  unmatchedCount: number;
  rawData?: string;
}

export interface ParsedCSV {
  headers: string[];
  rows: string[][];
  detectedFormat: {
    dateColumn: number;
    amountColumn: number;
    descriptionColumn: number;
    beneficiaryColumn?: number;
    referenceColumn?: number;
  };
}

export interface CSVColumnMapping {
  date: number;
  amount: number;
  description: number;
  beneficiary?: number;
  reference?: number;
  accountNumber?: number;
}
