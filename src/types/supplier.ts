export interface Supplier {
  id?: string;
  companyId: string;
  supplierName: string;
  supplierEmail?: string;
  totalAmountExVat: number;
  totalVatAmount: number;
  totalAmountIncVat: number;
  invoiceCount: number;
  grootboekrekening?: string;
  grootboekrekeningName?: string;
  lastInvoiceDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Grootboekrekening {
  id?: string;
  companyId: string;
  code: string;
  name: string;
  category: string;
  createdAt: Date;
  updatedAt: Date;
}
