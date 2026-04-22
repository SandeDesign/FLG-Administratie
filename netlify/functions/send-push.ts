// HTTP endpoint om een push te sturen vanuit de frontend.
//
// POST /.netlify/functions/send-push  (of via /api/send-push redirect)
//
// Headers:
//   Authorization: Bearer <firebase-id-token>
//   Content-Type: application/json
//
// Body:
//   {
//     "userIds": string[],
//     "title": string,
//     "body": string,
//     "url"?: string,
//     "taskId"?: string,
//     "category"?: string
//   }

import type { Handler } from '@netlify/functions';
import { getAuthAdmin } from './_lib/firebaseAdmin';
import { sendPushToUsers, type PushPayload } from './_lib/push';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const jsonResponse = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: CORS_HEADERS,
  body: JSON.stringify(body),
});

const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  // Verifieer Firebase ID token
  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return jsonResponse(401, { error: 'Missing or invalid Authorization header' });
  }
  const idToken = match[1];

  try {
    await getAuthAdmin().verifyIdToken(idToken);
  } catch (err) {
    console.error('[send-push] ID token verificatie mislukt:', err);
    return jsonResponse(401, { error: 'Invalid ID token' });
  }

  // Parse body
  let payload: {
    userIds?: string[];
    title?: string;
    body?: string;
    url?: string;
    taskId?: string;
    category?: string;
  };
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }

  if (
    !Array.isArray(payload.userIds) ||
    payload.userIds.length === 0 ||
    typeof payload.title !== 'string' ||
    typeof payload.body !== 'string'
  ) {
    return jsonResponse(400, {
      error: 'userIds (non-empty array), title, body zijn verplicht',
    });
  }

  const pushPayload: PushPayload = {
    title: payload.title,
    body: payload.body,
    url: payload.url,
    taskId: payload.taskId,
    category: payload.category,
  };

  try {
    const result = await sendPushToUsers(payload.userIds, pushPayload);
    return jsonResponse(200, { ok: true, ...result });
  } catch (err) {
    console.error('[send-push] sturen mislukt:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return jsonResponse(500, { error: message });
  }
};

export { handler };
