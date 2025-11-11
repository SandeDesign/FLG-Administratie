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
  Zap
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
          client: {
            name: invoice.clientName,
            email: invoice.clientEmail,
            phone: invoice.clientPhone || null,
            address: {
              street: invoice.clientAddress.street,
              city: invoice.clientAddress.city,
              zipCode: invoice.clientAddress.zipCode,
              country: invoice.clientAddress.country
            }
          },
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
      case 'draft': return 'text-gray-600 bg-gray-100';
      case 'sent': return 'text-blue-600 bg-blue-100';
      case 'paid': return 'text-green-600 bg-green-100';
      case 'overdue': return 'text-red-600 bg-red-100';
      case 'cancelled': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Uitgaande Facturen</h1>
          <p className="mt-1 text-sm text-gray-500">
            Beheer facturen voor {selectedCompany.name}
          </p>
        </div>
        <Button
          onClick={handleCreateInvoice}
          className="mt-4 sm:mt-0"
          icon={Plus}
        >
          Nieuwe Factuur
        </Button>
      </div>

      <Card>
        <div className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Zoek op klantnaam of factuurnummer..."
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
                <option value="draft">Concept</option>
                <option value="sent">Verstuurd</option>
                <option value="paid">Betaald</option>
                <option value="overdue">Vervallen</option>
                <option value="cancelled">Geannuleerd</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

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
        <div className="grid gap-4">
          {filteredInvoices.map((invoice) => {
            const StatusIcon = getStatusIcon(invoice.status);
            const isLoadingWebhook = sendingWebhook === invoice.id;
            
            return (
              <Card key={invoice.id}>
                <div className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="flex items-center space-x-4 min-w-0">
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Send className="h-6 w-6 text-blue-600" />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2 flex-wrap">
                          <h3 className="text-lg font-medium text-gray-900">
                            {invoice.invoiceNumber}
                          </h3>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {getStatusText(invoice.status)}
                          </span>
                        </div>
                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-gray-500">
                          <div className="flex items-center">
                            <User className="h-4 w-4 mr-1 flex-shrink-0" />
                            <span className="truncate">{invoice.clientName}</span>
                          </div>
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-1 flex-shrink-0" />
                            {invoice.invoiceDate.toLocaleDateString('nl-NL')}
                          </div>
                          <div className="flex items-center">
                            <Euro className="h-4 w-4 mr-1 flex-shrink-0" />
                            €{invoice.totalAmount.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-wrap lg:flex-nowrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Edit}
                        onClick={() => handleEditInvoice(invoice)}
                      >
                        Bewerken
                      </Button>
                      
                      {invoice.status === 'draft' && (
                        <Button
                          variant="primary"
                          size="sm"
                          icon={Send}
                          onClick={() => handleSendInvoice(invoice.id!)}
                          disabled={isLoadingWebhook}
                          className={isLoadingWebhook ? 'opacity-50' : ''}
                        >
                          {isLoadingWebhook ? 'Verzenden...' : 'Versturen'}
                        </Button>
                      )}
                      {invoice.status === 'sent' && (
                        <Button
                          variant="primary"
                          size="sm"
                          icon={CheckCircle}
                          onClick={() => handleMarkAsPaid(invoice.id!)}
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
                        >
                          Verwijderen
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
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