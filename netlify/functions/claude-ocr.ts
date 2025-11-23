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
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not set' }) };
  }

  try {
    const { ocrText } = JSON.parse(event.body || '{}');
    if (!ocrText) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'No ocrText provided' }) };
    }

    const prompt = `Je bent een expert in het lezen van Nederlandse facturen. Extraheer deze gegevens uit de OCR tekst.

OCR TEKST:
${ocrText}

Antwoord ALLEEN met geldige JSON (geen markdown):
{
  "supplierName": "bedrijfsnaam",
  "invoiceNumber": "factuurnummer",
  "invoiceDate": "YYYY-MM-DD",
  "totalAmount": 123.45,
  "subtotalExclVat": 102.02,
  "vatAmount": 21.43
}`;

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
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Anthropic error:', err);
      return { statusCode: response.status, headers, body: JSON.stringify({ error: 'Claude API error', details: err }) };
    }

    const data = await response.json() as any;
    let invoiceData;
    try {
      const text = data.content[0].text;
      invoiceData = JSON.parse(text.replace(/```json?\n?|\n?```/g, '').trim());
    } catch (e) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to parse Claude response' }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, invoiceData }) };
  } catch (error: any) {
    console.error('Error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};

export { handler };
