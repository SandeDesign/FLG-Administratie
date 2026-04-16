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
  detectFormat(rawData: string): 'CSV' | 'MT940' | 'unknown' {
    const trimmed = rawData.trim();
    if (!trimmed) return 'unknown';

    // MT940 kenmerken: begint met :20: of :61:, of bevat :86: of :61: blokken
    if (
      trimmed.startsWith(':20:') ||
      trimmed.startsWith(':61:') ||
      /:\d{2}[A-Z]?:/.test(trimmed.substring(0, 20)) ||
      trimmed.includes(':86:') ||
      trimmed.includes(':61:')
    ) {
      return 'MT940';
    }

    // CSV kenmerken: meerdere regels met consistente delimiter
    const lines = trimmed.split('\n').filter(l => l.trim()).slice(0, 5);
    if (lines.length >= 2) {
      const delimiters = [';', ',', '\t'];
      for (const delim of delimiters) {
        const counts = lines.map(l => (l.match(new RegExp(`\\${delim === '\t' ? '\\t' : delim}`, 'g')) || []).length);
        if (counts[0] > 0 && counts.every(c => c === counts[0])) {
          return 'CSV';
        }
      }
    }

    return 'unknown';
  },

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

    // Zoek alle :61: regels als transactie-entries, met de bijbehorende :86: beschrijving
    const lines = rawData.split('\n');
    let idx = 0;

    while (idx < lines.length) {
      const line = lines[idx].trim();

      if (line.startsWith(':61:')) {
        // Parse :61: transactieregel
        // Format: :61:YYMMDD[MMDD]DC[R]amount,decNtttREF
        const entryLine = line.substring(4); // strip ':61:'
        const dateMatch = entryLine.match(/^(\d{6})/);
        // D of C staat na de datum (6 cijfers) + optioneel 4 extra cijfers
        const dcMatch = entryLine.match(/^\d{6,10}([DC])(\d+),(\d+)/);

        if (!dateMatch || !dcMatch) {
          idx++;
          continue;
        }

        const dateStr = dateMatch[1];
        const year = 2000 + parseInt(dateStr.substring(0, 2));
        const month = parseInt(dateStr.substring(2, 4)) - 1;
        const day = parseInt(dateStr.substring(4, 6));
        const isCredit = dcMatch[1] === 'C';
        const amount = parseFloat(`${dcMatch[2]}.${dcMatch[3]}`);

        // Haal IBAN op van de volgende regel(s) tot :86:
        let accountNumber = '';
        let continuation = '';
        idx++;
        while (idx < lines.length && !lines[idx].trim().startsWith(':86:') && !lines[idx].trim().startsWith(':61:') && !lines[idx].trim().startsWith(':62')) {
          const contLine = lines[idx].trim();
          if (contLine.match(/^[A-Z]{2}\d{2}[A-Z]{4}/)) {
            accountNumber = contLine;
          } else {
            continuation += ' ' + contLine;
          }
          idx++;
        }

        // Parse :86: beschrijving
        let description = '';
        let beneficiary = '';
        let reference = '';
        let fallbackDate: Date | null = null;
        if (idx < lines.length && lines[idx].trim().startsWith(':86:')) {
          // Verzamel alle :86: regels (kan meerdere regels beslaan)
          let descBlock = lines[idx].trim().substring(4); // strip ':86:'
          idx++;
          while (idx < lines.length) {
            const nextLine = lines[idx].trim();
            if (nextLine.startsWith(':') && nextLine.match(/^:\d{2}[A-Z]?:/)) break;
            descBlock += ' ' + nextLine;
            idx++;
          }

          // Extraheer velden uit de gestructureerde :86: beschrijving
          const nameMatch = descBlock.match(/\/NAME\/(.*?)(?=\/[A-Z]{4}\/|$)/);
          const remiMatch = descBlock.match(/\/REMI\/(.*?)(?=\/[A-Z]{4}\/|$)/);
          const erefMatch = descBlock.match(/\/EREF\/(.*?)(?=\/[A-Z]{4}\/|$)/);
          const isdtMatch = descBlock.match(/\/ISDT\/\s*(\d{4})-?\s*(\d{2})-?\s*(\d{2})/);

          beneficiary = nameMatch ? nameMatch[1].trim() : '';
          const remiText = remiMatch ? remiMatch[1].trim() : '';
          const erefText = erefMatch ? erefMatch[1].trim() : '';

          if (isdtMatch) {
            const isdtDate = new Date(
              parseInt(isdtMatch[1]),
              parseInt(isdtMatch[2]) - 1,
              parseInt(isdtMatch[3])
            );
            if (!isNaN(isdtDate.getTime())) {
              fallbackDate = isdtDate;
            }
          }

          // Bouw volledige description op voor matching
          description = [remiText, erefText, descBlock].filter(Boolean).join(' ');
          reference = erefText || remiText;
        }

        const parsedDate = new Date(year, month, day);
        const finalDate = isNaN(parsedDate.getTime()) && fallbackDate ? fallbackDate : parsedDate;

        transactions.push({
          id: `mt940-${transactions.length}`,
          date: finalDate,
          amount: isCredit ? amount : -amount,
          description,
          beneficiary: beneficiary || undefined,
          reference: reference || undefined,
          accountNumber: accountNumber || undefined,
          transactionType: isCredit ? 'credit' : 'debit',
        });
      } else {
        idx++;
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

  makeTransactionSignature(t: Pick<BankTransaction, 'date' | 'amount' | 'description'>): string {
    const date = t.date instanceof Date ? t.date.getTime() : t.date;
    const d = new Date(date);
    const dateKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    return `${dateKey}_${t.amount.toFixed(2)}_${t.description.substring(0, 50).trim().toLowerCase()}`;
  },

  async checkDuplicates(
    transactions: BankTransaction[],
    companyId: string
  ): Promise<Set<string>> {
    const q = query(
      collection(db, 'bankTransactions'),
      where('companyId', '==', companyId)
    );
    const snapshot = await getDocs(q);
    const existingSignatures = new Set<string>();

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const sig = this.makeTransactionSignature({
        date: data.date,
        amount: data.amount,
        description: data.description || '',
      });
      existingSignatures.add(sig);
    });

    return existingSignatures;
  },

  async matchTransactions(
    transactions: BankTransaction[],
    userId: string,
    companyId: string
  ): Promise<MatchResult[]> {
    const outgoingInvoices = await outgoingInvoiceService.getInvoices(userId, companyId);
    const incomingInvoices = await incomingInvoiceService.getInvoices(userId, companyId);

    const availableOutgoingInvoices = outgoingInvoices;
    const availableIncomingInvoices = incomingInvoices;

    const results: MatchResult[] = [];
    const usedInvoiceIds = new Set<string>();

    for (const transaction of transactions) {
      let possibleMatches: MatchedInvoice[] = [];

      if (transaction.amount >= 0) {
        const available = availableOutgoingInvoices.filter(inv => !usedInvoiceIds.has(inv.id || ''));
        possibleMatches = this.findPossibleMatches(transaction, available, 'outgoing');
      } else {
        const available = availableIncomingInvoices.filter(inv => !usedInvoiceIds.has(inv.id || ''));
        possibleMatches = this.findPossibleMatches(transaction, available, 'incoming');
      }

      if (possibleMatches.length > 0) {
        const bestMatch = possibleMatches[0];
        const status: 'confirmed' | 'pending' | 'unmatched' =
          bestMatch.confidence >= 80 ? 'confirmed' :
          bestMatch.confidence >= 40 ? 'pending' : 'unmatched';

        usedInvoiceIds.add(bestMatch.invoiceId);

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
    // 1. Haal alle transacties op vóór verwijdering (nodig voor matched payments cleanup)
    const transactionsQuery = query(
      collection(db, 'bankTransactions'),
      where('companyId', '==', companyId),
      where('importId', '==', importId)
    );
    const transactionsSnapshot = await getDocs(transactionsQuery);

    // 2. Voor elke confirmed transactie: verwijder matched payment + markeer factuur als onbetaald
    for (const transDoc of transactionsSnapshot.docs) {
      const t = transDoc.data() as BankTransaction;
      if (t.status === 'confirmed' && t.matchedInvoiceId && t.matchedInvoiceType) {
        try {
          await matchedPaymentsService.deleteByTransactionId(companyId, transDoc.id);
          if (t.matchedInvoiceType === 'outgoing') {
            await outgoingInvoiceService.subtractPartialPayment(t.matchedInvoiceId, t.amount);
          } else {
            await incomingInvoiceService.subtractPartialPayment(t.matchedInvoiceId, t.amount);
          }
        } catch (e) {
          console.error('Error cleaning up matched payment:', e);
        }
      }
    }

    // 3. Verwijder de import + alle transacties
    const batch = writeBatch(db);
    await deleteDoc(doc(db, 'bankImports', importId));
    transactionsSnapshot.forEach((d) => {
      batch.delete(d.ref);
    });
    await batch.commit();
  },

  async saveTransactions(
    transactions: BankTransaction[],
    companyId: string,
    importId: string
  ): Promise<Map<string, string>> {
    const batch = writeBatch(db);
    const idMap = new Map<string, string>();

    transactions.forEach((transaction) => {
      const transactionRef = doc(collection(db, 'bankTransactions'));
      idMap.set(transaction.id, transactionRef.id);
      const raw: Record<string, unknown> = {
        ...transaction,
        id: transactionRef.id,
        date: typeof transaction.date === 'number' ? transaction.date : transaction.date.getTime(),
        companyId,
        importId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      // Firestore accepteert geen undefined values
      const cleaned = Object.fromEntries(
        Object.entries(raw).filter(([, v]) => v !== undefined)
      );
      batch.set(transactionRef, cleaned);
    });

    await batch.commit();
    return idMap;
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
        const oldValue = (currentData as Record<string, unknown>)[key];
        const newValue = (updates as Record<string, unknown>)[key];

        if (oldValue !== newValue) {
          editHistory.push({
            timestamp: Date.now(),
            userId,
            userName,
            fieldChanged: key,
            oldValue: oldValue ?? null,
            newValue: newValue ?? null,
          });
        }
      }
    });

    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );

    await updateDoc(transactionRef, {
      ...cleanUpdates,
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
      transaction.matchedInvoiceNumber || transaction.matchedInvoiceId,
      transactionId,
      transaction.importId,
      userId,
      userName
    );

    if (transaction.matchedInvoiceType === 'outgoing') {
      await outgoingInvoiceService.addPartialPayment(transaction.matchedInvoiceId, transaction.amount);
    } else {
      await incomingInvoiceService.addPartialPayment(transaction.matchedInvoiceId, transaction.amount);
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
        await outgoingInvoiceService.subtractPartialPayment(transaction.matchedInvoiceId, transaction.amount);
      } else {
        await incomingInvoiceService.subtractPartialPayment(transaction.matchedInvoiceId, transaction.amount);
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
