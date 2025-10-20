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
  Folder
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useToast } from '../hooks/useToast';
import { EmptyState } from '../components/ui/EmptyState';

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

const DriveFiles: React.FC = () => {
  const { user } = useAuth();
  const { selectedCompany, companies } = useApp();
  const { success, error: showError } = useToast();
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
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
      // TODO: Implement Google Drive API calls
      // const [filesData, foldersData] = await Promise.all([
      //   getDriveFiles(user.uid, selectedCompany?.id),
      //   getDriveFolders(user.uid)
      // ]);
      
      // Mock data for now
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
      // TODO: Implement Drive sync
      await new Promise(resolve => setTimeout(resolve, 2000)); // Mock delay
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
      // TODO: Implement folder creation
      success('Mappen aangemaakt', 'Google Drive mappen zijn aangemaakt voor het bedrijf');
      loadDriveData();
    } catch (error) {
      showError('Fout bij aanmaken', 'Kon mappen niet aanmaken');
    }
  };

  const openInDrive = (file: DriveFile | DriveFolder) => {
    window.open(file.webViewLink, '_blank');
  };

  const downloadFile = async (file: DriveFile) => {
    try {
      if (file.downloadLink) {
        window.open(file.downloadLink, '_blank');
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
      case 'invoice': return 'text-blue-600 bg-blue-100';
      case 'export': return 'text-green-600 bg-green-100';
      case 'document': return 'text-purple-600 bg-purple-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getSyncStatusColor = (status: DriveFolder['syncStatus']) => {
    switch (status) {
      case 'synced': return 'text-green-600 bg-green-100';
      case 'syncing': return 'text-blue-600 bg-blue-100';
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
            Centraal overzicht van alle Google Drive bestanden
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

      {/* Company Folders Overview */}
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
                      <FolderOpen className="h-5 w-5 text-blue-600" />
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
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            
            <div className="flex space-x-2">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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

      {/* Instructions */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Google Drive Integratie</h3>
          <div className="space-y-3 text-sm text-gray-600">
            <p>
              <strong>Automatische sync:</strong> Bestanden die in de Drive worden geplaatst verschijnen automatisch hier
            </p>
            <p>
              <strong>Mappenstructuur:</strong> Voor elk bedrijf wordt een eigen map aangemaakt met submappen voor Facturen, Exports, etc.
            </p>
            <p>
              <strong>OCR scanning:</strong> PDF facturen worden automatisch gescand en de gegevens worden uitgepakt
            </p>
            <p>
              <strong>Toegang:</strong> Alleen geautoriseerde gebruikers hebben toegang tot de bedrijfsbestanden
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default DriveFiles;