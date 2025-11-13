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
  Timestamp 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';

export interface OCRData {
  supplierName?: string;
  invoiceNumber?: string;
  amount?: number;
  date?: Date;
  confidence: number;
}

export interface IncomingInvoice {
  id?: string;
  userId: string;
  companyId: string;
  supplierName: string;
  supplierEmail?: string;
  invoiceNumber: string;
  amount: number;
  vatAmount: number;
  totalAmount: number;
  description: string;
  invoiceDate: Date;
  dueDate: Date;
  status: 'pending' | 'approved' | 'paid' | 'rejected';
  approvedAt?: Date;
  approvedBy?: string;
  paidAt?: Date;
  rejectedAt?: Date;
  rejectionReason?: string;
  fileName: string;
  fileUrl: string;
  driveFileId?: string;
  driveFileLink?: string;
  ocrProcessed: boolean;
  ocrData?: OCRData;
  archivedToDrive?: boolean;
  archivedAt?: Date;
  driveArchiveId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const COLLECTION_NAME = 'incomingInvoices';
const ARCHIVE_COLLECTION_NAME = 'invoiceArchives';

export const incomingInvoiceService = {
  // Get invoices for company
  async getInvoices(userId: string, companyId?: string): Promise<IncomingInvoice[]> {
    try {
      let q = query(
        collection(db, COLLECTION_NAME),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );

      if (companyId) {
        q = query(
          collection(db, COLLECTION_NAME),
          where('userId', '==', userId),
          where('companyId', '==', companyId),
          orderBy('createdAt', 'desc')
        );
      }

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        // Map subtotal van Firestore naar amount in component
        const subtotal = data.subtotal || data.amount || 0;
        return {
          id: doc.id,
          ...data,
          amount: subtotal,
          vatAmount: data.vatAmount || 0,
          totalAmount: data.totalAmount || 0,
          invoiceDate: data.invoiceDate.toDate(),
          dueDate: data.dueDate.toDate(),
          approvedAt: data.approvedAt?.toDate(),
          paidAt: data.paidAt?.toDate(),
          rejectedAt: data.rejectedAt?.toDate(),
          archivedAt: data.archivedAt?.toDate(),
          ocrData: data.ocrData ? {
            ...data.ocrData,
            date: data.ocrData.date?.toDate()
          } : undefined,
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate()
        } as IncomingInvoice;
      });
    } catch (error) {
      console.error('Error getting invoices:', error);
      throw new Error('Kon facturen niet laden');
    }
  },

  // Approve invoice
  async approveInvoice(invoiceId: string, approvedBy: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, invoiceId);
      await updateDoc(docRef, {
        status: 'approved',
        approvedAt: Timestamp.fromDate(new Date()),
        approvedBy,
        updatedAt: Timestamp.fromDate(new Date())
      });
    } catch (error) {
      console.error('Error approving invoice:', error);
      throw new Error('Kon factuur niet goedkeuren');
    }
  },

  // Reject invoice
  async rejectInvoice(invoiceId: string, reason: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, invoiceId);
      await updateDoc(docRef, {
        status: 'rejected',
        rejectedAt: Timestamp.fromDate(new Date()),
        rejectionReason: reason,
        updatedAt: Timestamp.fromDate(new Date())
      });
    } catch (error) {
      console.error('Error rejecting invoice:', error);
      throw new Error('Kon factuur niet afwijzen');
    }
  },

  // Mark as paid
  async markAsPaid(invoiceId: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, invoiceId);
      await updateDoc(docRef, {
        status: 'paid',
        paidAt: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date())
      });
    } catch (error) {
      console.error('Error marking as paid:', error);
      throw new Error('Kon factuur niet als betaald markeren');
    }
  },

  // Update invoice
  async updateInvoice(invoiceId: string, updates: Partial<IncomingInvoice>): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, invoiceId);
      const updateData: any = {
        updatedAt: Timestamp.fromDate(new Date())
      };

      if (updates.supplierName !== undefined) updateData.supplierName = updates.supplierName;
      if (updates.invoiceNumber !== undefined) updateData.invoiceNumber = updates.invoiceNumber;
      if (updates.amount !== undefined) updateData.amount = updates.amount;
      if (updates.vatAmount !== undefined) updateData.vatAmount = updates.vatAmount;
      if (updates.totalAmount !== undefined) updateData.totalAmount = updates.totalAmount;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.status !== undefined) updateData.status = updates.status;

      if (updates.invoiceDate instanceof Date) updateData.invoiceDate = Timestamp.fromDate(updates.invoiceDate);
      if (updates.dueDate instanceof Date) updateData.dueDate = Timestamp.fromDate(updates.dueDate);
      if (updates.approvedAt instanceof Date) updateData.approvedAt = Timestamp.fromDate(updates.approvedAt);
      if (updates.paidAt instanceof Date) updateData.paidAt = Timestamp.fromDate(updates.paidAt);
      if (updates.rejectedAt instanceof Date) updateData.rejectedAt = Timestamp.fromDate(updates.rejectedAt);
      if (updates.archivedAt instanceof Date) updateData.archivedAt = Timestamp.fromDate(updates.archivedAt);
      if (updates.approvedBy !== undefined) updateData.approvedBy = updates.approvedBy;
      if (updates.rejectionReason !== undefined) updateData.rejectionReason = updates.rejectionReason;

      await updateDoc(docRef, updateData);
    } catch (error) {
      console.error('Error updating invoice:', error);
      throw new Error('Kon factuur niet bijwerken');
    }
  },

  // Delete invoice
  async deleteInvoice(invoiceId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, COLLECTION_NAME, invoiceId));
    } catch (error) {
      console.error('Error deleting invoice:', error);
      throw new Error('Kon factuur niet verwijderen');
    }
  },

  // Get invoice statistics
  async getInvoiceStatistics(
    userId: string,
    companyId?: string
  ): Promise<{
    totalCount: number;
    pendingCount: number;
    approvedCount: number;
    paidCount: number;
    rejectedCount: number;
    totalAmount: number;
    averageAmount: number;
  }> {
    try {
      const invoices = await this.getInvoices(userId, companyId);
      
      return {
        totalCount: invoices.length,
        pendingCount: invoices.filter(inv => inv.status === 'pending').length,
        approvedCount: invoices.filter(inv => inv.status === 'approved').length,
        paidCount: invoices.filter(inv => inv.status === 'paid').length,
        rejectedCount: invoices.filter(inv => inv.status === 'rejected').length,
        totalAmount: invoices.reduce((sum, inv) => sum + inv.totalAmount, 0),
        averageAmount: invoices.length > 0 
          ? invoices.reduce((sum, inv) => sum + inv.totalAmount, 0) / invoices.length 
          : 0
      };
    } catch (error) {
      console.error('Error getting statistics:', error);
      throw new Error('Kon statistieken niet laden');
    }
  }
};