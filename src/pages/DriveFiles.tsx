import React, { useState, useEffect, useCallback } from 'react';
import {
  FolderOpen,
  File,
  Download,
  Eye,
  RefreshCw,
  Search,
  Filter,
  Calendar,
  Building2,
  Upload,
  Settings,
  ExternalLink,
  FileText,
  Image,
  Folder,
  Euro,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useToast } from '../hooks/useToast';
import { EmptyState } from '../components/ui/EmptyState';
import { incomingInvoiceService } from '../services/incomingInvoiceService';

interface DriveFile {
  id: string;
  name: string;
  type: 'file' | 'folder';
  mimeType: string;
  size?: number;
  createdAt: Date;
  modifiedAt: Date;
  driveId: string;
  webViewLink: string;
  downloadLink?: string;
  thumbnailLink?: string;
  companyId: string;
  companyName: string;
  category: 'invoice' | 'export' | 'document' | 'other';
  parentFolderId?: string;
  path: string;
  isShared: boolean;
  permissions: string[];
}

interface DriveFolder {
  id: string;
  name: string;
  companyId: string;
  companyName: string;
  driveId: string;
  webViewLink: string;
  fileCount: number;
  lastModified: Date;
  autoSync: boolean;
  syncStatus: 'synced' | 'syncing' | 'error';
}

interface ArchivedInvoice {
  id: string;
  invoiceNumber: string;
  supplierName: string;
  totalAmount: number;
  amount: number;
  vatAmount: number;
  invoiceDate: Date;
  archivedAt: Date;
  fileName: string;
  fileUrl: string;
  ocrProcessed: boolean;
  ocrData?: any;
  folderPath: string;
  companyId: string;
}

