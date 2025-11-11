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
import jsPDF from 'jspdf';

export interface OutgoingInvoice {
  id?: string;
  userId: string;
  companyId: string;
  invoiceNumber: string;
  
  // Client info - UITGEBREID
  clientId?: string; // Referentie naar relatie
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  clientKvk?: string;
  clientTaxNumber?: string;
  clientAddress: {
    street: string;
    city: string;
    zipCode: string;
    country: string;
  };
  
  // Bedrag gegevens
  amount: number;
  vatAmount: number;
  totalAmount: number;
  
  // Factuur details
  description: string;
  invoiceDate: Date;
  dueDate: Date;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  
  // Extra velden - NIEUW
  purchaseOrder?: string;
  projectCode?: string;
  
  // Payment tracking
  paidAt?: Date;
  sentAt?: Date;
  
  // Lineaire items
  items: {
    description: string;
    quantity: number;
    rate: number;
    amount: number;
  }[];
  
  // Admin
  notes?: string;
  pdfUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CompanyInfo {
  id: string;
  name: string;
  kvk: string;
  taxNumber: string;
  contactInfo: {
    email: string;
    phone: string;
  };
  address: {
    street: string;
    city: string;
    zipCode: string;
    country: string;
  };
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
      console.log('✅ Invoice created:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('Error creating invoice:', error);
      throw new Error('Kon factuur niet aanmaken');
    }
  },

