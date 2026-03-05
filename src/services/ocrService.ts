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
  description?: string;
  rawText: string;
}

let worker: any = null;

async function getWorker() {
  if (!worker) {
    worker = await createWorker('nld+eng');
  }
  return worker;
}

// Determine the Netlify function URL for Claude Vision OCR
function getClaudeVisionUrl(): string {
  // In production, use relative path (same domain)
  // In development, Netlify Dev serves functions at /.netlify/functions/
  return '/.netlify/functions/claude-vision-ocr';
}

// Convert File to base64
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:application/pdf;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Extract with Claude Vision (primary method - sends file directly to Claude)
async function extractWithClaudeVision(file: File): Promise<InvoiceData | null> {
  try {
    const base64 = await fileToBase64(file);
    const mediaType = file.type || 'application/pdf';

    const res = await fetch(getClaudeVisionUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileBase64: base64, fileMediaType: mediaType }),
    });

    if (!res.ok) {
      console.log('Claude Vision returned non-OK status, falling back');
      return null;
    }

    const responseText = await res.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      console.log('Claude Vision returned non-JSON, falling back');
      return null;
    }

    if (!data.success || !data.invoiceData) {
      console.log('Claude Vision returned error, falling back');
      return null;
    }

    const d = data.invoiceData;
    const totalAmount = Number(d.totalAmount) || 0;
    const subtotal = Number(d.subtotal) || Number(d.subtotalExclVat) || totalAmount / 1.21 || 0;
    const vatAmount = Number(d.vatAmount) || totalAmount - subtotal || 0;

    return {
      supplierName: d.supplierName || 'Onbekend',
      invoiceNumber: d.invoiceNumber || `INV-${Date.now()}`,
      invoiceDate: d.invoiceDate ? new Date(d.invoiceDate) : new Date(),
      amount: totalAmount,
      subtotal,
      vatAmount,
      vatRate: 21,
      totalInclVat: totalAmount,
      description: d.description || '',
      rawText: `[Claude Vision extraction] ${d.supplierName || ''} - ${d.invoiceNumber || ''}`,
    };
  } catch (err) {
    console.log('Claude Vision failed, falling back:', err);
    return null;
  }
}

// Extract with Claude Vision from URL (for email imports)
export async function extractWithClaudeVisionUrl(fileUrl: string): Promise<InvoiceData | null> {
  try {
    const res = await fetch(getClaudeVisionUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileUrl }),
    });

    if (!res.ok) {
      console.log('Claude Vision URL returned non-OK status');
      return null;
    }

    const responseText = await res.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      console.log('Claude Vision URL returned non-JSON');
      return null;
    }

    if (!data.success || !data.invoiceData) {
      console.log('Claude Vision URL returned error');
      return null;
    }

    const d = data.invoiceData;
    const totalAmount = Number(d.totalAmount) || 0;
    const subtotal = Number(d.subtotal) || Number(d.subtotalExclVat) || totalAmount / 1.21 || 0;
    const vatAmount = Number(d.vatAmount) || totalAmount - subtotal || 0;

    return {
      supplierName: d.supplierName || 'Onbekend',
      invoiceNumber: d.invoiceNumber || `INV-${Date.now()}`,
      invoiceDate: d.invoiceDate ? new Date(d.invoiceDate) : new Date(),
      amount: totalAmount,
      subtotal,
      vatAmount,
      vatRate: 21,
      totalInclVat: totalAmount,
      description: d.description || '',
      rawText: `[Claude Vision extraction] ${d.supplierName || ''} - ${d.invoiceNumber || ''}`,
    };
  } catch (err) {
    console.log('Claude Vision URL failed:', err);
    return null;
  }
}

// Extract with Claude via PHP proxy on internedata.nl (fallback for text-only)
async function extractWithClaude(ocrText: string): Promise<InvoiceData | null> {
  try {
    const res = await fetch('https://internedata.nl/claude-ocr.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ocrText }),
    });

    if (!res.ok) {
      console.log('Claude OCR returned non-OK status, using basic extraction');
      return null;
    }

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

  let supplierName = 'Onbekend';
  for (const line of lines.slice(0, 10)) {
    if (line.length > 3 && !/^\d/.test(line)) {
      supplierName = line.trim();
      break;
    }
  }

  let invoiceNumber = `INV-${Date.now()}`;
  const invMatch = text.match(/(?:factuurnummer|invoice|inv\.?|factuur)[\s:]*([A-Z0-9-]+)/i);
  if (invMatch) {
    invoiceNumber = invMatch[1];
  }

  let invoiceDate = new Date();
  const dateMatch = text.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
  if (dateMatch) {
    invoiceDate = new Date(+dateMatch[3], +dateMatch[2] - 1, +dateMatch[1]);
  }

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

// OCR image (Tesseract fallback)
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

// OCR PDF (Tesseract fallback)
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

// Main export — tries Claude Vision first, then Tesseract + Claude text, then basic regex
export async function processInvoiceFile(
  file: File,
  onProgress?: (n: number) => void
): Promise<OCRResult & { invoiceData: InvoiceData }> {
  // Step 1: Try Claude Vision directly (best quality, works on Dutch invoices + receipts)
  onProgress?.(10);
  const visionResult = await extractWithClaudeVision(file);
  if (visionResult) {
    onProgress?.(100);
    return {
      text: visionResult.rawText,
      confidence: 95,
      pages: [{ pageNumber: 1, text: visionResult.rawText, confidence: 95 }],
      invoiceData: visionResult,
    };
  }

  // Step 2: Fallback to Tesseract OCR + Claude text extraction
  onProgress?.(20);
  let ocrResult: OCRResult;
  if (file.type === 'application/pdf') {
    ocrResult = await ocrPdf(file, onProgress);
  } else {
    ocrResult = await ocrImage(file, onProgress);
  }

  const invoiceData = (await extractWithClaude(ocrResult.text)) || extractBasic(ocrResult.text);

  return { ...ocrResult, invoiceData };
}

export async function terminateOCRWorker() {
  if (worker) {
    await worker.terminate();
    worker = null;
  }
}
