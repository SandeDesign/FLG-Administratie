import React, { useState, useCallback } from 'react';
import {
  Upload,
  Zap,
  HardDrive,
  Download,
  CheckCircle,
  ArrowRight,
  RotateCw,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { useNavigate } from 'react-router-dom';
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
  const { user, adminUserId } = useAuth();
  const { selectedCompany } = useApp();
  const { success, error: showError } = useToast();
  const navigate = useNavigate();
  const [uploading, setUploading] = useState(false);
  const [processingFiles, setProcessingFiles] = useState<string[]>([]);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [ocrResults, setOcrResults] = useState<OCRResult[]>([]);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [totalProcessed, setTotalProcessed] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);

  const handleFileUpload = async (files: FileList) => {
    if (!files.length || !selectedCompany || !user) return;

    const fileArray = Array.from(files);
    const validFiles = fileArray.filter(file => {
      if (file.type !== 'application/pdf' && !file.type.startsWith('image/')) {
        showError('Ongeldig bestandstype', `${file.name}: Alleen PDF en afbeeldingen zijn toegestaan`);
        return false;
      }
      if (file.size > 10 * 1024 * 1024) {
        showError('Bestand te groot', `${file.name}: Maximaal 10MB per bestand`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    setUploading(true);
    setTotalFiles(validFiles.length);
    setTotalProcessed(0);
    const results: OCRResult[] = [];

    // ✅ Parallel verwerking met limiet van 3 tegelijk
    const PARALLEL_LIMIT = 3;
    const processFile = async (file: File) => {
      setProcessingFiles(prev => [...prev, file.name]);

      try {
        const ocrResult = await processInvoiceFile(file, (progress) => {
          setOcrProgress(Math.round(progress));
        });

        const uploadResult = await uploadInvoiceToDrive(
          file,
          selectedCompany.id,
          selectedCompany.name,
          adminUserId,
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

        results.push(result);
        console.log(`✅ Processed ${file.name}`);
      } catch (ocrError) {
        console.error('OCR error:', ocrError);
        showError('OCR fout', `${file.name}: ${ocrError instanceof Error ? ocrError.message : 'OCR verwerking mislukt'}`);
      } finally {
        setProcessingFiles(prev => prev.filter(f => f !== file.name));
        setTotalProcessed(prev => prev + 1);
      }
    };

    try {
      // Process in batches of PARALLEL_LIMIT
      for (let i = 0; i < validFiles.length; i += PARALLEL_LIMIT) {
        const batch = validFiles.slice(i, i + PARALLEL_LIMIT);
        await Promise.all(batch.map(processFile));
      }

      if (results.length > 0) {
        setOcrResults(prev => [...results, ...prev]);
        setShowSuccessModal(true);
      }
    } catch (error) {
      console.error('Upload error:', error);
      showError('Fout bij uploaden', error instanceof Error ? error.message : 'Kon bestanden niet uploaden');
    } finally {
      setUploading(false);
      setProcessingFiles([]);
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
      {processingFiles.length > 0 && (
        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <Zap className="h-5 w-5 text-primary-600 animate-pulse" />
                <h3 className="font-medium text-gray-900">OCR verwerking bezig...</h3>
              </div>
              <span className="text-sm font-medium text-gray-600">
                {totalProcessed} / {totalFiles} voltooid
              </span>
            </div>
            <div className="space-y-2 mb-3">
              {processingFiles.map((fileName) => (
                <div key={fileName} className="flex items-center text-sm text-gray-600">
                  <LoadingSpinner size="sm" className="mr-2" />
                  <span>{fileName}</span>
                </div>
              ))}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-primary-600 h-2 rounded-full transition-all"
                style={{ width: `${(totalProcessed / totalFiles) * 100}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {Math.round((totalProcessed / totalFiles) * 100)}% - Max 3 bestanden tegelijk
            </p>
          </div>
        </Card>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <Card className="max-w-md w-full">
            <div className="p-6 text-center">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Upload geslaagd!
              </h2>
              <p className="text-gray-600 mb-6">
                {totalProcessed} {totalProcessed === 1 ? 'factuur is' : 'facturen zijn'} succesvol verwerkt met OCR en opgeslagen.
              </p>
              <div className="space-y-3">
                <Button
                  variant="primary"
                  className="w-full"
                  icon={ArrowRight}
                  onClick={() => {
                    setShowSuccessModal(false);
                    navigate('/incoming-invoices-stats');
                  }}
                >
                  Ga naar Inkoop Overzicht
                </Button>
                <Button
                  variant="ghost"
                  className="w-full"
                  icon={RotateCw}
                  onClick={() => {
                    setShowSuccessModal(false);
                    setOcrResults([]);
                    setTotalProcessed(0);
                    setTotalFiles(0);
                  }}
                >
                  Nog meer uploaden
                </Button>
              </div>
            </div>
          </Card>
        </div>
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
          Sleep <strong>meerdere facturen</strong> hierheen of{' '}
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
        <p className="mt-1 text-xs font-medium text-primary-600">
          ⚡ Parallel verwerking: max 3 bestanden tegelijk voor snelheid
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