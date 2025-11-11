import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Send,
  Eye,
  Download,
  Search,
  Calendar,
  Euro,
  Building2,
  User,
  CheckCircle,
  AlertCircle,
  Clock,
  Edit,
  Trash2,
  ChevronDown,
  X
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useToast } from '../hooks/useToast';
import { EmptyState } from '../components/ui/EmptyState';
import CreateInvoiceModal from '../components/invoices/CreateInvoiceModal';
import { outgoingInvoiceService, OutgoingInvoice, CompanyInfo } from '../services/outgoingInvoiceService';

const MAKE_WEBHOOK_URL = 'https://hook.eu2.make.com/ttdixmxlu9n7rvbnxgfomilht2ihllc2';

const OutgoingInvoices: React.FC = () => {
  const { user } = useAuth();
  const { selectedCompany } = useApp();
  const { success, error: showError } = useToast();
  const [invoices, setInvoices] = useState<OutgoingInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<OutgoingInvoice | null>(null);
  const [sendingWebhook, setSendingWebhook] = useState<string | null>(null);
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);

  const loadInvoices = useCallback(async () => {
    if (!user || !selectedCompany) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const invoicesData = await outgoingInvoiceService.getInvoices(
        user.uid, 
        selectedCompany.id
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

  const handleSendInvoice = async (invoiceId: string) => {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (!invoice) {
      showError('Fout', 'Factuur niet gevonden');
      return;
    }

    setSendingWebhook(invoiceId);
    
    try {
      const companyInfo: CompanyInfo = {
        id: selectedCompany?.id || '',
        name: selectedCompany?.name || '',
        kvk: selectedCompany?.kvk || '',
        taxNumber: selectedCompany?.taxNumber || '',
        contactInfo: {
          email: selectedCompany?.contactInfo?.email || '',
          phone: selectedCompany?.contactInfo?.phone || ''
        },
        address: {
          street: selectedCompany?.address?.street || '',
          city: selectedCompany?.address?.city || '',
          zipCode: selectedCompany?.address?.zipCode || '',
          country: selectedCompany?.address?.country || ''
        }
      };

      const html = await outgoingInvoiceService.generateInvoiceHTML(invoice, companyInfo);

      const webhookPayload = {
        event: 'invoice.sent',
        timestamp: new Date().toISOString(),
        client: {
          name: invoice.clientName,
          email: invoice.clientEmail,
          phone: invoice.clientPhone || null,
          kvk: invoice.clientKvk || null,
          taxNumber: invoice.clientTaxNumber || null,
          address: {
            street: invoice.clientAddress.street,
            city: invoice.clientAddress.city,
            zipCode: invoice.clientAddress.zipCode,
            country: invoice.clientAddress.country
          }
        },
        invoice: {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          status: 'sent',
          amount: invoice.amount,
          vatAmount: invoice.vatAmount,
          totalAmount: invoice.totalAmount,
          description: invoice.description,
          notes: invoice.notes,
          invoiceDate: invoice.invoiceDate.toISOString(),
          dueDate: invoice.dueDate.toISOString(),
          createdAt: invoice.createdAt.toISOString(),
          updatedAt: invoice.updatedAt.toISOString(),
          items: invoice.items.map((item, index) => ({
            lineNumber: index + 1,
            description: item.description,
            quantity: item.quantity,
            rate: item.rate,
            amount: item.amount
          }))
        },
        company: {
          id: selectedCompany?.id,
          name: selectedCompany?.name,
          kvk: selectedCompany?.kvk,
          taxNumber: selectedCompany?.taxNumber,
          email: selectedCompany?.contactInfo?.email,
          phone: selectedCompany?.contactInfo?.phone,
          address: {
            street: selectedCompany?.address?.street,
            city: selectedCompany?.address?.city,
            zipCode: selectedCompany?.address?.zipCode,
            country: selectedCompany?.address?.country
          }
        },
        user: {
          id: user?.uid,
          email: user?.email
        },
        htmlContent: html
      };

      const response = await fetch(MAKE_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookPayload),
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) throw new Error(`Webhook error: ${response.status}`);

      await outgoingInvoiceService.sendInvoice(invoiceId);
      success('✅ Factuur verstuurd!', 'HTML naar Make.com verzonden');
      loadInvoices();
    } catch (error) {
      showError('Fout', error instanceof Error ? error.message : 'Onbekend');
    } finally {
      setSendingWebhook(null);
    }
  };

  const getStatusColor = (status: OutgoingInvoice['status']) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800 border-gray-300';
      case 'sent': return 'bg-blue-50 text-blue-800 border-blue-300';
      case 'paid': return 'bg-green-50 text-green-800 border-green-300';
      case 'overdue': return 'bg-red-50 text-red-800 border-red-300';
      case 'cancelled': return 'bg-gray-100 text-gray-800 border-gray-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusIcon = (status: OutgoingInvoice['status']) => {
    switch (status) {
      case 'draft': return Clock;
      case 'sent': return Send;
      case 'paid': return CheckCircle;
      case 'overdue': return AlertCircle;
      case 'cancelled': return AlertCircle;
      default: return Clock;
    }
  };

  const getStatusText = (status: OutgoingInvoice['status']) => {
    switch (status) {
      case 'draft': return 'Concept';
      case 'sent': return 'Verstuurd';
      case 'paid': return 'Betaald';
      case 'overdue': return 'Vervallen';
      case 'cancelled': return 'Geannuleerd';
      default: return status;
    }
  };

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = invoice.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCreateInvoice = () => {
    setEditingInvoice(null);
    setIsModalOpen(true);
  };

  const handleEditInvoice = (invoice: OutgoingInvoice) => {
    setEditingInvoice(invoice);
    setIsModalOpen(true);
  };

  const handleModalSuccess = () => {
    loadInvoices();
  };

  const handleMarkAsPaid = async (invoiceId: string) => {
    try {
      await outgoingInvoiceService.markAsPaid(invoiceId);
      success('Factuur betaald', 'De factuur is gemarkeerd als betaald');
      loadInvoices();
    } catch (error) {
      showError('Fout bij bijwerken', 'Kon factuur niet als betaald markeren');
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!confirm('Weet je zeker dat je deze factuur wilt verwijderen?')) return;
    
    try {
      await outgoingInvoiceService.deleteInvoice(invoiceId);
      success('Factuur verwijderd', 'De factuur is succesvol verwijderd');
      loadInvoices();
    } catch (error) {
      showError('Fout bij verwijderen', 'Kon factuur niet verwijderen');
    }
  };

  const totalAmount = filteredInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
  const draftCount = filteredInvoices.filter(inv => inv.status === 'draft').length;
  const sentCount = filteredInvoices.filter(inv => inv.status === 'sent').length;
  const paidCount = filteredInvoices.filter(inv => inv.status === 'paid').length;

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
    <div className="min-h-screen bg-gray-50">
      {/* HEADER */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-4 lg:px-6 lg:py-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Facturen</h1>
              <p className="mt-1 text-xs lg:text-sm text-gray-600">
                {selectedCompany.name}
              </p>
            </div>
            <Button
              onClick={handleCreateInvoice}
              icon={Plus}
              className="w-full lg:w-auto text-sm"
            >
              Nieuwe Factuur
            </Button>
          </div>

          {/* FILTERS */}
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Zoeken..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-transparent"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Alle statussen</option>
              <option value="draft">Concept</option>
              <option value="sent">Verstuurd</option>
              <option value="paid">Betaald</option>
              <option value="overdue">Vervallen</option>
              <option value="cancelled">Geannuleerd</option>
            </select>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div className="px-4 py-4 lg:px-6 lg:py-6">
        {filteredInvoices.length === 0 ? (
          <EmptyState
            icon={Send}
            title="Geen facturen gevonden"
            description={searchTerm || statusFilter !== 'all' 
              ? "Geen facturen gevonden die voldoen aan de filters" 
              : "Maak je eerste factuur aan"}
            action={
              <Button onClick={handleCreateInvoice} icon={Plus}>
                Nieuwe Factuur
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {/* INVOICE LIST */}
            {filteredInvoices.map((invoice) => {
              const StatusIcon = getStatusIcon(invoice.status);
              const isLoadingWebhook = sendingWebhook === invoice.id;
              const isExpanded = expandedInvoice === invoice.id;
              
              return (
                <div
                  key={invoice.id}
                  className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-sm transition-shadow"
                >
                  {/* ROW */}
                  <button
                    onClick={() => setExpandedInvoice(isExpanded ? null : invoice.id)}
                    className="w-full px-3 py-3 lg:px-4 lg:py-4 flex items-center gap-3 hover:bg-gray-50 transition-colors"
                  >
                    {/* EXPAND ICON */}
                    <ChevronDown
                      className={`h-5 w-5 text-gray-400 flex-shrink-0 transition-transform ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    />

                    {/* LEFT: INVOICE NUMBER + STATUS */}
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900 text-sm lg:text-base truncate">
                          {invoice.invoiceNumber}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(invoice.status)}`}>
                          <StatusIcon className="h-3 w-3" />
                          {getStatusText(invoice.status)}
                        </span>
                      </div>
                      <div className="text-xs lg:text-sm text-gray-600">
                        {invoice.clientName}
                      </div>
                    </div>

                    {/* RIGHT: AMOUNT */}
                    <div className="text-right flex-shrink-0">
                      <div className="font-semibold text-gray-900 text-sm lg:text-base">
                        €{invoice.totalAmount.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {invoice.invoiceDate.toLocaleDateString('nl-NL')}
                      </div>
                    </div>
                  </button>

                  {/* EXPANDED SECTION */}
                  {isExpanded && (
                    <div className="border-t border-gray-200 bg-gray-50 px-3 py-3 lg:px-4 lg:py-4 space-y-3">
                      {/* DETAILS GRID */}
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <div className="text-gray-600 text-xs">Klant</div>
                          <div className="font-medium text-gray-900">{invoice.clientName}</div>
                          <div className="text-xs text-gray-600">{invoice.clientEmail}</div>
                        </div>
                        <div>
                          <div className="text-gray-600 text-xs">Vervaldatum</div>
                          <div className="font-medium text-gray-900">
                            {invoice.dueDate.toLocaleDateString('nl-NL')}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-600 text-xs">Subtotaal</div>
                          <div className="font-medium text-gray-900">€{invoice.amount.toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-gray-600 text-xs">BTW (21%)</div>
                          <div className="font-medium text-gray-900">€{invoice.vatAmount.toFixed(2)}</div>
                        </div>
                      </div>

                      {/* ITEMS */}
                      {invoice.items.length > 0 && (
                        <div className="bg-white rounded p-2 text-xs">
                          <div className="font-semibold text-gray-900 mb-2">Regels</div>
                          {invoice.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-gray-600 mb-1 last:mb-0">
                              <span className="truncate flex-1">{item.description}</span>
                              <span className="ml-2 flex-shrink-0">€{item.amount.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* NOTES */}
                      {invoice.notes && (
                        <div className="bg-white rounded p-2 text-xs">
                          <div className="font-semibold text-gray-900 mb-1">Opmerkingen</div>
                          <div className="text-gray-600">{invoice.notes}</div>
                        </div>
                      )}

                      {/* BUTTONS */}
                      <div className="flex gap-2 pt-2 flex-wrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Edit}
                          onClick={() => handleEditInvoice(invoice)}
                          className="text-xs"
                        >
                          Bewerk
                        </Button>
                        
                        {invoice.status === 'draft' && (
                          <Button
                            variant="primary"
                            size="sm"
                            icon={Send}
                            onClick={() => handleSendInvoice(invoice.id!)}
                            disabled={isLoadingWebhook}
                            className={`text-xs ${isLoadingWebhook ? 'opacity-50' : ''}`}
                          >
                            {isLoadingWebhook ? 'Verzenden...' : 'Verstuur'}
                          </Button>
                        )}
                        {invoice.status === 'sent' && (
                          <Button
                            variant="primary"
                            size="sm"
                            icon={CheckCircle}
                            onClick={() => handleMarkAsPaid(invoice.id!)}
                            className="text-xs"
                          >
                            Betaald
                          </Button>
                        )}
                        {invoice.status === 'draft' && (
                          <Button
                            variant="danger"
                            size="sm"
                            icon={Trash2}
                            onClick={() => handleDeleteInvoice(invoice.id!)}
                            className="text-xs"
                          >
                            Verwijder
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* FOOTER: TOTALS */}
      {filteredInvoices.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 lg:px-6 lg:py-4 lg:static lg:border-t">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <div className="text-xs text-gray-600">Totaal bedrag</div>
              <div className="text-lg lg:text-2xl font-bold text-gray-900">
                €{totalAmount.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-600">Concepten</div>
              <div className="text-lg lg:text-xl font-semibold text-gray-600">
                {draftCount}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-600">Verstuurd</div>
              <div className="text-lg lg:text-xl font-semibold text-blue-600">
                {sentCount}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-600">Betaald</div>
              <div className="text-lg lg:text-xl font-semibold text-green-600">
                {paidCount}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SPACING FOR FIXED FOOTER ON MOBILE */}
      {filteredInvoices.length > 0 && (
        <div className="h-20 lg:h-0" />
      )}

      <CreateInvoiceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleModalSuccess}
        editingInvoice={editingInvoice}
      />
    </div>
  );
};

export default OutgoingInvoices;