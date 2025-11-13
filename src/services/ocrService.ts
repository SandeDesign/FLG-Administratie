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

let workerInstance: any = null;

const getWorker = async () => {
  if (!workerInstance) {
    workerInstance = await createWorker('eng', 1, {
      logger: () => {},
    });
  }
  return workerInstance;
};

/**
 * ✅ GRATIS FALLBACK: OCR.space API (geen auth nodig!)
 */
export const recognizeWithOCRSpace = async (
  imageFile: File
): Promise<{ text: string; confidence: number }> => {
  try {
    const formData = new FormData();
    formData.append('filename', imageFile.name);
    formData.append('file', imageFile);
    formData.append('apikey', 'K87899142591'); // Free tier
    formData.append('language', 'eng');

    const response = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      body: formData,
    });

    const data = (await response.json()) as any;

    if (!data.IsErroredOnProcessing && data.ParsedText) {
      return {
        text: data.ParsedText,
        confidence: 0.85, // Estimate
      };
    }

    return { text: '', confidence: 0 };
  } catch (error) {
    console.error('OCR.space error:', error);
    throw error;
  }
};

/**
 * ✅ HEIC → JPG
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
    console.warn('HEIC conversion failed, fallback canvas:', error);
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
 * ✅ MINIMAL PREPROCESSING - let Tesseract do its job
 * Photo quality is already good - preprocessing was destroying it!
 */
export const preprocessImage = async (img: HTMLImageElement): Promise<HTMLCanvasElement> => {
  const canvas = document.createElement('canvas');

  // NO upscaling - photo already good resolution
  canvas.width = img.width;
  canvas.height = img.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context failed');

  // Draw image as-is
  ctx.drawImage(img, 0, 0);

  // That's it! NO aggressive preprocessing
  // Let Tesseract handle contrast/brightness internally
  return canvas;
};

/**
 * ✅ TESSERACT MET PSM 4 - RECEIPTS/INVOICES
 * PSM 4 = Assume a single column of text of variable sizes
 */
export const extractTextFromImagePSM4 = async (
  file: File,
  onProgress?: (progress: number) => void
): Promise<OCRResult> => {
  try {
    onProgress?.(10);

    // HEIC → JPG
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

          // ✅ INSTELLE PSM 4 VOOR RECEIPTS
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
 * ✅ TESSERACT MET PSM 11 - SLECHTE FOTO'S/SPARSE TEXT
 * PSM 11 = Sparse text. Find as much text as possible in no particular order.
 */
export const extractTextFromImagePSM11 = async (
  file: File,
  onProgress?: (progress: number) => void
): Promise<OCRResult> => {
  try {
    onProgress?.(10);

    // HEIC → JPG
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

          // ✅ INSTELLE PSM 11 VOOR SLECHTE FOTO'S
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
 * ✅ SMART ROUTING:
 * 1. Probeer PSM 4 (voor facturen/receipts)
 * 2. Confidence laag? → PSM 11 (sparse text)
 * 3. Nog steeds slecht? → OCR.space (GRATIS fallback)
 */
export const extractTextFromImageSmart = async (
  file: File,
  onProgress?: (progress: number) => void
): Promise<OCRResult> => {
  try {
    onProgress?.(10);

    // STAP 1: PSM 4 proberen
    console.log('📄 Attempting PSM 4 (receipt/invoice mode)...');
    const result_psm4 = await extractTextFromImagePSM4(file, onProgress);

    console.log(`PSM 4 confidence: ${result_psm4.confidence.toFixed(1)}%`);

    if (result_psm4.confidence >= 70) {
      console.log('✅ PSM 4 good enough!');
      return result_psm4;
    }

    // STAP 2: PSM 11 proberen (sparse text)
    console.log('⚠️  PSM 4 confidence low, trying PSM 11 (sparse text)...');
    const result_psm11 = await extractTextFromImagePSM11(file, onProgress);

    console.log(`PSM 11 confidence: ${result_psm11.confidence.toFixed(1)}%`);

    if (result_psm11.confidence >= 65) {
      console.log('✅ PSM 11 good enough!');
      return result_psm11;
    }

    // STAP 3: OCR.space fallback (GRATIS!)
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

    // Fallback: return best result
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

    // Use PSM 4 for PDFs (receipts/invoices)
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

// ... (rest van het bestand: parseNederlandsNumber, extractInvoiceData, etc.)
function parseNederlandsNumber(str: string): number {
  if (!str) return 0;
  let cleaned = str.replace(/€/g, '').replace(/\s/g, '').trim();
  cleaned = cleaned.replace(/\./g, '');
  cleaned = cleaned.replace(',', '.');
  return parseFloat(cleaned) || 0;
}

function extractAmount(text: string): number {
  const match = text.match(/€?\s*([\d\.]+,\d{1,2})/);
  if (match) {
    return parseNederlandsNumber(match[1]);
  }
  return 0;
}

function detectDocumentType(ocrText: string): 'invoice' | 'receipt' {
  const lower = ocrText.toLowerCase();

  if (lower.includes('totaal') && (lower.includes('prijs') || lower.includes('pomp'))) {
    return 'receipt';
  }

  if (
    lower.includes('factuurnummer') ||
    lower.includes('subtotaal') ||
    lower.includes('factuur')
  ) {
    return 'invoice';
  }

  return 'receipt';
}

export const extractInvoiceData = (ocrText: string) => {
  const lines = ocrText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const docType = detectDocumentType(ocrText);

  let supplierName = 'Onbekend';
  let invoiceNumber = `INV-${Date.now()}`;
  let invoiceDate = new Date();
  let subtotalExclVat = 0;
  let vatAmount = 0;
  let totalInclVat = 0;

  for (let i = 0; i < Math.min(15, lines.length); i++) {
    const line = lines[i];
    if (line.includes('PAGE') || line.includes('---') || line.length < 3)
      continue;
    if (
      line.match(/[A-Z][a-z]+.*(?:BV|Ltd|Inc|b\.v|B\.V|GROUP|EXPRESS|bv)/i) ||
      (line.length > 5 &&
        !line.match(/^\d/) &&
        line !== line.toLowerCase() &&
        line.match(/[A-Z]/))
    ) {
      supplierName = line;
      break;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();
    if (lower.includes('factuurnummer') || lower.includes('ticketnumber')) {
      const num =
        line.match(/:\s*([A-Z0-9\-\.]+)/)?.[1] ||
        lines[i + 1]?.match(/^([A-Z0-9\-\.]+)/)?.[1];
      if (num) {
        invoiceNumber = num;
        break;
      }
    }
  }

  const datePattern = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/;
  for (const line of lines) {
    const match = line.match(datePattern);
    if (match) {
      const day = parseInt(match[1]);
      const month = parseInt(match[2]);
      const year = parseInt(match[3]);
      if (
        month >= 1 &&
        month <= 12 &&
        day >= 1 &&
        day <= 31 &&
        year >= 2020 &&
        year <= 2030
      ) {
        invoiceDate = new Date(year, month - 1, day);
        break;
      }
    }
  }

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

  console.log('\n========== 📄 INVOICE EXTRACTED ==========');
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
    } else if (
      file.type.startsWith('image/') ||
      file.type === 'image/heic' ||
      file.name.endsWith('.heic')
    ) {
      ocrResult = await extractTextFromImageSmart(file, onProgress);
    } else {
      throw new Error(`Unsupported file type: ${file.type}`);
    }

    // ✅ DEBUG: LOG RAW TEXT
    console.log('=== RAW OCR TEXT ===');
    console.log(ocrResult.text);
    console.log('=== END RAW TEXT ===');

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