import type { Handler, HandlerEvent } from '@netlify/functions';
import { google } from 'googleapis';
import { Readable } from 'stream';

// Root folder ID for FLG-Administratie (shared with service account)
const ROOT_FOLDER_ID = '1EZfv49Cq4HndtSKp_jqd2QCEsw0qVrYr';

// Parse private key from environment - handle various formats
function parsePrivateKey(key: string | undefined): string {
  if (!key) return '';

  // First, handle escaped newlines (\\n -> \n)
  let parsed = key.replace(/\\n/g, '\n');

  // Also handle double-escaped newlines (\\\\n -> \n)
  parsed = parsed.replace(/\\\\n/g, '\n');

  // Trim any extra whitespace
  parsed = parsed.trim();

  // Ensure proper PEM format with newlines
  if (parsed.includes('-----BEGIN') && !parsed.includes('\n-----BEGIN')) {
    // Key might be on single line, try to fix it
    parsed = parsed
      .replace(/-----BEGIN PRIVATE KEY-----\s*/g, '-----BEGIN PRIVATE KEY-----\n')
      .replace(/\s*-----END PRIVATE KEY-----/g, '\n-----END PRIVATE KEY-----');
  }

  return parsed;
}

// Service Account config - private key comes from environment
const SERVICE_ACCOUNT = {
  type: 'service_account',
  project_id: 'alloon',
  private_key_id: '6855692f9b9944b75859ea43bb12ad822c7a1518',
  private_key: parsePrivateKey(process.env.GOOGLE_DRIVE_PRIVATE_KEY),
  client_email: 'firebase-adminsdk-fbsvc@alloon.iam.gserviceaccount.com',
  client_id: '116088092692294770452',
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
};

// Create JWT auth client
function getAuthClient() {
  return new google.auth.JWT(
    SERVICE_ACCOUNT.client_email,
    undefined,
    SERVICE_ACCOUNT.private_key,
    ['https://www.googleapis.com/auth/drive']
  );
}

// Find or create folder
async function findOrCreateFolder(
  drive: any,
  folderName: string,
  parentId: string
): Promise<string> {
  const response = await drive.files.list({
    q: `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name)',
    spaces: 'drive',
  });

  if (response.data.files && response.data.files.length > 0) {
    return response.data.files[0].id!;
  }

  const createResponse = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
  });

  return createResponse.data.id!;
}

// Parse multipart form data (simple implementation)
function parseMultipart(body: string, boundary: string): { fields: Record<string, string>; file?: { name: string; type: string; data: Buffer } } {
  const fields: Record<string, string> = {};
  let file: { name: string; type: string; data: Buffer } | undefined;

  const parts = body.split(`--${boundary}`).filter(part => part.trim() && part.trim() !== '--');

  for (const part of parts) {
    const [headerSection, ...contentParts] = part.split('\r\n\r\n');
    const content = contentParts.join('\r\n\r\n').replace(/\r\n$/, '');

    const nameMatch = headerSection.match(/name="([^"]+)"/);
    const filenameMatch = headerSection.match(/filename="([^"]+)"/);
    const contentTypeMatch = headerSection.match(/Content-Type:\s*([^\r\n]+)/i);

    if (nameMatch) {
      if (filenameMatch) {
        // It's a file
        file = {
          name: filenameMatch[1],
          type: contentTypeMatch?.[1] || 'application/octet-stream',
          data: Buffer.from(content, 'binary'),
        };
      } else {
        // It's a field
        fields[nameMatch[1]] = content.trim();
      }
    }
  }

  return { fields, file };
}

export const handler: Handler = async (event: HandlerEvent) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle preflight
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
    // Check for private key
    if (!process.env.GOOGLE_DRIVE_PRIVATE_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'GOOGLE_DRIVE_PRIVATE_KEY not configured' }),
      };
    }

    // Parse the multipart form data
    const contentType = event.headers['content-type'] || '';
    const boundaryMatch = contentType.match(/boundary=(.+)/);

    if (!boundaryMatch || !event.body) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid request - missing multipart data' }),
      };
    }

    const body = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('binary')
      : event.body;

    const { fields, file } = parseMultipart(body, boundaryMatch[1]);

    if (!file) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No file uploaded' }),
      };
    }

    const companyName = fields.companyName || 'Unknown';
    const companyId = fields.companyId || '';
    const folderType = fields.folderType || 'Inkoop';
    const metadata = fields.metadata ? JSON.parse(fields.metadata) : {};

    // Initialize Drive API
    const auth = getAuthClient();
    const drive = google.drive({ version: 'v3', auth });

    // Create folder structure
    const companyFolderId = await findOrCreateFolder(drive, companyName, ROOT_FOLDER_ID);
    const typeFolderId = await findOrCreateFolder(drive, folderType, companyFolderId);

    // Generate unique filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const uniqueFilename = `${timestamp}_${file.name}`;

    // Upload file
    const fileStream = Readable.from(file.data);
    const uploadResponse = await drive.files.create({
      requestBody: {
        name: uniqueFilename,
        parents: [typeFolderId],
        description: JSON.stringify({
          companyId,
          ...metadata,
          uploadedAt: new Date().toISOString(),
        }),
      },
      media: {
        mimeType: file.type,
        body: fileStream,
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
    console.error('Error stack:', error.stack);

    // Provide more helpful error messages
    let errorMessage = error.message;
    if (errorMessage.includes('DECODER') || errorMessage.includes('unsupported')) {
      errorMessage = 'Private key format error - please check GOOGLE_DRIVE_PRIVATE_KEY environment variable format';
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Upload failed',
        message: errorMessage,
        details: error.code || 'unknown',
      }),
    };
  }
};
