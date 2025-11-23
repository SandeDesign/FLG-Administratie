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
  engine: 'tesseract-psm4' | 'tesseract-psm11' | 'ocr-space';
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

let workerInstance: any = null;

const getWorker = async () => {
  if (!workerInstance) {
    // Use Dutch + English for best results on Dutch invoices
    workerInstance = await createWorker('nld+eng', 1, {
      logger: () => {},
    });
  }
  return workerInstance;
};

/**
 * ✅ CLAUDE EXTRACTION via Netlify Function (no CORS issues!)
 */
const extractWithClaude = async (ocrText: string): Promise<InvoiceData> => {
  try {
    console.log('🤖 Calling Claude via Netlify function...');

    const response = await fetch('/api/claude-ocr', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ocrText }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success || !data.invoiceData) {
      throw new Error('Invalid response from Claude');
    }

    const jsonData = data.invoiceData;
    const invoiceDate = parseDate(jsonData.invoiceDate);
    const totalAmount = parseAmount(jsonData.totalAmount);
    const subtotal = parseAmount(jsonData.subtotalExclVat) || totalAmount / 1.21;
    const vatAmount = parseAmount(jsonData.vatAmount) || totalAmount - subtotal;

    console.log('\n========== 📄 INVOICE EXTRACTED (Claude) ==========');
    console.log('Supplier:        ', jsonData.supplierName);
    console.log('Invoice Number:  ', jsonData.invoiceNumber);
    console.log('Date:            ', invoiceDate.toLocaleDateString('nl-NL'));
    console.log('Excl. BTW:       ', `€ ${subtotal.toFixed(2)}`);
    console.log('BTW (21%):       ', `€ ${vatAmount.toFixed(2)}`);
    console.log('Incl. BTW:       ', `€ ${totalAmount.toFixed(2)}`);
    console.log('====================================================\n');

    return {
      supplierName: jsonData.supplierName || 'Onbekend',
      invoiceNumber: jsonData.invoiceNumber || `INV-${Date.now()}`,
      invoiceDate,
      amount: totalAmount,
      subtotal,
      vatAmount,
      vatRate: 21,
      totalInclVat: totalAmount,
      rawText: ocrText,
    };
  } catch (error) {
    console.error('Claude extraction failed, falling back to basic extraction:', error);
    return extractInvoiceDataBasic(ocrText);
  }
};

function parseAmount(value: any): number {
  if (!value) return 0;
  if (typeof value === 'number') return value;

  const str = String(value);
  const cleaned = str
    .replace(/€/g, '')
    .replace(/\s/g, '')
    .trim()
    .replace(/\./g, '')
    .replace(',', '.');
  return parseFloat(cleaned) || 0;
}

function parseDate(value: any): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;

  const str = String(value).trim();

  const isoMatch = str.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
  }

  const datedMatch = str.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
  if (datedMatch) {
    const day = parseInt(datedMatch[1]);
    const month = parseInt(datedMatch[2]);
    const year = parseInt(datedMatch[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return new Date(year, month - 1, day);
    }
  }

  return new Date();
}

/**
 * GRATIS FALLBACK: OCR.space API
 */
export const recognizeWithOCRSpace = async (
  imageFile: File
): Promise<{ text: string; confidence: number }> => {
  try {
    const formData = new FormData();
    formData.append('filename', imageFile.name);
    formData.append('file', imageFile);
    formData.append('apikey', 'K87899142591');
    formData.append('language', 'eng');

    const response = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      body: formData,
    });

    const data = (await response.json()) as any;

    if (!data.IsErroredOnProcessing && data.ParsedText) {
      return {
        text: data.ParsedText,
        confidence: 0.85,
      };
    }

    return { text: '', confidence: 0 };
  } catch (error) {
    console.error('OCR.space error:', error);
    throw error;
  }
};

/**
 * HEIC → JPG
 */
