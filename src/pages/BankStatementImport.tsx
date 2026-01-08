import React, { useState, useEffect, useCallback } from 'react';
import {
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  Clock,
  Trash2,
  ChevronDown,
  ChevronUp,
  Shield,
  Edit2,
  Save,
  Link,
  Search,
  RefreshCw,
  X,
  ArrowDownCircle,
  ArrowUpCircle,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useToast } from '../hooks/useToast';
import { EmptyState } from '../components/ui/EmptyState';
import { bankImportService } from '../services/bankImportService';
import { outgoingInvoiceService, OutgoingInvoice } from '../services/outgoingInvoiceService';
import { incomingInvoiceService, IncomingInvoice } from '../services/incomingInvoiceService';
import {
  BankTransaction,
  BankImport,
  MatchResult,
  CSVColumnMapping,
  MatchedInvoice,
} from '../types/bankImport';
import { format as formatDate } from 'date-fns';
import Modal from '../components/ui/Modal';

type TabType = 'all' | 'incoming' | 'outgoing';
type StatusFilter = 'all' | 'confirmed' | 'pending' | 'unmatched';

const BankStatementImport: React.FC = () => {
  const { user, userRole } = useAuth();
  const { selectedCompany, queryUserId } = useApp();
  const { success, error: showError } = useToast();

  const [rawData, setRawData] = useState('');
  const [format, setFormat] = useState<'CSV' | 'MT940'>('CSV');
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [imports, setImports] = useState<BankImport[]>([]);
  const [expandedImport, setExpandedImport] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [editingTransaction, setEditingTransaction] = useState<string | null>(null);
  const [editedData, setEditedData] = useState<Partial<BankTransaction>>({});

  const [linkingTransaction, setLinkingTransaction] = useState<MatchResult | null>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [invoiceSearchTerm, setInvoiceSearchTerm] = useState('');

  const [outgoingInvoices, setOutgoingInvoices] = useState<OutgoingInvoice[]>([]);
  const [incomingInvoices, setIncomingInvoices] = useState<IncomingInvoice[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const [importTransactions, setImportTransactions] = useState<Map<string, BankTransaction[]>>(new Map());

  const safeFormatDate = (date: Date | number | string | undefined, fmt: string): string => {
    if (!date) return 'Onbekend';
    try {
      let dateObj: Date;
      if (date instanceof Date) {
        dateObj = date;
      } else if (typeof date === 'number') {
        dateObj = new Date(date);
      } else if (typeof date === 'string') {
        dateObj = new Date(date);
      } else {
        return 'Onbekend';
      }
      if (isNaN(dateObj.getTime())) return 'Ongeldige datum';
      return formatDate(dateObj, fmt);
    } catch (error) {
      return 'Ongeldige datum';
    }
  };

  if (userRole !== 'admin') {
    return (
      <div className="p-6">
        <EmptyState
          icon={Shield}
          title="Geen toegang"
          description="Alleen administrators kunnen bankafschriften importeren"
        />
      </div>
    );
  }

  const loadInvoices = useCallback(async () => {
    if (!selectedCompany || !queryUserId) return;
    try {
      const [outgoing, incoming] = await Promise.all([
        outgoingInvoiceService.getInvoices(queryUserId, selectedCompany.id),
        incomingInvoiceService.getInvoices(queryUserId, selectedCompany.id),
      ]);
      setOutgoingInvoices(outgoing);
      setIncomingInvoices(incoming);
    } catch (e) {
      console.error('Error loading invoices:', e);
    }
  }, [selectedCompany, queryUserId]);

  const loadImportHistory = useCallback(async () => {
    if (!selectedCompany) return;
    try {
      const history = await bankImportService.getImports(selectedCompany.id);
      setImports(history);

      const transactionsMap = new Map<string, BankTransaction[]>();
      for (const imp of history) {
        const transactions = await bankImportService.getTransactionsByImport(
          selectedCompany.id,
          imp.id
        );
        transactionsMap.set(imp.id, transactions);
      }
      setImportTransactions(transactionsMap);
    } catch (e: any) {
      console.error('Error loading import history:', e);
    }
  }, [selectedCompany]);

  useEffect(() => {
    loadImportHistory();
    loadInvoices();
  }, [loadImportHistory, loadInvoices]);

  const handleParse = async () => {
    if (!rawData.trim()) {
      showError('Fout', 'Plak eerst een bankafschrift');
      return;
    }

    if (!selectedCompany || !queryUserId) {
      showError('Fout', 'Selecteer eerst een bedrijf');
      return;
    }

    try {
      setLoading(true);

      let parsedTransactions: any[] = [];

      if (format === 'CSV') {
        const parsed = bankImportService.parseCSV(rawData);
        parsedTransactions = bankImportService.parseCSVRows(
          parsed.rows,
          parsed.detectedFormat
        );
      } else {
        parsedTransactions = bankImportService.parseMT940(rawData);
      }

      const enrichedTransactions: BankTransaction[] = parsedTransactions.map((t, idx) => ({
        ...t,
        id: `temp-${idx}`,
        type: t.amount >= 0 ? 'outgoing' : 'incoming',
        status: 'unmatched' as const,
        companyId: selectedCompany.id,
        importId: 'temp',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));

      const results = await bankImportService.matchTransactions(
        enrichedTransactions,
        queryUserId,
        selectedCompany.id
      );

      setMatchResults(results);
      setShowPreview(true);
      success('Geslaagd', `${parsedTransactions.length} transacties geparsed`);
    } catch (e: any) {
      showError('Parse fout', e.message || 'Kon bankafschrift niet verwerken');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!selectedCompany || !user || !queryUserId) return;

    try {
      setImporting(true);

      const confirmed = matchResults.filter(r => r.status === 'confirmed');
      const pending = matchResults.filter(r => r.status === 'pending');
      const unmatched = matchResults.filter(r => r.status === 'unmatched');

      const importData: Omit<BankImport, 'id'> = {
        companyId: selectedCompany.id,
        companyName: selectedCompany.name,
        importedBy: user.uid,
        importedByName: user.displayName || user.email || 'Unknown',
        totalLines: matchResults.length,
        format,
        confirmedCount: confirmed.length,
        pendingCount: pending.length,
        unmatchedCount: unmatched.length,
        rawData: rawData.substring(0, 10000),
        importedAt: Date.now(),
      };

      const importId = await bankImportService.saveImport(importData);

      const allTransactions: BankTransaction[] = matchResults.map((r) => ({
        ...r.transaction,
        importId,
        status: r.status,
        confidence: r.confidence,
        matchedInvoiceId: r.matchedInvoice?.invoiceId,
        matchedInvoiceType: r.matchedInvoice?.type,
      }));

      await bankImportService.saveTransactions(allTransactions, selectedCompany.id, importId);

      let confirmedCount = 0;
      for (const result of confirmed) {
        if (result.matchedInvoice?.invoiceId) {
          try {
            const transactionDoc = allTransactions.find(t => t.id === result.transaction.id);
            if (transactionDoc) {
              await bankImportService.confirmTransaction(
                transactionDoc.id,
                selectedCompany.id,
                user.uid,
                user.displayName || user.email || 'Unknown'
              );
              confirmedCount++;
            }
          } catch (e) {
            console.error('Error confirming transaction:', e);
          }
        }
      }

      success(
        'Import geslaagd',
        `${confirmed.length} bevestigd, ${pending.length} ter beoordeling, ${unmatched.length} onbekend. ${confirmedCount} facturen gemarkeerd als betaald.`
      );

      setRawData('');
      setMatchResults([]);
      setShowPreview(false);
      loadImportHistory();
      loadInvoices();
    } catch (e: any) {
      showError('Import fout', e.message || 'Kon import niet opslaan');
      console.error(e);
    } finally {
      setImporting(false);
    }
  };

  const handleDeleteImport = async (importId: string) => {
    if (!selectedCompany) return;
    if (!confirm('Weet je zeker dat je deze import wilt verwijderen?')) return;

    try {
      await bankImportService.deleteImport(selectedCompany.id, importId);
      success('Verwijderd', 'Import is verwijderd');
      loadImportHistory();
    } catch (e) {
      showError('Fout', 'Kon import niet verwijderen');
    }
  };

  const handleEditTransaction = (transaction: BankTransaction) => {
    setEditingTransaction(transaction.id);
    setEditedData({
      date: transaction.date,
      amount: transaction.amount,
      description: transaction.description,
      beneficiary: transaction.beneficiary,
    });
  };

  const handleSaveEdit = async (transactionId: string) => {
    if (!user || !selectedCompany) return;

    try {
      await bankImportService.updateTransaction(
        transactionId,
        editedData,
        user.uid,
        user.displayName || user.email || 'Unknown'
      );
      success('Opgeslagen', 'Transactie bijgewerkt');
      setEditingTransaction(null);
      setEditedData({});
      loadImportHistory();
    } catch (e: any) {
      showError('Fout', e.message || 'Kon transactie niet bijwerken');
    }
  };

  const handleRefreshMatch = async (transactionId: string) => {
    if (!user || !selectedCompany || !queryUserId) return;

    try {
      setRefreshing(true);
      const results = await bankImportService.rematchTransactions(
        [transactionId],
        queryUserId,
        selectedCompany.id
      );

      if (results.length > 0 && results[0].matchedInvoice) {
        await bankImportService.updateTransaction(
          transactionId,
          {
            matchedInvoiceId: results[0].matchedInvoice.invoiceId,
            matchedInvoiceType: results[0].matchedInvoice.type,
            confidence: results[0].confidence,
            status: results[0].status,
          },
          user.uid,
          user.displayName || user.email || 'Unknown'
        );
        success('Vernieuwd', 'Match bijgewerkt');
      } else {
        success('Geen match', 'Geen nieuwe match gevonden');
      }

      loadImportHistory();
    } catch (e: any) {
      showError('Fout', e.message || 'Kon match niet vernieuwen');
    } finally {
      setRefreshing(false);
    }
  };

  const handleConfirmTransaction = async (transactionId: string) => {
    if (!user || !selectedCompany) return;

    try {
      await bankImportService.confirmTransaction(
        transactionId,
        selectedCompany.id,
        user.uid,
        user.displayName || user.email || 'Unknown'
      );
      success('Bevestigd', 'Transactie bevestigd en factuur gemarkeerd als betaald');
      loadImportHistory();
      loadInvoices();
    } catch (e: any) {
      showError('Fout', e.message || 'Kon transactie niet bevestigen');
    }
  };

  const handleUnconfirmTransaction = async (transactionId: string) => {
    if (!selectedCompany) return;
    if (!confirm('Weet je zeker dat je deze bevestiging wilt terugdraaien?')) return;

    try {
      await bankImportService.unconfirmTransaction(transactionId, selectedCompany.id);
      success('Teruggedraaid', 'Bevestiging teruggedraaid');
      loadImportHistory();
      loadInvoices();
    } catch (e: any) {
      showError('Fout', e.message || 'Kon bevestiging niet terugdraaien');
    }
  };

  const handleOpenLinkModal = (result: MatchResult) => {
    setLinkingTransaction(result);
    setShowLinkModal(true);
    setInvoiceSearchTerm('');
  };

  const handleLinkInvoice = async (
    invoice: OutgoingInvoice | IncomingInvoice,
    type: 'outgoing' | 'incoming'
  ) => {
    if (!linkingTransaction || !user || !selectedCompany) return;

    try {
      const transactionId = linkingTransaction.transaction.id;

      await bankImportService.updateTransaction(
        transactionId,
        {
          matchedInvoiceId: invoice.id || '',
          matchedInvoiceType: type,
          confidence: 100,
          status: 'pending',
        },
        user.uid,
        user.displayName || user.email || 'Unknown'
      );

      success('Gekoppeld', `Transactie gekoppeld aan ${invoice.invoiceNumber}`);
      setShowLinkModal(false);
      setLinkingTransaction(null);
      loadImportHistory();
    } catch (e: any) {
      showError('Fout', e.message || 'Kon koppeling niet opslaan');
    }
  };

  const handleUnlinkTransaction = async (transactionId: string) => {
    if (!user || !selectedCompany) return;
    if (!confirm('Weet je zeker dat je deze koppeling wilt verwijderen?')) return;

    try {
      await bankImportService.updateTransaction(
        transactionId,
        {
          matchedInvoiceId: undefined,
          matchedInvoiceType: undefined,
          status: 'unmatched',
          confidence: 0,
        },
        user.uid,
        user.displayName || user.email || 'Unknown'
      );
      success('Ontkoppeld', 'Koppeling verwijderd');
      loadImportHistory();
    } catch (e: any) {
      showError('Fout', e.message || 'Kon koppeling niet verwijderen');
    }
  };

  const getStatusBadge = (status: 'confirmed' | 'pending' | 'unmatched', confidence?: number) => {
    if (status === 'confirmed') {
      return (
        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
          <CheckCircle className="w-3 h-3 mr-1" />
          Bevestigd ({confidence}%)
        </span>
      );
    } else if (status === 'pending') {
      return (
        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
          <Clock className="w-3 h-3 mr-1" />
          Ter beoordeling ({confidence}%)
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
          <AlertCircle className="w-3 h-3 mr-1" />
          Geen match
        </span>
      );
    }
  };

  const filteredPreviewResults = matchResults.filter((r) => {
    if (activeTab === 'incoming' && r.transaction.type !== 'incoming') return false;
    if (activeTab === 'outgoing' && r.transaction.type !== 'outgoing') return false;
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    return true;
  });

  const confirmedResults = matchResults.filter(r => r.status === 'confirmed');
  const pendingResults = matchResults.filter(r => r.status === 'pending');
  const unmatchedResults = matchResults.filter(r => r.status === 'unmatched');

  if (!selectedCompany) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Upload}
          title="Geen bedrijf geselecteerd"
          description="Selecteer eerst een bedrijf om bankafschriften te importeren"
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Bankafschrift Import
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Import en match bankafschriften met facturen
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-3 py-1 text-sm font-medium rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
            <Shield className="w-4 h-4 mr-1" />
            Admin Only
          </span>
        </div>
      </div>

      <Card>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Nieuw bankafschrift importeren
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFormat('CSV')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  format === 'CSV'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                CSV
              </button>
              <button
                onClick={() => setFormat('MT940')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  format === 'MT940'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                MT940
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Plak bankafschrift hier
            </label>
            <textarea
              value={rawData}
              onChange={(e) => setRawData(e.target.value)}
              rows={10}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm"
              placeholder={
                format === 'CSV'
                  ? 'Datum;Bedrag;Omschrijving;Begunstigde\n2024-01-15;1250.00;Factuur 2024-001;Klant BV'
                  : ':20:STMT001\n:25:NL12BANK0123456789\n:28C:001/001\n:60F:C240115EUR1000,00'
              }
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleParse} disabled={loading || !rawData.trim()} className="flex-1">
              {loading ? (
                <>
                  <LoadingSpinner size="sm" />
                  Verwerken...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  Verwerk en Match
                </>
              )}
            </Button>
            <Button
              onClick={() => {
                setRawData('');
                setMatchResults([]);
                setShowPreview(false);
              }}
              variant="outline"
            >
              <X className="w-4 h-4 mr-2" />
              Wissen
            </Button>
          </div>
        </div>
      </Card>

      {showPreview && matchResults.length > 0 && (
        <Card>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Importvoorbeeld ({matchResults.length} transacties)
              </h2>
              <div className="flex gap-3 text-sm">
                <span className="flex items-center text-green-600 dark:text-green-400">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  {confirmedResults.length} bevestigd
                </span>
                <span className="flex items-center text-yellow-600 dark:text-yellow-400">
                  <Clock className="w-4 h-4 mr-1" />
                  {pendingResults.length} ter beoordeling
                </span>
                <span className="flex items-center text-gray-600 dark:text-gray-400">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {unmatchedResults.length} geen match
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                Alle
              </button>
              <button
                onClick={() => setActiveTab('outgoing')}
                className={`flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === 'outgoing'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                Uitgaand ({matchResults.filter(r => r.transaction.type === 'outgoing').length})
              </button>
              <button
                onClick={() => setActiveTab('incoming')}
                className={`flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === 'incoming'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                <TrendingDown className="w-4 h-4" />
                Inkomend ({matchResults.filter(r => r.transaction.type === 'incoming').length})
              </button>
            </div>

            <div className="space-y-6">
              {confirmedResults.length > 0 && (
                <div>
                  <h3 className="text-md font-semibold text-green-600 dark:text-green-400 mb-3 flex items-center">
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Bevestigd ({confirmedResults.length})
                  </h3>
                  <div className="space-y-2">
                    {confirmedResults
                      .filter((r) => {
                        if (activeTab === 'incoming' && r.transaction.type !== 'incoming') return false;
                        if (activeTab === 'outgoing' && r.transaction.type !== 'outgoing') return false;
                        return true;
                      })
                      .map((result, index) => (
                        <div
                          key={index}
                          className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg"
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                {result.transaction.type === 'outgoing' ? (
                                  <TrendingUp className="w-4 h-4 text-green-600" />
                                ) : (
                                  <TrendingDown className="w-4 h-4 text-red-600" />
                                )}
                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                  {safeFormatDate(result.transaction.date, 'dd-MM-yyyy')}
                                </span>
                                <span
                                  className={`text-sm font-bold ${
                                    result.transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'
                                  }`}
                                >
                                  € {Math.abs(result.transaction.amount).toFixed(2)}
                                </span>
                                {getStatusBadge(result.status, result.confidence)}
                              </div>
                              <div className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                                {result.transaction.description}
                              </div>
                              {result.transaction.beneficiary && (
                                <div className="text-xs text-gray-600 dark:text-gray-400">
                                  Begunstigde: {result.transaction.beneficiary}
                                </div>
                              )}
                              {result.matchedInvoice && (
                                <div className="mt-2 text-xs">
                                  <span className="font-medium text-gray-900 dark:text-white">
                                    Gematcht met: {result.matchedInvoice.invoiceNumber}
                                  </span>
                                  <span className="text-gray-600 dark:text-gray-400 ml-2">
                                    {result.matchedInvoice.clientName}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {pendingResults.length > 0 && (
                <div>
                  <h3 className="text-md font-semibold text-yellow-600 dark:text-yellow-400 mb-3 flex items-center">
                    <Clock className="w-5 h-5 mr-2" />
                    Ter beoordeling ({pendingResults.length})
                  </h3>
                  <div className="space-y-2">
                    {pendingResults
                      .filter((r) => {
                        if (activeTab === 'incoming' && r.transaction.type !== 'incoming') return false;
                        if (activeTab === 'outgoing' && r.transaction.type !== 'outgoing') return false;
                        return true;
                      })
                      .map((result, index) => (
                        <div
                          key={index}
                          className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg"
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                {result.transaction.type === 'outgoing' ? (
                                  <TrendingUp className="w-4 h-4 text-green-600" />
                                ) : (
                                  <TrendingDown className="w-4 h-4 text-red-600" />
                                )}
                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                  {safeFormatDate(result.transaction.date, 'dd-MM-yyyy')}
                                </span>
                                <span
                                  className={`text-sm font-bold ${
                                    result.transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'
                                  }`}
                                >
                                  € {Math.abs(result.transaction.amount).toFixed(2)}
                                </span>
                                {getStatusBadge(result.status, result.confidence)}
                              </div>
                              <div className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                                {result.transaction.description}
                              </div>
                              {result.transaction.beneficiary && (
                                <div className="text-xs text-gray-600 dark:text-gray-400">
                                  Begunstigde: {result.transaction.beneficiary}
                                </div>
                              )}
                              {result.matchedInvoice && (
                                <div className="mt-2 text-xs">
                                  <span className="font-medium text-gray-900 dark:text-white">
                                    Mogelijk: {result.matchedInvoice.invoiceNumber}
                                  </span>
                                  <span className="text-gray-600 dark:text-gray-400 ml-2">
                                    {result.matchedInvoice.clientName}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {unmatchedResults.length > 0 && (
                <div>
                  <h3 className="text-md font-semibold text-gray-600 dark:text-gray-400 mb-3 flex items-center">
                    <AlertCircle className="w-5 h-5 mr-2" />
                    Geen match ({unmatchedResults.length})
                  </h3>
                  <div className="space-y-2">
                    {unmatchedResults
                      .filter((r) => {
                        if (activeTab === 'incoming' && r.transaction.type !== 'incoming') return false;
                        if (activeTab === 'outgoing' && r.transaction.type !== 'outgoing') return false;
                        return true;
                      })
                      .map((result, index) => (
                        <div
                          key={index}
                          className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                {result.transaction.type === 'outgoing' ? (
                                  <TrendingUp className="w-4 h-4 text-green-600" />
                                ) : (
                                  <TrendingDown className="w-4 h-4 text-red-600" />
                                )}
                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                  {safeFormatDate(result.transaction.date, 'dd-MM-yyyy')}
                                </span>
                                <span
                                  className={`text-sm font-bold ${
                                    result.transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'
                                  }`}
                                >
                                  € {Math.abs(result.transaction.amount).toFixed(2)}
                                </span>
                                {getStatusBadge(result.status, result.confidence)}
                              </div>
                              <div className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                                {result.transaction.description}
                              </div>
                              {result.transaction.beneficiary && (
                                <div className="text-xs text-gray-600 dark:text-gray-400">
                                  Begunstigde: {result.transaction.beneficiary}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button onClick={handleImport} disabled={importing}>
                {importing ? (
                  <>
                    <LoadingSpinner size="sm" />
                    Importeren...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Importeer {matchResults.length} transacties
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <div className="p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Import Geschiedenis
          </h2>

          {imports.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Nog geen imports"
              description="Je hebt nog geen bankafschriften geïmporteerd"
            />
          ) : (
            <div className="space-y-2">
              {imports.map((imp) => {
                const transactions = importTransactions.get(imp.id) || [];
                const confirmed = transactions.filter(t => t.status === 'confirmed');
                const pending = transactions.filter(t => t.status === 'pending');
                const unmatched = transactions.filter(t => t.status === 'unmatched');

                return (
                  <div
                    key={imp.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                  >
                    <div
                      className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                      onClick={() => setExpandedImport(expandedImport === imp.id ? null : imp.id)}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {safeFormatDate(imp.importedAt, 'dd-MM-yyyy HH:mm')}
                          </span>
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            {imp.format}
                          </span>
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            {imp.totalLines} regels
                          </span>
                          <span className="text-xs text-green-600">
                            {confirmed.length} bevestigd
                          </span>
                          <span className="text-xs text-yellow-600">
                            {pending.length} ter beoordeling
                          </span>
                          <span className="text-xs text-gray-600">
                            {unmatched.length} geen match
                          </span>
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          Door: {imp.importedByName}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteImport(imp.id);
                          }}
                          className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        {expandedImport === imp.id ? (
                          <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </div>

                    {expandedImport === imp.id && transactions.length > 0 && (
                      <div className="p-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 space-y-4">
                        {confirmed.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium text-green-600 dark:text-green-400 mb-2 flex items-center">
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Bevestigd ({confirmed.length})
                            </h4>
                            <div className="space-y-1">
                              {confirmed.map((t) => (
                                <div
                                  key={t.id}
                                  className="text-xs p-3 bg-white dark:bg-gray-900 rounded border border-green-200 dark:border-green-800 flex justify-between items-center"
                                >
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      {t.type === 'outgoing' ? (
                                        <TrendingUp className="w-3 h-3 text-green-600" />
                                      ) : (
                                        <TrendingDown className="w-3 h-3 text-red-600" />
                                      )}
                                      <span>{safeFormatDate(t.date, 'dd-MM-yyyy')}</span>
                                      <span className={t.amount >= 0 ? 'text-green-600' : 'text-red-600'}>
                                        € {Math.abs(t.amount).toFixed(2)}
                                      </span>
                                    </div>
                                    <div className="text-gray-600 dark:text-gray-400">{t.description}</div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => handleUnconfirmTransaction(t.id)}
                                      className="p-1 text-yellow-600 hover:bg-yellow-100 dark:hover:bg-yellow-900 rounded"
                                      title="Terugdraaien"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {pending.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium text-yellow-600 dark:text-yellow-400 mb-2 flex items-center">
                              <Clock className="w-4 h-4 mr-1" />
                              Ter beoordeling ({pending.length})
                            </h4>
                            <div className="space-y-1">
                              {pending.map((t) => {
                                const isEditing = editingTransaction === t.id;

                                return (
                                  <div
                                    key={t.id}
                                    className="text-xs p-3 bg-white dark:bg-gray-900 rounded border border-yellow-200 dark:border-yellow-800"
                                  >
                                    {isEditing ? (
                                      <div className="space-y-2">
                                        <div className="grid grid-cols-2 gap-2">
                                          <input
                                            type="date"
                                            value={
                                              editedData.date
                                                ? safeFormatDate(editedData.date, 'yyyy-MM-dd')
                                                : ''
                                            }
                                            onChange={(e) =>
                                              setEditedData({
                                                ...editedData,
                                                date: new Date(e.target.value).getTime(),
                                              })
                                            }
                                            className="px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600"
                                          />
                                          <input
                                            type="number"
                                            step="0.01"
                                            value={editedData.amount || 0}
                                            onChange={(e) =>
                                              setEditedData({
                                                ...editedData,
                                                amount: parseFloat(e.target.value),
                                              })
                                            }
                                            className="px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600"
                                          />
                                        </div>
                                        <input
                                          type="text"
                                          value={editedData.description || ''}
                                          onChange={(e) =>
                                            setEditedData({ ...editedData, description: e.target.value })
                                          }
                                          className="w-full px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600"
                                        />
                                        <div className="flex gap-1">
                                          <button
                                            onClick={() => handleSaveEdit(t.id)}
                                            className="px-2 py-1 bg-green-600 text-white rounded text-xs"
                                          >
                                            Opslaan
                                          </button>
                                          <button
                                            onClick={() => {
                                              setEditingTransaction(null);
                                              setEditedData({});
                                            }}
                                            className="px-2 py-1 bg-gray-600 text-white rounded text-xs"
                                          >
                                            Annuleren
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex justify-between items-center">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2 mb-1">
                                            {t.type === 'outgoing' ? (
                                              <TrendingUp className="w-3 h-3 text-green-600" />
                                            ) : (
                                              <TrendingDown className="w-3 h-3 text-red-600" />
                                            )}
                                            <span>{safeFormatDate(t.date, 'dd-MM-yyyy')}</span>
                                            <span
                                              className={t.amount >= 0 ? 'text-green-600' : 'text-red-600'}
                                            >
                                              € {Math.abs(t.amount).toFixed(2)}
                                            </span>
                                          </div>
                                          <div className="text-gray-600 dark:text-gray-400">
                                            {t.description}
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <button
                                            onClick={() => handleEditTransaction(t)}
                                            className="p-1 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900 rounded"
                                            title="Bewerken"
                                          >
                                            <Edit2 className="w-3 h-3" />
                                          </button>
                                          <button
                                            onClick={() => handleRefreshMatch(t.id)}
                                            className="p-1 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900 rounded"
                                            title="Ververs match"
                                            disabled={refreshing}
                                          >
                                            <RefreshCw
                                              className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`}
                                            />
                                          </button>
                                          {t.matchedInvoiceId ? (
                                            <>
                                              <button
                                                onClick={() => handleConfirmTransaction(t.id)}
                                                className="p-1 text-green-600 hover:bg-green-100 dark:hover:bg-green-900 rounded"
                                                title="Bevestigen"
                                              >
                                                <CheckCircle className="w-3 h-3" />
                                              </button>
                                              <button
                                                onClick={() => handleUnlinkTransaction(t.id)}
                                                className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900 rounded"
                                                title="Ontkoppelen"
                                              >
                                                <X className="w-3 h-3" />
                                              </button>
                                            </>
                                          ) : (
                                            <button
                                              onClick={() => {
                                                const result: MatchResult = {
                                                  transaction: t,
                                                  status: t.status,
                                                  confidence: t.confidence || 0,
                                                };
                                                handleOpenLinkModal(result);
                                              }}
                                              className="p-1 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900 rounded"
                                              title="Handmatig koppelen"
                                            >
                                              <Link className="w-3 h-3" />
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {unmatched.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 flex items-center">
                              <AlertCircle className="w-4 h-4 mr-1" />
                              Geen match ({unmatched.length})
                            </h4>
                            <div className="space-y-1">
                              {unmatched.map((t) => {
                                const isEditing = editingTransaction === t.id;

                                return (
                                  <div
                                    key={t.id}
                                    className="text-xs p-3 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700"
                                  >
                                    {isEditing ? (
                                      <div className="space-y-2">
                                        <div className="grid grid-cols-2 gap-2">
                                          <input
                                            type="date"
                                            value={
                                              editedData.date
                                                ? safeFormatDate(editedData.date, 'yyyy-MM-dd')
                                                : ''
                                            }
                                            onChange={(e) =>
                                              setEditedData({
                                                ...editedData,
                                                date: new Date(e.target.value).getTime(),
                                              })
                                            }
                                            className="px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600"
                                          />
                                          <input
                                            type="number"
                                            step="0.01"
                                            value={editedData.amount || 0}
                                            onChange={(e) =>
                                              setEditedData({
                                                ...editedData,
                                                amount: parseFloat(e.target.value),
                                              })
                                            }
                                            className="px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600"
                                          />
                                        </div>
                                        <input
                                          type="text"
                                          value={editedData.description || ''}
                                          onChange={(e) =>
                                            setEditedData({ ...editedData, description: e.target.value })
                                          }
                                          className="w-full px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600"
                                        />
                                        <div className="flex gap-1">
                                          <button
                                            onClick={() => handleSaveEdit(t.id)}
                                            className="px-2 py-1 bg-green-600 text-white rounded text-xs"
                                          >
                                            Opslaan
                                          </button>
                                          <button
                                            onClick={() => {
                                              setEditingTransaction(null);
                                              setEditedData({});
                                            }}
                                            className="px-2 py-1 bg-gray-600 text-white rounded text-xs"
                                          >
                                            Annuleren
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex justify-between items-center">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2 mb-1">
                                            {t.type === 'outgoing' ? (
                                              <TrendingUp className="w-3 h-3 text-green-600" />
                                            ) : (
                                              <TrendingDown className="w-3 h-3 text-red-600" />
                                            )}
                                            <span>{safeFormatDate(t.date, 'dd-MM-yyyy')}</span>
                                            <span
                                              className={t.amount >= 0 ? 'text-green-600' : 'text-red-600'}
                                            >
                                              € {Math.abs(t.amount).toFixed(2)}
                                            </span>
                                          </div>
                                          <div className="text-gray-600 dark:text-gray-400">
                                            {t.description}
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <button
                                            onClick={() => handleEditTransaction(t)}
                                            className="p-1 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900 rounded"
                                            title="Bewerken"
                                          >
                                            <Edit2 className="w-3 h-3" />
                                          </button>
                                          <button
                                            onClick={() => handleRefreshMatch(t.id)}
                                            className="p-1 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900 rounded"
                                            title="Ververs match"
                                            disabled={refreshing}
                                          >
                                            <RefreshCw
                                              className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`}
                                            />
                                          </button>
                                          <button
                                            onClick={() => {
                                              const result: MatchResult = {
                                                transaction: t,
                                                status: t.status,
                                                confidence: t.confidence || 0,
                                              };
                                              handleOpenLinkModal(result);
                                            }}
                                            className="p-1 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900 rounded"
                                            title="Handmatig koppelen"
                                          >
                                            <Link className="w-3 h-3" />
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      {showLinkModal && linkingTransaction && (
        <Modal
          isOpen={showLinkModal}
          onClose={() => {
            setShowLinkModal(false);
            setLinkingTransaction(null);
            setInvoiceSearchTerm('');
          }}
          title="Koppel aan factuur"
          size="lg"
        >
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Transactie</h3>
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Datum:</span>{' '}
                    {safeFormatDate(linkingTransaction.transaction.date, 'dd-MM-yyyy')}
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Bedrag:</span>{' '}
                    <span
                      className={
                        linkingTransaction.transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'
                      }
                    >
                      € {Math.abs(linkingTransaction.transaction.amount).toFixed(2)}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-600 dark:text-gray-400">Omschrijving:</span>{' '}
                    {linkingTransaction.transaction.description}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Zoek factuur
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={invoiceSearchTerm}
                  onChange={(e) => setInvoiceSearchTerm(e.target.value)}
                  placeholder="Zoek op factuurnummer of klant/leverancier"
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto space-y-2">
              {linkingTransaction.transaction.type === 'outgoing' ? (
                <>
                  <h4 className="text-sm font-medium text-green-600 mb-2">Uitgaande facturen</h4>
                  {outgoingInvoices
                    .filter(
                      (inv) =>
                        !invoiceSearchTerm ||
                        inv.invoiceNumber.toLowerCase().includes(invoiceSearchTerm.toLowerCase()) ||
                        inv.clientName.toLowerCase().includes(invoiceSearchTerm.toLowerCase())
                    )
                    .map((invoice) => (
                      <button
                        key={invoice.id}
                        onClick={() => handleLinkInvoice(invoice, 'outgoing')}
                        className="w-full p-3 text-left border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">
                              {invoice.invoiceNumber}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              {invoice.clientName}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {safeFormatDate(invoice.invoiceDate, 'dd-MM-yyyy')}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium text-gray-900 dark:text-white">
                              € {invoice.totalAmount.toFixed(2)}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">{invoice.status}</div>
                          </div>
                        </div>
                      </button>
                    ))}
                </>
              ) : (
                <>
                  <h4 className="text-sm font-medium text-red-600 mb-2">Inkomende facturen</h4>
                  {incomingInvoices
                    .filter(
                      (inv) =>
                        !invoiceSearchTerm ||
                        inv.invoiceNumber.toLowerCase().includes(invoiceSearchTerm.toLowerCase()) ||
                        inv.supplierName.toLowerCase().includes(invoiceSearchTerm.toLowerCase())
                    )
                    .map((invoice) => (
                      <button
                        key={invoice.id}
                        onClick={() => handleLinkInvoice(invoice, 'incoming')}
                        className="w-full p-3 text-left border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">
                              {invoice.invoiceNumber}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              {invoice.supplierName}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {safeFormatDate(invoice.invoiceDate, 'dd-MM-yyyy')}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium text-gray-900 dark:text-white">
                              € {invoice.totalAmount.toFixed(2)}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">{invoice.status}</div>
                          </div>
                        </div>
                      </button>
                    ))}
                </>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default BankStatementImport;
