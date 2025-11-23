const PROXY_URL = 'https://internedata.nl/proxy.php';
const BASE_FOLDER = 'FLG-Administratie';

export const uploadFile = async (
  file: File,
  companyName: string,
  folderType: string = 'Inkoop'
): Promise<{ success: boolean; fileUrl: string }> => {
  const formData = new FormData();

  // Create filename with folder structure: FLG-Administratie/CompanyName/FolderType/timestamp_filename
  const timestamp = Date.now();
  const safeName = `${BASE_FOLDER}/${companyName}/${folderType}/${timestamp}_${file.name}`;

  // Rename file for folder structure
  const renamedFile = new File([file], safeName, { type: file.type });
  formData.append('file', renamedFile);

  const response = await fetch(PROXY_URL, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(err.error || 'Upload failed');
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Upload failed');
  }

  return {
    success: true,
    fileUrl: result.file,
  };
};