export const convertHEICToJPG = async (file: File): Promise<File> => {
  try {
    const heic2any = (window as any).heic2any;
    if (heic2any) {
      const jpgBlob = await heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: 0.95,
      });
      return new File([jpgBlob], file.name.replace('.heic', '.jpg'), {
        type: 'image/jpeg',
      });
    }
  } catch (error) {
    console.warn('HEIC conversion failed');
  }

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
              resolve(
                new File([blob], file.name.replace('.heic', '.jpg'), {
                  type: 'image/jpeg',
                })
              );
            } else {
              reject(new Error('Canvas conversion failed'));
            }
          },
          'image/jpeg',
          0.95
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
 * MINIMAL PREPROCESSING
 */
export const preprocessImage = async (img: HTMLImageElement): Promise<HTMLCanvasElement> => {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context failed');

  ctx.drawImage(img, 0, 0);
  return canvas;
};

/**
 * PSM 4 - RECEIPTS/INVOICES
 */
export const extractTextFromImagePSM4 = async (
  file: File,
  onProgress?: (progress: number) => void
): Promise<OCRResult> => {
  try {
    onProgress?.(10);

    let imageFile = file;
    if (file.type === 'image/heic' || file.name.endsWith('.heic')) {
      console.log('📱 Converting HEIC to JPG...');
      imageFile = await convertHEICToJPG(file);
      onProgress?.(20);
    }

    const img = document.createElement('img');
    const url = URL.createObjectURL(imageFile);

    return new Promise((resolve, reject) => {
      img.onload = async () => {
        try {
          onProgress?.(30);

          const processedCanvas = await preprocessImage(img);
          onProgress?.(50);

          const worker = await getWorker();

          console.log('🤖 Running OCR with PSM 4 (receipts/invoices)...');
          await worker.setParameters({
            tessedit_pageseg_mode: 4,
          });

          const result = await worker.recognize(processedCanvas);
          const confidence = result.data.confidence;

          onProgress?.(100);

          resolve({
            text: result.data.text,
            confidence,
            pages: [
              {
                pageNumber: 1,
                text: result.data.text,
                confidence,
              },
            ],
            engine: 'tesseract-psm4',
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
    console.error('Image OCR error (PSM4):', error);
    throw error;
  }
};

/**
 * PSM 11 - SPARSE TEXT/BAD PHOTOS
 */
export const extractTextFromImagePSM11 = async (
  file: File,
  onProgress?: (progress: number) => void
): Promise<OCRResult> => {
  try {
    onProgress?.(10);

    let imageFile = file;
    if (file.type === 'image/heic' || file.name.endsWith('.heic')) {
      console.log('📱 Converting HEIC to JPG...');
      imageFile = await convertHEICToJPG(file);
      onProgress?.(20);
    }

    const img = document.createElement('img');
    const url = URL.createObjectURL(imageFile);

    return new Promise((resolve, reject) => {
      img.onload = async () => {
        try {
          onProgress?.(30);

          const processedCanvas = await preprocessImage(img);
          onProgress?.(50);

          const worker = await getWorker();

          console.log('🤖 Running OCR with PSM 11 (sparse text/bad photos)...');
          await worker.setParameters({
            tessedit_pageseg_mode: 11,
          });

          const result = await worker.recognize(processedCanvas);
          const confidence = result.data.confidence;

          onProgress?.(100);

          resolve({
            text: result.data.text,
            confidence,
            pages: [
              {
                pageNumber: 1,
                text: result.data.text,
                confidence,
              },
            ],
            engine: 'tesseract-psm11',
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
    console.error('Image OCR error (PSM11):', error);
    throw error;
  }
};

/**
 * SMART ROUTING
 */
export const extractTextFromImageSmart = async (
  file: File,
  onProgress?: (progress: number) => void
): Promise<OCRResult> => {
  try {
    onProgress?.(10);

    console.log('📄 Attempting PSM 4 (receipt/invoice mode)...');
    const result_psm4 = await extractTextFromImagePSM4(file, onProgress);

    console.log(`PSM 4 confidence: ${result_psm4.confidence.toFixed(1)}%`);

    if (result_psm4.confidence >= 70) {
      console.log('✅ PSM 4 good enough!');
      return result_psm4;
    }

    console.log('⚠️  PSM 4 confidence low, trying PSM 11 (sparse text)...');
    const result_psm11 = await extractTextFromImagePSM11(file, onProgress);

    console.log(`PSM 11 confidence: ${result_psm11.confidence.toFixed(1)}%`);

    if (result_psm11.confidence >= 65) {
      console.log('✅ PSM 11 good enough!');
      return result_psm11;
    }

    console.log('🆘 Both PSM modes failed, trying OCR.space...');
    const result_space = await recognizeWithOCRSpace(file);

    if (result_space.text && result_space.text.length > 10) {
      console.log('✅ OCR.space saved the day!');
      onProgress?.(100);
      return {
        text: result_space.text,
        confidence: result_space.confidence,
        pages: [
          {
            pageNumber: 1,
            text: result_space.text,
            confidence: result_space.confidence,
          },
        ],
        engine: 'ocr-space',
      };
    }

    console.log('⚠️  All methods attempted, returning best result');
    return result_psm11.confidence > result_psm4.confidence
      ? result_psm11
      : result_psm4;
  } catch (error) {
    console.error('Smart OCR error:', error);
    throw error;
  }
};

/**
 * PDF extraction
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

    await worker.setParameters({
      tessedit_pageseg_mode: 4,
    });

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      onProgress?.((pageNum / pdf.numPages) * 50);

      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 3 });

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

    const averageConfidence =
      pages.length > 0 ? totalConfidence / pages.length : 0;
    return {
      text: allText.trim(),
      confidence: averageConfidence,
      pages,
      engine: 'tesseract-psm4',
    };
  } catch (error) {
    console.error('PDF OCR error:', error);
    throw error;
  }
};

/**
 * BASIC EXTRACTION (fallback if Claude unavailable)
 */
function extractInvoiceDataBasic(ocrText: string): InvoiceData {
  const lines = ocrText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let supplierName = 'Onbekend';
  let invoiceNumber = `INV-${Date.now()}`;
  let invoiceDate = new Date();

  for (let i = 0; i < Math.min(15, lines.length); i++) {
    const line = lines[i];
    if (line.length > 3 && !line.match(/^\d/) && line.match(/[A-Z]/)) {
      supplierName = line;
      break;
    }
  }

  const datePattern = /(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/;
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

  const amountPattern = /€?\s*([\d.,]+)/g;
  const amounts: number[] = [];
  let match;
  while ((match = amountPattern.exec(ocrText)) !== null) {
    const amount = parseAmount(match[1]);
    if (amount > 0 && amount < 10000) {
      amounts.push(amount);
    }
  }

  const totalInclVat = amounts.length > 0 ? Math.max(...amounts) : 0;
  const subtotalExclVat = totalInclVat / 1.21;
  const vatAmount = totalInclVat - subtotalExclVat;

  console.log('\n========== 📄 INVOICE EXTRACTED (Basic) ==========');
  console.log('Supplier:        ', supplierName);
  console.log('Invoice Number:  ', invoiceNumber);
  console.log('Date:            ', invoiceDate.toLocaleDateString('nl-NL'));
  console.log('Incl. BTW:       ', `€ ${totalInclVat.toFixed(2)}`);
  console.log('=================================================\n');

  return {
    supplierName,
    invoiceNumber,
    invoiceDate,
    amount: totalInclVat,
    subtotal: subtotalExclVat,
    vatAmount,
    vatRate: 21,
    totalInclVat,
    rawText: ocrText,
  };
}

/**
 * MAIN FUNCTION - Always uses Claude via Netlify function
 */
export const processInvoiceFile = async (
  file: File,
  onProgress?: (progress: number) => void
): Promise<OCRResult & { invoiceData: InvoiceData }> => {
  try {
    let ocrResult: OCRResult;

    if (file.type === 'application/pdf') {
      ocrResult = await extractTextFromPDF(file, onProgress);
    } else if (
      file.type.startsWith('image/') ||
      file.type === 'image/heic' ||
      file.name.endsWith('.heic')
    ) {
      ocrResult = await extractTextFromImageSmart(file, onProgress);
    } else {
      throw new Error(`Unsupported file type: ${file.type}`);
    }

    console.log('=== RAW OCR TEXT ===');
    console.log(ocrResult.text);
    console.log('=== END RAW TEXT ===');

    // Always try Claude first (via Netlify function), fallback to basic
    const invoiceData = await extractWithClaude(ocrResult.text);

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