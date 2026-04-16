import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  increment,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Supplier, Grootboekrekening, Crediteur, Debiteur } from '../types/supplier';
import { grootboekTemplate } from '../utils/grootboekTemplate';

const SUPPLIERS_COLLECTION = 'suppliers';
const GROOTBOEK_COLLECTION = 'grootboekrekeningen';
const CREDITEUREN_COLLECTION = 'crediteuren';
const DEBITEUREN_COLLECTION = 'debiteuren';

interface InvoiceAmounts {
  amount: number;
  vatAmount: number;
  totalAmount: number;
  invoiceDate?: Date;
}

export const supplierService = {
  /**
   * Upsert supplier: create if not exists, increment totals if exists
   */
  async upsertSupplier(
    companyId: string,
    supplierName: string,
    supplierEmail: string | undefined,
    amounts: InvoiceAmounts
  ): Promise<string> {
    const q = query(
      collection(db, SUPPLIERS_COLLECTION),
      where('companyId', '==', companyId),
      where('supplierName', '==', supplierName)
    );

    const snapshot = await getDocs(q);
    const now = Timestamp.fromDate(new Date());

    if (!snapshot.empty) {
      // Update existing supplier with incremented totals
      const existingDoc = snapshot.docs[0];
      const updateData: Record<string, any> = {
        totalAmountExVat: increment(amounts.amount || 0),
        totalVatAmount: increment(amounts.vatAmount || 0),
        totalAmountIncVat: increment(amounts.totalAmount || 0),
        invoiceCount: increment(1),
        updatedAt: now,
      };

      if (supplierEmail) {
        updateData.supplierEmail = supplierEmail;
      }
      if (amounts.invoiceDate) {
        updateData.lastInvoiceDate = Timestamp.fromDate(
          amounts.invoiceDate instanceof Date ? amounts.invoiceDate : new Date(amounts.invoiceDate)
        );
      }

      await updateDoc(doc(db, SUPPLIERS_COLLECTION, existingDoc.id), updateData);
      return existingDoc.id;
    } else {
      // Create new supplier
      const newSupplier: Record<string, any> = {
        companyId,
        supplierName,
        supplierEmail: supplierEmail || '',
        totalAmountExVat: amounts.amount || 0,
        totalVatAmount: amounts.vatAmount || 0,
        totalAmountIncVat: amounts.totalAmount || 0,
        invoiceCount: 1,
        createdAt: now,
        updatedAt: now,
      };

      if (amounts.invoiceDate) {
        newSupplier.lastInvoiceDate = Timestamp.fromDate(
          amounts.invoiceDate instanceof Date ? amounts.invoiceDate : new Date(amounts.invoiceDate)
        );
      }

      const docRef = await addDoc(collection(db, SUPPLIERS_COLLECTION), newSupplier);
      return docRef.id;
    }
  },

  /**
   * Get all suppliers for a company
   */
  async getSuppliers(companyId: string): Promise<Supplier[]> {
    const q = query(
      collection(db, SUPPLIERS_COLLECTION),
      where('companyId', '==', companyId),
      orderBy('supplierName', 'asc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        companyId: data.companyId,
        supplierName: data.supplierName,
        supplierEmail: data.supplierEmail || '',
        totalAmountExVat: data.totalAmountExVat || 0,
        totalVatAmount: data.totalVatAmount || 0,
        totalAmountIncVat: data.totalAmountIncVat || 0,
        invoiceCount: data.invoiceCount || 0,
        grootboekrekening: data.grootboekrekening || undefined,
        grootboekrekeningName: data.grootboekrekeningName || undefined,
        lastInvoiceDate: data.lastInvoiceDate?.toDate() || undefined,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as Supplier;
    });
  },

  /**
   * Update supplier's linked grootboekrekening
   */
  async updateSupplierGrootboek(
    supplierId: string,
    code: string,
    name: string
  ): Promise<void> {
    await updateDoc(doc(db, SUPPLIERS_COLLECTION, supplierId), {
      grootboekrekening: code,
      grootboekrekeningName: name,
      updatedAt: Timestamp.fromDate(new Date()),
    });
  },

  /**
   * Get all grootboekrekeningen for a company
   */
  async getGrootboekrekeningen(companyId: string): Promise<Grootboekrekening[]> {
    const q = query(
      collection(db, GROOTBOEK_COLLECTION),
      where('companyId', '==', companyId),
      orderBy('code', 'asc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        companyId: data.companyId,
        code: data.code,
        name: data.name,
        category: data.category,
        type: data.type || 'debet',
        btw: data.btw,
        isDefault: data.isDefault,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as Grootboekrekening;
    });
  },

  /**
   * Add a new grootboekrekening
   */
  async addGrootboekrekening(
    companyId: string,
    code: string,
    name: string,
    category: string,
    type: 'debet' | 'credit' = 'debet',
    btw?: 'hoog' | 'laag' | 'geen' | 'verlegd'
  ): Promise<string> {
    const now = Timestamp.fromDate(new Date());
    const data: Record<string, unknown> = {
      companyId,
      code,
      name,
      category,
      type,
      createdAt: now,
      updatedAt: now,
    };
    if (btw) data.btw = btw;
    const docRef = await addDoc(collection(db, GROOTBOEK_COLLECTION), data);
    return docRef.id;
  },

  /**
   * Update a grootboekrekening
   */
  async updateGrootboekrekening(
    id: string,
    updates: Partial<Pick<Grootboekrekening, 'code' | 'name' | 'category' | 'type' | 'btw'>>
  ): Promise<void> {
    await updateDoc(doc(db, GROOTBOEK_COLLECTION, id), {
      ...updates,
      updatedAt: Timestamp.fromDate(new Date()),
    });
  },

  /**
   * Delete a grootboekrekening
   */
  async deleteGrootboekrekening(id: string): Promise<void> {
    await deleteDoc(doc(db, GROOTBOEK_COLLECTION, id));
  },

  /**
   * Import het standaard rekeningschema voor een bedrijf
   * Controleert eerst of er al rekeningen bestaan
   */
  async importGrootboekTemplate(companyId: string): Promise<number> {
    const existing = await this.getGrootboekrekeningen(companyId);
    const existingCodes = new Set(existing.map(g => g.code));

    const batch = writeBatch(db);
    let count = 0;
    const now = Timestamp.fromDate(new Date());

    for (const entry of grootboekTemplate) {
      if (!existingCodes.has(entry.code)) {
        const ref = doc(collection(db, GROOTBOEK_COLLECTION));
        const data: Record<string, unknown> = {
          companyId,
          code: entry.code,
          name: entry.name,
          category: entry.category,
          type: entry.type,
          isDefault: true,
          createdAt: now,
          updatedAt: now,
        };
        if (entry.btw) data.btw = entry.btw;
        batch.set(ref, data);
        count++;
      }
    }

    if (count > 0) {
      await batch.commit();
    }
    return count;
  },

  /**
   * Verwijder alle grootboekrekeningen van een bedrijf
   */
  async clearGrootboekrekeningen(companyId: string): Promise<void> {
    const existing = await this.getGrootboekrekeningen(companyId);
    const batch = writeBatch(db);
    for (const gb of existing) {
      if (gb.id) {
        batch.delete(doc(db, GROOTBOEK_COLLECTION, gb.id));
      }
    }
    await batch.commit();
  },

  // ==========================================
  // CREDITEUREN
  // ==========================================

  /**
   * Zoek of maak een crediteur aan op basis van naam of IBAN
   */
  async findOrCreateCrediteur(
    companyId: string,
    name: string,
    iban?: string,
    extraData?: Partial<Crediteur>
  ): Promise<Crediteur> {
    let existing: Crediteur | null = null;

    if (iban) {
      const q = query(
        collection(db, CREDITEUREN_COLLECTION),
        where('companyId', '==', companyId),
        where('iban', '==', iban)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const d = snapshot.docs[0];
        existing = { id: d.id, ...d.data() } as Crediteur;
      }
    }

    if (!existing) {
      const q = query(
        collection(db, CREDITEUREN_COLLECTION),
        where('companyId', '==', companyId),
        where('name', '==', name)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const d = snapshot.docs[0];
        existing = { id: d.id, ...d.data() } as Crediteur;
      }
    }

    if (existing) {
      return existing;
    }

    const allCrediteuren = await this.getCrediteuren(companyId);
    const nextCode = `C${String(allCrediteuren.length + 1).padStart(4, '0')}`;
    const now = Timestamp.fromDate(new Date());

    const newCrediteur: Record<string, unknown> = {
      companyId,
      name,
      code: nextCode,
      iban: iban || '',
      email: extraData?.email || '',
      telefoon: extraData?.telefoon || '',
      adres: extraData?.adres || '',
      postcode: extraData?.postcode || '',
      plaats: extraData?.plaats || '',
      land: extraData?.land || 'NL',
      kvkNummer: extraData?.kvkNummer || '',
      btwNummer: extraData?.btwNummer || '',
      standaardGrootboek: extraData?.standaardGrootboek || '3000',
      standaardGrootboekNaam: extraData?.standaardGrootboekNaam || 'Crediteuren',
      totalOpenstaand: 0,
      totalBetaald: 0,
      transactionCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await addDoc(collection(db, CREDITEUREN_COLLECTION), newCrediteur);
    return { id: docRef.id, ...newCrediteur, createdAt: new Date(), updatedAt: new Date() } as Crediteur;
  },

  /**
   * Update crediteur totalen bij een transactie
   */
  async updateCrediteurTotals(
    crediteurId: string,
    amount: number,
    isPaid: boolean
  ): Promise<void> {
    const updates: Record<string, unknown> = {
      transactionCount: increment(1),
      updatedAt: Timestamp.fromDate(new Date()),
    };

    if (isPaid) {
      updates.totalBetaald = increment(Math.abs(amount));
    } else {
      updates.totalOpenstaand = increment(Math.abs(amount));
    }

    await updateDoc(doc(db, CREDITEUREN_COLLECTION, crediteurId), updates);
  },

  async getCrediteuren(companyId: string): Promise<Crediteur[]> {
    const q = query(
      collection(db, CREDITEUREN_COLLECTION),
      where('companyId', '==', companyId),
      orderBy('name', 'asc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() || new Date(),
        updatedAt: data.updatedAt?.toDate?.() || new Date(),
      } as Crediteur;
    });
  },

  async updateCrediteur(id: string, updates: Partial<Crediteur>): Promise<void> {
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = updates;
    await updateDoc(doc(db, CREDITEUREN_COLLECTION, id), {
      ...rest,
      updatedAt: Timestamp.fromDate(new Date()),
    });
  },

  async deleteCrediteur(id: string): Promise<void> {
    await deleteDoc(doc(db, CREDITEUREN_COLLECTION, id));
  },

  // ==========================================
  // DEBITEUREN
  // ==========================================

  /**
   * Zoek of maak een debiteur aan op basis van naam of IBAN
   */
  async findOrCreateDebiteur(
    companyId: string,
    name: string,
    iban?: string,
    extraData?: Partial<Debiteur>
  ): Promise<Debiteur> {
    let existing: Debiteur | null = null;

    if (iban) {
      const q = query(
        collection(db, DEBITEUREN_COLLECTION),
        where('companyId', '==', companyId),
        where('iban', '==', iban)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const d = snapshot.docs[0];
        existing = { id: d.id, ...d.data() } as Debiteur;
      }
    }

    if (!existing) {
      const q = query(
        collection(db, DEBITEUREN_COLLECTION),
        where('companyId', '==', companyId),
        where('name', '==', name)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const d = snapshot.docs[0];
        existing = { id: d.id, ...d.data() } as Debiteur;
      }
    }

    if (existing) {
      return existing;
    }

    const allDebiteuren = await this.getDebiteuren(companyId);
    const nextCode = `D${String(allDebiteuren.length + 1).padStart(4, '0')}`;
    const now = Timestamp.fromDate(new Date());

    const newDebiteur: Record<string, unknown> = {
      companyId,
      name,
      code: nextCode,
      iban: iban || '',
      email: extraData?.email || '',
      telefoon: extraData?.telefoon || '',
      adres: extraData?.adres || '',
      postcode: extraData?.postcode || '',
      plaats: extraData?.plaats || '',
      land: extraData?.land || 'NL',
      kvkNummer: extraData?.kvkNummer || '',
      btwNummer: extraData?.btwNummer || '',
      standaardGrootboek: extraData?.standaardGrootboek || '1200',
      standaardGrootboekNaam: extraData?.standaardGrootboekNaam || 'Debiteuren',
      totalOpenstaand: 0,
      totalBetaald: 0,
      transactionCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await addDoc(collection(db, DEBITEUREN_COLLECTION), newDebiteur);
    return { id: docRef.id, ...newDebiteur, createdAt: new Date(), updatedAt: new Date() } as Debiteur;
  },

  /**
   * Update debiteur totalen bij een transactie
   */
  async updateDebiteurTotals(
    debiteurId: string,
    amount: number,
    isPaid: boolean
  ): Promise<void> {
    const updates: Record<string, unknown> = {
      transactionCount: increment(1),
      updatedAt: Timestamp.fromDate(new Date()),
    };

    if (isPaid) {
      updates.totalBetaald = increment(Math.abs(amount));
    } else {
      updates.totalOpenstaand = increment(Math.abs(amount));
    }

    await updateDoc(doc(db, DEBITEUREN_COLLECTION, debiteurId), updates);
  },

  async getDebiteuren(companyId: string): Promise<Debiteur[]> {
    const q = query(
      collection(db, DEBITEUREN_COLLECTION),
      where('companyId', '==', companyId),
      orderBy('name', 'asc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() || new Date(),
        updatedAt: data.updatedAt?.toDate?.() || new Date(),
      } as Debiteur;
    });
  },

  async updateDebiteur(id: string, updates: Partial<Debiteur>): Promise<void> {
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = updates;
    await updateDoc(doc(db, DEBITEUREN_COLLECTION, id), {
      ...rest,
      updatedAt: Timestamp.fromDate(new Date()),
    });
  },

  async deleteDebiteur(id: string): Promise<void> {
    await deleteDoc(doc(db, DEBITEUREN_COLLECTION, id));
  },
};
