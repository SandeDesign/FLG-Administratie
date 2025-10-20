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
import { db, storage } from '../config/firebase';

export interface OutgoingInvoice {
  id?: string;
  userId: string;
  companyId: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  clientAddress: {
    street: string;
    city: string;
    zipCode: string;
    country: string;
  };
  amount: number;
  vatAmount: number;
  totalAmount: number;
  description: string;
  invoiceDate: Date;
  dueDate: Date;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  paidAt?: Date;
  sentAt?: Date;
  items: {
    description: string;
    quantity: number;
    rate: number;
    amount: number;
  }[];
  notes?: string;
  pdfUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const COLLECTION_NAME = 'outgoingInvoices';

export const outgoingInvoiceService = {
  // Create new invoice
  async createInvoice(invoice: Omit<OutgoingInvoice, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const now = new Date();
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...invoice,
        invoiceDate: Timestamp.fromDate(invoice.invoiceDate),
        dueDate: Timestamp.fromDate(invoice.dueDate),
        paidAt: invoice.paidAt ? Timestamp.fromDate(invoice.paidAt) : null,
        sentAt: invoice.sentAt ? Timestamp.fromDate(invoice.sentAt) : null,
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now)
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating invoice:', error);
      throw new Error('Kon factuur niet aanmaken');
    }
  },

  // Get invoices for company
  async getInvoices(userId: string, companyId?: string): Promise<OutgoingInvoice[]> {
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
          paidAt: data.paidAt?.toDate(),
          sentAt: data.sentAt?.toDate(),
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate()
        } as OutgoingInvoice;
      });
    } catch (error) {
      console.error('Error getting invoices:', error);
      throw new Error('Kon facturen niet laden');
    }
  },

  // Update invoice
  async updateInvoice(invoiceId: string, updates: Partial<OutgoingInvoice>): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, invoiceId);
      const updateData: any = {
        ...updates,
        updatedAt: Timestamp.fromDate(new Date())
      };

      // Convert dates to Timestamps
      if (updates.invoiceDate) updateData.invoiceDate = Timestamp.fromDate(updates.invoiceDate);
      if (updates.dueDate) updateData.dueDate = Timestamp.fromDate(updates.dueDate);
      if (updates.paidAt) updateData.paidAt = Timestamp.fromDate(updates.paidAt);
      if (updates.sentAt) updateData.sentAt = Timestamp.fromDate(updates.sentAt);

      await updateDoc(docRef, updateData);
    } catch (error) {
      console.error('Error updating invoice:', error);
      throw new Error('Kon factuur niet bijwerken');
    }
  },

  // Send invoice
  async sendInvoice(invoiceId: string): Promise<void> {
    try {
      await this.updateInvoice(invoiceId, {
        status: 'sent',
        sentAt: new Date()
      });
    } catch (error) {
      console.error('Error sending invoice:', error);
      throw new Error('Kon factuur niet versturen');
    }
  },

  // Mark as paid
  async markAsPaid(invoiceId: string): Promise<void> {
    try {
      await this.updateInvoice(invoiceId, {
        status: 'paid',
        paidAt: new Date()
      });
    } catch (error) {
      console.error('Error marking as paid:', error);
      throw new Error('Kon factuur niet als betaald markeren');
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

  // Generate PDF and upload
  async generateAndUploadPDF(invoice: OutgoingInvoice): Promise<string> {
    try {
      // Generate PDF blob (you'll need to implement PDF generation)
      const pdfBlob = await this.generateInvoicePDF(invoice);
      
      // Upload to Firebase Storage
      const fileName = `invoices/${invoice.companyId}/${invoice.invoiceNumber}.pdf`;
      const storageRef = ref(storage, fileName);
      
      await uploadBytes(storageRef, pdfBlob);
      const downloadURL = await getDownloadURL(storageRef);
      
      // Update invoice with PDF URL
      if (invoice.id) {
        await this.updateInvoice(invoice.id, { pdfUrl: downloadURL });
      }
      
      return downloadURL;
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw new Error('Kon PDF niet genereren');
    }
  },

  // Generate PDF (implement with jsPDF or similar)
  async generateInvoicePDF(invoice: OutgoingInvoice): Promise<Blob> {
    // This is a placeholder - implement with jsPDF
    const htmlContent = `
      <html>
        <body>
          <h1>Factuur ${invoice.invoiceNumber}</h1>
          <p>Klant: ${invoice.clientName}</p>
          <p>Totaal: €${invoice.totalAmount.toFixed(2)}</p>
        </body>
      </html>
    `;
    
    return new Blob([htmlContent], { type: 'application/pdf' });
  }
};