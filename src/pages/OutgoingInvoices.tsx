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
import { db } from '../lib/firebase';

export interface OutgoingInvoice {
  id?: string;
  userId: string;
  companyId: string;
  invoiceNumber: string;
  clientId?: string;
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
  amount: number;
  vatAmount: number;
  totalAmount: number;
  description: string;
  invoiceDate: Date;
  dueDate: Date;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  purchaseOrder?: string;
  projectCode?: string;
  paidAt?: Date;
  sentAt?: Date;
  items: {
    title: string;
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

export interface CompanyInfo {
  id: string;
  name: string;
  kvk: string;
  taxNumber: string;
  bankAccount?: string;
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
  async getNextInvoiceNumber(userId: string, companyId: string): Promise<string> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('userId', '==', userId),
        where('companyId', '==', companyId),
        orderBy('createdAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        const year = new Date().getFullYear();
        return `${year}-001`;
      }

      const lastInvoice = querySnapshot.docs[0].data();
      const lastNumber = lastInvoice.invoiceNumber;
      
      const match = lastNumber.match(/(\d+)$/);
      if (!match) {
        const year = new Date().getFullYear();
        return `${year}-001`;
      }
      
      const nextNum = (parseInt(match[1]) + 1).toString().padStart(3, '0');
      const year = new Date().getFullYear();
      
      return `${year}-${nextNum}`;
    } catch (error) {
      console.error('Error getting next invoice number:', error);
      const year = new Date().getFullYear();
      return `${year}-001`;
    }
  },

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

  async getInvoices(userId: string, companyId?: string): Promise<OutgoingInvoice[]> {
    try {
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

      return invoices;
    } catch (error) {
      console.error('Error getting invoices:', error);
      throw new Error('Kon facturen niet laden');
    }
  },

