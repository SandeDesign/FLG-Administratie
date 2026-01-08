import { ref, push, set, get, query, orderByChild, equalTo } from 'firebase/database';
import { database } from '../lib/firebase';
import {
  BankTransaction,
  BankImport,
  ParsedCSV,
  CSVColumnMapping,
  MatchResult,
  MatchedInvoice,
} from '../types/bankImport';
import { outgoingInvoiceService, OutgoingInvoice } from './outgoingInvoiceService';

export const bankImportService = {
  parseCSV(rawData: string): ParsedCSV {
    const lines = rawData.trim().split('\n').filter(line => line.trim());
    if (lines.length === 0) throw new Error('CSV bestand is leeg');

    const delimiter = rawData.includes(';') ? ';' : ',';

    const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, ''));
    const rows = lines.slice(1).map(line => {
      const cols = line.split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
      return cols;
    });

    const detectedFormat = this.detectCSVColumns(headers);

    return {
      headers,
      rows,
      detectedFormat,
    };
  },

  detectCSVColumns(headers: string[]): CSVColumnMapping {
    const datePatterns = ['datum', 'date', 'boekdatum', 'valutadatum', 'transaction date'];
    const amountPatterns = ['bedrag', 'amount', 'totaal', 'total', 'saldo mutatie'];
    const descriptionPatterns = ['omschrijving', 'description', 'mededelingen', 'remarks'];
    const beneficiaryPatterns = ['begunstigde', 'beneficiary', 'naam', 'name', 'tegenpartij'];
    const referencePatterns = ['referentie', 'reference', 'kenmerk', 'transaction id'];

    const findColumn = (patterns: string[]) => {
      return headers.findIndex(h =>
        patterns.some(p => h.toLowerCase().includes(p.toLowerCase()))
      );
    };

    const dateColumn = findColumn(datePatterns);
    const amountColumn = findColumn(amountPatterns);
    const descriptionColumn = findColumn(descriptionPatterns);
    const beneficiaryColumn = findColumn(beneficiaryPatterns);
    const referenceColumn = findColumn(referencePatterns);

    if (dateColumn === -1 || amountColumn === -1 || descriptionColumn === -1) {
      throw new Error('Kon datum, bedrag of omschrijving kolom niet detecteren');
    }

    return {
      date: dateColumn,
      amount: amountColumn,
      description: descriptionColumn,
      beneficiary: beneficiaryColumn >= 0 ? beneficiaryColumn : undefined,
      reference: referenceColumn >= 0 ? referenceColumn : undefined,
    };
  },

  parseMT940(rawData: string): BankTransaction[] {
    const transactions: BankTransaction[] = [];
    const blocks = rawData.split(':86:');

    for (let i = 1; i < blocks.length; i++) {
      const block = blocks[i];

      const dateMatch = block.match(/:61:(\d{6})/);
      const amountMatch = block.match(/([CD])(\d+),(\d+)/);
      const descriptionMatch = block.match(/:86:(.*?)(?=:61:|$)/s);

      if (dateMatch && amountMatch) {
        const dateStr = dateMatch[1];
        const year = 2000 + parseInt(dateStr.substring(0, 2));
        const month = parseInt(dateStr.substring(2, 4)) - 1;
        const day = parseInt(dateStr.substring(4, 6));

        const isCredit = amountMatch[1] === 'C';
        const amount = parseFloat(`${amountMatch[2]}.${amountMatch[3]}`);

        transactions.push({
          id: `mt940-${i}`,
          date: new Date(year, month, day),
          amount: isCredit ? amount : -amount,
          description: descriptionMatch ? descriptionMatch[1].trim() : '',
          transactionType: isCredit ? 'credit' : 'debit',
        });
      }
    }

    return transactions;
  },

  parseCSVRows(rows: string[][], mapping: CSVColumnMapping): BankTransaction[] {
    return rows.map((row, index) => {
      const dateStr = row[mapping.date];
      const amountStr = row[mapping.amount];
      const description = row[mapping.description];

      const date = this.parseDate(dateStr);
      const amount = this.parseAmount(amountStr);

      return {
        id: `csv-${index}`,
        date,
        amount,
        description,
        beneficiary: mapping.beneficiary !== undefined ? row[mapping.beneficiary] : undefined,
        reference: mapping.reference !== undefined ? row[mapping.reference] : undefined,
        transactionType: amount >= 0 ? 'credit' : 'debit',
      };
    });
  },

  parseDate(dateStr: string): Date {
    dateStr = dateStr.trim();

    const formats = [
      /^(\d{4})-(\d{2})-(\d{2})$/,
      /^(\d{2})-(\d{2})-(\d{4})$/,
      /^(\d{2})\/(\d{2})\/(\d{4})$/,
      /^(\d{4})\/(\d{2})\/(\d{2})$/,
    ];

    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        let year, month, day;
        if (format === formats[0] || format === formats[3]) {
          [, year, month, day] = match.map(Number);
        } else {
          [, day, month, year] = match.map(Number);
        }
        return new Date(year, month - 1, day);
      }
    }

    throw new Error(`Kan datum niet parsen: ${dateStr}`);
  },

  parseAmount(amountStr: string): number {
    amountStr = amountStr.trim().replace(/[^\d,.\-+]/g, '');

    if (amountStr.includes(',') && amountStr.includes('.')) {
      if (amountStr.lastIndexOf(',') > amountStr.lastIndexOf('.')) {
        amountStr = amountStr.replace(/\./g, '').replace(',', '.');
      } else {
        amountStr = amountStr.replace(/,/g, '');
      }
    } else if (amountStr.includes(',')) {
      const parts = amountStr.split(',');
      if (parts.length === 2 && parts[1].length <= 2) {
        amountStr = amountStr.replace(',', '.');
      } else {
        amountStr = amountStr.replace(/,/g, '');
      }
    }

    return parseFloat(amountStr);
  },

  async matchTransactions(
    transactions: BankTransaction[],
    userId: string,
    companyId: string
  ): Promise<MatchResult[]> {
    const invoices = await outgoingInvoiceService.getInvoices(userId, companyId);
    const results: MatchResult[] = [];

    for (const transaction of transactions) {
      const possibleMatches = this.findPossibleMatches(transaction, invoices);

      if (possibleMatches.length > 0) {
        const bestMatch = possibleMatches[0];
        results.push({
          transaction,
          matchedInvoice: bestMatch,
          status: bestMatch.confidence >= 80 ? 'matched' : 'partial',
          confidence: bestMatch.confidence,
          possibleMatches: possibleMatches.slice(0, 3),
        });
      } else {
        results.push({
          transaction,
          status: 'unmatched',
          confidence: 0,
        });
      }
    }

    return results;
  },

  findPossibleMatches(transaction: BankTransaction, invoices: OutgoingInvoice[]): MatchedInvoice[] {
    const matches: MatchedInvoice[] = [];

    for (const invoice of invoices) {
      let confidence = 0;

      const invoiceNumberInDescription = transaction.description
        .toLowerCase()
        .includes(invoice.invoiceNumber.toLowerCase());
      if (invoiceNumberInDescription) confidence += 50;

      const amountMatch = Math.abs(Math.abs(transaction.amount) - invoice.totalAmount) < 0.01;
      if (amountMatch) confidence += 30;

      const daysDiff = Math.abs(
        (transaction.date.getTime() - invoice.invoiceDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysDiff <= 7) confidence += 10;
      else if (daysDiff <= 30) confidence += 5;

      const clientNameInDescription = transaction.description
        .toLowerCase()
        .includes(invoice.clientName.toLowerCase().substring(0, 5));
      if (clientNameInDescription) confidence += 10;

      if (confidence > 0) {
        matches.push({
          invoiceId: invoice.id || '',
          invoiceNumber: invoice.invoiceNumber,
          amount: invoice.totalAmount,
          clientName: invoice.clientName,
          invoiceDate: invoice.invoiceDate,
          confidence,
        });
      }
    }

    return matches.sort((a, b) => b.confidence - a.confidence);
  },

  async saveImport(importData: Omit<BankImport, 'id'>): Promise<string> {
    const importsRef = ref(database, `companies/${importData.companyId}/bankImports`);
    const newImportRef = push(importsRef);

    await set(newImportRef, {
      ...importData,
      importedAt: Date.now(),
    });

    return newImportRef.key || '';
  },

  async getImports(companyId: string): Promise<BankImport[]> {
    const importsRef = ref(database, `companies/${companyId}/bankImports`);
    const snapshot = await get(importsRef);

    if (!snapshot.exists()) return [];

    const imports: BankImport[] = [];
    snapshot.forEach(child => {
      imports.push({
        id: child.key || '',
        ...child.val(),
      });
    });

    return imports.sort((a, b) => b.importedAt - a.importedAt);
  },

  async deleteImport(companyId: string, importId: string): Promise<void> {
    const importRef = ref(database, `companies/${companyId}/bankImports/${importId}`);
    await set(importRef, null);
  },
};
