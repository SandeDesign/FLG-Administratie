import { createWorker } from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';

if (typeof window !== 'undefined' && !window.WebSocket) {
  (window as any).WebSocket = class FakeWebSocket {
    constructor(url: string) {}
    addEventListener() {}
    removeEventListener() {}
    send() {}
    close() {}
  };
}

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href;

export interface OCRResult {
  text: string;
  confidence: number;
  pages: {
    pageNumber: number;
    text: string;
    confidence: number;
  }[];
}

let workerInstance: any = null;

const getWorker = async () => {
  if (!workerInstance) {
    workerInstance = await createWorker('eng', 1, {
      logger: () => {}, // Silent - geen spam
    });
  }
  return workerInstance;
};

export const extractTextFromPDF = async (
  file: File,
  onProgress?: (progress: number) => void
): Promise<OCRResult> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const pages = [];
    let totalConfidence = 0;
    let allText = '';
    const worker = await getWorker();

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      onProgress?.((pageNum / pdf.numPages) * 50);

      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2 });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      if (!context) throw new Error('Canvas context failed');

      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;

      const result = await worker.recognize(canvas);
      const pageText = result.data.text;
      const pageConfidence = result.data.confidence;

      pages.push({
        pageNumber: pageNum,
        text: pageText,
        confidence: pageConfidence,
      });

      allText += `\n--- PAGE ${pageNum} ---\n${pageText}`;
      totalConfidence += pageConfidence;

      onProgress?.(50 + (pageNum / pdf.numPages) * 50);
    }

    const averageConfidence = pages.length > 0 ? totalConfidence / pages.length : 0;
    return {
      text: allText.trim(),
      confidence: averageConfidence,
      pages,
    };
  } catch (error) {
    console.error('PDF OCR error:', error);
    throw error;
  }
};

