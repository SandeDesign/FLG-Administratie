import type { Handler } from '@netlify/functions';
import { google } from 'googleapis';
import { Readable } from 'stream';

const ROOT_FOLDER_ID = '1EZfv49Cq4HndtSKp_jqd2QCEsw0qVrYr';

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
    // Get and parse private key
    const rawKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY;
    if (!rawKey) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'GOOGLE_DRIVE_PRIVATE_KEY not set' }) };
    }

    // Parse the private key - handle Netlify's encoding
    let privateKey = rawKey;

    // If it looks like it might be base64 (no dashes at start)
    if (!privateKey.includes('-----BEGIN')) {
      try {
        privateKey = Buffer.from(privateKey, 'base64').toString('utf8');
      } catch (e) {
        // Not base64
      }
    }

    // Replace literal \n with actual newlines
    privateKey = privateKey.replace(/\\n/g, '\n');

    // Log for debugging (first/last chars only)
    console.log('Key starts:', privateKey.substring(0, 30));
    console.log('Key ends:', privateKey.substring(privateKey.length - 30));

    // Create auth client
    const auth = new google.auth.JWT({
      email: 'firebase-adminsdk-fbsvc@alloon.iam.gserviceaccount.com',
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });

    const drive = google.drive({ version: 'v3', auth });

    // Parse multipart form data
    const contentType = event.headers['content-type'] || '';
    const boundaryMatch = contentType.match(/boundary=(.+)/);
    if (!boundaryMatch || !event.body) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid multipart data' }) };
    }

    const body = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('binary')
      : event.body;

    const { fields, file } = parseMultipart(body, boundaryMatch[1]);
    if (!file) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'No file uploaded' }) };
    }

    const companyName = fields.companyName || 'Unknown';
    const folderType = fields.folderType || 'Inkoop';

    // Find or create company folder
    const companyFolderId = await findOrCreateFolder(drive, companyName, ROOT_FOLDER_ID);
    const typeFolderId = await findOrCreateFolder(drive, folderType, companyFolderId);

    // Upload file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${timestamp}_${file.name}`;

    const uploadResponse = await drive.files.create({
      requestBody: {
        name: filename,
        parents: [typeFolderId],
      },
      media: {
        mimeType: file.type,
        body: Readable.from(file.data),
      },
      fields: 'id, name, webViewLink',
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        driveFileId: uploadResponse.data.id,
        driveWebLink: uploadResponse.data.webViewLink,
        filename: uploadResponse.data.name,
      }),
    };
  } catch (error: any) {
    console.error('Upload error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Upload failed', message: error.message }),
    };
  }
};

async function findOrCreateFolder(drive: any, name: string, parentId: string): Promise<string> {
  const response = await drive.files.list({
    q: `name='${name}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
  });

  if (response.data.files?.length > 0) {
    return response.data.files[0].id;
  }

  const createResponse = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
  });

  return createResponse.data.id!;
}

function parseMultipart(body: string, boundary: string) {
  const fields: Record<string, string> = {};
  let file: { name: string; type: string; data: Buffer } | undefined;

  const parts = body.split(`--${boundary}`).filter(p => p.trim() && p.trim() !== '--');

  for (const part of parts) {
    const [headerSection, ...contentParts] = part.split('\r\n\r\n');
    const content = contentParts.join('\r\n\r\n').replace(/\r\n$/, '');

    const nameMatch = headerSection.match(/name="([^"]+)"/);
    const filenameMatch = headerSection.match(/filename="([^"]+)"/);
    const contentTypeMatch = headerSection.match(/Content-Type:\s*([^\r\n]+)/i);

    if (nameMatch) {
      if (filenameMatch) {
        file = {
          name: filenameMatch[1],
          type: contentTypeMatch?.[1] || 'application/octet-stream',
          data: Buffer.from(content, 'binary'),
        };
      } else {
        fields[nameMatch[1]] = content.trim();
      }
    }
  }

  return { fields, file };
}

export { handler };
