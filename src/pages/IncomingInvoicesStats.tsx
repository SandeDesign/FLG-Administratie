import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  Search,
  Download,
  Eye,
  Edit2,
  Trash2,
  ArrowDownLeft,
  TrendingUp,
  X
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../hooks/useToast';
import {
  incomingInvoiceService,
  IncomingInvoice,
} from '../services/incomingInvoiceService';
import { doc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

const IncomingInvoicesStats: React.FC = () => {
  const { user } = useAuth();
  const { selectedCompany } = useApp();
  const { success, error: showError } = useToast();

  const [invoices, setInvoices] = useState<IncomingInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'status'>('date');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<IncomingInvoice | null>(null);
  const [editFormData, setEditFormData] = useState<IncomingInvoice | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Load Invoices from Firestore
  const loadInvoices = useCallback(async () => {
    if (!user || !selectedCompany) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await incomingInvoiceService.getInvoices(
        user.uid,
        selectedCompany.id
      );
      setInvoices(data);
    } catch (err) {
      showError('Kon facturen niet laden');
      console.error('Error loading invoices:', err);
    } finally {
      setLoading(false);
    }
  }, [user, selectedCompany, showError]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  // Filter and Sort
  const filteredInvoices = invoices
    .filter(invoice => {
      const matchesSearch =
        invoice.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === 'all' || invoice.status === statusFilter;

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'amount':
          return b.totalAmount - a.totalAmount;
        case 'status':
          return a.status.localeCompare(b.status);
        case 'date':
        default:
          return new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime();
      }
    });

  // Statistics
  const statistics = {
    total: invoices.reduce((sum, inv) => sum + inv.totalAmount, 0),
    pending: invoices.filter(inv => inv.status === 'pending').reduce((sum, inv) => sum + inv.totalAmount, 0),
    approved: invoices.filter(inv => inv.status === 'approved').reduce((sum, inv) => sum + inv.totalAmount, 0),
    paid: invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.totalAmount, 0),
    count: invoices.length,
    pendingCount: invoices.filter(inv => inv.status === 'pending').length,
    approvedCount: invoices.filter(inv => inv.status === 'approved').length,
    paidCount: invoices.filter(inv => inv.status === 'paid').length,
  };

  // Status Badge
  const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const statusConfig = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: Clock, label: 'In behandeling' },
      approved: { bg: 'bg-blue-100', text: 'text-blue-800', icon: CheckCircle, label: 'Goedgekeurd' },
      paid: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle, label: 'Betaald' },
      rejected: { bg: 'bg-red-100', text: 'text-red-800', icon: XCircle, label: 'Afgewezen' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${config.bg} ${config.text} text-sm font-medium`}>
        <Icon className="w-4 h-4" />
        {config.label}
      </div>
    );
  };

  // Handle Approve
  const handleApprove = async (invoice: IncomingInvoice) => {
    if (!user) return;

    try {
      setIsSaving(true);
      const invoiceRef = doc(db, 'incomingInvoices', invoice.id!);
      await updateDoc(invoiceRef, {
        status: 'approved',
        approvedAt: Timestamp.fromDate(new Date()),
        approvedBy: user.uid,
        updatedAt: Timestamp.fromDate(new Date()),
      });

      setInvoices(prev =>
        prev.map(inv =>
          inv.id === invoice.id
            ? {
              ...inv,
              status: 'approved',
              approvedAt: new Date(),
              approvedBy: user.uid,
              updatedAt: new Date(),
            }
            : inv
        )
      );

      success('Factuur goedgekeurd');
    } catch (err) {
      showError('Kon factuur niet goedkeuren');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Mark as Paid
  const handleMarkPaid = async (invoice: IncomingInvoice) => {
    if (!user) return;

    try {
      setIsSaving(true);
      const invoiceRef = doc(db, 'incomingInvoices', invoice.id!);
      await updateDoc(invoiceRef, {
        status: 'paid',
        paidAt: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date()),
      });

      setInvoices(prev =>
        prev.map(inv =>
          inv.id === invoice.id
            ? {
              ...inv,
              status: 'paid',
              paidAt: new Date(),
              updatedAt: new Date(),
            }
            : inv
        )
      );

      success('Factuur gemarkeerd als betaald');
    } catch (err) {
      showError('Kon factuur niet bijwerken');
    } finally {
      setIsSaving(false);
    }
  };

  // Open Edit Modal
  const openEdit = (invoice: IncomingInvoice) => {
    setEditingInvoice(invoice);
    setEditFormData({ ...invoice });
  };

  // Save Edit
  const handleSaveEdit = async () => {
    if (!editingInvoice || !editFormData || !editingInvoice.id) return;

    try {
      setIsSaving(true);
      const invoiceRef = doc(db, 'incomingInvoices', editingInvoice.id);

      const updateData: any = {
        supplierName: editFormData.supplierName,
        invoiceNumber: editFormData.invoiceNumber,
        amount: editFormData.amount,
        vatAmount: editFormData.vatAmount,
        totalAmount: editFormData.totalAmount,
        description: editFormData.description,
        supplierEmail: editFormData.supplierEmail,
        invoiceDate: Timestamp.fromDate(
          editFormData.invoiceDate instanceof Date
            ? editFormData.invoiceDate
            : new Date(editFormData.invoiceDate)
        ),
        dueDate: Timestamp.fromDate(
          editFormData.dueDate instanceof Date
            ? editFormData.dueDate
            : new Date(editFormData.dueDate)
        ),
        updatedAt: Timestamp.fromDate(new Date()),
      };

      await updateDoc(invoiceRef, updateData);

      setInvoices(prev =>
        prev.map(inv =>
          inv.id === editingInvoice.id
            ? { ...editFormData, id: editingInvoice.id }
            : inv
        )
      );

      success('Factuur bijgewerkt');
      setEditingInvoice(null);
      setEditFormData(null);
    } catch (err) {
      showError('Kon factuur niet bijwerken');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Invoice
  const handleDelete = async (invoiceId: string) => {
    if (!window.confirm('Weet je zeker dat je deze factuur wilt verwijderen?')) return;

    try {
      setIsDeleting(invoiceId);
      const invoiceRef = doc(db, 'incomingInvoices', invoiceId);
      await deleteDoc(invoiceRef);

      setInvoices(prev => prev.filter(inv => inv.id !== invoiceId));
      success('Factuur verwijderd');
    } catch (err) {
      showError('Kon factuur niet verwijderen');
    } finally {
      setIsDeleting(null);
    }
  };

  // Download
  const handleDownload = (invoice: IncomingInvoice) => {
    const url = invoice.fileUrl || invoice.driveWebLink;
    if (url) {
      window.open(url, '_blank');
    } else {
      showError('Download niet beschikbaar');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const formatDate = (date: Date | string) => {
    return new Intl.DateTimeFormat('nl-NL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(date));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Inkomende Facturen
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Beheer en volg al je inkomende facturen
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Totaal',
            amount: statistics.total,
            count: statistics.count,
            icon: TrendingUp,
            color: 'bg-gradient-to-br from-blue-500 to-blue-600',
          },
          {
            label: 'In Behandeling',
            amount: statistics.pending,
            count: statistics.pendingCount,
            icon: Clock,
            color: 'bg-gradient-to-br from-yellow-500 to-yellow-600',
          },
          {
            label: 'Goedgekeurd',
            amount: statistics.approved,
            count: statistics.approvedCount,
            icon: CheckCircle,
            color: 'bg-gradient-to-br from-blue-500 to-cyan-600',
          },
          {
            label: 'Betaald',
            amount: statistics.paid,
            count: statistics.paidCount,
            icon: CheckCircle,
            color: 'bg-gradient-to-br from-green-500 to-emerald-600',
          },
        ].map((stat, index) => (
          <Card key={index} className="overflow-hidden">
            <div className={`${stat.color} p-4 text-white`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium opacity-90">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1">{formatCurrency(stat.amount)}</p>
                  <p className="text-xs opacity-75 mt-2">{stat.count} facturen</p>
                </div>
                <stat.icon className="w-12 h-12 opacity-20" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Zoeken op leverancier, factuurnummer..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
          >
            <option value="all">Alle statussen</option>
            <option value="pending">In behandeling</option>
            <option value="approved">Goedgekeurd</option>
            <option value="paid">Betaald</option>
            <option value="rejected">Afgewezen</option>
          </select>

          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
          >
            <option value="date">Sorteer op datum</option>
            <option value="amount">Sorteer op bedrag</option>
            <option value="status">Sorteer op status</option>
          </select>
        </div>
      </Card>

      {/* Table */}
      {filteredInvoices.length === 0 ? (
        <EmptyState
          icon={AlertCircle}
          title="Geen facturen gevonden"
          description="Er zijn nog geen inkomende facturen"
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold text-gray-900 dark:text-white">Leverancier</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-900 dark:text-white">Factuurnummer</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-900 dark:text-white">Bedrag</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-900 dark:text-white">Datum</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-900 dark:text-white">Status</th>
                  <th className="px-6 py-3 text-right font-semibold text-gray-900 dark:text-white">Acties</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredInvoices.map(invoice => (
                  <React.Fragment key={invoice.id}>
                    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-6 py-4 text-gray-900 dark:text-white font-medium">
                        {invoice.supplierName}
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                        {invoice.invoiceNumber}
                      </td>
                      <td className="px-6 py-4 text-gray-900 dark:text-white font-semibold">
                        {formatCurrency(invoice.totalAmount)}
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                        {formatDate(invoice.invoiceDate)}
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={invoice.status} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end items-center gap-2">
                          <button
                            onClick={() => setExpandedRow(expandedRow === invoice.id ? null : invoice.id)}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
                          >
                            <Eye className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                          </button>

                          {invoice.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleApprove(invoice)}
                                disabled={isSaving}
                                className="p-2 hover:bg-green-100 dark:hover:bg-green-900 rounded-lg transition-colors disabled:opacity-50"
                              >
                                <CheckCircle className="w-4 h-4 text-green-600" />
                              </button>
                              <button
                                onClick={() => openEdit(invoice)}
                                className="p-2 hover:bg-blue-100 dark:hover:bg-blue-900 rounded-lg transition-colors"
                              >
                                <Edit2 className="w-4 h-4 text-blue-600" />
                              </button>
                            </>
                          )}

                          {(invoice.status === 'approved' || invoice.status === 'pending') && (
                            <button
                              onClick={() => handleMarkPaid(invoice)}
                              disabled={isSaving}
                              className="p-2 hover:bg-emerald-100 dark:hover:bg-emerald-900 rounded-lg transition-colors disabled:opacity-50"
                            >
                              <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                            </button>
                          )}

                          <button
                            onClick={() => handleDelete(invoice.id!)}
                            disabled={isDeleting === invoice.id}
                            className="p-2 hover:bg-red-100 dark:hover:bg-red-900 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {expandedRow === invoice.id && (
                      <tr className="bg-gray-50 dark:bg-gray-700/50">
                        <td colSpan={6} className="px-6 py-4">
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Beschrijving</p>
                                <p className="font-medium text-gray-900 dark:text-white">
                                  {invoice.description}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">E-mail</p>
                                <p className="font-medium text-gray-900 dark:text-white">
                                  {invoice.supplierEmail || '-'}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Vervaldatum</p>
                                <p className="font-medium text-gray-900 dark:text-white">
                                  {formatDate(invoice.dueDate)}
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                              <div className="bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-600">
                                <p className="text-xs text-gray-600 dark:text-gray-400">Excl. BTW</p>
                                <p className="font-bold text-gray-900 dark:text-white">
                                  {formatCurrency(invoice.amount)}
                                </p>
                              </div>
                              <div className="bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-600">
                                <p className="text-xs text-gray-600 dark:text-gray-400">BTW</p>
                                <p className="font-bold text-gray-900 dark:text-white">
                                  {formatCurrency(invoice.vatAmount)}
                                </p>
                              </div>
                              <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded border border-blue-200 dark:border-blue-700">
                                <p className="text-xs text-blue-600 dark:text-blue-400">Incl. BTW</p>
                                <p className="font-bold text-blue-900 dark:text-blue-200">
                                  {formatCurrency(invoice.totalAmount)}
                                </p>
                              </div>
                            </div>

                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                icon={Download}
                                onClick={() => handleDownload(invoice)}
                              >
                                Download
                              </Button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Edit Modal */}
      {editingInvoice && editFormData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Factuur bewerken</h2>
              <button
                onClick={() => {
                  setEditingInvoice(null);
                  setEditFormData(null);
                }}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Leverancier
                  </label>
                  <input
                    type="text"
                    value={editFormData.supplierName ?? ''}
                    onChange={e => setEditFormData({ ...editFormData, supplierName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Factuurnummer
                  </label>
                  <input
                    type="text"
                    value={editFormData.invoiceNumber ?? ''}
                    onChange={e => setEditFormData({ ...editFormData, invoiceNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Excl. BTW (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.amount ?? ''}
                    onChange={e => setEditFormData({ ...editFormData, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    BTW (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.vatAmount ?? ''}
                    onChange={e => setEditFormData({ ...editFormData, vatAmount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Incl. BTW (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.totalAmount ?? ''}
                    onChange={e => setEditFormData({ ...editFormData, totalAmount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={editFormData.supplierEmail ?? ''}
                    onChange={e => setEditFormData({ ...editFormData, supplierEmail: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Factuurdatum
                  </label>
                  <input
                    type="date"
                    value={
                      editFormData.invoiceDate
                        ? new Date(editFormData.invoiceDate).toISOString().split('T')[0]
                        : ''
                    }
                    onChange={e => setEditFormData({ ...editFormData, invoiceDate: new Date(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Vervaldatum
                  </label>
                  <input
                    type="date"
                    value={
                      editFormData.dueDate
                        ? new Date(editFormData.dueDate).toISOString().split('T')[0]
                        : ''
                    }
                    onChange={e => setEditFormData({ ...editFormData, dueDate: new Date(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Beschrijving
                </label>
                <textarea
                  value={editFormData.description ?? ''}
                  onChange={e => setEditFormData({ ...editFormData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Preview</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white dark:bg-gray-700 p-3 rounded">
                    <p className="text-xs text-gray-600 dark:text-gray-400">Excl. BTW</p>
                    <p className="font-bold text-gray-900 dark:text-white">
                      {formatCurrency(editFormData.amount || 0)}
                    </p>
                  </div>
                  <div className="bg-white dark:bg-gray-700 p-3 rounded">
                    <p className="text-xs text-gray-600 dark:text-gray-400">BTW</p>
                    <p className="font-bold text-gray-900 dark:text-white">
                      {formatCurrency(editFormData.vatAmount || 0)}
                    </p>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded">
                    <p className="text-xs text-blue-600 dark:text-blue-400">Incl. BTW</p>
                    <p className="font-bold text-blue-900 dark:text-blue-200">
                      {formatCurrency(editFormData.totalAmount || 0)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700 sticky bottom-0 bg-white dark:bg-gray-800">
              <Button
                variant="secondary"
                onClick={() => {
                  setEditingInvoice(null);
                  setEditFormData(null);
                }}
              >
                Annuleren
              </Button>
              <Button
                onClick={handleSaveEdit}
                loading={isSaving}
              >
                Opslaan
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default IncomingInvoicesStats;