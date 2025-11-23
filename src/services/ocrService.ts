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

// Extract with Claude via PHP proxy on internedata.nl
async function extractWithClaude(ocrText: string): Promise<InvoiceData | null> {
  try {
    const res = await fetch('https://internedata.nl/claude-ocr.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ocrText }),
    });

    // Any non-OK response -> fallback to basic
    if (!res.ok) {
      console.log('Claude OCR returned non-OK status, using basic extraction');
      return null;
    }

    // Get response as text first to safely parse
    const responseText = await res.text();

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      console.log('Claude OCR returned non-JSON, using basic extraction');
      return null;
    }

    if (!data.success || !data.invoiceData) {
      console.log('Claude OCR returned error, using basic extraction');
      return null;
    }

    const d = data.invoiceData;
    return {
      supplierName: d.supplierName || 'Onbekend',
      invoiceNumber: d.invoiceNumber || `INV-${Date.now()}`,
      invoiceDate: d.invoiceDate ? new Date(d.invoiceDate) : new Date(),
      amount: Number(d.totalAmount) || 0,
      subtotal: Number(d.subtotalExclVat) || Number(d.totalAmount) / 1.21 || 0,
      vatAmount: Number(d.vatAmount) || 0,
      vatRate: 21,
      totalInclVat: Number(d.totalAmount) || 0,
      rawText: ocrText,
    };
  } catch (err) {
    console.log('Claude OCR failed, using basic extraction:', err);
    return null;
  }
}

// Basic extraction fallback (always works, no external calls)
function extractBasic(text: string): InvoiceData {
  const lines = text.split('\n').filter(l => l.trim());

  // Find supplier (first non-numeric line)
  let supplierName = 'Onbekend';
  for (const line of lines.slice(0, 10)) {
    if (line.length > 3 && !/^\d/.test(line)) {
      supplierName = line.trim();
      break;
    }
  }

  // Find invoice number
  let invoiceNumber = `INV-${Date.now()}`;
  const invMatch = text.match(/(?:factuurnummer|invoice|inv\.?|factuur)[\s:]*([A-Z0-9-]+)/i);
  if (invMatch) {
    invoiceNumber = invMatch[1];
  }

  // Find date
  let invoiceDate = new Date();
  const dateMatch = text.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
  if (dateMatch) {
    invoiceDate = new Date(+dateMatch[3], +dateMatch[2] - 1, +dateMatch[1]);
  }

  // Find amounts
  const amounts: number[] = [];
  const amountMatches = text.matchAll(/€?\s*(\d+[.,]\d{2})/g);
  for (const m of amountMatches) {
    const val = parseFloat(m[1].replace(',', '.'));
    if (val > 0 && val < 100000) amounts.push(val);
  }

  const totalInclVat = amounts.length ? Math.max(...amounts) : 0;
  const subtotal = totalInclVat / 1.21;
  const vatAmount = totalInclVat - subtotal;

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

// OCR image
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

// OCR PDF
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

// Main export
export async function processInvoiceFile(
  file: File,
  onProgress?: (n: number) => void
): Promise<OCRResult & { invoiceData: InvoiceData }> {
  let ocrResult: OCRResult;

  if (file.type === 'application/pdf') {
    ocrResult = await ocrPdf(file, onProgress);
  } else {
    ocrResult = await ocrImage(file, onProgress);
  }

  // Try Claude first, fallback to basic extraction
  const invoiceData = (await extractWithClaude(ocrResult.text)) || extractBasic(ocrResult.text);

  return { ...ocrResult, invoiceData };
}

export async function terminateOCRWorker() {
  if (worker) {
    await worker.terminate();
    worker = null;
  }
}
