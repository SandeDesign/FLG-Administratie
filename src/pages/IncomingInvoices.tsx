import React, { useState, useCallback } from 'react';
import {
  Upload,
  Zap,
  HardDrive,
  Download,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useToast } from '../hooks/useToast';
import { EmptyState } from '../components/ui/EmptyState';
import { uploadInvoiceToDrive } from '../services/googleDriveService';
import { processInvoiceFile } from '../services/ocrService';

interface OCRResult {
  id: string;
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: Date;
  amount: number;
  vatAmount: number;
  totalAmount: number;
  fileUrl: string;
  confidence: number;
}

const IncomingInvoices: React.FC = () => {
  const { user } = useAuth();
  const { selectedCompany } = useApp();
  const { success, error: showError } = useToast();
  const [uploading, setUploading] = useState(false);
  const [processingFile, setProcessingFile] = useState<string | null>(null);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [ocrResults, setOcrResults] = useState<OCRResult[]>([]);

  const handleFileUpload = async (files: FileList) => {
    if (!files.length || !selectedCompany || !user) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.type !== 'application/pdf' && !file.type.startsWith('image/')) {
          showError('Ongeldig bestandstype', 'Alleen PDF en afbeeldingen zijn toegestaan');
          continue;
        }

        if (file.size > 10 * 1024 * 1024) {
          showError('Bestand te groot', 'Maximaal 10MB per bestand');
          continue;
        }

        setProcessingFile(file.name);
        setOcrProgress(0);

        try {
          const ocrResult = await processInvoiceFile(file, (progress) => {
            setOcrProgress(Math.round(progress));
          });

          const uploadResult = await uploadInvoiceToDrive(
            file,
            selectedCompany.id,
            selectedCompany.name,
            user.uid,
            user.email || undefined,
            {
              supplierName: ocrResult.invoiceData.supplierName,
              invoiceNumber: ocrResult.invoiceData.invoiceNumber,
              amount: ocrResult.invoiceData.subtotal,
              vatAmount: ocrResult.invoiceData.vatAmount,
              totalAmount: ocrResult.invoiceData.totalInclVat,
            },
            {
              ...ocrResult.invoiceData,
              text: ocrResult.text,
              confidence: ocrResult.confidence,
              pages: ocrResult.pages,
            }
          );

          const result: OCRResult = {
            id: uploadResult.invoiceId,
            supplierName: ocrResult.invoiceData.supplierName,
            invoiceNumber: ocrResult.invoiceData.invoiceNumber,
            invoiceDate: ocrResult.invoiceData.invoiceDate,
            amount: ocrResult.invoiceData.subtotal || 0,
            vatAmount: ocrResult.invoiceData.vatAmount || 0,
            totalAmount: ocrResult.invoiceData.totalInclVat || 0,
            fileUrl: uploadResult.driveWebLink,
            confidence: ocrResult.confidence,
          };

          setOcrResults([result, ...ocrResults]);
          success('Factuur verwerkt', `OCR klaar (${ocrResult.confidence.toFixed(1)}% accuraat)`);
        } catch (ocrError) {
          console.error('OCR error:', ocrError);
          showError('OCR fout', ocrError instanceof Error ? ocrError.message : 'OCR verwerking mislukt');
        }

        setProcessingFile(null);
        setOcrProgress(0);
      }
    } catch (error) {
      console.error('Upload error:', error);
      showError('Fout bij uploaden', error instanceof Error ? error.message : 'Kon bestanden niet uploaden');
    } finally {
      setUploading(false);
      setProcessingFile(null);
      setOcrProgress(0);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileUpload(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  if (!selectedCompany) {
    return (
      <EmptyState
        icon={HardDrive}
        title="Geen bedrijf geselecteerd"
        description="Selecteer een bedrijf om facturen te beheren"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inkoopbonnen uploaden</h1>
          <p className="mt-1 text-sm text-gray-500">
            Upload facturen voor {selectedCompany.name}
          </p>
        </div>
        <div className="flex space-x-2 mt-4 sm:mt-0">
          <label className="cursor-pointer">
            <Button as="span" icon={Upload} disabled={uploading}>
              {uploading ? 'Uploaden...' : 'Upload Factuur'}
            </Button>
            <input
              type="file"
              multiple
              accept=".pdf,image/*"
              className="hidden"
              onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
            />
          </label>
        </div>
      </div>

      {/* OCR Progress */}
      {processingFile && (
        <Card>
          <div className="p-6">
            <div className="flex items-center space-x-3 mb-3">
              <Zap className="h-5 w-5 text-primary-600 animate-pulse" />
              <h3 className="font-medium text-gray-900">OCR verwerking bezig...</h3>
            </div>
            <p className="text-sm text-gray-600 mb-3">{processingFile}</p>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-primary-600 h-2 rounded-full transition-all"
                style={{ width: `${ocrProgress}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">{ocrProgress}%</p>
          </div>
        </Card>
      )}

      {/* Upload Zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragOver 
            ? 'border-primary-400 bg-primary-50' 
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <HardDrive className="mx-auto h-12 w-12 text-primary-400" />
        <p className="mt-2 text-sm text-gray-600">
          Sleep facturen hierheen of{' '}
          <label className="font-medium text-primary-600 hover:text-primary-500 cursor-pointer">
            selecteer bestanden
            <input
              type="file"
              multiple
              accept=".pdf,image/*"
              className="hidden"
              onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
            />
          </label>
        </p>
        <p className="mt-1 text-xs text-gray-500">
          PDF, PNG, JPG tot 10MB - Automatische OCR + Google Drive upload
        </p>
      </div>

      {/* OCR Results */}
      {ocrResults.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-900">Verwerkte facturen</h2>
          {ocrResults.map((result) => (
            <Card key={result.id} className="p-6">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Leverancier</p>
                    <p className="font-semibold text-gray-900">{result.supplierName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Factuurnummer</p>
                    <p className="font-semibold text-gray-900">{result.invoiceNumber}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Factuurdatum</p>
                    <p className="font-semibold text-gray-900">
                      {result.invoiceDate.toLocaleDateString('nl-NL')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">OCR Betrouwbaarheid</p>
                    <p className="font-semibold text-gray-900">{result.confidence.toFixed(1)}%</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-xs text-gray-600">Excl. BTW</p>
                    <p className="text-lg font-bold text-gray-900">€{result.amount.toFixed(2)}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-xs text-gray-600">BTW</p>
                    <p className="text-lg font-bold text-gray-900">€{result.vatAmount.toFixed(2)}</p>
                  </div>
                  <div className="bg-primary-50 p-3 rounded">
                    <p className="text-xs text-primary-600">Incl. BTW</p>
                    <p className="text-lg font-bold text-primary-900">€{result.totalAmount.toFixed(2)}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Download}
                    onClick={() => window.open(result.fileUrl, '_blank')}
                  >
                    Download PDF
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default IncomingInvoices;