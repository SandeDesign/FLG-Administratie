export interface BankTransaction {
  id: string;
  date: Date;
  amount: number;
  description: string;
  beneficiary?: string;
  reference?: string;
  accountNumber?: string;
  transactionType?: 'debit' | 'credit';
}

export interface MatchedInvoice {
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  clientName: string;
  invoiceDate: Date;
  confidence: number;
}

export interface MatchResult {
  transaction: BankTransaction;
  matchedInvoice?: MatchedInvoice;
  status: 'matched' | 'unmatched' | 'partial';
  confidence: number;
  possibleMatches?: MatchedInvoice[];
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
  matchedCount: number;
  unmatchedCount: number;
  matchedTransactions: Array<{
    transaction: BankTransaction;
    matchedInvoice: MatchedInvoice;
  }>;
  unmatchedTransactions: BankTransaction[];
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
