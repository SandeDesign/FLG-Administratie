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
    body { font-family: Arial, sans-serif; color: #333; line-height: 1.4; }
    .container { max-width: 900px; margin: 0 auto; padding: 40px; }
    .header { display: flex; justify-content: space-between; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 3px solid #007bff; }
    .company-info h1 { font-size: 32px; color: #007bff; margin-bottom: 10px; }
    .company-info p { font-size: 12px; color: #666; margin-bottom: 3px; }
    .company-details { font-size: 12px; color: #666; }
    .company-details p { margin-bottom: 3px; }
    .invoice-title { display: flex; justify-content: space-between; margin-bottom: 30px; align-items: flex-start; }
    .invoice-title h2 { font-size: 24px; color: #000; }
    .invoice-meta { text-align: right; font-size: 12px; }
    .invoice-meta p { margin-bottom: 5px; }
    .invoice-meta strong { display: inline-block; width: 100px; }
    .section { margin-bottom: 30px; }
    .section h3 { font-size: 14px; font-weight: bold; margin-bottom: 10px; color: #000; }
    .customer-box { border: 1px solid #ddd; padding: 15px; background-color: #f9f9f9; font-size: 12px; }
    .customer-box p { margin-bottom: 5px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    table thead { background-color: #007bff; color: white; }
    table th { padding: 12px; text-align: left; font-weight: bold; font-size: 12px; }
    table td { padding: 10px 12px; border-bottom: 1px solid #eee; font-size: 12px; }
    table tbody tr:nth-child(odd) { background-color: #f9f9f9; }
    .amount-right { text-align: right; }
    .totals { margin-top: 30px; border-top: 1px solid #ddd; padding-top: 15px; display: flex; justify-content: flex-end; }
    .totals-box { width: 300px; }
    .totals-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; }
    .totals-row.total { border-top: 2px solid #007bff; padding-top: 8px; font-size: 16px; font-weight: bold; color: #007bff; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 10px; color: #999; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="company-info">
        <h1>${company.name}</h1>
        <p>${company.address.street}</p>
        <p>${company.address.zipCode} ${company.address.city}</p>
        <p>${company.address.country}</p>
      </div>
      <div class="company-details">
        <p><strong>KvK:</strong> ${company.kvk}</p>
        <p><strong>BTW:</strong> ${company.taxNumber}</p>
        <p><strong>Email:</strong> ${company.contactInfo.email}</p>
        <p><strong>Tel:</strong> ${company.contactInfo.phone}</p>
      </div>
    </div>

    <div class="invoice-title">
      <h2>FACTUUR</h2>
      <div class="invoice-meta">
        <p><strong>Factuurnummer:</strong> ${invoice.invoiceNumber}</p>
        <p><strong>Factuurdatum:</strong> ${new Date(invoice.invoiceDate).toLocaleDateString('nl-NL')}</p>
        <p><strong>Vervaldatum:</strong> ${new Date(invoice.dueDate).toLocaleDateString('nl-NL')}</p>
      </div>
    </div>

    <div class="section">
      <h3>FACTUREREN NAAR:</h3>
      <div class="customer-box">
        <p><strong>${invoice.clientName}</strong></p>
        <p>${invoice.clientAddress.street}</p>
        <p>${invoice.clientAddress.zipCode} ${invoice.clientAddress.city}</p>
        <p>${invoice.clientAddress.country}</p>
        <p>Email: ${invoice.clientEmail}</p>
        ${invoice.clientPhone ? `<p>Tel: ${invoice.clientPhone}</p>` : ''}
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Omschrijving</th>
          <th style="width: 80px;" class="amount-right">Aantal</th>
          <th style="width: 100px;" class="amount-right">Tarief</th>
          <th style="width: 100px;" class="amount-right">Bedrag</th>
        </tr>
      </thead>
      <tbody>
        ${invoice.items.map(item => `
          <tr>
            <td>${item.description}</td>
            <td class="amount-right">${item.quantity}</td>
            <td class="amount-right">€${item.rate.toFixed(2)}</td>
            <td class="amount-right">€${item.amount.toFixed(2)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="totals">
      <div class="totals-box">
        <div class="totals-row">
          <label>Subtotaal:</label>
          <span>€${invoice.amount.toFixed(2)}</span>
        </div>
        <div class="totals-row">
          <label>BTW (21%):</label>
          <span>€${invoice.vatAmount.toFixed(2)}</span>
        </div>
        <div class="totals-row total">
          <label>TOTAAL:</label>
          <span>€${invoice.totalAmount.toFixed(2)}</span>
        </div>
      </div>
    </div>

    <div class="footer">
      <p>Factuur gegenereerd op: ${new Date().toLocaleDateString('nl-NL')} om ${new Date().toLocaleTimeString('nl-NL')}</p>
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