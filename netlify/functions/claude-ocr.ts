import type { Handler, HandlerEvent } from '@netlify/functions';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

export const handler: Handler = async (event: HandlerEvent) => {
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
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    if (!ANTHROPIC_API_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }),
      };
    }

    const { ocrText } = JSON.parse(event.body || '{}');

    if (!ocrText) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No OCR text provided' }),
      };
    }

    const prompt = `Je bent een expert in het lezen van Nederlandse facturen en bonnen. Extraheer de volgende gegevens uit deze OCR tekst.

OCR TEKST:
${ocrText}

EXTRACT DEZE VELDEN (reageer ALLEEN met geldige JSON, geen markdown):
{
  "supplierName": "bedrijfsnaam of leverancier",
  "invoiceNumber": "factuurnummer of bonnummer",
  "invoiceDate": "datum in YYYY-MM-DD formaat",
  "totalAmount": "TOTAAL bedrag inclusief BTW (hoogste bedrag)",
  "subtotalExclVat": "bedrag exclusief BTW indien beschikbaar",
  "vatAmount": "BTW bedrag indien zichtbaar"
}

Regels:
- Bedragen: converteer 85,92 of €85.92 naar 85.92
- Datum: elk formaat is OK, converteer naar YYYY-MM-DD
- TOTAAL/TOTAL/Te betalen = eindtotaal
- Als onduidelijk, maak beste schatting
- Antwoord MOET geldige JSON zijn`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API error:', errorText);
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ error: `Anthropic API error: ${response.status}` }),
      };
    }

    const data = await response.json() as any;
    const responseText = data.content[0].text;

    // Parse JSON from response
    let invoiceData;
    try {
      invoiceData = JSON.parse(responseText);
    } catch (e) {
      // Try to extract JSON from markdown code block
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        invoiceData = JSON.parse(jsonMatch[1]);
      } else {
        throw new Error('Could not parse Claude response as JSON');
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        invoiceData,
      }),
    };

  } catch (error: any) {
    console.error('Claude OCR error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Claude OCR failed',
        message: error.message,
      }),
    };
  }
};
