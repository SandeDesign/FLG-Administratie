import React, { useState, useEffect, useCallback } from 'react';
import {
  Upload,
  Search,
  Building2,
  FileText,
  Zap,
  HardDrive,
  X,
  ChevronDown,
  Download,
  Edit2,
  CheckCircle,
  AlertCircle,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useToast } from '../hooks/useToast';
import { EmptyState } from '../components/ui/EmptyState';
import { incomingInvoiceService, IncomingInvoice } from '../services/incomingInvoiceService';
import { uploadInvoiceToDrive } from '../services/googleDriveService';
import { processInvoiceFile } from '../services/ocrService';

const IncomingInvoices: React.FC = () => {
  const { user } = useAuth();
  const { selectedCompany } = useApp();
  const { success, error: showError } = useToast();
  const [invoices, setInvoices] = useState<IncomingInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [processingFile, setProcessingFile] = useState<string | null>(null);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isDragOver, setIsDragOver] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<IncomingInvoice | null>(null);
  const [editFormData, setEditFormData] = useState({
    supplierName: '',
    invoiceNumber: '',
    subtotal: 0,
  });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadInvoices = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const invoicesData = await incomingInvoiceService.getInvoices(
        user.uid, 
        selectedCompany?.id
      );
      setInvoices(invoicesData);
    } catch (error) {
      console.error('Error loading invoices:', error);
      showError('Fout bij laden', 'Kon facturen niet laden');
    } finally {
      setLoading(false);
    }
  }, [user, selectedCompany, showError]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

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
          console.log('Starting OCR processing...');
          const ocrResult = await processInvoiceFile(file, (progress) => {
            setOcrProgress(Math.round(progress));
          });

          console.log('OCR completed:', ocrResult);

          const uploadResult = await uploadInvoiceToDrive(
            file,
            selectedCompany.id,
            selectedCompany.name,
            user.uid,
            user.email || undefined,
            {
              supplierName: ocrResult.invoiceData.supplierName,
              invoiceNumber: ocrResult.invoiceData.invoiceNumber,
              amount: ocrResult.invoiceData.amount,
            },
            {
              ...ocrResult.invoiceData,
              text: ocrResult.text,
              confidence: ocrResult.confidence,
              pages: ocrResult.pages,
            }
          );

          const newInvoice: IncomingInvoice = {
            id: uploadResult.invoiceId,
            userId: user.uid,
            companyId: selectedCompany.id,
            supplierName: ocrResult.invoiceData.supplierName,
            invoiceNumber: ocrResult.invoiceData.invoiceNumber,
            amount: ocrResult.invoiceData.subtotal || 0,
            vatAmount: ocrResult.invoiceData.vatAmount || 0,
            totalAmount: ocrResult.invoiceData.totalInclVat || 0,
            description: `Factuur van ${ocrResult.invoiceData.supplierName}`,
            invoiceDate: ocrResult.invoiceData.invoiceDate,
            dueDate: new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000),
            status: 'pending',
            fileName: file.name,
            fileUrl: uploadResult.driveWebLink,
            driveFileId: uploadResult.driveFileId,
            driveWebLink: uploadResult.driveWebLink,
            ocrProcessed: true,
            ocrData: ocrResult.invoiceData,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          setInvoices([newInvoice, ...invoices]);
          success('Factuur verwerkt', `OCR klaar (${ocrResult.confidence.toFixed(1)}% accuraat)`);
        } catch (ocrError) {
          console.error('OCR error:', ocrError);
          showError('OCR fout', ocrError instanceof Error ? ocrError.message : 'OCR verwerking mislukt');
        }

        setProcessingFile(null);
        setOcrProgress(0);
      }

      loadInvoices();
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

  const handleApprove = async (invoiceId: string) => {
    if (!user) return;
    try {
      await incomingInvoiceService.approveInvoice(invoiceId, user.uid);
      success('Factuur goedgekeurd', 'De factuur is goedgekeurd voor betaling');
      loadInvoices();
    } catch (error) {
      showError('Fout bij goedkeuren', 'Kon factuur niet goedkeuren');
    }
  };

  const handleReject = async (invoiceId: string) => {
    const reason = prompt('Reden voor afwijzing:');
    if (!reason) return;
    
    try {
      await incomingInvoiceService.rejectInvoice(invoiceId, reason);
      success('Factuur afgewezen', 'De factuur is afgewezen');
      loadInvoices();
    } catch (error) {
      showError('Fout bij afwijzen', 'Kon factuur niet afwijzen');
    }
  };

  const handleMarkAsPaid = async (invoiceId: string) => {
    try {
      await incomingInvoiceService.markAsPaid(invoiceId);
      success('Factuur betaald', 'De factuur is gemarkeerd als betaald');
      loadInvoices();
    } catch (error) {
      showError('Fout bij bijwerken', 'Kon factuur niet als betaald markeren');
    }
  };

  const handleDelete = async (invoiceId: string) => {
    if (!confirm('Weet je zeker dat je deze factuur wilt verwijderen?')) return;
    
    try {
      await incomingInvoiceService.deleteInvoice(invoiceId);
      success('Factuur verwijderd', 'De factuur is succesvol verwijderd');
      loadInvoices();
    } catch (error) {
      showError('Fout bij verwijderen', 'Kon factuur niet verwijderen');
    }
  };

  const handleDownload = (invoice: IncomingInvoice) => {
    window.open(invoice.fileUrl, '_blank');
  };

  const openEditModal = (invoice: IncomingInvoice) => {
    setEditingInvoice(invoice);
    setEditFormData({
      supplierName: invoice.supplierName,
      invoiceNumber: invoice.invoiceNumber,
      subtotal: invoice.amount,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingInvoice) return;
    
    const vat = Math.round(editFormData.subtotal * 0.21 * 100) / 100;
    const total = editFormData.subtotal + vat;

    try {
      await incomingInvoiceService.updateInvoice(editingInvoice.id!, {
        supplierName: editFormData.supplierName,
        invoiceNumber: editFormData.invoiceNumber,
        amount: editFormData.subtotal,
        vatAmount: vat,
        totalAmount: total,
      });

      const updated = invoices.map(inv =>
        inv.id === editingInvoice.id
          ? {
              ...inv,
              supplierName: editFormData.supplierName,
              invoiceNumber: editFormData.invoiceNumber,
              amount: editFormData.subtotal,
              vatAmount: vat,
              totalAmount: total,
              updatedAt: new Date(),
            }
          : inv
      );
      setInvoices(updated);
      setEditingInvoice(null);

      success('Factuur bijgewerkt', 'De gegevens zijn opgeslagen');
    } catch (error) {
      console.error('Edit error:', error);
      showError('Fout bij bijwerken', 'Kon factuur niet bijwerken');
    }
  };

  const getStatusColor = (status: IncomingInvoice['status']) => {
    switch (status) {
      case 'pending': return 'bg-orange-100 text-orange-800';
      case 'approved': return 'bg-blue-100 text-blue-800';
      case 'paid': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: IncomingInvoice['status']) => {
    switch (status) {
      case 'pending': return 'In behandeling';
      case 'approved': return 'Goedgekeurd';
      case 'paid': return 'Betaald';
      case 'rejected': return 'Afgewezen';
      default: return status;
    }
  };

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = invoice.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!selectedCompany) {
    return (
      <EmptyState
        icon={Building2}
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
          <h1 className="text-2xl font-bold text-gray-900">Inkomende Facturen</h1>
          <p className="mt-1 text-sm text-gray-500">
            Beheer inkomende facturen voor {selectedCompany.name} - met automatische OCR
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
              <Zap className="h-5 w-5 text-blue-600 animate-pulse" />
              <h3 className="font-medium text-gray-900">OCR verwerking bezig...</h3>
            </div>
            <p className="text-sm text-gray-600 mb-3">{processingFile}</p>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
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
            ? 'border-blue-400 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <HardDrive className="mx-auto h-12 w-12 text-blue-400" />
        <p className="mt-2 text-sm text-gray-600">
          Sleep facturen hierheen of{' '}
          <label className="font-medium text-blue-600 hover:text-blue-500 cursor-pointer">
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

      {/* Filters */}
      <Card>
        <div className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Zoek op leverancier of factuurnummer..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="sm:w-48">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">Alle statussen</option>
                <option value="pending">In behandeling</option>
                <option value="approved">Goedgekeurd</option>
                <option value="paid">Betaald</option>
                <option value="rejected">Afgewezen</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* Invoices List - COMPACT */}
      {filteredInvoices.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Geen facturen gevonden"
          description={searchTerm || statusFilter !== 'all' 
            ? "Geen facturen gevonden die voldoen aan de filters" 
            : "Upload je eerste factuur"}
        />
      ) : (
        <div className="space-y-1">
          {filteredInvoices.map((invoice) => (
            <div
              key={invoice.id}
              className="border border-gray-200 rounded-lg hover:shadow-sm transition-all"
            >
              {/* Compact Header - Always Visible */}
              <div
                className="p-3 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedId(expandedId === invoice.id ? null : invoice.id)}
              >
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <ChevronDown
                    className={`h-4 w-4 text-gray-400 transition-transform flex-shrink-0 ${
                      expandedId === invoice.id ? 'rotate-180' : ''
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-sm text-gray-900">
                        {invoice.invoiceNumber}
                      </span>
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${getStatusColor(invoice.status)}`}>
                        {getStatusText(invoice.status)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">
                      {invoice.supplierName} • {invoice.invoiceDate.toLocaleDateString('nl-NL')}
                    </p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <p className="font-semibold text-sm text-gray-900">
                    €{(invoice.totalAmount || 0).toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedId === invoice.id && (
                <div className="border-t border-gray-200 bg-gray-50 p-3 space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-white p-2 rounded border border-gray-200">
                      <p className="text-gray-600">Excl. BTW</p>
                      <p className="font-semibold text-gray-900">€{(invoice.amount || 0).toFixed(2)}</p>
                    </div>
                    <div className="bg-white p-2 rounded border border-gray-200">
                      <p className="text-gray-600">BTW</p>
                      <p className="font-semibold text-gray-900">€{(invoice.vatAmount || 0).toFixed(2)}</p>
                    </div>
                    <div className="bg-blue-50 p-2 rounded border border-blue-200">
                      <p className="text-blue-600">Incl. BTW</p>
                      <p className="font-semibold text-blue-900">€{(invoice.totalAmount || 0).toFixed(2)}</p>
                    </div>
                  </div>

                  {invoice.status === 'rejected' && (invoice as any).rejectionReason && (
                    <div className="bg-red-50 p-2 rounded text-xs text-red-700">
                      <strong>Reden:</strong> {(invoice as any).rejectionReason}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Download}
                      onClick={() => handleDownload(invoice)}
                      className="text-xs py-1"
                    >
                      Download
                    </Button>

                    {invoice.status === 'pending' && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Edit2}
                          onClick={() => openEditModal(invoice)}
                          className="text-xs py-1"
                        >
                          Bewerken
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          icon={CheckCircle}
                          onClick={() => handleApprove(invoice.id!)}
                          className="text-xs py-1"
                        >
                          Goedkeuren
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          icon={AlertCircle}
                          onClick={() => handleReject(invoice.id!)}
                          className="text-xs py-1"
                        >
                          Afwijzen
                        </Button>
                      </>
                    )}

                    {invoice.status === 'approved' && (
                      <Button
                        variant="primary"
                        size="sm"
                        icon={CheckCircle}
                        onClick={() => handleMarkAsPaid(invoice.id!)}
                        className="text-xs py-1"
                      >
                        Betaald
                      </Button>
                    )}

                    {(invoice.status === 'rejected' || invoice.status === 'pending') && (
                      <Button
                        variant="danger"
                        size="sm"
                        icon={Trash2}
                        onClick={() => handleDelete(invoice.id!)}
                        className="text-xs py-1"
                      >
                        Verwijderen
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editingInvoice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">Factuur bewerken</h2>
                <button
                  onClick={() => setEditingInvoice(null)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Leverancier
                  </label>
                  <input
                    type="text"
                    value={editFormData.supplierName}
                    onChange={(e) => setEditFormData({...editFormData, supplierName: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Factuurnummer
                  </label>
                  <input
                    type="text"
                    value={editFormData.invoiceNumber}
                    onChange={(e) => setEditFormData({...editFormData, invoiceNumber: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Excl. BTW (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.subtotal || ''}
                    onChange={(e) => {
                      const val = e.target.value ? parseFloat(e.target.value) : 0;
                      setEditFormData({...editFormData, subtotal: val});
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="bg-gray-50 p-3 rounded text-sm space-y-2">
                  <div>
                    <p className="text-gray-600 text-xs">BTW 21%</p>
                    <p className="font-semibold text-gray-900">€{(editFormData.subtotal * 0.21).toFixed(2)}</p>
                  </div>
                  <div className="border-t border-gray-200 pt-2">
                    <p className="text-blue-600 text-xs font-medium">Totaal Incl. BTW</p>
                    <p className="font-bold text-blue-900 text-lg">€{(editFormData.subtotal * 1.21).toFixed(2)}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <Button
                  variant="ghost"
                  onClick={() => setEditingInvoice(null)}
                  className="flex-1"
                >
                  Annuleren
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSaveEdit}
                  className="flex-1"
                >
                  Opslaan
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default IncomingInvoices;