const PROXY_URL = 'https://internedata.nl/proxy2.php';
const BASE_FOLDER = 'FLG-Administratie';

export const uploadFile = async (
  file: File,
  companyName: string,
  folderType: string = 'Inkoop'
): Promise<{ success: boolean; fileUrl: string }> => {
  const formData = new FormData();

  // Send folder path as separate field
  const folderPath = `${BASE_FOLDER}/${companyName}/${folderType}`;
  const timestamp = Date.now();
  const fileName = `${timestamp}_${file.name}`;

  formData.append('file', file);
  formData.append('folder', folderPath);
  formData.append('filename', fileName);

  const response = await fetch(PROXY_URL, {
    method: 'POST',
    body: formData,
  });

  // Get response as text first
  const responseText = await response.text();

  // Try to parse as JSON
  let result;
  try {
    result = JSON.parse(responseText);
  } catch {
    console.error('Invalid JSON from proxy:', responseText);
    throw new Error('Upload server returned invalid response');
  }

  if (!response.ok || !result.success) {
    throw new Error(result.error || 'Upload failed');
  }

  return {
    success: true,
    fileUrl: result.url,
  };
};
