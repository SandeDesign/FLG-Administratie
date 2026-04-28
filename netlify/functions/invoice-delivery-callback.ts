// Webhook endpoint voor Make.com om de bezorgstatus van een factuur terug te melden.
//
// Make.com roept dit endpoint aan nadat de factuur-email is verstuurd.
//
// POST /api/invoice-delivery-callback
//
// Body:
//   {
//     "invoiceId": string,
//     "status": "delivered" | "failed",
//     "secret": string,       // komt overeen met DELIVERY_CALLBACK_SECRET env var
//     "error"?: string        // foutmelding bij status "failed"
//   }
//
// Env vars:
//   FIREBASE_SERVICE_ACCOUNT_JSON  — Firebase service account (vol JSON)
//   DELIVERY_CALLBACK_SECRET        — gedeeld geheim met Make.com scenario

import type { Handler } from '@netlify/functions';
import { getDb } from './_lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const json = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: CORS_HEADERS,
  body: JSON.stringify(body),
});

const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    console.error('[invoice-delivery-callback] FIREBASE_SERVICE_ACCOUNT_JSON ontbreekt');
    return json(503, { error: 'Server niet geconfigureerd' });
  }

  let body: { invoiceId?: string; status?: string; secret?: string; error?: string };
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Ongeldige JSON body' });
  }

  const { invoiceId, status, secret, error: deliveryError } = body;

  // Valideer geheim als het is ingesteld
  const expectedSecret = process.env.DELIVERY_CALLBACK_SECRET;
  if (expectedSecret && secret !== expectedSecret) {
    console.warn('[invoice-delivery-callback] Ongeldig geheim ontvangen');
    return json(401, { error: 'Ongeldig geheim' });
  }

  if (!invoiceId || !status) {
    return json(400, { error: 'invoiceId en status zijn verplicht' });
  }

  if (status !== 'delivered' && status !== 'failed') {
    return json(400, { error: 'status moet "delivered" of "failed" zijn' });
  }

  try {
    const db = getDb();
    const invoiceRef = db.collection('outgoingInvoices').doc(invoiceId);
    const snap = await invoiceRef.get();

    if (!snap.exists) {
      return json(404, { error: 'Factuur niet gevonden' });
    }

    const updateData: Record<string, unknown> = {
      deliveryStatus: status,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (status === 'delivered') {
      updateData.deliveredAt = FieldValue.serverTimestamp();
      updateData.deliveryError = null;
    } else {
      updateData.deliveryError = deliveryError || 'Onbekende fout bij bezorging';
    }

    await invoiceRef.update(updateData);

    console.log(`[invoice-delivery-callback] Factuur ${invoiceId} bijgewerkt naar ${status}`);
    return json(200, { success: true, invoiceId, status });
  } catch (err) {
    console.error('[invoice-delivery-callback] Fout:', err);
    return json(500, { error: 'Interne serverfout' });
  }
};

export { handler };
