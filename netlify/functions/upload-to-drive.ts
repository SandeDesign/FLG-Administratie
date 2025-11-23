import type { Handler } from '@netlify/functions';
import { google } from 'googleapis';
import { Readable } from 'stream';

const FOLDER_ID = '1EZfv49Cq4HndtSKp_jqd2QCEsw0qVrYr';

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

  try {
    // Get private key from env
    const rawKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY;
    if (!rawKey) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'GOOGLE_DRIVE_PRIVATE_KEY not configured' }) };
    }

    // Fix newlines - Netlify stores literal \n, need actual newlines
    const privateKey = rawKey.replace(/\\n/g, '\n');

    // Create auth
    const auth = new google.auth.JWT(
      'firebase-adminsdk-fbsvc@alloon.iam.gserviceaccount.com',
      undefined,
      privateKey,
      ['https://www.googleapis.com/auth/drive.file']
    );

    const drive = google.drive({ version: 'v3', auth });

    // Parse multipart
    const contentType = event.headers['content-type'] || '';
    const boundary = contentType.split('boundary=')[1];
    if (!boundary || !event.body) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request' }) };
    }

    const body = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('binary')
      : event.body;

    const { fields, file } = parseMultipart(body, boundary);
    if (!file) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'No file' }) };
    }

    // Get or create company folder
    const companyName = fields.companyName || 'Algemeen';
    const companyFolderId = await getOrCreateFolder(drive, companyName, FOLDER_ID);

    // Get or create type folder (Inkoop/Verkoop)
    const folderType = fields.folderType || 'Inkoop';
    const typeFolderId = await getOrCreateFolder(drive, folderType, companyFolderId);

    // Upload
    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.name}`;

    const res = await drive.files.create({
      requestBody: { name: fileName, parents: [typeFolderId] },
      media: { mimeType: file.type, body: Readable.from(file.data) },
      fields: 'id,webViewLink',
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        driveFileId: res.data.id,
        driveWebLink: res.data.webViewLink,
      }),
    };
  } catch (err: any) {
    console.error('Error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};

async function getOrCreateFolder(drive: any, name: string, parentId: string): Promise<string> {
  const q = `name='${name}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const list = await drive.files.list({ q, fields: 'files(id)' });

  if (list.data.files?.length) {
    return list.data.files[0].id;
  }

  const created = await drive.files.create({
    requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
    fields: 'id',
  });
  return created.data.id;
}

function parseMultipart(body: string, boundary: string) {
  const fields: Record<string, string> = {};
  let file: { name: string; type: string; data: Buffer } | undefined;

  body.split('--' + boundary).forEach(part => {
    if (!part.trim() || part.trim() === '--') return;

    const [head, ...rest] = part.split('\r\n\r\n');
    const content = rest.join('\r\n\r\n').replace(/\r\n$/, '');

    const nameMatch = head.match(/name="([^"]+)"/);
    const fileMatch = head.match(/filename="([^"]+)"/);
    const typeMatch = head.match(/Content-Type:\s*(\S+)/i);

    if (nameMatch) {
      if (fileMatch) {
        file = { name: fileMatch[1], type: typeMatch?.[1] || 'application/octet-stream', data: Buffer.from(content, 'binary') };
      } else {
        fields[nameMatch[1]] = content.trim();
      }
    }
  });

  return { fields, file };
}

export { handler };
