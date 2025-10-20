import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Send,
  Eye,
  Edit,
  Download,
  Filter,
  Search,
  Calendar,
  Euro,
  Building2,
  User,
  CheckCircle,
  AlertCircle,
  Clock
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useToast } from '../hooks/useToast';
import { EmptyState } from '../components/ui/EmptyState';

interface OutgoingInvoice {
  id: string;
  userId: string;
  companyId: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  clientAddress: {
    street: string;
    city: string;
    zipCode: string;
    country: string;
  };
  amount: number;
  vatAmount: number;
  totalAmount: number;
  description: string;
  invoiceDate: Date;
  dueDate: Date;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  paidAt?: Date;
  sentAt?: Date;
  items: {
    description: string;
    quantity: number;
    rate: number;
    amount: number;
  }[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const OutgoingInvoices: React.FC = () => {
  const { user } = useAuth();
  const { selectedCompany } = useApp();
  const { success, error: showError } = useToast();
  const [invoices, setInvoices] = useState<OutgoingInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadInvoices = useCallback(async () => {
    if (!user || !selectedCompany) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // TODO: Implement firebase service call
      // const invoicesData = await getOutgoingInvoices(user.uid, selectedCompany.id);
      // setInvoices(invoicesData);
      
      // Mock data for now
      const mockInvoices: OutgoingInvoice[] = [
        {
          id: '1',
          userId: user.uid,
          companyId: selectedCompany.id,
          invoiceNumber: 'INV-2024-001',
          clientName: 'Acme Corporation',
          clientEmail: 'finance@acme.com',
          clientAddress: {
            street: 'Hoofdstraat 123',
            city: 'Amsterdam',
            zipCode: '1000 AB',
            country: 'Nederland'
          },
          amount: 1000,
          vatAmount: 210,
          totalAmount: 1210,
          description: 'Consultancy services Q1 2024',
          invoiceDate: new Date('2024-01-15'),
          dueDate: new Date('2024-02-15'),
          status: 'sent',
          sentAt: new Date('2024-01-15'),
          items: [
            {
              description: 'Consultancy services',
              quantity: 40,
              rate: 25,
              amount: 1000
            }
          ],
          createdAt: new Date('2024-01-15'),
          updatedAt: new Date('2024-01-15')
        }
      ];
      setInvoices(mockInvoices);
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

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = invoice.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCreateInvoice = () => {
    setIsModalOpen(true);
  };

  const handleSendInvoice = async (invoiceId: string) => {
    try {
      // TODO: Implement send invoice functionality
      success('Factuur verstuurd', 'De factuur is succesvol verstuurd naar de klant');
      loadInvoices();
    } catch (error) {
      showError('Fout bij versturen', 'Kon factuur niet versturen');
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
      {/* Header */}
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

      {/* Filters */}
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

      {/* Invoices List */}
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
            return (
              <Card key={invoice.id}>
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Send className="h-6 w-6 text-blue-600" />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2">
                          <h3 className="text-lg font-medium text-gray-900">
                            {invoice.invoiceNumber}
                          </h3>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {invoice.status === 'draft' && 'Concept'}
                            {invoice.status === 'sent' && 'Verstuurd'}
                            {invoice.status === 'paid' && 'Betaald'}
                            {invoice.status === 'overdue' && 'Vervallen'}
                            {invoice.status === 'cancelled' && 'Geannuleerd'}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500">
                          <div className="flex items-center">
                            <User className="h-4 w-4 mr-1" />
                            {invoice.clientName}
                          </div>
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-1" />
                            {invoice.invoiceDate.toLocaleDateString('nl-NL')}
                          </div>
                          <div className="flex items-center">
                            <Euro className="h-4 w-4 mr-1" />
                            €{invoice.totalAmount.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Eye}
                        onClick={() => {/* TODO: View invoice */}}
                      >
                        Bekijken
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Download}
                        onClick={() => {/* TODO: Download PDF */}}
                      >
                        PDF
                      </Button>
                      {invoice.status === 'draft' && (
                        <Button
                          variant="primary"
                          size="sm"
                          icon={Send}
                          onClick={() => handleSendInvoice(invoice.id)}
                        >
                          Versturen
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

      {/* TODO: Add InvoiceModal component */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <h2 className="text-xl font-bold mb-4">Nieuwe Factuur</h2>
            <p className="text-gray-600 mb-4">
              Factuur modal komt hier...
            </p>
            <div className="flex justify-end space-x-2">
              <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
                Annuleren
              </Button>
              <Button onClick={() => setIsModalOpen(false)}>
                Opslaan
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OutgoingInvoices;