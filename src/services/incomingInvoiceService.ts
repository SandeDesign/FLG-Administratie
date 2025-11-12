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
  // Upload and create invoice
  async uploadInvoice(
    file: File, 
    userId: string, 
    companyId: string,
    metadata?: Partial<IncomingInvoice>
  ): Promise<string> {
    try {
      // Upload file to storage
      const fileName = `incoming-invoices/${companyId}/${Date.now()}-${file.name}`;
      const storageRef = ref(storage, fileName);
      
      await uploadBytes(storageRef, file);
      const fileUrl = await getDownloadURL(storageRef);
      
      // Process OCR if it's a PDF or image
      const ocrData = await this.processOCR(file);
      
      // Create invoice record
      const now = new Date();
      const invoiceData = {
        userId,
        companyId,
        supplierName: metadata?.supplierName || ocrData?.supplierName || 'Onbekend',
        supplierEmail: metadata?.supplierEmail || '',
        invoiceNumber: metadata?.invoiceNumber || ocrData?.invoiceNumber || `INV-${Date.now()}`,
        amount: metadata?.amount || ocrData?.amount || 0,
        vatAmount: metadata?.vatAmount || (metadata?.amount || ocrData?.amount || 0) * 0.21,
        totalAmount: metadata?.totalAmount || (metadata?.amount || ocrData?.amount || 0) * 1.21,
        description: metadata?.description || `Factuur van ${metadata?.supplierName || ocrData?.supplierName || 'leverancier'}`,
        invoiceDate: metadata?.invoiceDate || ocrData?.date || now,
        dueDate: metadata?.dueDate || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days
        status: 'pending' as const,
        fileName: file.name,
        fileUrl,
        ocrProcessed: !!ocrData,
        ocrData,
        archivedToDrive: false,
        createdAt: now,
        updatedAt: now
      };
      
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...invoiceData,
        invoiceDate: Timestamp.fromDate(invoiceData.invoiceDate),
        dueDate: Timestamp.fromDate(invoiceData.dueDate),
        createdAt: Timestamp.fromDate(invoiceData.createdAt),
        updatedAt: Timestamp.fromDate(invoiceData.updatedAt)
      });
      
      return docRef.id;
    } catch (error) {
      console.error('Error uploading invoice:', error);
      throw new Error('Kon factuur niet uploaden');
    }
  },

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
        return {
          id: doc.id,
          ...data,
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

  // Archive invoice to Google Drive
  async archiveToGoogleDrive(
    invoiceId: string,
    userId: string,
    companyId: string,
    invoice: IncomingInvoice
  ): Promise<string> {
    try {
      // Create archive record in Firestore
      const now = new Date();
      const archiveData = {
        userId,
        companyId,
        invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        supplierName: invoice.supplierName,
        totalAmount: invoice.totalAmount,
        amount: invoice.amount,
        vatAmount: invoice.vatAmount,
        currency: 'EUR',
        invoiceDate: Timestamp.fromDate(invoice.invoiceDate),
        dueDate: Timestamp.fromDate(invoice.dueDate),
        description: invoice.description,
        fileName: invoice.fileName,
        fileUrl: invoice.fileUrl,
        ocrProcessed: invoice.ocrProcessed,
        ocrData: invoice.ocrData ? {
          ...invoice.ocrData,
          date: invoice.ocrData.date ? Timestamp.fromDate(invoice.ocrData.date) : null
        } : null,
        status: 'archived',
        folderPath: `${companyId}/facturen/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}`,
        tags: ['archived', invoice.supplierName],
        notes: `Gearchiveerd op ${now.toLocaleDateString('nl-NL')}`,
        createdAt: Timestamp.fromDate(now),
        archivedAt: Timestamp.fromDate(now)
      };

      // Add to archive collection
      const archiveRef = await addDoc(
        collection(db, ARCHIVE_COLLECTION_NAME),
        archiveData
      );

      // Update original invoice to mark as archived
      const invoiceRef = doc(db, COLLECTION_NAME, invoiceId);
      await updateDoc(invoiceRef, {
        archivedToDrive: true,
        archivedAt: Timestamp.fromDate(now),
        driveArchiveId: archiveRef.id,
        updatedAt: Timestamp.fromDate(now)
      });

      // Sync to Google Drive if configured
      try {
        await this.syncArchiveToGoogleDrive(archiveRef.id, invoice, companyId, userId);
      } catch (driveError) {
        console.warn('Google Drive sync failed, archive saved locally:', driveError);
      }

      return archiveRef.id;
    } catch (error) {
      console.error('Error archiving to Google Drive:', error);
      throw new Error('Kon factuur niet archiveren');
    }
  },

  // Sync archive to Google Drive (placeholder for actual Google Drive API integration)
  async syncArchiveToGoogleDrive(
    archiveId: string,
    invoice: IncomingInvoice,
    companyId: string,
    userId: string
  ): Promise<void> {
    try {
      // TODO: Implement actual Google Drive API calls here
      // This would upload the file and create a folder structure in Google Drive
      // For now, this is a placeholder that logs the intent
      console.log(`Syncing archive ${archiveId} to Google Drive for company ${companyId}`);
      
      // When implemented, this should:
      // 1. Create a folder structure: /Bedrijf/Jaar/Maand/
      // 2. Upload the invoice file
      // 3. Store the driveFileId and driveFileLink
      // 4. Create a metadata file with OCR extracted data
    } catch (error) {
      console.error('Error syncing to Google Drive:', error);
      throw error;
    }
  },

  // Get archived invoices
  async getArchivedInvoices(
    userId: string,
    companyId?: string
  ): Promise<any[]> {
    try {
      let q = query(
        collection(db, ARCHIVE_COLLECTION_NAME),
        where('userId', '==', userId),
        orderBy('archivedAt', 'desc')
      );

      if (companyId) {
        q = query(
          collection(db, ARCHIVE_COLLECTION_NAME),
          where('userId', '==', userId),
          where('companyId', '==', companyId),
          orderBy('archivedAt', 'desc')
        );
      }

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          invoiceDate: data.invoiceDate?.toDate(),
          dueDate: data.dueDate?.toDate(),
          archivedAt: data.archivedAt?.toDate(),
          createdAt: data.createdAt?.toDate(),
          ocrData: data.ocrData ? {
            ...data.ocrData,
            date: data.ocrData.date?.toDate()
          } : undefined
        };
      });
    } catch (error) {
      console.error('Error getting archived invoices:', error);
      throw new Error('Kon gearchiveerde facturen niet laden');
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

  // Process OCR (placeholder for Tesseract.js or Google Vision API)
  async processOCR(file: File): Promise<OCRData | null> {
    try {
      // This is a placeholder - implement with Tesseract.js or Google Vision API
      const text = await this.extractTextFromFile(file);
      
      // Simple regex patterns for Dutch invoices
      const supplierMatch = text.match(/(?:Van|From):\s*(.+)/i);
      const invoiceNumberMatch = text.match(/(?:Factuur|Invoice)\s*(?:nummer|number)?:?\s*([A-Z0-9-]+)/i);
      const amountMatch = text.match(/(?:Totaal|Total|Bedrag).*?€?\s*([0-9.,]+)/i);
      const dateMatch = text.match(/(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/);
      
      return {
        supplierName: supplierMatch?.[1]?.trim(),
        invoiceNumber: invoiceNumberMatch?.[1]?.trim(),
        amount: amountMatch ? parseFloat(amountMatch[1].replace(',', '.')) : undefined,
        date: dateMatch ? new Date(dateMatch[1]) : undefined,
        confidence: 0.8 // Mock confidence score
      };
    } catch (error) {
      console.error('Error processing OCR:', error);
      return null;
    }
  },

  // Extract text from file (implement with Tesseract.js)
  async extractTextFromFile(file: File): Promise<string> {
    // This is a placeholder - implement with Tesseract.js or similar
    return "Factuur nummer: INV-2024-001\nVan: Test Leverancier B.V.\nTotaal: €299.99";
  },

  // Update invoice
  async updateInvoice(invoiceId: string, updates: Partial<IncomingInvoice>): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, invoiceId);
      const updateData: any = {
        ...updates,
        updatedAt: Timestamp.fromDate(new Date())
      };

      // Convert dates to Timestamps
      if (updates.invoiceDate) updateData.invoiceDate = Timestamp.fromDate(updates.invoiceDate);
      if (updates.dueDate) updateData.dueDate = Timestamp.fromDate(updates.dueDate);
      if (updates.approvedAt) updateData.approvedAt = Timestamp.fromDate(updates.approvedAt);
      if (updates.paidAt) updateData.paidAt = Timestamp.fromDate(updates.paidAt);
      if (updates.rejectedAt) updateData.rejectedAt = Timestamp.fromDate(updates.rejectedAt);
      if (updates.archivedAt) updateData.archivedAt = Timestamp.fromDate(updates.archivedAt);

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