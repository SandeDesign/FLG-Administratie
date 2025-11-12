import { ref, getBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';

/**
 * 📁 MAPSTRUCTUUR INSTRUCTIE:
 * 
 * Plaats dit bestand in: src/utils/firebase-storage-helper.ts
 * 
 * Je mapstructuur wordt:
 * src/
 *   ├── utils/
 *   │   ├── firebase-storage-helper.ts  ← HIER (dit bestand)
 *   │   ├── leaveCalculations.ts
 *   │   ├── poortwachterTracking.ts
 *   │   └── ... (andere utils)
 *   ├── services/
 *   ├── components/
 *   └── ...
 */

/**
 * Veilige PDF downloader met CORS handling
 * Voorkomt CORS errors bij direct downloaden van Firebase Storage bestanden
 */
export const firebaseStorageHelper = {
  /**
   * Download PDF met blob fallback strategy
   * 1. Probeert eerst URL-based download (snelste)
   * 2. Valt terug op blob-based download als URL fails (CORS-safe)
   */
  async downloadFile(
    storagePath: string,
    fileName: string
  ): Promise<void> {
    try {
      // Strategie 1: Direct URL download (voorkeur)
      try {
        const storageRef = ref(storage, storagePath);
        const downloadUrl = await getDownloadURL(storageRef);
        
        // Maak download link dynamisch aan
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = fileName || 'document.pdf';
        link.target = '_blank';
        
        // Voeg toe aan DOM, klik, en verwijder
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
      } catch (urlError) {
        console.warn('Direct URL download failed, trying blob strategy:', urlError);
        
        // Strategie 2: Blob-based download (CORS-safe)
        const storageRef = ref(storage, storagePath);
        const bytes = await getBytes(storageRef);
        const blob = new Blob([bytes], { type: 'application/pdf' });
        
        // Maak blob URL aan
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName || 'document.pdf';
        
        // Download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Cleanup
        window.URL.revokeObjectURL(blobUrl);
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      throw new Error('Kon bestand niet downloaden');
    }
  },

  /**
   * Open PDF in nieuw venster met CORS handling
   */
  async viewFile(storagePath: string): Promise<void> {
    try {
      // Probeer eerst direct download URL
      try {
        const storageRef = ref(storage, storagePath);
        const downloadUrl = await getDownloadURL(storageRef);
        window.open(downloadUrl, '_blank');
      } catch (urlError) {
        console.warn('Direct URL view failed, trying blob strategy:', urlError);
        
        // Fallback: blob-based view
        const storageRef = ref(storage, storagePath);
        const bytes = await getBytes(storageRef);
        const blob = new Blob([bytes], { type: 'application/pdf' });
        
        // Maak blob URL aan
        const blobUrl = window.URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
        
        // Note: Don't revoke immediately - PDF viewer needs the URL
        // Revoke after 5 seconds when PDF should be loaded
        setTimeout(() => {
          window.URL.revokeObjectURL(blobUrl);
        }, 5000);
      }
    } catch (error) {
      console.error('Error viewing file:', error);
      throw new Error('Kon bestand niet openen');
    }
  },

  /**
   * Get file as blob (for manipulation)
   */
  async getFileAsBlob(storagePath: string): Promise<Blob> {
    try {
      const storageRef = ref(storage, storagePath);
      const bytes = await getBytes(storageRef);
      return new Blob([bytes], { type: 'application/pdf' });
    } catch (error) {
      console.error('Error getting file blob:', error);
      throw new Error('Kon bestand niet laden');
    }
  },

  /**
   * Get file download URL with optional token
   */
  async getFileUrl(storagePath: string): Promise<string> {
    try {
      const storageRef = ref(storage, storagePath);
      return await getDownloadURL(storageRef);
    } catch (error) {
      console.error('Error getting file URL:', error);
      throw new Error('Kon bestand URL niet ophalen');
    }
  }
};