  // Get invoices for company
  async getInvoices(userId: string, companyId?: string): Promise<OutgoingInvoice[]> {
    try {
      console.log('🔍 Loading invoices - userId:', userId, 'companyId:', companyId);

      let q;
      if (companyId) {
        q = query(
          collection(db, COLLECTION_NAME),
          where('userId', '==', userId),
          where('companyId', '==', companyId),
          orderBy('createdAt', 'desc')
        );
      } else {
        q = query(
          collection(db, COLLECTION_NAME),
          where('userId', '==', userId),
          orderBy('createdAt', 'desc')
        );
      }

      const querySnapshot = await getDocs(q);
      const invoices = querySnapshot.docs.map(doc => {
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

      console.log('✅ Invoices loaded:', invoices.length);
      return invoices;
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

  // 🔥 Generate professional PDF as Blob
  async generateInvoicePDF(invoice: OutgoingInvoice, company: CompanyInfo): Promise<Blob> {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let yPosition = 15;

      // Set default font
      doc.setFont('helvetica');

      // ===== HEADER =====
      doc.setFontSize(24);
      doc.setTextColor(0, 123, 255);
      doc.text(company.name, 20, yPosition);
      yPosition += 10;

      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`${company.address.street}`, 20, yPosition);
      yPosition += 5;
      doc.text(`${company.address.zipCode} ${company.address.city}, ${company.address.country}`, 20, yPosition);
      yPosition += 5;
      doc.text(`KvK: ${company.kvk} | BTW: ${company.taxNumber}`, 20, yPosition);
      yPosition += 5;
      doc.text(`📧 ${company.contactInfo.email} | ☎ ${company.contactInfo.phone}`, 20, yPosition);
      yPosition += 12;

      // Divider line
      doc.setDrawColor(0, 123, 255);
      doc.line(20, yPosition, pageWidth - 20, yPosition);
      yPosition += 8;

      // ===== INVOICE TITLE & NUMBERS =====
      doc.setFontSize(18);
      doc.setTextColor(0, 0, 0);
      doc.text('FACTUUR', 20, yPosition);
      yPosition += 10;

      doc.setFontSize(10);
      doc.setTextColor(50, 50, 50);
      
      // Left column
      doc.text('Factuurnummer:', 20, yPosition);
      doc.setFont('helvetica', 'bold');
      doc.text(invoice.invoiceNumber, 60, yPosition);
      doc.setFont('helvetica', 'normal');
      yPosition += 6;

      doc.text('Factuurdatum:', 20, yPosition);
      doc.setFont('helvetica', 'bold');
      doc.text(new Date(invoice.invoiceDate).toLocaleDateString('nl-NL'), 60, yPosition);
      doc.setFont('helvetica', 'normal');
      yPosition += 6;

      doc.text('Vervaldatum:', 20, yPosition);
      doc.setFont('helvetica', 'bold');
      doc.text(new Date(invoice.dueDate).toLocaleDateString('nl-NL'), 60, yPosition);
      doc.setFont('helvetica', 'normal');
      yPosition += 10;

      // ===== CUSTOMER INFO =====
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('FACTUREREN NAAR:', 20, yPosition);
      yPosition += 8;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(50, 50, 50);
      doc.text(invoice.clientName, 20, yPosition);
      yPosition += 5;
      doc.text(`${invoice.clientAddress.street}`, 20, yPosition);
      yPosition += 5;
      doc.text(`${invoice.clientAddress.zipCode} ${invoice.clientAddress.city}`, 20, yPosition);
      yPosition += 5;
      doc.text(`${invoice.clientAddress.country}`, 20, yPosition);
      yPosition += 5;
      doc.text(`Email: ${invoice.clientEmail}`, 20, yPosition);
      if (invoice.clientPhone) {
        yPosition += 5;
        doc.text(`Tel: ${invoice.clientPhone}`, 20, yPosition);
      }
      yPosition += 10;

      // ===== ITEMS TABLE =====
      const tableStartY = yPosition;
      const colWidths = [100, 20, 22, 22];
      const tableHeaders = ['Omschrijving', 'Aantal', 'Tarief', 'Bedrag'];

      // Header background
      doc.setFillColor(0, 123, 255);
      doc.rect(20, tableStartY, pageWidth - 40, 8, 'F');

      // Header text
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      let xPos = 25;
      for (let i = 0; i < tableHeaders.length; i++) {
        doc.text(tableHeaders[i], xPos, tableStartY + 6);
        xPos += colWidths[i];
      }

      yPosition = tableStartY + 10;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(50, 50, 50);

      // Items
      invoice.items.forEach((item) => {
        // Check if we need a new page
        if (yPosition > pageHeight - 40) {
          doc.addPage();
          yPosition = 20;
        }

        xPos = 25;
        doc.text(item.description.substring(0, 40), xPos, yPosition);
        xPos += colWidths[0];
        doc.text(item.quantity.toString(), xPos, yPosition, { align: 'center' });
        xPos += colWidths[1];
        doc.text(`€${item.rate.toFixed(2)}`, xPos, yPosition, { align: 'right' });
        xPos += colWidths[2];
        doc.text(`€${item.amount.toFixed(2)}`, xPos, yPosition, { align: 'right' });

        yPosition += 6;
      });

      yPosition += 5;

      // Divider
      doc.setDrawColor(200, 200, 200);
      doc.line(20, yPosition, pageWidth - 20, yPosition);
      yPosition += 8;

      // ===== TOTALS =====
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);

      // Subtotal
      doc.text('Subtotaal:', pageWidth - 50, yPosition);
      doc.text(`€${invoice.amount.toFixed(2)}`, pageWidth - 20, yPosition, { align: 'right' });
      yPosition += 6;

      // VAT
      doc.text('BTW (21%):', pageWidth - 50, yPosition);
      doc.text(`€${invoice.vatAmount.toFixed(2)}`, pageWidth - 20, yPosition, { align: 'right' });
      yPosition += 8;

      // Total
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(0, 123, 255);
      doc.text('TOTAAL:', pageWidth - 50, yPosition);
      doc.text(`€${invoice.totalAmount.toFixed(2)}`, pageWidth - 20, yPosition, { align: 'right' });

      yPosition += 15;
      doc.setTextColor(50, 50, 50);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Factuur gegenereerd op: ${new Date().toLocaleDateString('nl-NL')} om ${new Date().toLocaleTimeString('nl-NL')}`, 20, yPosition);

      // Return as Blob
      return doc.output('blob');
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw new Error('Kon PDF niet genereren');
    }
  },

  // 🔥 Generate PDF as base64 (for webhook transmission)
  async generateInvoicePDFBase64(invoice: OutgoingInvoice, company: CompanyInfo): Promise<string> {
    try {
      const blob = await this.generateInvoicePDF(invoice, company);
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error generating base64 PDF:', error);
      throw new Error('Kon PDF niet genereren');
    }
  },

  // Generate PDF and upload to Firebase Storage
  async generateAndUploadPDF(invoice: OutgoingInvoice, company: CompanyInfo): Promise<string> {
    try {
      console.log('📄 Generating PDF for invoice:', invoice.invoiceNumber);
      
      // Generate PDF blob
      const pdfBlob = await this.generateInvoicePDF(invoice, company);
      
      // Upload to Firebase Storage
      const fileName = `invoices/${invoice.companyId}/${invoice.invoiceNumber}.pdf`;
      const storageRef = ref(storage, fileName);
      
      await uploadBytes(storageRef, pdfBlob);
      const downloadURL = await getDownloadURL(storageRef);
      
      // Update invoice with PDF URL
      if (invoice.id) {
        await this.updateInvoice(invoice.id, { pdfUrl: downloadURL });
      }
      
      console.log('✅ PDF uploaded:', downloadURL);
      return downloadURL;
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw new Error('Kon PDF niet genereren');
    }
  }
};