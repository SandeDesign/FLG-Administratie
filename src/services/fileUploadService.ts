// Upload-service voor bestanden naar internedata.nl (via proxy2.php).
//
// UNIFORME MAP-STRUCTUUR OP INTERNEDATA.NL
// ────────────────────────────────────────
//   FLG-Administratie/
//     {companyId}__{companyNameSlug}/      ← stabiele key (id) + leesbare slug
//       Verkoop/{year}/{invoiceNumber}.pdf
//       Inkoop/{year}/INK-{year}-####.pdf
//       Post/{year}/{yyyy-MM-dd}_{subject-slug}.pdf
//       Loonstroken/{year}/{employeeCode}_{yyyy-MM}.pdf
//
// proxy2.php doet recursieve folder-creatie — de JS hoeft alleen de
// complete `folder`-string mee te sturen. Geen PHP-wijziging nodig.

const PROXY_URL = 'https://internedata.nl/proxy2.php';
const BASE_FOLDER = 'FLG-Administratie';

export type FolderType = 'Verkoop' | 'Inkoop' | 'Post' | 'Loonstroken';

/**
 * Maak een bestands- en pad-veilige slug van een string.
 * Nederlandse diacritics → ascii, spaties/speciale tekens → underscore,
 * lowercase, max 60 chars.
 */
export const slugify = (input: string): string => {
  return (input || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')      // diacritics weg
    .replace(/[^a-zA-Z0-9\- ]+/g, '')     // alleen alnum, space, dash
    .trim()
    .replace(/\s+/g, '_')                  // spaties → _
    .toLowerCase()
    .slice(0, 60) || 'onbekend';
};

/**
 * Bouw de stabiele company-folder-key.
 * Altijd `{companyId}__{slug}` zodat de id de waarheid is en de slug
 * de map vindbaar houdt ook na hernoemen (nieuwe naam → nieuwe slug,
 * maar de id blijft hetzelfde → oude én nieuwe mappen bestaan naast
 * elkaar; een renaming-migratie is een apart script).
 */
export const companyFolderKey = (companyId: string, companyName: string): string => {
  return `${companyId}__${slugify(companyName)}`;
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
