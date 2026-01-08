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
  DollarSign,
  Calendar,
  User,
  X,
  Edit2,
  Save,
  Link,
  Search,
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

const BankStatementImport: React.FC = () => {
  const { user, userRole } = useAuth();
  const { selectedCompany, queryUserId } = useApp();
  const { success, error: showError } = useToast();

  const [rawData, setRawData] = useState('');
  const [format, setFormat] = useState<'CSV' | 'MT940'>('CSV');
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [imports, setImports] = useState<BankImport[]>([]);
  const [expandedImport, setExpandedImport] = useState<string | null>(null);
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editedTransaction, setEditedTransaction] = useState<BankTransaction | null>(null);
  const [columnMapping, setColumnMapping] = useState<CSVColumnMapping | null>(null);
  const [showColumnMapping, setShowColumnMapping] = useState(false);
  const [dbPermissionError, setDbPermissionError] = useState(false);
  const [linkingTransaction, setLinkingTransaction] = useState<BankTransaction | null>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [outgoingInvoices, setOutgoingInvoices] = useState<OutgoingInvoice[]>([]);
  const [incomingInvoices, setIncomingInvoices] = useState<IncomingInvoice[]>([]);
  const [invoiceSearchTerm, setInvoiceSearchTerm] = useState('');

  const safeFormatDate = (date: Date | number | string | undefined, format: string): string => {
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

      if (isNaN(dateObj.getTime())) {
        return 'Ongeldige datum';
      }

      return formatDate(dateObj, format);
    } catch (error) {
      console.error('Error formatting date:', error, date);
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
      setDbPermissionError(false);
    } catch (e: any) {
      console.error('Error loading import history:', e);
      if (e.code === 'PERMISSION_DENIED' || e.message?.includes('Permission denied')) {
        setDbPermissionError(true);
      }
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

      let parsedTransactions: BankTransaction[] = [];

      if (format === 'CSV') {
        const parsed = bankImportService.parseCSV(rawData);
        setColumnMapping(parsed.detectedFormat);
        parsedTransactions = bankImportService.parseCSVRows(
          parsed.rows,
          parsed.detectedFormat
        );
      } else {
        parsedTransactions = bankImportService.parseMT940(rawData);
      }

      setTransactions(parsedTransactions);

      const results = await bankImportService.matchTransactions(
        parsedTransactions,
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

      const matched = matchResults.filter(r => r.status === 'matched' || r.status === 'partial' || r.status === 'manual');
      const unmatched = matchResults.filter(r => r.status === 'unmatched');

      const importData = {
        companyId: selectedCompany.id,
        companyName: selectedCompany.name,
        importedBy: user.uid,
        importedByName: user.displayName || user.email || 'Unknown',
        totalLines: transactions.length,
        format,
        matchedCount: matched.length,
        unmatchedCount: unmatched.length,
        matchedTransactions: matched.map(m => ({
          transaction: m.transaction,
          matchedInvoice: m.matchedInvoice!,
        })),
        unmatchedTransactions: unmatched.map(u => u.transaction),
        rawData: rawData.substring(0, 10000),
        importedAt: Date.now(),
      };

      await bankImportService.saveImport(importData);

      let updatedCount = 0;
      for (const match of matched) {
        if (match.matchedInvoice && match.matchedInvoice.invoiceId) {
          try {
            if (match.matchedInvoice.type === 'outgoing') {
              await outgoingInvoiceService.markAsPaid(match.matchedInvoice.invoiceId);
              updatedCount++;
            } else if (match.matchedInvoice.type === 'incoming') {
              await incomingInvoiceService.markAsPaid(match.matchedInvoice.invoiceId);
              updatedCount++;
            }
          } catch (updateError) {
            console.error(`Failed to update invoice ${match.matchedInvoice.invoiceNumber}:`, updateError);
          }
        }
      }

      success(
        'Import geslaagd',
        `${matched.length} gematcht, ${unmatched.length} niet gematcht. ${updatedCount} facturen gemarkeerd als betaald.`
      );

      setRawData('');
      setTransactions([]);
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

  const handleEditRow = (transaction: BankTransaction) => {
    setEditingRow(transaction.id);
    setEditedTransaction({ ...transaction });
  };

  const handleSaveEdit = () => {
    if (!editedTransaction) return;

    setTransactions(prev =>
      prev.map(t => (t.id === editedTransaction.id ? editedTransaction : t))
    );

    const updatedResults = matchResults.map(r =>
      r.transaction.id === editedTransaction.id
        ? { ...r, transaction: editedTransaction }
        : r
    );
    setMatchResults(updatedResults);

    setEditingRow(null);
    setEditedTransaction(null);
    success('Opgeslagen', 'Transactie bijgewerkt');
  };

  const handleCancelEdit = () => {
    setEditingRow(null);
    setEditedTransaction(null);
  };

  const handleOpenLinkModal = (transaction: BankTransaction) => {
    setLinkingTransaction(transaction);
    setShowLinkModal(true);
    setInvoiceSearchTerm('');
  };

  const handleLinkInvoice = (invoice: OutgoingInvoice | IncomingInvoice, type: 'outgoing' | 'incoming') => {
    if (!linkingTransaction) return;

    const clientName = type === 'outgoing'
      ? (invoice as OutgoingInvoice).clientName
      : (invoice as IncomingInvoice).supplierName;

    const linkedInvoice: MatchedInvoice = {
      invoiceId: invoice.id || '',
      invoiceNumber: invoice.invoiceNumber,
      amount: invoice.totalAmount,
      clientName,
      invoiceDate: invoice.invoiceDate,
      confidence: 100,
      type,
      status: invoice.status,
    };

    const updatedResults = matchResults.map(r =>
      r.transaction.id === linkingTransaction.id
        ? {
            ...r,
            matchedInvoice: linkedInvoice,
            status: 'manual' as const,
            confidence: 100,
            manuallyLinked: true,
            linkedInvoiceId: invoice.id || '',
            linkedInvoiceType: type,
          }
        : r
    );

    setMatchResults(updatedResults);
    setShowLinkModal(false);
    setLinkingTransaction(null);
    success('Gekoppeld', `Transactie gekoppeld aan ${invoice.invoiceNumber}`);
  };

  const handleUnlinkInvoice = (transactionId: string) => {
    const updatedResults = matchResults.map(r =>
      r.transaction.id === transactionId
        ? {
            ...r,
            matchedInvoice: undefined,
            status: 'unmatched' as const,
            confidence: 0,
            manuallyLinked: false,
            linkedInvoiceId: undefined,
            linkedInvoiceType: undefined,
          }
        : r
    );
    setMatchResults(updatedResults);
    success('Ontkoppeld', 'Koppeling verwijderd');
  };

  const getStatusBadge = (status: 'matched' | 'unmatched' | 'partial' | 'manual', confidence: number) => {
    if (status === 'matched' || status === 'manual') {
      return (
        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
          <CheckCircle className="w-3 h-3 mr-1" />
          {status === 'manual' ? 'Handmatig gekoppeld' : `Gematcht (${confidence}%)`}
        </span>
      );
    } else if (status === 'partial') {
      return (
        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
          <Clock className="w-3 h-3 mr-1" />
          Mogelijk ({confidence}%)
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
          <AlertCircle className="w-3 h-3 mr-1" />
          Niet gematcht
        </span>
      );
    }
  };

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

      {dbPermissionError && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-4 rounded">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                Database Configuratie Vereist
              </h3>
              <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
                <p>
                  Firebase Realtime Database rules zijn niet geconfigureerd. Importgeschiedenis kan
                  niet worden opgeslagen of geladen.
                </p>
                <p className="mt-2">
                  <strong>Instructies:</strong> Zie{' '}
                  <code className="bg-yellow-100 dark:bg-yellow-800 px-1 rounded">
                    FIREBASE_REALTIME_DATABASE_RULES.md
                  </code>{' '}
                  in de projectroot voor configuratiestappen.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

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
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                CSV
              </button>
              <button
                onClick={() => setFormat('MT940')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  format === 'MT940'
                    ? 'bg-primary-600 text-white'
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
              onChange={e => setRawData(e.target.value)}
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
            <Button
              onClick={handleParse}
              disabled={loading || !rawData.trim()}
              className="flex-1"
            >
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
                setTransactions([]);
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
                Preview ({transactions.length} transacties)
              </h2>
              <div className="flex gap-2 text-sm">
                <span className="text-green-600 dark:text-green-400">
                  {matchResults.filter(r => r.status === 'matched').length} gematcht
                </span>
                <span className="text-yellow-600 dark:text-yellow-400">
                  {matchResults.filter(r => r.status === 'partial').length} mogelijk
                </span>
                <span className="text-gray-600 dark:text-gray-400">
                  {matchResults.filter(r => r.status === 'unmatched').length} niet gematcht
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Datum
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Bedrag
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Omschrijving
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Begunstigde
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Match Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Acties
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {matchResults.map((result, index) => {
                    const isEditing = editingRow === result.transaction.id;
                    const transaction = isEditing ? editedTransaction! : result.transaction;

                    return (
                      <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          {isEditing ? (
                            <input
                              type="date"
                              value={safeFormatDate(transaction.date, 'yyyy-MM-dd')}
                              onChange={e =>
                                setEditedTransaction({
                                  ...transaction,
                                  date: new Date(e.target.value),
                                })
                              }
                              className="px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600"
                            />
                          ) : (
                            safeFormatDate(transaction.date, 'dd-MM-yyyy')
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          {isEditing ? (
                            <input
                              type="number"
                              step="0.01"
                              value={transaction.amount}
                              onChange={e =>
                                setEditedTransaction({
                                  ...transaction,
                                  amount: parseFloat(e.target.value),
                                })
                              }
                              className="px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600 w-32"
                            />
                          ) : (
                            <span
                              className={
                                transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'
                              }
                            >
                              € {transaction.amount.toFixed(2)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          {isEditing ? (
                            <input
                              type="text"
                              value={transaction.description}
                              onChange={e =>
                                setEditedTransaction({
                                  ...transaction,
                                  description: e.target.value,
                                })
                              }
                              className="px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600 w-full"
                            />
                          ) : (
                            <span className="truncate block max-w-xs">
                              {transaction.description}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {isEditing ? (
                            <input
                              type="text"
                              value={transaction.beneficiary || ''}
                              onChange={e =>
                                setEditedTransaction({
                                  ...transaction,
                                  beneficiary: e.target.value,
                                })
                              }
                              className="px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600 w-full"
                            />
                          ) : (
                            transaction.beneficiary || '-'
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="space-y-1">
                            {getStatusBadge(result.status, result.confidence)}
                            {result.matchedInvoice && (
                              <div className="text-xs space-y-0.5">
                                <div className="text-gray-600 dark:text-gray-400">
                                  {result.matchedInvoice.invoiceNumber} - {result.matchedInvoice.clientName}
                                </div>
                                <div className={`font-medium ${result.matchedInvoice.type === 'outgoing' ? 'text-blue-600' : 'text-purple-600'}`}>
                                  {result.matchedInvoice.type === 'outgoing' ? 'Uitgaand' : 'Inkomend'}
                                </div>
                                {result.possibleMatches && result.possibleMatches.length > 1 && (
                                  <div className="text-gray-500">
                                    +{result.possibleMatches.length - 1} andere mogelijkheden
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {isEditing ? (
                            <div className="flex gap-1">
                              <button
                                onClick={handleSaveEdit}
                                className="p-1 text-green-600 hover:bg-green-100 dark:hover:bg-green-900 rounded"
                                title="Opslaan"
                              >
                                <Save className="w-4 h-4" />
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className="p-1 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                                title="Annuleren"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleEditRow(result.transaction)}
                                className="p-1 text-primary-600 hover:bg-primary-100 dark:hover:bg-primary-900 rounded"
                                title="Bewerken"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              {result.matchedInvoice ? (
                                <button
                                  onClick={() => handleUnlinkInvoice(result.transaction.id)}
                                  className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900 rounded"
                                  title="Ontkoppelen"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleOpenLinkModal(result.transaction)}
                                  className="p-1 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900 rounded"
                                  title="Koppelen aan factuur"
                                >
                                  <Link className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleImport} disabled={importing}>
                {importing ? (
                  <>
                    <LoadingSpinner size="sm" />
                    Importeren...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Importeer {transactions.length} transacties
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
              {imports.map(imp => (
                <div
                  key={imp.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                >
                  <div
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                    onClick={() =>
                      setExpandedImport(expandedImport === imp.id ? null : imp.id)
                    }
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
                          {imp.matchedCount} gematcht
                        </span>
                        <span className="text-xs text-gray-600">
                          {imp.unmatchedCount} niet gematcht
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        Door: {imp.importedByName}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={e => {
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

                  {expandedImport === imp.id && (
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                      <div className="space-y-4">
                        {imp.matchedTransactions.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                              Gematchte transacties ({imp.matchedTransactions.length})
                            </h4>
                            <div className="space-y-1">
                              {imp.matchedTransactions.map((mt, i) => (
                                <div
                                  key={i}
                                  className="text-xs p-2 bg-white dark:bg-gray-900 rounded flex justify-between"
                                >
                                  <span>
                                    {safeFormatDate(mt.transaction.date, 'dd-MM-yyyy')} - €{' '}
                                    {mt.transaction.amount.toFixed(2)}
                                  </span>
                                  <span className="text-green-600">
                                    → {mt.matchedInvoice.invoiceNumber}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {imp.unmatchedTransactions.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                              Niet gematchte transacties ({imp.unmatchedTransactions.length})
                            </h4>
                            <div className="space-y-1">
                              {imp.unmatchedTransactions.map((t, i) => (
                                <div
                                  key={i}
                                  className="text-xs p-2 bg-white dark:bg-gray-900 rounded"
                                >
                                  {safeFormatDate(t.date, 'dd-MM-yyyy')} - €{' '}
                                  {t.amount.toFixed(2)} - {t.description}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
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
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                Transactie
              </h3>
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Datum:</span>{' '}
                    {safeFormatDate(linkingTransaction.date, 'dd-MM-yyyy')}
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Bedrag:</span>{' '}
                    <span className={linkingTransaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}>
                      € {linkingTransaction.amount.toFixed(2)}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-600 dark:text-gray-400">Omschrijving:</span>{' '}
                    {linkingTransaction.description}
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
              {linkingTransaction.amount >= 0 ? (
                <>
                  <h4 className="text-sm font-medium text-blue-600 mb-2">
                    Uitgaande facturen (ontvangen betalingen)
                  </h4>
                  {outgoingInvoices
                    .filter(
                      inv =>
                        !invoiceSearchTerm ||
                        inv.invoiceNumber.toLowerCase().includes(invoiceSearchTerm.toLowerCase()) ||
                        inv.clientName.toLowerCase().includes(invoiceSearchTerm.toLowerCase())
                    )
                    .map(invoice => (
                      <button
                        key={invoice.id}
                        onClick={() => handleLinkInvoice(invoice, 'outgoing')}
                        className="w-full p-3 text-left border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
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
                            <div className="text-xs text-gray-500 mt-1">
                              {invoice.status}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                </>
              ) : (
                <>
                  <h4 className="text-sm font-medium text-purple-600 mb-2">
                    Inkomende facturen (uitgaande betalingen)
                  </h4>
                  {incomingInvoices
                    .filter(
                      inv =>
                        !invoiceSearchTerm ||
                        inv.invoiceNumber.toLowerCase().includes(invoiceSearchTerm.toLowerCase()) ||
                        inv.supplierName.toLowerCase().includes(invoiceSearchTerm.toLowerCase())
                    )
                    .map(invoice => (
                      <button
                        key={invoice.id}
                        onClick={() => handleLinkInvoice(invoice, 'incoming')}
                        className="w-full p-3 text-left border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
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
                            <div className="text-xs text-gray-500 mt-1">
                              {invoice.status}
                            </div>
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