export const extractTextFromImage = async (
  file: File,
  onProgress?: (progress: number) => void
): Promise<OCRResult> => {
  try {
    const img = document.createElement('img');
    const url = URL.createObjectURL(file);

    return new Promise((resolve, reject) => {
      img.onload = async () => {
        try {
          onProgress?.(25);
          const worker = await getWorker();
          const result = await worker.recognize(img);
          onProgress?.(100);

          resolve({
            text: result.data.text,
            confidence: result.data.confidence,
            pages: [
              {
                pageNumber: 1,
                text: result.data.text,
                confidence: result.data.confidence,
              },
            ],
          });
          URL.revokeObjectURL(url);
        } catch (error) {
          URL.revokeObjectURL(url);
          reject(error);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Image load failed'));
      };

      img.src = url;
    });
  } catch (error) {
    console.error('Image OCR error:', error);
    throw error;
  }
};

/**
 * Parse Nederlands getal: 15.339,66 → 15339.66
 */
function parseNederlandsNumber(str: string): number {
  if (!str) return 0;
  let cleaned = str.replace(/€/g, '').replace(/\s/g, '').trim();
  cleaned = cleaned.replace(/\./g, '');
  cleaned = cleaned.replace(',', '.');
  return parseFloat(cleaned) || 0;
}

/**
 * Extract bedrag uit string
 */
function extractAmount(text: string): number {
  const match = text.match(/€?\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/);
  if (match) {
    return parseNederlandsNumber(match[1]);
  }
  return 0;
}

/**
 * Proper invoice extraction - fokus op STRUCTUUR
 */
export const extractInvoiceData = (ocrText: string) => {
  const lines = ocrText.split('\n').map(l => l.trim()).filter(l => l);
  
  let supplierName = 'Onbekend';
  let invoiceNumber = `INV-${Date.now()}`;
  let invoiceDate = new Date();
  let subtotalExclVat = 0;
  let vatAmount = 0;
  let totalInclVat = 0;

  // ===== SUPPLIER: Zoek bedrijfsnaam (eerste grote tekst) =====
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const line = lines[i];
    // Criteria: minstens 4 woorden OF bedrijfswoorden
    if (line.length > 5 && !line.match(/^\d/) && line !== line.toLowerCase()) {
      if (line.includes(' ') || line.match(/B\.?V\.?|Ltd|Inc|BV/i)) {
        supplierName = line;
        break;
      }
    }
  }

  // ===== INVOICE NUMBER =====
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();
    if (line.includes('factuurnummer') || line.includes('invoice') || line.includes('nummer')) {
      // Kijk op dezelfde lijn eerst
      let num = lines[i].match(/:\s*([A-Z0-9\-]+)/)?.[1];
      // Of op volgende lijn
      if (!num && i + 1 < lines.length) {
        num = lines[i + 1].match(/^([A-Z0-9\-]+)/)?.[1];
      }
      if (num && num.length > 2) {
        invoiceNumber = num;
        break;
      }
    }
  }

  // ===== DATUM =====
  const datePattern = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/;
  for (const line of lines) {
    const match = line.match(datePattern);
    if (match) {
      const day = parseInt(match[1]);
      const month = parseInt(match[2]);
      const year = parseInt(match[3]);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        invoiceDate = new Date(year, month - 1, day);
        break;
      }
    }
  }

  // ===== BEDRAGEN: Zoek naar specifieke LABELS =====
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = (i + 1 < lines.length) ? lines[i + 1] : '';
    const lower = line.toLowerCase();

    // SUBTOTAAL
    if ((lower.includes('subtotaal') || lower.includes('subtotal')) && !lower.includes('incl')) {
      subtotalExclVat = extractAmount(nextLine) || extractAmount(line);
    }

    // 21% BTW
    if ((lower.includes('21%') || lower.includes('btw')) && lower.includes('%')) {
      vatAmount = extractAmount(nextLine) || extractAmount(line);
    }

    // TOTAAL
    if (lower.includes('totaal') && (lower.includes('voldoen') || lower.includes('incl') || lower.includes('total'))) {
      totalInclVat = extractAmount(nextLine) || extractAmount(line);
    }
  }

  // ===== Fallback: Bereken uit elkaar =====
  // Als we subtotal en vat hebben, bereken totaal
  if (subtotalExclVat > 0 && vatAmount === 0) {
    vatAmount = Math.round((subtotalExclVat * 0.21) * 100) / 100;
  }
  if (subtotalExclVat > 0 && totalInclVat === 0) {
    totalInclVat = subtotalExclVat + vatAmount;
  }
  // Als we totaal hebben maar geen subtotal
  if (totalInclVat > 0 && subtotalExclVat === 0) {
    if (vatAmount > 0) {
      subtotalExclVat = totalInclVat - vatAmount;
    } else {
      subtotalExclVat = Math.round((totalInclVat / 1.21) * 100) / 100;
      vatAmount = totalInclVat - subtotalExclVat;
    }
  }

  console.log('\n========== INVOICE EXTRACTED ==========');
  console.log('Supplier:        ', supplierName);
  console.log('Invoice Number:  ', invoiceNumber);
  console.log('Date:            ', invoiceDate.toLocaleDateString('nl-NL'));
  console.log('');
  console.log('Excl. BTW:       ', `€ ${subtotalExclVat.toFixed(2)}`);
  console.log('BTW (21%):       ', `€ ${vatAmount.toFixed(2)}`);
  console.log('Incl. BTW:       ', `€ ${totalInclVat.toFixed(2)}`);
  console.log('=========================================\n');

  return {
    supplierName,
    invoiceNumber,
    invoiceDate,
    amount: totalInclVat || subtotalExclVat,
    subtotal: subtotalExclVat,
    vatAmount,
    vatRate: 21,
    totalInclVat,
    rawText: ocrText,
  };
};

export const processInvoiceFile = async (
  file: File,
  onProgress?: (progress: number) => void
): Promise<OCRResult & { invoiceData: ReturnType<typeof extractInvoiceData> }> => {
  try {
    let ocrResult: OCRResult;

    if (file.type === 'application/pdf') {
      ocrResult = await extractTextFromPDF(file, onProgress);
    } else if (file.type.startsWith('image/')) {
      ocrResult = await extractTextFromImage(file, onProgress);
    } else {
      throw new Error(`Unsupported file type: ${file.type}`);
    }

    const invoiceData = extractInvoiceData(ocrResult.text);

    return {
      ...ocrResult,
      invoiceData,
    };
  } catch (error) {
    console.error('File processing error:', error);
    throw error;
  }
};

export const terminateOCRWorker = async () => {
  if (workerInstance) {
    await workerInstance.terminate();
    workerInstance = null;
  }
};