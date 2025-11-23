import { createWorker } from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href;

export interface OCRResult {
  text: string;
  confidence: number;
  pages: { pageNumber: number; text: string; confidence: number }[];
}

export interface InvoiceData {
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: Date;
  amount: number;
  subtotal: number;
  vatAmount: number;
  vatRate: number;
  totalInclVat: number;
  rawText: string;
}

let worker: any = null;

async function getWorker() {
  if (!worker) {
    worker = await createWorker('nld+eng');
  }
  return worker;
}

// Extract invoice data from OCR text using basic regex patterns
function extractInvoiceData(text: string): InvoiceData {
  const lines = text.split('\n').filter(l => l.trim());

  // Find supplier (first substantial non-numeric line)
  let supplierName = 'Onbekend';
  for (const line of lines.slice(0, 15)) {
    const cleaned = line.trim();
    if (cleaned.length > 3 && !/^\d/.test(cleaned) && !/^[€$]/.test(cleaned)) {
      supplierName = cleaned;
      break;
    }
  }

  // Find invoice number
  let invoiceNumber = `INV-${Date.now()}`;
  const invMatch = text.match(/(?:factuurnummer|invoice|inv\.?|factuur)[\s:]*([A-Z0-9-]+)/i);
  if (invMatch) {
    invoiceNumber = invMatch[1];
  }

  // Find date (DD-MM-YYYY or DD/MM/YYYY)
  let invoiceDate = new Date();
  const dateMatch = text.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
  if (dateMatch) {
    const day = parseInt(dateMatch[1]);
    const month = parseInt(dateMatch[2]) - 1;
    const year = parseInt(dateMatch[3]);
    if (day >= 1 && day <= 31 && month >= 0 && month <= 11 && year >= 2000) {
      invoiceDate = new Date(year, month, day);
    }
  }

  // Find amounts (look for euro amounts)
  const amounts: number[] = [];
  const amountMatches = text.matchAll(/€?\s*(\d{1,6}[.,]\d{2})\b/g);
  for (const m of amountMatches) {
    const val = parseFloat(m[1].replace(',', '.'));
    if (val > 0 && val < 1000000) {
      amounts.push(val);
    }
  }

  // Get totals
  const totalInclVat = amounts.length > 0 ? Math.max(...amounts) : 0;
  const subtotal = Math.round((totalInclVat / 1.21) * 100) / 100;
  const vatAmount = Math.round((totalInclVat - subtotal) * 100) / 100;

  return {
    supplierName,
    invoiceNumber,
    invoiceDate,
    amount: totalInclVat,
    subtotal,
    vatAmount,
    vatRate: 21,
    totalInclVat,
    rawText: text,
  };
}

// OCR image file
async function ocrImage(file: File, onProgress?: (n: number) => void): Promise<OCRResult> {
  onProgress?.(10);
  const w = await getWorker();
  onProgress?.(30);
  const result = await w.recognize(file);
  onProgress?.(100);

  return {
    text: result.data.text,
    confidence: result.data.confidence,
    pages: [{ pageNumber: 1, text: result.data.text, confidence: result.data.confidence }],
  };
}

// OCR PDF file
async function ocrPdf(file: File, onProgress?: (n: number) => void): Promise<OCRResult> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const w = await getWorker();

  const pages: { pageNumber: number; text: string; confidence: number }[] = [];
  let allText = '';
  let totalConf = 0;

  for (let i = 1; i <= pdf.numPages; i++) {
    onProgress?.((i / pdf.numPages) * 80);

    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;

    await page.render({ canvasContext: ctx, viewport }).promise;
    const result = await w.recognize(canvas);

    pages.push({ pageNumber: i, text: result.data.text, confidence: result.data.confidence });
    allText += result.data.text + '\n';
    totalConf += result.data.confidence;
  }

  onProgress?.(100);

  return {
    text: allText.trim(),
    confidence: totalConf / pdf.numPages,
    pages,
  };
}

// Main export - process invoice file with OCR
export async function processInvoiceFile(
  file: File,
  onProgress?: (n: number) => void
): Promise<OCRResult & { invoiceData: InvoiceData }> {
  // Do OCR based on file type
  const ocrResult = file.type === 'application/pdf'
    ? await ocrPdf(file, onProgress)
    : await ocrImage(file, onProgress);

  // Extract invoice data from OCR text (no external API calls)
  const invoiceData = extractInvoiceData(ocrResult.text);

  return { ...ocrResult, invoiceData };
}

export async function terminateOCRWorker() {
  if (worker) {
    await worker.terminate();
    worker = null;
  }
}