const DriveFiles: React.FC = () => {
  const { user } = useAuth();
  const { selectedCompany, companies } = useApp();
  const { success, error: showError } = useToast();
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [archivedInvoices, setArchivedInvoices] = useState<ArchivedInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<'files' | 'archived'>('files');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  const loadDriveData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Load mock Google Drive data
      const mockFolders: DriveFolder[] = companies.map(company => ({
        id: `folder_${company.id}`,
        name: `${company.name} - Documenten`,
        companyId: company.id,
        companyName: company.name,
        driveId: `drive_${company.id}`,
        webViewLink: `https://drive.google.com/drive/folders/drive_${company.id}`,
        fileCount: Math.floor(Math.random() * 50) + 10,
        lastModified: new Date(),
        autoSync: true,
        syncStatus: 'synced'
      }));

      const mockFiles: DriveFile[] = [
        {
          id: 'file_1',
          name: 'Factuur-2024-001.pdf',
          type: 'file',
          mimeType: 'application/pdf',
          size: 245760,
          createdAt: new Date('2024-01-15'),
          modifiedAt: new Date('2024-01-15'),
          driveId: 'drive_123',
          webViewLink: 'https://drive.google.com/file/d/file_1/view',
          downloadLink: 'https://drive.google.com/file/d/file_1/download',
          thumbnailLink: 'https://drive.google.com/thumbnail?id=file_1',
          companyId: selectedCompany?.id || '',
          companyName: selectedCompany?.name || '',
          category: 'invoice',
          path: '/Facturen/Uitgaand/',
          isShared: false,
          permissions: ['read', 'write']
        },
        {
          id: 'file_2',
          name: 'Uren-Export-Januari-2024.xlsx',
          type: 'file',
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          size: 87456,
          createdAt: new Date('2024-02-01'),
          modifiedAt: new Date('2024-02-01'),
          driveId: 'drive_123',
          webViewLink: 'https://drive.google.com/file/d/file_2/view',
          downloadLink: 'https://drive.google.com/file/d/file_2/download',
          companyId: selectedCompany?.id || '',
          companyName: selectedCompany?.name || '',
          category: 'export',
          path: '/Exports/Uren/',
          isShared: true,
          permissions: ['read']
        }
      ];

      setFolders(mockFolders);
      setFiles(mockFiles);

      // Load archived invoices
      if (selectedCompany?.id) {
        try {
          const archived = await incomingInvoiceService.getArchivedInvoices(
            user.uid,
            selectedCompany.id
          );
          setArchivedInvoices(archived);
        } catch (error) {
          console.warn('Could not load archived invoices:', error);
        }
      }
    } catch (error) {
      console.error('Error loading Drive data:', error);
      showError('Fout bij laden', 'Kon Drive bestanden niet laden');
    } finally {
      setLoading(false);
    }
  }, [user, selectedCompany, companies, showError]);

  useEffect(() => {
    loadDriveData();
  }, [loadDriveData]);

  const syncDrive = useCallback(async (folderId?: string) => {
    if (!user) return;

    setSyncing(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      success('Drive gesynchroniseerd', 'Alle bestanden zijn bijgewerkt');
      loadDriveData();
    } catch (error) {
      showError('Fout bij synchroniseren', 'Kon Drive niet synchroniseren');
    } finally {
      setSyncing(false);
    }
  }, [user, success, showError, loadDriveData]);

  const createCompanyFolders = async (companyId: string) => {
    try {
      success('Mappen aangemaakt', 'Google Drive mappen zijn aangemaakt voor het bedrijf');
      loadDriveData();
    } catch (error) {
      showError('Fout bij aanmaken', 'Kon mappen niet aanmaken');
    }
  };

  const openInDrive = (file: DriveFile | DriveFolder) => {
    window.open(file.webViewLink, '_blank');
  };

  const downloadFile = async (file: DriveFile | ArchivedInvoice) => {
    try {
      if ('downloadLink' in file && file.downloadLink) {
        window.open(file.downloadLink, '_blank');
      } else if ('fileUrl' in file) {
        window.open(file.fileUrl, '_blank');
      }
    } catch (error) {
      showError('Fout bij downloaden', 'Kon bestand niet downloaden');
    }
  };

  const getFileIcon = (file: DriveFile) => {
    if (file.type === 'folder') return Folder;
    if (file.mimeType.startsWith('image/')) return Image;
    if (file.mimeType.includes('pdf') || file.mimeType.includes('document')) return FileText;
    return File;
  };

  const getCategoryColor = (category: DriveFile['category']) => {
    switch (category) {
      case 'invoice': return 'text-primary-600 bg-primary-100';
      case 'export': return 'text-green-600 bg-green-100';
      case 'document': return 'text-purple-600 bg-purple-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getSyncStatusColor = (status: DriveFolder['syncStatus']) => {
    switch (status) {
      case 'synced': return 'text-green-600 bg-green-100';
      case 'syncing': return 'text-primary-600 bg-primary-100';
      case 'error': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const filteredFiles = files.filter(file => {
    const matchesSearch = file.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || file.category === categoryFilter;
    const matchesCompany = companyFilter === 'all' || file.companyId === companyFilter;
    return matchesSearch && matchesCategory && matchesCompany;
  });

  const filteredArchivedInvoices = archivedInvoices.filter(invoice => {
    const matchesSearch = 
      invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.supplierName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCompany = companyFilter === 'all' || invoice.companyId === companyFilter;
    return matchesSearch && matchesCompany;
  });

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Drive Bestanden</h1>
          <p className="mt-1 text-sm text-gray-500">
            Centraal overzicht van alle Google Drive bestanden en gearchiveerde facturen
          </p>
        </div>
        <div className="flex space-x-2 mt-4 sm:mt-0">
          <Button
            onClick={() => syncDrive()}
            variant="ghost"
            icon={syncing ? RefreshCw : RefreshCw}
            disabled={syncing}
            className={syncing ? 'animate-spin' : ''}
          >
            {syncing ? 'Synchroniseren...' : 'Sync Drive'}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('files')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'files'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Bestanden
        </button>
        <button
          onClick={() => setActiveTab('archived')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'archived'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Gearchiveerde Facturen ({archivedInvoices.length})
        </button>
      </div>

      {/* Company Folders Overview */}
      {activeTab === 'files' && (
        <>
          <Card>
            <div className="p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Bedrijfs Mappen</h2>
              
              {folders.length === 0 ? (
                <EmptyState
                  icon={FolderOpen}
                  title="Geen mappen gevonden"
                  description="Maak eerst Drive mappen aan voor je bedrijven"
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {folders.map((folder) => (
                    <div key={folder.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <FolderOpen className="h-5 w-5 text-primary-600" />
                          <span className="font-medium text-gray-900 truncate">{folder.companyName}</span>
                        </div>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getSyncStatusColor(folder.syncStatus)}`}>
                          {folder.syncStatus === 'synced' && 'Gesynchroniseerd'}
                          {folder.syncStatus === 'syncing' && 'Synchroniseren...'}
                          {folder.syncStatus === 'error' && 'Fout'}
                        </span>
                      </div>
                      
                      <div className="text-sm text-gray-500 mb-3">
                        <div>{folder.fileCount} bestanden</div>
                        <div>Laatst gewijzigd: {folder.lastModified.toLocaleDateString('nl-NL')}</div>
                      </div>
                      
                      <div className="flex space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={ExternalLink}
                          onClick={() => openInDrive(folder)}
                          className="flex-1"
                        >
                          Open in Drive
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Settings}
                          onClick={() => createCompanyFolders(folder.companyId)}
                        >
                          Instellingen
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* Files Filter and Search */}
          <Card>
            <div className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Zoek bestanden..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>
                
                <div className="flex space-x-2">
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="all">Alle categorieën</option>
                    <option value="invoice">Facturen</option>
                    <option value="export">Exports</option>
                    <option value="document">Documenten</option>
                    <option value="other">Overig</option>
                  </select>
                  
                  <select
                    value={companyFilter}
                    onChange={(e) => setCompanyFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="all">Alle bedrijven</option>
                    {companies.map(company => (
                      <option key={company.id} value={company.id}>{company.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </Card>

          {/* Files List */}
          {filteredFiles.length === 0 ? (
            <EmptyState
              icon={File}
              title="Geen bestanden gevonden"
              description={searchTerm || categoryFilter !== 'all' || companyFilter !== 'all'
                ? "Geen bestanden gevonden die voldoen aan de filters"
                : "Synchroniseer je Drive om bestanden te tonen"}
              action={
                <Button onClick={() => syncDrive()} icon={RefreshCw}>
                  Synchroniseer Drive
                </Button>
              }
            />
          ) : (
            <Card>
              <div className="p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Bestanden</h2>
                
                <div className="space-y-3">
                  {filteredFiles.map((file) => {
                    const FileIcon = getFileIcon(file);
                    return (
                      <div key={file.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
                        <div className="flex items-center space-x-3 min-w-0 flex-1">
                          <div className="flex-shrink-0">
                            <FileIcon className="h-8 w-8 text-gray-400" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center space-x-2">
                              <h3 className="text-sm font-medium text-gray-900 truncate">
                                {file.name}
                              </h3>
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(file.category)}`}>
                                {file.category === 'invoice' && 'Factuur'}
                                {file.category === 'export' && 'Export'}
                                {file.category === 'document' && 'Document'}
                                {file.category === 'other' && 'Overig'}
                              </span>
                            </div>
                            <div className="mt-1 flex items-center space-x-4 text-xs text-gray-500">
                              <span>{file.companyName}</span>
                              <span>{file.path}</span>
                              {file.size && (
                                <span>{Math.round(file.size / 1024)} KB</span>
                              )}
                              <span>{file.modifiedAt.toLocaleDateString('nl-NL')}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Eye}
                            onClick={() => openInDrive(file)}
                          >
                            Bekijken
                          </Button>
                          {file.downloadLink && (
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={Download}
                              onClick={() => downloadFile(file)}
                            >
                              Download
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Archived Invoices Tab */}
      {activeTab === 'archived' && (
        <>
          {/* Archived Invoices Filter and Search */}
          <Card>
            <div className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Zoek gearchiveerde facturen..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>
                
                <select
                  value={companyFilter}
                  onChange={(e) => setCompanyFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="all">Alle bedrijven</option>
                  {companies.map(company => (
                    <option key={company.id} value={company.id}>{company.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </Card>

          {/* Archived Invoices List */}
          {filteredArchivedInvoices.length === 0 ? (
            <EmptyState
              icon={Archive}
              title="Geen gearchiveerde facturen"
              description={searchTerm || companyFilter !== 'all'
                ? "Geen gearchiveerde facturen gevonden die voldoen aan de filters"
                : "Goedgekeurde facturen worden hier gearchiveerd"}
            />
          ) : (
            <div className="grid gap-4">
              {filteredArchivedInvoices.map((invoice) => (
                <Card key={invoice.id}>
                  <div className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 flex-1">
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                            <CheckCircle className="h-6 w-6 text-green-600" />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-2">
                            <h3 className="text-lg font-medium text-gray-900">
                              {invoice.invoiceNumber}
                            </h3>
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Gearchiveerd
                            </span>
                            {invoice.ocrProcessed && (
                              <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-primary-100 text-primary-800">
                                <Scan className="h-3 w-3 mr-1" />
                                OCR
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500">
                            <div className="flex items-center">
                              <User className="h-4 w-4 mr-1" />
                              {invoice.supplierName}
                            </div>
                            <div className="flex items-center">
                              <Calendar className="h-4 w-4 mr-1" />
                              {invoice.invoiceDate.toLocaleDateString('nl-NL')}
                            </div>
                            <div className="flex items-center">
                              <Euro className="h-4 w-4 mr-1" />
                              €{invoice.totalAmount.toFixed(2)}
                            </div>
                            <div className="flex items-center text-xs text-gray-400">
                              Gearchiveerd: {invoice.archivedAt.toLocaleDateString('nl-NL')}
                            </div>
                          </div>
                          {invoice.ocrData && invoice.ocrData.confidence < 0.8 && (
                            <div className="mt-2 text-sm text-amber-600">
                              <AlertCircle className="h-4 w-4 inline mr-1" />
                              OCR betrouwbaarheid: {Math.round(invoice.ocrData.confidence * 100)}%
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Download}
                          onClick={() => downloadFile(invoice)}
                        >
                          Download
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Eye}
                          onClick={() => window.open(invoice.fileUrl, '_blank')}
                        >
                          Bekijken
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Instructions */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Google Drive Integratie</h3>
          <div className="space-y-3 text-sm text-gray-600">
            <p>
              <strong>Bestanden:</strong> Overzicht van alle bestanden in je Google Drive gestructureerd per bedrijf
            </p>
            <p>
              <strong>Gearchiveerde Facturen:</strong> Goedgekeurde facturen die zijn gearchiveerd in Google Drive met automatisch geëxtraheerde gegevens
            </p>
            <p>
              <strong>OCR Verwerking:</strong> PDF facturen worden automatisch gescand en de gegevens worden uitgepakt voor financiële administratie
            </p>
            <p>
              <strong>Bedragen:</strong> Alle factuurgegevens inclusief bedragen worden bewaard voor rapportage en administratieve doeleinden
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default DriveFiles;