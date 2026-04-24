// Upload-service voor bestanden naar internedata.nl (via proxy2.php).
//
// UNIFORME MAP-STRUCTUUR OP INTERNEDATA.NL
// ────────────────────────────────────────
//   FLG-Administratie/
//     {Bedrijfsnaam}/                      ← leesbare bedrijfsnaam (zoals "Buddy BV")
//       Verkoop/{year}/{invoiceNumber}.pdf
//       Inkoop/{year}/INK-{year}-####.pdf
//       Post/{year}/{yyyy-MM-dd}_{onderwerp}.pdf
//       Loonstroken/{year}/{employeeCode}_{yyyy-MM}.pdf
//
// proxy2.php doet recursieve folder-creatie — de JS hoeft alleen de
// complete `folder`-string mee te sturen. Geen PHP-wijziging nodig.

const PROXY_URL = 'https://internedata.nl/proxy2.php';
const BASE_FOLDER = 'FLG-Administratie';

export type FolderType = 'Verkoop' | 'Inkoop' | 'Post' | 'Loonstroken';

/**
 * Slug voor bestandsnamen (NIET voor folder). Houdt leesbaarheid maar
 * maakt veilig voor bestandssysteem: alleen alnum, spaties, dash en
 * underscore. Diacritics blijven behouden zodat 'é' etc. niet vreemde
 * namen worden.
 */
export const slugify = (input: string): string => {
  return (input || '')
    .replace(/[\/\\?*:|"<>]+/g, '')   // filesystem-verboden tekens weg
    .replace(/\s+/g, '_')             // spaties → _
    .trim()
    .slice(0, 80) || 'onbekend';
};

/**
 * Path-veilige variant van de bedrijfsnaam voor gebruik als folder.
 * Strip alleen karakters die op filesystems écht niet mogen
 * (/, \, ?, *, :, |, ", <, >); spaties en hoofdletters blijven zodat
 * "Buddy BV" en "DeInstallatie BV" gewoon herkenbaar zichtbaar zijn.
 */
export const companyFolderKey = (_companyId: string, companyName: string): string => {
  const cleaned = (companyName || '').replace(/[\/\\?*:|"<>]+/g, '').trim();
  return cleaned || 'Onbekend';
};

export interface UploadOptions {
  file: File;
  companyId: string;
  companyName: string;
  folderType: FolderType;
  /** Jaar voor de subfolder. Default: huidig jaar. */
  year?: number;
  /** Bestandsnaam zonder extensie. Default: timestamp. */
  customFileName?: string;
  /** Forceer een extensie (zonder punt). Default: uit file.name. */
  extension?: string;
}

const extFromFile = (file: File): string => {
  const parts = file.name.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase() : 'bin';
};

/**
 * Primaire upload-functie. Retourneert de URL waaronder het bestand
 * publiekelijk bereikbaar is + het relatieve storagePath zodat we het
 * in Firestore docs kunnen opslaan voor latere referentie.
 */
export const uploadFileToInternedata = async (
  opts: UploadOptions
): Promise<{ success: boolean; fileUrl: string; storagePath: string }> => {
  const {
    file,
    companyId,
    companyName,
    folderType,
    year = new Date().getFullYear(),
    customFileName,
    extension,
  } = opts;

  const companyKey = companyFolderKey(companyId, companyName);
  const folderPath = `${BASE_FOLDER}/${companyKey}/${folderType}/${year}`;

  const ext = extension || extFromFile(file);
  const base = customFileName ? slugify(customFileName) : `${Date.now()}_${slugify(file.name.replace(/\.[^.]+$/, ''))}`;
  const fileName = `${base}.${ext}`;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folderPath);
  formData.append('filename', fileName);

  const response = await fetch(PROXY_URL, { method: 'POST', body: formData });

  const responseText = await response.text();
  let result: { success?: boolean; url?: string; error?: string };
  try {
    result = JSON.parse(responseText);
  } catch {
    console.error('[uploadFileToInternedata] proxy returned non-JSON:', responseText);
    throw new Error('Upload-server gaf ongeldig antwoord');
  }

  if (!response.ok || !result.success || !result.url) {
    throw new Error(result.error || 'Upload mislukt');
  }

  return {
    success: true,
    fileUrl: result.url,
    storagePath: `${folderPath}/${fileName}`,
  };
};

/**
 * Legacy-signature voor de oude `uploadFile(file, companyName, folderType, customFileName)`
 * — alle bestaande callers blijven werken, maar voor nieuwe code gebruik
 * liever `uploadFileToInternedata`. Deze fallt terug op een oude folder-
 * structuur ZONDER companyId/year als er geen companyId meegegeven is,
 * zodat bestaande flows niet breken.
 *
 * @deprecated Gebruik uploadFileToInternedata met companyId + year.
 */
export const uploadFile = async (
  file: File,
  companyName: string,
  folderType: string = 'Inkoop',
  customFileName?: string,
  companyId?: string
): Promise<{ success: boolean; fileUrl: string }> => {
  // Als companyId bekend is: gebruik nieuwe structuur.
  if (companyId) {
    const res = await uploadFileToInternedata({
      file,
      companyId,
      companyName,
      folderType: folderType as FolderType,
      customFileName,
    });
    return { success: res.success, fileUrl: res.fileUrl };
  }

  // Legacy-fallback — oude structuur zonder year/slug.
  const folderPath = `${BASE_FOLDER}/${companyName}/${folderType}`;
  const ext = extFromFile(file);
  const fileName = customFileName ? `${customFileName}.${ext}` : `${Date.now()}_${file.name}`;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folderPath);
  formData.append('filename', fileName);

  const response = await fetch(PROXY_URL, { method: 'POST', body: formData });
  const responseText = await response.text();
  let result: { success?: boolean; url?: string; error?: string };
  try { result = JSON.parse(responseText); } catch {
    throw new Error('Upload-server gaf ongeldig antwoord');
  }
  if (!response.ok || !result.success || !result.url) {
    throw new Error(result.error || 'Upload mislukt');
  }
  return { success: true, fileUrl: result.url };
};
