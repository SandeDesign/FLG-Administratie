import { createWorker } from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';

// Fix WebSocket error in webcontainer environment
if (typeof window !== 'undefined' && !window.WebSocket) {
  (window as any).WebSocket = class FakeWebSocket {
    constructor(url: string) {
      console.warn('WebSocket not available, continuing anyway');
    }
    addEventListener() {}
    removeEventListener() {}
    send() {}
    close() {}
  };
}

// Set worker path for pdf.js
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

/**
 * Get or create worker instance
 */
const getWorker = async () => {
  if (!workerInstance) {
    workerInstance = await createWorker('eng', 1, {
      logger: (m: any) => {
        console.log('OCR Worker:', m);
      },
    });
  }
  return workerInstance;
};

/**
 * Extract text from PDF using OCR
 */
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

    // Process each page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      if (onProgress) {
        onProgress((pageNum / pdf.numPages) * 50);
      }

      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2 });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      if (!context) {
        throw new Error('Could not get canvas context');
      }

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      await page.render(renderContext).promise;

      console.log(`Running OCR on page ${pageNum} of ${pdf.numPages}...`);

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

      if (onProgress) {
        onProgress(50 + (pageNum / pdf.numPages) * 50);
      }
    }

    const averageConfidence = pages.length > 0 ? totalConfidence / pages.length : 0;

    console.log(`OCR completed for PDF. Average confidence: ${averageConfidence}%`);

    return {
      text: allText.trim(),
      confidence: averageConfidence,
      pages,
    };
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error(`PDF OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Extract text from image using OCR
 */
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
          console.log('Running OCR on image...');
          onProgress?.(25);

          const worker = await getWorker();
          const result = await worker.recognize(img);

          const text = result.data.text;
          const confidence = result.data.confidence;

          console.log(`OCR completed for image. Confidence: ${confidence}%`);
          onProgress?.(100);

          resolve({
            text,
            confidence,
            pages: [
              {
                pageNumber: 1,
                text,
                confidence,
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
        reject(new Error('Failed to load image'));
      };

      img.src = url;
    });
  } catch (error) {
    console.error('Error extracting text from image:', error);
    throw new Error(
      `Image OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
};

/**
 * Extract invoice data from OCR text - Proper Dutch invoice parsing
 */
