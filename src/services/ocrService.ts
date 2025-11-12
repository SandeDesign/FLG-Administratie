import * as pdfjsLib from 'pdfjs-dist';
import Tesseract from 'tesseract.js';

// Set worker path for pdf.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export interface OCRResult {
  text: string;
  confidence: number;
  pages: {
    pageNumber: number;
    text: string;
    confidence: number;
  }[];
}

/**
 * Extract text from PDF using OCR
 */
export const extractTextFromPDF = async (file: File, onProgress?: (progress: number) => void): Promise<OCRResult> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    const pages = [];
    let totalConfidence = 0;
    let allText = '';

    // Process each page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      if (onProgress) {
        onProgress((pageNum / pdf.numPages) * 50); // First 50% for page extraction
      }

      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2 });
      
      // Render page to canvas
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

      // Run OCR on canvas image
      console.log(`Running OCR on page ${pageNum} of ${pdf.numPages}...`);
      
      const result = await Tesseract.recognize(canvas, 'eng', {
        logger: (m: any) => {
          console.log('OCR progress:', m);
        },
      });

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
        onProgress(50 + (pageNum / pdf.numPages) * 50); // Second 50% for OCR
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
export const extractTextFromImage = async (file: File, onProgress?: (progress: number) => void): Promise<OCRResult> => {
  try {
    // Create image element
    const img = document.createElement('img');
    const url = URL.createObjectURL(file);

    return new Promise((resolve, reject) => {
      img.onload = async () => {
        try {
          console.log('Running OCR on image...');
          onProgress?.(25);

          const result = await Tesseract.recognize(img, 'eng', {
            logger: (m: any) => {
              // Update progress: 25% + 75% of OCR progress
              if (m.progress) {
                onProgress?.(25 + m.progress * 75);
              }
              console.log('OCR progress:', m);
            },
          });

          const text = result.data.text;
          const confidence = result.data.confidence;

          console.log(`OCR completed for image. Confidence: ${confidence}%`);
          onProgress?.(100);

          resolve({
            text,
            confidence,
            pages: [{
              pageNumber: 1,
              text,
              confidence,
            }],
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
    throw new Error(`Image OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Extract invoice data from OCR text
 */
export const extractInvoiceData = (ocrText: string) => {
  const lines = ocrText.split('\n').filter(line => line.trim());
  
  // Simple regex patterns for Dutch invoices
  const supplierMatch = ocrText.match(/(?:Van|From|Leverancier)[\s:]*([^\n]+)/i);
  const invoiceNumberMatch = ocrText.match(/(?:Factuur|Invoice|Factuurnummer|Nummer)[\s:]*([A-Z0-9\-]+)/i);
  const dateMatch = ocrText.match(/(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/);
  const amountMatch = ocrText.match(/(?:Totaal|Total|Bedrag|Totale)[\s:]*€?\s*([0-9.,]+)/i);
  const dueDateMatch = ocrText.match(/(?:Vervaldatum|Due Date|Betaaltermijn)[\s:]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i);

  return {
    supplierName: supplierMatch ? supplierMatch[1].trim() : 'Onbekend',
    invoiceNumber: invoiceNumberMatch ? invoiceNumberMatch[1].trim() : `INV-${Date.now()}`,
    invoiceDate: dateMatch ? new Date(dateMatch[1]) : new Date(),
    amount: amountMatch ? parseFloat(amountMatch[1].replace(',', '.')) : 0,
    dueDate: dueDateMatch ? new Date(dueDateMatch[1]) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
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