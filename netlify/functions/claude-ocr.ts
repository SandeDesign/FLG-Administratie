import type { Handler } from '@netlify/functions';

const handler: Handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

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
    const { ocrText } = JSON.parse(event.body || '{}');
    if (!ocrText) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'No ocrText' }) };
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: `Extract invoice data from this OCR text. Return ONLY valid JSON:
{
  "supplierName": "company name",
  "invoiceNumber": "invoice number",
  "invoiceDate": "YYYY-MM-DD",
  "totalAmount": 123.45,
  "subtotalExclVat": 102.02,
  "vatAmount": 21.43
}

OCR TEXT:
${ocrText}`
        }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Claude API error', details: err }) };
    }

    const data = await response.json() as any;
    const text = data.content[0].text;

    // Parse JSON (handle markdown code blocks)
    const clean = text.replace(/```json?\n?|\n?```/g, '').trim();
    const invoiceData = JSON.parse(clean);

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, invoiceData }) };
  } catch (err: any) {
    console.error('Error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};

export { handler };
