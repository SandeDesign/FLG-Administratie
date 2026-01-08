import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  doc,
  deleteDoc,
  getDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { MatchedPayment } from '../types/bankImport';

export const matchedPaymentsService = {
  async createMatchedPayment(
    companyId: string,
    invoiceId: string,
    invoiceType: 'outgoing' | 'incoming',
    invoiceNumber: string,
    transactionId: string,
    importId: string,
    userId: string,
    userName: string
  ): Promise<string> {
    const matchedPayment: Omit<MatchedPayment, 'id'> = {
      companyId,
      invoiceId,
      invoiceType,
      invoiceNumber,
      transactionId,
      importId,
      matchedAt: Date.now(),
      matchedBy: userId,
      matchedByName: userName,
    };

    const docRef = await addDoc(collection(db, 'matchedPayments'), matchedPayment);
    return docRef.id;
  },

  async isInvoiceMatched(companyId: string, invoiceId: string): Promise<boolean> {
    const q = query(
      collection(db, 'matchedPayments'),
      where('companyId', '==', companyId),
      where('invoiceId', '==', invoiceId)
    );

    const snapshot = await getDocs(q);
    return !snapshot.empty;
  },

  async getMatchedInvoiceIds(companyId: string): Promise<Set<string>> {
    const q = query(
      collection(db, 'matchedPayments'),
      where('companyId', '==', companyId)
    );

    const snapshot = await getDocs(q);
    const matchedIds = new Set<string>();

    snapshot.forEach((doc) => {
      const data = doc.data() as MatchedPayment;
      matchedIds.add(data.invoiceId);
    });

    return matchedIds;
  },

  async getMatchedPaymentByTransaction(
    companyId: string,
    transactionId: string
  ): Promise<MatchedPayment | null> {
    const q = query(
      collection(db, 'matchedPayments'),
      where('companyId', '==', companyId),
      where('transactionId', '==', transactionId)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) return null;

    const doc = snapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data(),
    } as MatchedPayment;
  },

  async deleteMatchedPayment(matchedPaymentId: string): Promise<void> {
    await deleteDoc(doc(db, 'matchedPayments', matchedPaymentId));
  },

  async deleteByTransactionId(companyId: string, transactionId: string): Promise<void> {
    const matchedPayment = await this.getMatchedPaymentByTransaction(companyId, transactionId);
    if (matchedPayment) {
      await this.deleteMatchedPayment(matchedPayment.id);
    }
  },

  async getAllMatchedPayments(companyId: string): Promise<MatchedPayment[]> {
    const q = query(
      collection(db, 'matchedPayments'),
      where('companyId', '==', companyId)
    );

    const snapshot = await getDocs(q);
    const payments: MatchedPayment[] = [];

    snapshot.forEach((doc) => {
      payments.push({
        id: doc.id,
        ...doc.data(),
      } as MatchedPayment);
    });

    return payments;
  },
};