  async updateInvoice(invoiceId: string, updates: Partial<OutgoingInvoice>): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, invoiceId);
      const updateData: any = {
        ...updates,
        updatedAt: Timestamp.fromDate(new Date())
      };

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

  async deleteInvoice(invoiceId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, COLLECTION_NAME, invoiceId));
    } catch (error) {
      console.error('Error deleting invoice:', error);
      throw new Error('Kon factuur niet verwijderen');
    }
  },

  async generateInvoiceHTML(invoice: OutgoingInvoice, company: CompanyInfo): Promise<string> {
    try {
      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #1f2937; line-height: 1.5; background-color: #f9fafb; }
    .container { max-width: 900px; margin: 0 auto; padding: 20px 30px; background-color: white; }
    
    /* Header */
    .header { display: flex; justify-content: space-between; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #2563eb; align-items: flex-start; gap: 30px; }
    .company-info h1 { font-size: 18px; color: #2563eb; margin-bottom: 6px; font-weight: 700; letter-spacing: -0.5px; }
    .company-info p { font-size: 11px; color: #6b7280; margin-bottom: 2px; line-height: 1.3; }
    .company-details { font-size: 11px; color: #6b7280; text-align: right; }
    .company-details p { margin-bottom: 2px; line-height: 1.3; }
    .company-details strong { color: #374151; }
    
    /* Invoice Title Section */
    .invoice-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; gap: 30px; }
    .invoice-header h2 { font-size: 18px; color: #111827; font-weight: 700; }
    .invoice-meta { background-color: #f3f4f6; border-radius: 6px; padding: 10px 14px; font-size: 11px; }
    .invoice-meta p { margin-bottom: 4px; display: flex; justify-content: space-between; gap: 20px; }
    .invoice-meta strong { color: #374151; }
    .invoice-meta span { color: #111827; font-weight: 600; }
    
    /* Section */
    .section { margin-bottom: 20px; }
    .section h3 { font-size: 11px; font-weight: 700; margin-bottom: 8px; color: #374151; text-transform: uppercase; letter-spacing: 0.3px; display: none; }
    
    /* Customer Box */
    .customer-box { background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 12px; font-size: 11px; line-height: 1.4; }
    .customer-box p { margin-bottom: 2px; color: #374151; }
    .customer-box strong { color: #111827; }
    
    /* Table */
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; margin-top: 15px; }
    table thead { background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; }
    table th { padding: 10px 10px; text-align: left; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.3px; }
    table td { padding: 9px 10px; border-bottom: 1px solid #f3f4f6; font-size: 11px; color: #374151; }
    table tbody tr:hover { background-color: #f9fafb; }
    table tbody tr:last-child td { border-bottom: 2px solid #e5e7eb; }
    
    /* Item Description Formatting */
    .item-title { font-weight: 600; color: #111827; margin-bottom: 2px; }
    .item-description { color: #6b7280; font-size: 10px; white-space: pre-wrap; line-height: 1.3; margin-top: 3px; }
    .item-quantity { text-align: right; }
    .item-rate { text-align: right; }
    .item-amount { text-align: right; font-weight: 600; color: #111827; }
    
    /* Totals */
    .totals-section { margin-top: 20px; }
    .totals-box { display: flex; justify-content: flex-end; margin-bottom: 25px; }
    .totals-content { width: 280px; }
    .totals-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 11px; padding-bottom: 8px; border-bottom: 1px solid #e5e7eb; }
    .totals-row.total { border-top: 2px solid #2563eb; border-bottom: 2px solid #2563eb; padding: 8px 0; font-size: 13px; font-weight: 700; color: #2563eb; margin-bottom: 0; }
    .totals-label { color: #6b7280; }
    .totals-value { font-weight: 600; color: #111827; }
    .totals-row.total .totals-value { color: #2563eb; }
    
    /* Footer */
    .footer { margin-top: 25px; padding-top: 15px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #9ca3af; text-align: center; line-height: 1.4; }
    
  </style>
</head>
<body>
  <div class="container">
    <!-- Header with Company Info -->
    <div class="header">
      <div class="company-info">
        <h1>${company.name}</h1>
        <p>${company.address.street}</p>
        <p>${company.address.zipCode} ${company.address.city}</p>
      </div>
      <div class="company-details">
        <p><strong>KvK:</strong> <span>${company.kvk}</span></p>
        <p><strong>BTW:</strong> <span>${company.taxNumber}</span></p>
        <p><strong>E-mail:</strong> <span>${company.contactInfo.email}</span></p>
        <p><strong>Tel:</strong> <span>${company.contactInfo.phone}</span></p>
        ${company.bankAccount ? `<p><strong>Bankrekening:</strong> <span>${company.bankAccount}</span></p>` : ''}
      </div>
    </div>

    <!-- Invoice Title & Meta -->
    <div class="invoice-header">
      <h2>FACTUUR</h2>
      <div class="invoice-meta">
        <p><strong>Nr:</strong> <span>${invoice.invoiceNumber}</span></p>
        <p><strong>Datum:</strong> <span>${new Date(invoice.invoiceDate).toLocaleDateString('nl-NL')}</span></p>
        <p><strong>Vervaldatum:</strong> <span>${new Date(invoice.dueDate).toLocaleDateString('nl-NL')}</span></p>
      </div>
    </div>

    <!-- Customer Section -->
    <div class="section">
      <h3>Factureren naar:</h3>
      <div class="customer-box">
        <p><strong>${invoice.clientName}</strong></p>
        <p>${invoice.clientAddress.street}</p>
        <p>${invoice.clientAddress.zipCode} ${invoice.clientAddress.city}</p>
        ${invoice.clientEmail ? `<p>E-mail: ${invoice.clientEmail}</p>` : ''}
        ${invoice.clientPhone ? `<p>Tel: ${invoice.clientPhone}</p>` : ''}
      </div>
    </div>

    <!-- Invoice Items Table -->
    <div class="section">
      <table>
        <thead>
          <tr>
            <th style="flex: 1;">Omschrijving</th>
            <th style="width: 90px;">Aantal</th>
            <th style="width: 110px;">Tarief</th>
            <th style="width: 110px;">Bedrag</th>
          </tr>
        </thead>
        <tbody>
          ${invoice.items.map(item => `
            <tr>
              <td>
                <div class="item-title">${item.title || item.description}</div>
                ${item.description && item.title ? `<div class="item-description">${item.description}</div>` : ''}
              </td>
              <td class="item-quantity">${item.quantity}</td>
              <td class="item-rate">€${item.rate.toFixed(2)}</td>
              <td class="item-amount">€${item.amount.toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <!-- Totals -->
    <div class="totals-section">
      <div class="totals-box">
        <div class="totals-content">
          <div class="totals-row">
            <span class="totals-label">Subtotaal:</span>
            <span class="totals-value">€${invoice.amount.toFixed(2)}</span>
          </div>
          <div class="totals-row">
            <span class="totals-label">BTW (21%):</span>
            <span class="totals-value">€${invoice.vatAmount.toFixed(2)}</span>
          </div>
          <div class="totals-row total">
            <span class="totals-label">TOTAAL:</span>
            <span class="totals-value">€${invoice.totalAmount.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p>Factuur gegenereerd op ${new Date().toLocaleDateString('nl-NL')}</p>
    </div>
  </div>
</body>
</html>`;
      return html;
    } catch (error) {
      console.error('Error generating HTML:', error);
      throw new Error('Kon HTML niet genereren');
    }
  }
};