const CLAUDE_PROXY = 'https://internedata.nl/claude-vision-ocr.php';

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

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function parseInvoiceResponse(d: any): InvoiceData {
  const total = Number(d.totalAmount) || 0;
  const sub = Number(d.subtotal) || Number(d.subtotalExclVat) || (total ? total / 1.21 : 0);
  const vat = Number(d.vatAmount) || (total ? total - sub : 0);

  return {
    supplierName: d.supplierName || 'Onbekend',
    invoiceNumber: d.invoiceNumber || '',
    invoiceDate: d.invoiceDate ? new Date(d.invoiceDate) : new Date(),
    amount: total,
    subtotal: sub,
    vatAmount: vat,
    vatRate: 21,
    totalInclVat: total,
    description: d.description || '',
    rawText: `${d.supplierName || ''} - ${d.invoiceNumber || ''}`,
  };
}

async function callClaudeProxy(body: Record<string, string>): Promise<InvoiceData> {
  const res = await fetch(CLAUDE_PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`PHP proxy error (HTTP ${res.status}): ${text.substring(0, 300)}`);
  }

  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`PHP proxy returned invalid JSON: ${text.substring(0, 300)}`);
  }

  if (!json.success) {
    throw new Error(`Claude extraction failed: ${json.error || 'unknown'} ${json.details ? '- ' + JSON.stringify(json.details).substring(0, 200) : ''}`);
  }

  if (!json.invoiceData) {
    throw new Error('Claude returned success but no invoiceData');
  }

  return parseInvoiceResponse(json.invoiceData);
}

// Main: upload file → base64 → PHP proxy → Claude Vision → invoice data
export async function processInvoiceFile(
  file: File,
  onProgress?: (n: number) => void
): Promise<OCRResult & { invoiceData: InvoiceData }> {
  onProgress?.(10);

  const base64 = await fileToBase64(file);
  const mediaType = file.type || 'application/pdf';

  onProgress?.(30);

  const invoiceData = await callClaudeProxy({
    fileBase64: base64,
    fileMediaType: mediaType,
  });

  onProgress?.(100);

  return {
    text: invoiceData.rawText,
    confidence: 95,
    pages: [{ pageNumber: 1, text: invoiceData.rawText, confidence: 95 }],
    invoiceData,
  };
}

// For re-OCR / email imports: send file URL instead of base64
export async function extractWithClaudeVisionUrl(fileUrl: string): Promise<InvoiceData | null> {
  try {
    return await callClaudeProxy({ fileUrl });
  } catch (err) {
    console.error('extractWithClaudeVisionUrl failed:', err);
    return null;
  }
}
