import type { Handler } from '@netlify/functions';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const EXTRACTION_PROMPT = `Je bent een expert Nederlandse factuur-scanner. Analyseer dit document (factuur, bon, of kassabon) en extraheer alle financiële gegevens.

Let op:
- Nederlandse bedragen gebruiken komma als decimaalteken (€ 1.234,56)
- BTW is meestal 21% of 9%
- Zoek naar: factuurnummer, factuurdatum, vervaldatum, bedragen, leveranciersnaam
- Als je iets niet kunt vinden, gebruik null

BELANGRIJK: Retourneer ALLEEN een JSON object, geen uitleg, geen tekst ervoor of erna:
{"supplierName": "bedrijfsnaam leverancier", "invoiceNumber": "factuurnummer", "invoiceDate": "YYYY-MM-DD", "dueDate": "YYYY-MM-DD of null", "subtotal": 100.00, "vatAmount": 21.00, "totalAmount": 121.00, "description": "korte omschrijving van de factuur"}`;

async function downloadFileAsBase64(url: string): Promise<{ base64: string; mediaType: string }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || 'application/octet-stream';
  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');

  // Determine media type
  let mediaType = contentType.split(';')[0].trim();

  // Normalize common types
  if (mediaType === 'application/octet-stream' || !mediaType) {
    // Try to guess from URL
    const urlLower = url.toLowerCase();
    if (urlLower.endsWith('.pdf')) mediaType = 'application/pdf';
    else if (urlLower.endsWith('.png')) mediaType = 'image/png';
    else if (urlLower.endsWith('.jpg') || urlLower.endsWith('.jpeg')) mediaType = 'image/jpeg';
    else if (urlLower.endsWith('.webp')) mediaType = 'image/webp';
    else mediaType = 'application/pdf'; // Default assumption for invoices
  }

  return { base64, mediaType };
}

const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { fileUrl, fileBase64, fileMediaType } = body;

    if (!fileUrl && !fileBase64) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'fileUrl or fileBase64 is required' }) };
    }

    // Get file data
    let base64: string;
    let mediaType: string;

    if (fileBase64) {
      base64 = fileBase64;
      mediaType = fileMediaType || 'application/pdf';
    } else {
      const downloaded = await downloadFileAsBase64(fileUrl);
      base64 = downloaded.base64;
      mediaType = downloaded.mediaType;
    }

    // Build the content block based on file type
    let fileContent: any;
    if (mediaType === 'application/pdf') {
      fileContent = {
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: base64,
        },
      };
    } else {
      // Image types: png, jpeg, webp, gif
      const imageMediaType = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(mediaType)
        ? mediaType
        : 'image/jpeg'; // fallback
      fileContent = {
        type: 'image',
        source: {
          type: 'base64',
          media_type: imageMediaType,
          data: base64,
        },
      };
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            fileContent,
            {
              type: 'text',
              text: EXTRACTION_PROMPT,
            },
          ],
        }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Anthropic Vision API error:', err);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Claude Vision API error', details: err }) };
    }

    const data = await response.json() as any;
    const text = data.content[0].text;
    const clean = text.replace(/```json?\n?|\n?```/g, '').trim();

    // Parse JSON from response
    let invoiceData;
    try {
      invoiceData = JSON.parse(clean);
    } catch {
      const jsonMatch = clean.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        invoiceData = JSON.parse(jsonMatch[0]);
      } else {
        console.error('No valid JSON in Claude Vision response:', clean);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Invalid JSON response from Claude Vision' }) };
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, invoiceData }),
    };
  } catch (err: any) {
    console.error('Claude Vision OCR error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};

export { handler };
