import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  increment,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Supplier, Grootboekrekening } from '../types/supplier';

const SUPPLIERS_COLLECTION = 'suppliers';
const GROOTBOEK_COLLECTION = 'grootboekrekeningen';

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
    category: string
  ): Promise<string> {
    const now = Timestamp.fromDate(new Date());
    const docRef = await addDoc(collection(db, GROOTBOEK_COLLECTION), {
      companyId,
      code,
      name,
      category,
      createdAt: now,
      updatedAt: now,
    });
    return docRef.id;
  },
};