export const extractInvoiceData = (ocrText: string) => {
  const normalized = ocrText.toLowerCase().replace(/\r\n/g, '\n');

  // ===== SUPPLIER NAME =====
  const supplierPatterns = [
    /(?:van|leverancier|bedrijf|maatschappij|door)[\s:]*([^\n]+?)(?:\n|bedrijf|adres|kvk|btw|€)/i,
    /^([a-z\s&\.]+?)(?:\n\n|\s{2,}(?:adres|straat|kvk))/im,
  ];
  let supplierName = 'Onbekend';
  for (const pattern of supplierPatterns) {
    const match = normalized.match(pattern);
    if (match) {
      supplierName = match[1].trim().split(/\n/)[0].trim();
      if (supplierName.length > 3 && supplierName.length < 100) break;
    }
  }

  // ===== INVOICE NUMBER =====
  const invoiceNumberPatterns = [
    /(?:factuur\s*(?:nr|nummer|#|no)?\.?|invoice\s*(?:nr|number)?\.?|factuurnummer)[:\s]+([a-z0-9\-\.\/]+)/i,
    /^(?:inv|f|factuur)[:\s]*([a-z0-9\-\.]{3,})/im,
  ];
  let invoiceNumber = `INV-${Date.now()}`;
  for (const pattern of invoiceNumberPatterns) {
    const match = normalized.match(pattern);
    if (match) {
      invoiceNumber = match[1].trim().toUpperCase();
      break;
    }
  }

  // ===== DATES =====
  const dateRegex = /(\d{1,2})[-\/\.](\d{1,2})[-\/\.](\d{2,4})/g;
  const dates: Date[] = [];
  let dateMatch;
  while ((dateMatch = dateRegex.exec(ocrText)) !== null) {
    let day = parseInt(dateMatch[1]);
    let month = parseInt(dateMatch[2]);
    let year = parseInt(dateMatch[3]);

    if (year < 100) year = year < 30 ? 2000 + year : 1900 + year;
    if (month > 12) [day, month] = [month, day];

    if (day > 0 && day <= 31 && month > 0 && month <= 12) {
      dates.push(new Date(year, month - 1, day));
    }
  }

  const invoiceDate = dates.length > 0 ? dates[0] : new Date();
  const dueDate = dates.length > 1 ? dates[1] : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  // ===== AMOUNTS - Proper Dutch invoice parsing =====
  const parseAmount = (str?: string): number => {
    if (!str) return 0;
    // Remove dots (thousands separator) and replace comma with dot
    return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
  };

  // Subtotal excl VAT
  const subtotalPatterns = [
    /(?:subtotaal|netto bedrag|bedrag\s*ex(?:cl)?\.?\s*btw|totaal\s*ex\s*btw)[:\s]*€?\s*([0-9]{1,10}[.,][0-9]{2})/i,
    /ex\s*btw[:\s]*€?\s*([0-9]{1,10}[.,][0-9]{2})/i,
  ];
  let subtotal = 0;
  for (const pattern of subtotalPatterns) {
    const match = normalized.match(pattern);
    if (match) {
      subtotal = parseAmount(match[1]);
      if (subtotal > 0) break;
    }
  }

  // VAT Rate
  const vatRateMatch = normalized.match(/btw\s*(?:tarief)?[:\s]*(\d{1,2})%/i);
  const vatRate = vatRateMatch ? parseInt(vatRateMatch[1]) : 21;

  // VAT Amount - be specific to avoid false positives
  const vatPatterns = [
    /btw\s*(?:21%)?[:\s]*€?\s*([0-9]{1,10}[.,][0-9]{2})(?:\s|$)/i,
    /(?:21%?\s*)?btw\s*bedrag[:\s]*€?\s*([0-9]{1,10}[.,][0-9]{2})/i,
  ];
  let vatAmount = 0;
  for (const pattern of vatPatterns) {
    const match = normalized.match(pattern);
    if (match) {
      vatAmount = parseAmount(match[1]);
      if (vatAmount > 0) break;
    }
  }

  // Total incl VAT - most specific patterns first
  const totalPatterns = [
    /totaal\s*(?:incl)?\.?\s*btw[:\s]*€?\s*([0-9]{1,10}[.,][0-9]{2})/i,
    /totaalbedrag[:\s]*€?\s*([0-9]{1,10}[.,][0-9]{2})/i,
    /totaal\s*te\s*betalen[:\s]*€?\s*([0-9]{1,10}[.,][0-9]{2})/i,
    /bedrag\s*incl\.?\s*btw[:\s]*€?\s*([0-9]{1,10}[.,][0-9]{2})/i,
    /(?:incl\s*btw|inclusive)[:\s]*€?\s*([0-9]{1,10}[.,][0-9]{2})/i,
  ];
  let totalInclVat = 0;
  for (const pattern of totalPatterns) {
    const match = normalized.match(pattern);
    if (match) {
      totalInclVat = parseAmount(match[1]);
      if (totalInclVat > 0) break;
    }
  }

  // ===== CALCULATE MISSING AMOUNTS =====
  // If we have subtotal but no VAT, calculate it
  if (subtotal > 0 && vatAmount === 0) {
    vatAmount = (subtotal * vatRate) / 100;
  }

  // If we have subtotal but no total, calculate it
  if (subtotal > 0 && totalInclVat === 0) {
    totalInclVat = subtotal + (vatAmount > 0 ? vatAmount : (subtotal * vatRate) / 100);
  }

  // If we have total and VAT but no subtotal, calculate it
  if (totalInclVat > 0 && vatAmount > 0 && subtotal === 0) {
    subtotal = totalInclVat - vatAmount;
  }

  // If only total exists, assume 21% VAT
  if (totalInclVat > 0 && subtotal === 0 && vatAmount === 0) {
    subtotal = totalInclVat / (1 + vatRate / 100);
    vatAmount = totalInclVat - subtotal;
  }

  const amount = totalInclVat > 0 ? totalInclVat : subtotal;

  return {
    supplierName,
    invoiceNumber,
    invoiceDate,
    dueDate,
    amount: Math.round(amount * 100) / 100,
    subtotal: Math.round(subtotal * 100) / 100,
    vatAmount: Math.round(vatAmount * 100) / 100,
    vatRate: vatRate,
    totalInclVat: Math.round(totalInclVat * 100) / 100,
    rawText: ocrText,
  };
};

/**
 * Process file - automatically detect type and extract
 */
export const processInvoiceFile = async (
  file: File,
  onProgress?: (progress: number) => void
): Promise<OCRResult & { invoiceData: ReturnType<typeof extractInvoiceData> }> => {
  try {
    let ocrResult: OCRResult;

    if (file.type === 'application/pdf') {
      console.log('Processing PDF file...');
      ocrResult = await extractTextFromPDF(file, onProgress);
    } else if (file.type.startsWith('image/')) {
      console.log('Processing image file...');
      ocrResult = await extractTextFromImage(file, onProgress);
    } else {
      throw new Error(`Unsupported file type: ${file.type}`);
    }

    // Extract invoice data from OCR text
    const invoiceData = extractInvoiceData(ocrResult.text);

    return {
      ...ocrResult,
      invoiceData,
    };
  } catch (error) {
    console.error('Error processing invoice file:', error);
    throw error;
  }
};

/**
 * Terminate worker to free memory
 */
export const terminateOCRWorker = async () => {
  if (workerInstance) {
    await workerInstance.terminate();
    workerInstance = null;
  }
};