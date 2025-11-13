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
      logger: () => {}, // Silent
    });
  }
  return workerInstance;
};

/**
 * ✅ NEW: Convert HEIC to JPG (iPad photos)
 */
export const convertHEICToJPG = async (file: File): Promise<File> => {
  try {
    const heic2any = (window as any).heic2any;
    if (heic2any) {
      const jpgBlob = await heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: 0.9,
      });
      return new File([jpgBlob], file.name.replace('.heic', '.jpg'), { type: 'image/jpeg' });
    }
  } catch (error) {
    console.warn('HEIC conversion failed, falling back to canvas:', error);
  }

  // Fallback: Canvas conversion
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = document.createElement('img');
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context failed'));
          return;
        }
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(new File([blob], file.name.replace('.heic', '.jpg'), { type: 'image/jpeg' }));
            } else {
              reject(new Error('Canvas conversion failed'));
            }
          },
          'image/jpeg',
          0.9
        );
      };
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsDataURL(file);
  });
};

/**
 * ✅ NEW: Preprocessing voor betere OCR
 */
export const preprocessImage = async (img: HTMLImageElement): Promise<HTMLCanvasElement> => {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context failed');

  ctx.drawImage(img, 0, 0);
  
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Contrast & brightness boost
  const contrast = 1.5;
  const brightness = 20;

  for (let i = 0; i < data.length; i += 4) {
    for (let j = 0; j < 3; j++) {
      let pixel = data[i + j];
      pixel = (pixel - 128) * contrast + 128 + brightness;
      data[i + j] = Math.max(0, Math.min(255, pixel));
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
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

/**
 * ✅ UPDATED: Extract text from image - with preprocessing & HEIC support
 */
export const extractTextFromImage = async (
  file: File,
  onProgress?: (progress: number) => void
): Promise<OCRResult> => {
  try {
    onProgress?.(10);

    // Convert HEIC to JPG if needed
    let imageFile = file;
    if (file.type === 'image/heic' || file.name.endsWith('.heic')) {
      console.log('Converting HEIC to JPG...');
      imageFile = await convertHEICToJPG(file);
      onProgress?.(25);
    }

    const img = document.createElement('img');
    const url = URL.createObjectURL(imageFile);

    return new Promise((resolve, reject) => {
      img.onload = async () => {
        try {
          onProgress?.(35);

          // Preprocess image for better OCR
          const processedCanvas = await preprocessImage(img);
          onProgress?.(40);

          const worker = await getWorker();
          const result = await worker.recognize(processedCanvas);
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
 * Extract bedrag - ondersteunt 1-2 decimalen
 */
function extractAmount(text: string): number {
  const match = text.match(/€?\s*([\d\.]+,\d{1,2})/);
  if (match) {
    return parseNederlandsNumber(match[1]);
  }
  return 0;
}

/**
 * Find all amounts in text
 */
function findAllAmounts(text: string): number[] {
  const regex = /€?\s*([\d\.]+,\d{1,2})/g;
  const matches = Array.from(text.matchAll(regex));
  return matches
    .map(m => parseNederlandsNumber(m[1]))
    .filter(n => n > 0)
    .sort((a, b) => b - a);
}

/**
 * Detect document type
 */
function detectDocumentType(ocrText: string): 'invoice' | 'receipt' {
  const lower = ocrText.toLowerCase();
  
  if (lower.includes('totaal') && (lower.includes('prijs') || lower.includes('pomp'))) {
    return 'receipt';
  }
  
  if (lower.includes('factuurnummer') || lower.includes('subtotaal') || lower.includes('factuur')) {
    return 'invoice';
  }
  
  return 'receipt';
}

/**
 * Extract invoice data - DYNAMISCH
 */
export const extractInvoiceData = (ocrText: string) => {
  const lines = ocrText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const docType = detectDocumentType(ocrText);
  
  let supplierName = 'Onbekend';
  let invoiceNumber = `INV-${Date.now()}`;
  let invoiceDate = new Date();
  let subtotalExclVat = 0;
  let vatAmount = 0;
  let totalInclVat = 0;

  // Supplier
  for (let i = 0; i < Math.min(15, lines.length); i++) {
    const line = lines[i];
    if (line.includes('PAGE') || line.includes('---') || line.length < 3) continue;
    if (line.match(/[A-Z][a-z]+.*(?:BV|Ltd|Inc|b\.v|B\.V|GROUP|EXPRESS|bv)/i) || 
        (line.length > 5 && !line.match(/^\d/) && line !== line.toLowerCase() && line.match(/[A-Z]/))) {
      supplierName = line;
      break;
    }
  }

  // Invoice number
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();
    if (lower.includes('factuurnummer') || lower.includes('ticketnumber')) {
      const num = line.match(/:\s*([A-Z0-9\-\.]+)/)?.[1] || lines[i + 1]?.match(/^([A-Z0-9\-\.]+)/)?.[1];
      if (num) {
        invoiceNumber = num;
        break;
      }
    }
  }

  // Date
  const datePattern = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/;
  for (const line of lines) {
    const match = line.match(datePattern);
    if (match) {
      const day = parseInt(match[1]);
      const month = parseInt(match[2]);
      const year = parseInt(match[3]);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2020 && year <= 2030) {
        invoiceDate = new Date(year, month - 1, day);
        break;
      }
    }
  }

  // Amounts
  if (docType === 'receipt') {
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      const lower = line.toLowerCase();

      if (lower.includes('totaal') && !lower.includes('subtotaal')) {
        totalInclVat = extractAmount(line);
        if (totalInclVat > 0) break;
      }
    }

    subtotalExclVat = totalInclVat;
    vatAmount = 0;
  } else {
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      const lower = line.toLowerCase();

      if (totalInclVat === 0 && lower.includes('totaal') && lower.includes('voldoen')) {
        totalInclVat = extractAmount(line);
        continue;
      }

      if (vatAmount === 0 && lower.includes('btw') && lower.match(/\d+%/)) {
        vatAmount = extractAmount(line);
        continue;
      }

      if (subtotalExclVat === 0 && lower.includes('subtotaal')) {
        subtotalExclVat = extractAmount(line);
        continue;
      }
    }
  }

  // Fallbacks
  if (subtotalExclVat > 0 && vatAmount === 0) {
    vatAmount = Math.round((subtotalExclVat * 0.21) * 100) / 100;
  }
  if (subtotalExclVat > 0 && totalInclVat === 0) {
    totalInclVat = subtotalExclVat + vatAmount;
  }
  if (totalInclVat > 0 && subtotalExclVat === 0) {
    if (vatAmount > 0) {
      subtotalExclVat = totalInclVat - vatAmount;
    } else {
      subtotalExclVat = totalInclVat;
    }
  }

  console.log('\n========== INVOICE EXTRACTED ==========');
  console.log('Type:            ', docType);
  console.log('Supplier:        ', supplierName);
  console.log('Invoice Number:  ', invoiceNumber);
  console.log('Date:            ', invoiceDate.toLocaleDateString('nl-NL'));
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
    } else if (file.type.startsWith('image/') || file.type === 'image/heic' || file.name.endsWith('.heic')) {
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