import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
  orderBy,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  BankTransaction,
  BankImport,
  ParsedCSV,
  CSVColumnMapping,
  MatchResult,
  MatchedInvoice,
  EditHistoryEntry,
} from '../types/bankImport';
import { outgoingInvoiceService, OutgoingInvoice } from './outgoingInvoiceService';
import { incomingInvoiceService, IncomingInvoice } from './incomingInvoiceService';
import { matchedPaymentsService } from './matchedPaymentsService';

export const bankImportService = {
  parseCSV(rawData: string): ParsedCSV {
    const lines = rawData.trim().split('\n').filter(line => line.trim());
    if (lines.length === 0) throw new Error('CSV bestand is leeg');

    let delimiter = ',';
    const firstLine = lines[0];
    const tabCount = (firstLine.match(/\t/g) || []).length;
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;

    if (tabCount > semicolonCount && tabCount > commaCount) {
      delimiter = '\t';
    } else if (semicolonCount > commaCount) {
      delimiter = ';';
    }

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
    const transactions: BankTransaction[] = [];
    const errors: string[] = [];

    rows.forEach((row, index) => {
      try {
        if (row.length < 3) {
          errors.push(`Regel ${index + 1}: Onvoldoende kolommen`);
          return;
        }

        const dateStr = row[mapping.date] || '';
        const amountStr = row[mapping.amount] || '';
        const description = row[mapping.description] || '';

        if (!dateStr || !amountStr) {
          errors.push(`Regel ${index + 1}: Datum of bedrag ontbreekt`);
          return;
        }

        const date = this.parseDate(dateStr);
        const amount = this.parseAmount(amountStr);

        transactions.push({
          id: `csv-${index}`,
          date,
          amount,
          description,
          beneficiary: mapping.beneficiary !== undefined ? row[mapping.beneficiary] : undefined,
          reference: mapping.reference !== undefined ? row[mapping.reference] : undefined,
          transactionType: amount >= 0 ? 'credit' : 'debit',
        });
      } catch (e: any) {
        errors.push(`Regel ${index + 1}: ${e.message}`);
      }
    });

    if (transactions.length === 0 && errors.length > 0) {
      throw new Error(`Geen geldige transacties gevonden:\n${errors.slice(0, 5).join('\n')}`);
    }

    if (errors.length > 0) {
      console.warn(`${errors.length} rijen overgeslagen:`, errors);
    }

    return transactions;
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
    const outgoingInvoices = await outgoingInvoiceService.getInvoices(userId, companyId);
    const incomingInvoices = await incomingInvoiceService.getInvoices(userId, companyId);

    const matchedInvoiceIds = await matchedPaymentsService.getMatchedInvoiceIds(companyId);

    const availableOutgoingInvoices = outgoingInvoices.filter(
      inv => !matchedInvoiceIds.has(inv.id || '')
    );
    const availableIncomingInvoices = incomingInvoices.filter(
      inv => !matchedInvoiceIds.has(inv.id || '')
    );

    const results: MatchResult[] = [];

    for (const transaction of transactions) {
      let possibleMatches: MatchedInvoice[] = [];

      if (transaction.amount >= 0) {
        possibleMatches = this.findPossibleMatches(transaction, availableOutgoingInvoices, 'outgoing');
      } else {
        possibleMatches = this.findPossibleMatches(transaction, availableIncomingInvoices, 'incoming');
      }

      if (possibleMatches.length > 0) {
        const bestMatch = possibleMatches[0];
        const status: 'confirmed' | 'pending' | 'unmatched' =
          bestMatch.confidence >= 80 ? 'confirmed' :
          bestMatch.confidence >= 40 ? 'pending' : 'unmatched';

        results.push({
          transaction,
          matchedInvoice: bestMatch,
          status,
          confidence: bestMatch.confidence,
          possibleMatches: possibleMatches.slice(0, 5),
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

  extractInvoiceNumbers(text: string): string[] {
    const patterns = [
      /\b(\d{4}[-\/]\d{3,4})\b/g,
      /\b(INV[-_]?\d{3,})\b/gi,
      /\b(FACT[-_]?\d{3,})\b/gi,
      /\b(F[-_]?\d{4,})\b/gi,
      /\b([A-Z]{2,4}\d{4,})\b/g,
      /\b(\d{6,})\b/g,
    ];

    const found = new Set<string>();
    for (const pattern of patterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        found.add(match[1].toUpperCase());
      }
    }

    return Array.from(found);
  },

  normalizeInvoiceNumber(invoiceNumber: string): string {
    return invoiceNumber
      .toUpperCase()
      .replace(/[-_\s]/g, '')
      .trim();
  },

  findPossibleMatches(
    transaction: BankTransaction,
    invoices: (OutgoingInvoice | IncomingInvoice)[],
    type: 'outgoing' | 'incoming'
  ): MatchedInvoice[] {
    const matches: MatchedInvoice[] = [];
    const extractedNumbers = this.extractInvoiceNumbers(transaction.description);

    for (const invoice of invoices) {
      let confidence = 0;
      const normalizedInvoiceNumber = this.normalizeInvoiceNumber(invoice.invoiceNumber);

      const exactMatch = extractedNumbers.some(
        num => this.normalizeInvoiceNumber(num) === normalizedInvoiceNumber
      );
      if (exactMatch) confidence += 70;

      let partialMatch = false;
      if (!exactMatch) {
        partialMatch = extractedNumbers.some(num =>
          normalizedInvoiceNumber.includes(this.normalizeInvoiceNumber(num)) ||
          this.normalizeInvoiceNumber(num).includes(normalizedInvoiceNumber)
        );
        if (partialMatch) confidence += 40;
      }

      if (!exactMatch && !partialMatch) {
        const simpleIncludes = transaction.description
          .toUpperCase()
          .includes(invoice.invoiceNumber.toUpperCase());
        if (simpleIncludes) confidence += 30;
      }

      const transactionAmount = Math.abs(transaction.amount);
      const invoiceAmount = invoice.totalAmount;
      const amountDiff = Math.abs(transactionAmount - invoiceAmount);

      if (amountDiff < 0.01) confidence += 40;
      else if (amountDiff < 1) confidence += 30;
      else if (amountDiff < 10) confidence += 20;
      else if (amountDiff < invoiceAmount * 0.05) confidence += 10;

      const transactionDate = transaction.date instanceof Date ? transaction.date : new Date(transaction.date);
      const invoiceDate = invoice.invoiceDate instanceof Date ? invoice.invoiceDate : new Date(invoice.invoiceDate);

      const daysDiff = Math.abs(
        (transactionDate.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysDiff <= 7) confidence += 15;
      else if (daysDiff <= 30) confidence += 10;
      else if (daysDiff <= 90) confidence += 5;

      const clientName = type === 'outgoing'
        ? (invoice as OutgoingInvoice).clientName
        : (invoice as IncomingInvoice).supplierName;

      const nameParts = clientName.toLowerCase().split(/\s+/).filter(p => p.length > 2);
      const nameMatchCount = nameParts.filter(part =>
        transaction.description.toLowerCase().includes(part)
      ).length;

      if (nameMatchCount > 0) {
        confidence += Math.min(nameMatchCount * 5, 15);
      }

      if (transaction.beneficiary) {
        const beneficiaryLower = transaction.beneficiary.toLowerCase();
        const clientNameLower = clientName.toLowerCase();
        if (beneficiaryLower.includes(clientNameLower) || clientNameLower.includes(beneficiaryLower)) {
          confidence += 20;
        }
      }

      if (confidence > 15) {
        matches.push({
          invoiceId: invoice.id || '',
          invoiceNumber: invoice.invoiceNumber,
          amount: invoice.totalAmount,
          clientName,
          invoiceDate: invoice.invoiceDate,
          confidence: Math.min(confidence, 100),
          type,
          status: invoice.status,
        });
      }
    }

    return matches.sort((a, b) => b.confidence - a.confidence);
  },

  async saveImport(importData: Omit<BankImport, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'bankImports'), {
      ...importData,
      importedAt: Date.now(),
    });

    return docRef.id;
  },

  async getImports(companyId: string): Promise<BankImport[]> {
    try {
      const q = query(
        collection(db, 'bankImports'),
        where('companyId', '==', companyId),
        orderBy('importedAt', 'desc')
      );

      const snapshot = await getDocs(q);
      const imports: BankImport[] = [];

      snapshot.forEach((doc) => {
        imports.push({
          id: doc.id,
          ...doc.data(),
        } as BankImport);
      });

      return imports;
    } catch (error: any) {
      console.error('Error loading bank imports:', error);
      return [];
    }
  },

  async deleteImport(companyId: string, importId: string): Promise<void> {
    const batch = writeBatch(db);

    await deleteDoc(doc(db, 'bankImports', importId));

    const transactionsQuery = query(
      collection(db, 'bankTransactions'),
      where('companyId', '==', companyId),
      where('importId', '==', importId)
    );
    const transactionsSnapshot = await getDocs(transactionsQuery);

    transactionsSnapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
  },

  async saveTransactions(
    transactions: BankTransaction[],
    companyId: string,
    importId: string
  ): Promise<void> {
    const batch = writeBatch(db);

    transactions.forEach((transaction) => {
      const transactionRef = doc(collection(db, 'bankTransactions'));
      batch.set(transactionRef, {
        ...transaction,
        date: typeof transaction.date === 'number' ? transaction.date : transaction.date.getTime(),
        companyId,
        importId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await batch.commit();
  },

  async getTransactionsByImport(companyId: string, importId: string): Promise<BankTransaction[]> {
    const q = query(
      collection(db, 'bankTransactions'),
      where('companyId', '==', companyId),
      where('importId', '==', importId)
    );

    const snapshot = await getDocs(q);
    const transactions: BankTransaction[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      transactions.push({
        ...data,
        id: doc.id,
        date: typeof data.date === 'number' ? new Date(data.date) : data.date,
      } as BankTransaction);
    });

    return transactions;
  },

  async getTransactionsByStatus(
    companyId: string,
    status: 'confirmed' | 'pending' | 'unmatched'
  ): Promise<BankTransaction[]> {
    const q = query(
      collection(db, 'bankTransactions'),
      where('companyId', '==', companyId),
      where('status', '==', status),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    const transactions: BankTransaction[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      transactions.push({
        ...data,
        id: doc.id,
        date: typeof data.date === 'number' ? new Date(data.date) : data.date,
      } as BankTransaction);
    });

    return transactions;
  },

  async updateTransaction(
    transactionId: string,
    updates: Partial<BankTransaction>,
    userId: string,
    userName: string
  ): Promise<void> {
    const transactionRef = doc(db, 'bankTransactions', transactionId);
    const transactionDoc = await getDoc(transactionRef);

    if (!transactionDoc.exists()) {
      throw new Error('Transaction not found');
    }

    const currentData = transactionDoc.data() as BankTransaction;
    const editHistory: EditHistoryEntry[] = currentData.editHistory || [];

    Object.keys(updates).forEach((key) => {
      if (key !== 'editHistory' && key !== 'updatedAt') {
        const oldValue = currentData[key as keyof BankTransaction];
        const newValue = updates[key as keyof BankTransaction];

        if (oldValue !== newValue) {
          editHistory.push({
            timestamp: Date.now(),
            userId,
            userName,
            fieldChanged: key,
            oldValue,
            newValue,
          });
        }
      }
    });

    await updateDoc(transactionRef, {
      ...updates,
      editHistory,
      updatedAt: Date.now(),
    });
  },

  async confirmTransaction(
    transactionId: string,
    companyId: string,
    userId: string,
    userName: string
  ): Promise<void> {
    const transactionRef = doc(db, 'bankTransactions', transactionId);
    const transactionDoc = await getDoc(transactionRef);

    if (!transactionDoc.exists()) {
      throw new Error('Transaction not found');
    }

    const transaction = transactionDoc.data() as BankTransaction;

    if (!transaction.matchedInvoiceId || !transaction.matchedInvoiceType) {
      throw new Error('Transaction must be matched before confirming');
    }

    await updateDoc(transactionRef, {
      status: 'confirmed',
      updatedAt: Date.now(),
    });

    await matchedPaymentsService.createMatchedPayment(
      companyId,
      transaction.matchedInvoiceId,
      transaction.matchedInvoiceType,
      transaction.matchedInvoiceId,
      transactionId,
      transaction.importId,
      userId,
      userName
    );

    if (transaction.matchedInvoiceType === 'outgoing') {
      await outgoingInvoiceService.markAsPaid(transaction.matchedInvoiceId);
    } else {
      await incomingInvoiceService.markAsPaid(transaction.matchedInvoiceId);
    }
  },

  async unconfirmTransaction(transactionId: string, companyId: string): Promise<void> {
    const transactionRef = doc(db, 'bankTransactions', transactionId);
    const transactionDoc = await getDoc(transactionRef);

    if (!transactionDoc.exists()) {
      throw new Error('Transaction not found');
    }

    const transaction = transactionDoc.data() as BankTransaction;

    await updateDoc(transactionRef, {
      status: 'pending',
      updatedAt: Date.now(),
    });

    await matchedPaymentsService.deleteByTransactionId(companyId, transactionId);

    if (transaction.matchedInvoiceId && transaction.matchedInvoiceType) {
      if (transaction.matchedInvoiceType === 'outgoing') {
        await outgoingInvoiceService.markAsUnpaid(transaction.matchedInvoiceId);
      } else {
        await incomingInvoiceService.markAsUnpaid(transaction.matchedInvoiceId);
      }
    }
  },

  async rematchTransactions(
    transactionIds: string[],
    userId: string,
    companyId: string
  ): Promise<MatchResult[]> {
    const transactions: BankTransaction[] = [];

    for (const transactionId of transactionIds) {
      const transactionRef = doc(db, 'bankTransactions', transactionId);
      const transactionDoc = await getDoc(transactionRef);

      if (transactionDoc.exists()) {
        const data = transactionDoc.data();
        transactions.push({
          ...data,
          id: transactionDoc.id,
          date: typeof data.date === 'number' ? new Date(data.date) : data.date,
        } as BankTransaction);
      }
    }

    return await this.matchTransactions(transactions, userId, companyId);
  },
};
