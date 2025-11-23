import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Send, Search, Calendar, Euro, Building2, User, CheckCircle, AlertCircle, Clock, Edit, Trash2, ChevronDown, X, ArrowLeft, TrendingUp, Eye, Factory } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import Button from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useToast } from '../hooks/useToast';
import { EmptyState } from '../components/ui/EmptyState';
import Card from '../components/ui/Card';
import { outgoingInvoiceService, OutgoingInvoice, CompanyInfo } from '../services/outgoingInvoiceService';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';

const MAKE_WEBHOOK_URL = 'https://hook.eu2.make.com/ttdixmxlu9n7rvbnxgfomilht2ihllc2';

interface InvoiceItem {
  title: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface InvoiceRelation {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: { street: string; city: string; zipCode: string; country: string };
  kvk?: string;
  taxNumber?: string;
}

interface ProductionEntry {
  monteur: string;
  datum: string;
  uren: number;
  opdrachtgever: string;
  locaties: string;
}

interface ProductionWeek {
  id: string;
  week: number;
  year: number;
  employeeId: string;
  entries: ProductionEntry[];
  totalHours: number;
}

const OutgoingInvoices: React.FC = () => {
  const { user } = useAuth();
  const { selectedCompany, employees, queryUserId } = useApp(); // ✅ Gebruik queryUserId voor queries
  const { success, error: showError } = useToast();

  const [invoices, setInvoices] = useState<OutgoingInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);
  const [sendingWebhook, setSendingWebhook] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'create'>('list');
  const [editingInvoice, setEditingInvoice] = useState<OutgoingInvoice | null>(null);
  const [relations, setRelations] = useState<InvoiceRelation[]>([]);
  const [isRelationsOpen, setIsRelationsOpen] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Production Import State
  const [showProductionImport, setShowProductionImport] = useState(false);
  const [productionWeeks, setProductionWeeks] = useState<ProductionWeek[]>([]);
  const [selectedProductionWeeks, setSelectedProductionWeeks] = useState<ProductionWeek[]>([]);
  const [selectedProductionEmployeeId, setSelectedProductionEmployeeId] = useState('');
  const [selectedProductionWeekIds, setSelectedProductionWeekIds] = useState<string[]>([]);
  const [loadingProduction, setLoadingProduction] = useState(false);
  const [invoicedWeekIds, setInvoicedWeekIds] = useState<Set<string>>(new Set());

  const [formData, setFormData] = useState({
    clientId: '',
    clientName: '',
    clientEmail: '',
    clientAddress: { street: '', city: '', zipCode: '', country: 'Nederland' },
    clientPhone: '',
    clientKvk: '',
    clientTaxNumber: '',
    description: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    notes: '',
    purchaseOrder: '',
    projectCode: ''
  });

  const [items, setItems] = useState<InvoiceItem[]>([{ title: '', description: '', quantity: 1, rate: 0, amount: 0 }]);

  const loadInvoices = useCallback(async () => {
    if (!user || !selectedCompany || !queryUserId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await outgoingInvoiceService.getInvoices(queryUserId, selectedCompany.id);
      setInvoices(data);
    } catch (e) {
      showError('Fout', 'Kon facturen niet laden');
    } finally {
      setLoading(false);
    }
  }, [user, selectedCompany, queryUserId, showError]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const loadRelations = useCallback(async () => {
    if (!user || !selectedCompany || !queryUserId) return;
    try {
      const q = query(collection(db, 'invoiceRelations'), where('userId', '==', queryUserId), where('companyId', '==', selectedCompany.id));
      const snap = await getDocs(q);
      setRelations(snap.docs.map(d => ({ id: d.id, ...d.data() } as InvoiceRelation)));
    } catch (e) {
      console.error(e);
    }
  }, [user, selectedCompany, queryUserId]);

  const generateNextInvoiceNumber = useCallback(async () => {
    if (!user || !selectedCompany || !queryUserId) return;
    try {
      const num = await outgoingInvoiceService.getNextInvoiceNumber(queryUserId, selectedCompany.id);
      setInvoiceNumber(num);
    } catch (e) {
      console.error(e);
    }
  }, [user, selectedCompany, queryUserId]);

  // Load which weeks have already been invoiced for an employee
  const loadInvoicedWeeks = async (employeeId: string) => {
    if (!user || !selectedCompany || !queryUserId) return new Set<string>();

    try {
      // Get all invoices for this company
      const invoiceData = await outgoingInvoiceService.getInvoices(queryUserId, selectedCompany.id);

      // Find the employee name
      const employee = employees.find(e => e.id === employeeId);
      const employeeName = employee
        ? `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`
        : '';

      // Check all invoice items for week references for this employee
      const usedWeekIds = new Set<string>();

      invoiceData.forEach(invoice => {
        invoice.items.forEach(item => {
          // Check if title matches pattern "Week X EmployeeName"
          if (item.title && employeeName && item.title.includes(employeeName)) {
            const weekMatch = item.title.match(/Week (\d+)/);
            if (weekMatch) {
              // Create a composite key: week-year-employeeId (we'll match this later)
              usedWeekIds.add(`week-${weekMatch[1]}-${employeeId}`);
            }
          }
        });
      });

      return usedWeekIds;
    } catch (error) {
      console.error('Error loading invoiced weeks:', error);
      return new Set<string>();
    }
  };

  // Load production weeks when employee is selected
  const handleLoadProductionWeeks = async () => {
    if (!selectedProductionEmployeeId || !user || !selectedCompany || !queryUserId) {
      console.error('❌ Missing data:', { selectedProductionEmployeeId, user: !!user, selectedCompany: !!selectedCompany, queryUserId: !!queryUserId });
      showError('Fout', 'Selecteer een medewerker');
      return;
    }

    console.log('🔄 Loading production weeks for employee:', selectedProductionEmployeeId);
    setLoadingProduction(true);
    try {
      // Load invoiced weeks for this employee
      const invoicedIds = await loadInvoicedWeeks(selectedProductionEmployeeId);
      setInvoicedWeekIds(invoicedIds);

      const q = query(
        collection(db, 'productionWeeks'),
        where('userId', '==', queryUserId),
        where('companyId', '==', selectedCompany.id),
        where('employeeId', '==', selectedProductionEmployeeId),
        orderBy('week', 'desc')
      );

      const snap = await getDocs(q);
      console.log('✅ Got snapshots:', snap.size);

      const weeks: ProductionWeek[] = [];

      snap.docs.forEach(doc => {
        const data = doc.data();
        console.log('📋 Week data:', { week: data.week, year: data.year, entries: data.entries?.length });
        weeks.push({
          id: doc.id,
          week: data.week,
          year: data.year,
          employeeId: data.employeeId,
          entries: data.entries || [],
          totalHours: data.totalHours || 0
        });
      });

      console.log('✅ Loaded weeks:', weeks.length);
      setProductionWeeks(weeks);
      setSelectedProductionWeekIds([]);
      setSelectedProductionWeeks([]);

      if (weeks.length === 0) {
        showError('Geen data', `Geen productie weken gevonden`);
      } else {
        success('Geladen', `${weeks.length} weken gevonden`);
      }
    } catch (error) {
      console.error('❌ Error loading production weeks:', error);
      showError('Fout', `Kon productie weken niet laden: ${error instanceof Error ? error.message : 'Onbekend'}`);
    } finally {
      setLoadingProduction(false);
    }
  };

  // Handle week selection (toggle for multi-select)
  const handleWeekToggle = (weekId: string) => {
    const week = productionWeeks.find(w => w.id === weekId);
    if (!week) return;

    const isSelected = selectedProductionWeekIds.includes(weekId);

    if (isSelected) {
      // Remove from selection
      setSelectedProductionWeekIds(prev => prev.filter(id => id !== weekId));
      setSelectedProductionWeeks(prev => prev.filter(w => w.id !== weekId));
    } else {
      // Add to selection
      setSelectedProductionWeekIds(prev => [...prev, weekId]);
      setSelectedProductionWeeks(prev => [...prev, week]);
    }
  };

  // Check if a week is already invoiced
  const isWeekInvoiced = (week: ProductionWeek): boolean => {
    const key = `week-${week.week}-${week.employeeId}`;
    return invoicedWeekIds.has(key);
  };

  // Select all uninvoiced weeks
  const selectAllUninvoiced = () => {
    const uninvoicedWeeks = productionWeeks.filter(w => !isWeekInvoiced(w));
    setSelectedProductionWeekIds(uninvoicedWeeks.map(w => w.id));
    setSelectedProductionWeeks(uninvoicedWeeks);
  };

  // Clear selection
  const clearWeekSelection = () => {
    setSelectedProductionWeekIds([]);
    setSelectedProductionWeeks([]);
  };

  // Add production weeks as invoice items (one item per week)
  const addAllProductionItems = () => {
    console.log('🚀 Adding production items...');

    if (selectedProductionWeeks.length === 0) {
      console.error('❌ No weeks selected');
      showError('Fout', 'Selecteer minimaal één week');
      return;
    }

    const employee = employees.find(e => e.id === selectedProductionEmployeeId);
    const employeeName = employee
      ? `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`
      : 'Onbekend';

    const rate = 41.31;
    const newItems: InvoiceItem[] = [];

    // Create an invoice item for each selected week
    selectedProductionWeeks.forEach(week => {
      if (!week.entries || week.entries.length === 0) {
        console.warn(`⚠️ Week ${week.week} has no entries, skipping`);
        return;
      }

      // Build description in table format
      const tableHeader = 'Monteur\tDatum\tUren\tOpdrachtgever\tLocaties';
      const tableRows = week.entries
        .map(entry => `${entry.monteur}\t${entry.datum}\t${entry.uren}\t${entry.opdrachtgever}\t${entry.locaties}`)
        .join('\n');

      const description = `${tableHeader}\n${tableRows}`;
      const totalUren = week.totalHours;
      const amount = totalUren * rate;

      const newItem: InvoiceItem = {
        title: `Week ${week.week} ${employeeName}`,
        description: description,
        quantity: totalUren,
        rate: rate,
        amount: amount
      };

      console.log('✅ New item:', { title: newItem.title, quantity: newItem.quantity, rate: newItem.rate, amount: newItem.amount });
      newItems.push(newItem);
    });

    if (newItems.length === 0) {
      showError('Fout', 'Geen weken met entries gevonden');
      return;
    }

    // Remove empty first item if it exists
    const updatedItems = items.filter(i => i.title.trim() !== '');
    setItems([...updatedItems, ...newItems]);

    // Reset selection
    setSelectedProductionWeeks([]);
    setSelectedProductionWeekIds([]);
    setProductionWeeks([]);
    setSelectedProductionEmployeeId('');
    setShowProductionImport(false);

    success('✅ Toegevoegd', `${newItems.length} week(en) toegevoegd aan factuur`);
  };

  const handleCreateNew = () => {
    setEditingInvoice(null);
    setFormData({
      clientId: '',
      clientName: '',
      clientEmail: '',
      clientAddress: { street: '', city: '', zipCode: '', country: 'nederland' },
      clientPhone: '',
      clientKvk: '',
      clientTaxNumber: '',
      description: '',
      invoiceDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: '',
      purchaseOrder: '',
      projectCode: ''
    });
    setItems([{ title: '', description: '', quantity: 1, rate: 0, amount: 0 }]);
    setShowProductionImport(false);
    setProductionWeeks([]);
    setSelectedProductionWeeks([]);
    setSelectedProductionEmployeeId('');
    setSelectedProductionWeekIds([]);
    setInvoicedWeekIds(new Set());
    loadRelations();
    generateNextInvoiceNumber();
    setView('create');
  };

  const handleEdit = (inv: OutgoingInvoice) => {
    setEditingInvoice(inv);
    setFormData({
      clientId: inv.clientId || '',
      clientName: inv.clientName,
      clientEmail: inv.clientEmail,
      clientAddress: inv.clientAddress,
      clientPhone: inv.clientPhone || '',
      clientKvk: inv.clientKvk || '',
      clientTaxNumber: inv.clientTaxNumber || '',
      description: inv.description,
      invoiceDate: inv.invoiceDate.toISOString().split('T')[0],
      dueDate: inv.dueDate.toISOString().split('T')[0],
      notes: inv.notes || '',
      purchaseOrder: inv.purchaseOrder || '',
      projectCode: inv.projectCode || ''
    });
    setItems(inv.items);
    setInvoiceNumber(inv.invoiceNumber);
    loadRelations();
    setView('create');
  };

  const handleSelectRelation = (rel: InvoiceRelation) => {
    setFormData({
      ...formData,
      clientId: rel.id,
      clientName: rel.name,
      clientEmail: rel.email,
      clientPhone: rel.phone || '',
      clientKvk: rel.kvk || '',
      clientTaxNumber: rel.taxNumber || '',
      clientAddress: rel.address || { street: '', city: '', zipCode: '', country: 'Nederland' }
    });
    setIsRelationsOpen(false);
  };

  const updateItem = (idx: number, field: keyof InvoiceItem, val: string | number) => {
    const newItems = [...items];
    newItems[idx] = { ...newItems[idx], [field]: val };
    if (field === 'quantity' || field === 'rate') newItems[idx].amount = newItems[idx].quantity * newItems[idx].rate;
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { title: '', description: '', quantity: 1, rate: 0, amount: 0 }]);
  };

  const removeItem = (idx: number) => {
    if (items.length > 1) setItems(items.filter((_, i) => i !== idx));
  };

  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const vatAmount = subtotal * 0.21;
  const total = subtotal + vatAmount;

  const handleSubmitInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedCompany) {
      showError('Fout', 'Geen gebruiker/bedrijf');
      return;
    }
    if (!formData.clientName.trim()) {
      showError('Fout', 'Klantnaam verplicht');
      return;
    }
    const validItems = items.filter(i => i.description.trim());
    if (validItems.length === 0) {
      showError('Fout', 'Minimaal 1 regel nodig');
      return;
    }

    setFormLoading(true);
    try {
      const data: Omit<OutgoingInvoice, 'id' | 'createdAt' | 'updatedAt'> = {
        userId: queryUserId!,
        companyId: selectedCompany.id,
        invoiceNumber,
        clientId: formData.clientId,
        clientName: formData.clientName.trim(),
        clientEmail: formData.clientEmail.trim(),
        clientPhone: formData.clientPhone.trim(),
        clientKvk: formData.clientKvk.trim(),
        clientTaxNumber: formData.clientTaxNumber.trim(),
        clientAddress: formData.clientAddress,
        amount: subtotal,
        vatAmount,
        totalAmount: total,
        description: formData.description.trim(),
        purchaseOrder: formData.purchaseOrder.trim(),
        projectCode: formData.projectCode.trim(),
        invoiceDate: new Date(formData.invoiceDate),
        dueDate: new Date(formData.dueDate),
        status: 'draft',
        items: validItems,
        notes: formData.notes.trim()
      };

      if (editingInvoice?.id) {
        await outgoingInvoiceService.updateInvoice(editingInvoice.id, data);
        success('Bijgewerkt', 'Factuur succesvol bijgewerkt');
      } else {
        await outgoingInvoiceService.createInvoice(data);
        success('Aangemaakt', 'Factuur succesvol aangemaakt');
      }
      loadInvoices();
      setView('list');
    } catch (e) {
      showError('Fout', 'Kon niet opslaan');
    } finally {
      setFormLoading(false);
    }
  };

  const handleSendInvoice = async (invoiceId: string) => {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (!invoice) {
      showError('Fout', 'Factuur niet gevonden');
      return;
    }
    setSendingWebhook(invoiceId);
    try {
      // ⭐ AANPASSING: bankAccount toegevoegd
      const info: CompanyInfo = {
        id: selectedCompany?.id || '',
        name: selectedCompany?.name || '',
        kvk: selectedCompany?.kvk || '',
        taxNumber: selectedCompany?.taxNumber || '',
        bankAccount: selectedCompany?.bankAccount || '',  // ← NIEUW
        contactInfo: { email: selectedCompany?.contactInfo?.email || '', phone: selectedCompany?.contactInfo?.phone || '' },
        address: { street: selectedCompany?.address?.street || '', city: selectedCompany?.address?.city || '', zipCode: selectedCompany?.address?.zipCode || '', country: selectedCompany?.address?.country || '' }
      };
      const html = await outgoingInvoiceService.generateInvoiceHTML(invoice, info);
      const payload = {
        event: 'invoice.sent',
        timestamp: new Date().toISOString(),
        client: { name: invoice.clientName, email: invoice.clientEmail, phone: invoice.clientPhone || null },
        invoice: { id: invoice.id, invoiceNumber: invoice.invoiceNumber, status: 'sent', totalAmount: invoice.totalAmount, items: invoice.items },
        company: { id: selectedCompany?.id, name: selectedCompany?.name },
        user: { id: user?.uid, email: user?.email },
        htmlContent: html
      };
      const res = await fetch(MAKE_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000)
      });
      if (!res.ok) throw new Error('Webhook error');
      await outgoingInvoiceService.sendInvoice(invoiceId);
      success('Verstuurd', 'Factuur succesvol verzonden');
      loadInvoices();
    } catch (e) {
      showError('Fout', 'Kon niet versturen');
    } finally {
      setSendingWebhook(null);
    }
  };

  const handleMarkAsPaid = async (invoiceId: string) => {
    try {
      await outgoingInvoiceService.markAsPaid(invoiceId);
      success('Betaald', 'Factuur als betaald gemarkeerd');
      loadInvoices();
    } catch (e) {
      showError('Fout', 'Kon niet bijwerken');
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!confirm('Weet u zeker dat u deze factuur wilt verwijderen?')) return;
    try {
      await outgoingInvoiceService.deleteInvoice(invoiceId);
      success('Verwijderd', 'Factuur verwijderd');
      loadInvoices();
    } catch (e) {
      showError('Fout', 'Kon niet verwijderen');
    }
  };

  const getStatusColor = (status: OutgoingInvoice['status']) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-800 border-gray-200',
      sent: 'bg-primary-50 text-primary-700 border-primary-200',
      paid: 'bg-green-50 text-green-700 border-green-200',
      overdue: 'bg-red-50 text-red-700 border-red-200',
      cancelled: 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return colors[status] || colors.draft;
  };

  const getStatusIcon = (status: OutgoingInvoice['status']) => {
    const icons = {
      draft: Clock,
      sent: Send,
      paid: CheckCircle,
      overdue: AlertCircle,
      cancelled: AlertCircle
    };
    return icons[status] || Clock;
  };

  const getStatusText = (status: OutgoingInvoice['status']) => {
    const texts = {
      draft: 'Concept',
      sent: 'Verstuurd',
      paid: 'Betaald',
      overdue: 'Vervallen',
      cancelled: 'Geannuleerd'
    };
    return texts[status] || status;
  };

  const filteredInvoices = invoices.filter(
    inv =>
      (inv.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (statusFilter === 'all' || inv.status === statusFilter)
  );

  const totalAmount = filteredInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
  const draftCount = filteredInvoices.filter(inv => inv.status === 'draft').length;
  const sentCount = filteredInvoices.filter(inv => inv.status === 'sent').length;
  const paidCount = filteredInvoices.filter(inv => inv.status === 'paid').length;

  if (loading && view === 'list') {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (!selectedCompany) {
    return (
      <div className="space-y-6 px-4 sm:px-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Facturen</h1>
        </div>
        <EmptyState
          icon={Building2}
          title="Geen bedrijf geselecteerd"
          description="Selecteer een bedrijf uit de dropdown in de zijbalk om facturen te beheren."
        />
      </div>
    );
  }

  if (view === 'create') {
    return (
      <div className="space-y-4 sm:space-y-6 px-4 sm:px-0 pb-24 sm:pb-6">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => setView('list')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Terug"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              {editingInvoice ? 'Factuur bewerken' : 'Nieuwe factuur'}
            </h1>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">{invoiceNumber}</p>
          </div>
        </div>

        <form onSubmit={handleSubmitInvoice} className="space-y-6">
          {/* Client Selection */}
          <Card className="p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-primary-100 rounded-lg">
                <User className="h-4 w-4 text-primary-600" />
              </div>
              <h2 className="text-sm font-semibold text-gray-900">Klantgegevens</h2>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">Klant selecteren</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsRelationsOpen(!isRelationsOpen)}
                  className="w-full flex items-center justify-between p-3 border-2 border-gray-200 rounded-lg bg-white text-sm hover:border-gray-300 transition-colors"
                >
                  <span className={formData.clientName ? 'text-gray-900 font-medium' : 'text-gray-500'}>
                    {formData.clientName || 'Kies een klant...'}
                  </span>
                  <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isRelationsOpen ? 'rotate-180' : ''}`} />
                </button>
                {isRelationsOpen && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-gray-200 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
                    {relations.length === 0 ? (
                      <div className="p-4 text-xs text-gray-500 text-center">Geen relaties beschikbaar</div>
                    ) : (
                      relations.map(rel => (
                        <button
                          key={rel.id}
                          type="button"
                          onClick={() => handleSelectRelation(rel)}
                          className="w-full text-left px-4 py-3 hover:bg-primary-50 border-b border-gray-100 last:border-b-0 transition-colors"
                        >
                          <div className="font-medium text-gray-900 text-sm">{rel.name}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{rel.email}</div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Naam</label>
                <input
                  type="text"
                  value={formData.clientName}
                  onChange={e => setFormData({ ...formData, clientName: e.target.value })}
                  placeholder="Bedrijfsnaam"
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">E-mail</label>
                <input
                  type="email"
                  value={formData.clientEmail}
                  onChange={e => setFormData({ ...formData, clientEmail: e.target.value })}
                  placeholder="klant@bedrijf.nl"
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Telefoonnummer</label>
                <input
                  type="tel"
                  value={formData.clientPhone}
                  onChange={e => setFormData({ ...formData, clientPhone: e.target.value })}
                  placeholder="+31 6 12345678"
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">KvK-nummer</label>
                <input
                  type="text"
                  value={formData.clientKvk}
                  onChange={e => setFormData({ ...formData, clientKvk: e.target.value })}
                  placeholder="12345678"
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary-500 transition-colors"
                />
              </div>
            </div>
          </Card>

          {/* Dates */}
          <Card className="p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Calendar className="h-4 w-4 text-orange-600" />
              </div>
              <h2 className="text-sm font-semibold text-gray-900">Datums</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Factuurdatum</label>
                <input
                  type="date"
                  value={formData.invoiceDate}
                  onChange={e => setFormData({ ...formData, invoiceDate: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Vervaldatum</label>
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary-500 transition-colors"
                />
              </div>
            </div>
          </Card>

          {/* Production Data */}
          <Card className="p-4 sm:p-5 bg-amber-50 border-2 border-amber-200">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-100 rounded">
                  <Factory className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs font-medium text-amber-700">Production data</p>
                  <p className="text-xs text-amber-600">Uit database</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowProductionImport(!showProductionImport)}
                className="px-3 py-1 text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 rounded transition-colors whitespace-nowrap"
              >
                {showProductionImport ? '✕ Sluit' : '+ Open'}
              </button>
            </div>
            
            {showProductionImport && (
              <div className="mt-4 pt-4 border-t border-amber-200 space-y-3">
                <div className="bg-white rounded-lg p-3 space-y-3">
                  {/* Step 1: Employee Selector */}
                  <div>
                    <label className="block text-xs font-semibold text-amber-900 mb-2">STAP 1: Selecteer medewerker</label>
                    <select
                      value={selectedProductionEmployeeId}
                      onChange={(e) => {
                        setSelectedProductionEmployeeId(e.target.value);
                        setProductionWeeks([]);
                        setSelectedProductionWeeks([]);
                        setSelectedProductionWeekIds([]);
                        setInvoicedWeekIds(new Set());
                      }}
                      className="w-full px-3 py-2 border-2 border-amber-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                    >
                      <option value="">-- Kies medewerker --</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.personalInfo.firstName} {emp.personalInfo.lastName}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Step 2: Load Button */}
                  {selectedProductionEmployeeId && (
                    <button
                      type="button"
                      onClick={handleLoadProductionWeeks}
                      disabled={loadingProduction}
                      className="w-full px-3 py-2 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 rounded transition-colors"
                    >
                      {loadingProduction ? '⏳ Laden...' : '📥 LAAD WEKEN'}
                    </button>
                  )}

                  {/* Step 3: Week Selector (Multi-select with checkboxes) */}
                  {productionWeeks.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold text-amber-900">STAP 2: Selecteer weken (meerdere mogelijk)</label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={selectAllUninvoiced}
                            className="text-xs text-amber-700 hover:text-amber-900 underline"
                          >
                            Selecteer alle nieuwe
                          </button>
                          {selectedProductionWeekIds.length > 0 && (
                            <button
                              type="button"
                              onClick={clearWeekSelection}
                              className="text-xs text-red-600 hover:text-red-800 underline"
                            >
                              Wis selectie
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="max-h-48 overflow-y-auto border-2 border-amber-300 rounded bg-white">
                        {productionWeeks.map((week) => {
                          const invoiced = isWeekInvoiced(week);
                          const isSelected = selectedProductionWeekIds.includes(week.id);
                          return (
                            <label
                              key={week.id}
                              className={`flex items-center gap-3 px-3 py-2 cursor-pointer border-b border-amber-100 last:border-0 transition-colors ${
                                isSelected ? 'bg-amber-100' : invoiced ? 'bg-gray-100' : 'hover:bg-amber-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleWeekToggle(week.id)}
                                className="h-4 w-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs font-medium ${invoiced ? 'text-gray-500' : 'text-amber-900'}`}>
                                    Week {week.week} ({week.year})
                                  </span>
                                  {invoiced && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-700">
                                      ✓ Gefactureerd
                                    </span>
                                  )}
                                </div>
                                <span className={`text-xs ${invoiced ? 'text-gray-400' : 'text-amber-600'}`}>
                                  {week.entries.length} entries - {week.totalHours}u
                                </span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                      {selectedProductionWeekIds.length > 0 && (
                        <div className="mt-2 p-2 bg-amber-100 rounded text-xs text-amber-800">
                          <strong>{selectedProductionWeekIds.length}</strong> week(en) geselecteerd -
                          Totaal: <strong>{selectedProductionWeeks.reduce((sum, w) => sum + w.totalHours, 0)}</strong> uren
                        </div>
                      )}
                    </div>
                  )}

                  {/* Step 4: Preview selected weeks */}
                  {selectedProductionWeeks.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-amber-900">STAP 3: Preview geselecteerde weken</p>
                      <div className="bg-white border-2 border-amber-200 rounded p-2 max-h-48 overflow-y-auto space-y-3">
                        {selectedProductionWeeks.map((week) => (
                          <div key={week.id} className="border-b border-amber-200 pb-2 last:border-0 last:pb-0">
                            <div className="text-xs font-bold text-amber-900 mb-1">
                              Week {week.week} ({week.year}) - {week.totalHours}u
                            </div>
                            <div className="text-xs font-mono text-amber-800 space-y-0.5">
                              {week.entries.slice(0, 3).map((entry, idx) => (
                                <div key={idx} className="grid grid-cols-5 gap-1">
                                  <div className="truncate">{entry.monteur}</div>
                                  <div>{entry.datum}</div>
                                  <div className="text-right font-semibold">{entry.uren}u</div>
                                  <div className="truncate">{entry.opdrachtgever}</div>
                                  <div className="truncate text-amber-600">{entry.locaties}</div>
                                </div>
                              ))}
                              {week.entries.length > 3 && (
                                <div className="text-amber-500 italic">... en {week.entries.length - 3} meer</div>
                              )}
                            </div>
                          </div>
                        ))}
                        <div className="pt-2 border-t-2 border-amber-300 font-bold text-amber-900 text-xs">
                          Totaal alle weken: {selectedProductionWeeks.reduce((sum, w) => sum + w.totalHours, 0)} uren
                        </div>
                      </div>

                      {/* Step 5: Add Button */}
                      <button
                        type="button"
                        onClick={addAllProductionItems}
                        className="w-full px-3 py-3 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded transition-colors"
                      >
                        ✅ VOEG {selectedProductionWeeks.length} WEEK(EN) TOE AAN FACTUUR
                      </button>
                    </div>
                  )}

                  {productionWeeks.length === 0 && selectedProductionEmployeeId && !loadingProduction && (
                    <p className="text-xs text-amber-600 p-2 bg-amber-100 rounded">
                      ⚠️ Klik "LAAD WEKEN" om productie weken op te halen
                    </p>
                  )}
                </div>
              </div>
            )}
          </Card>

          {/* Invoice Items */}
          <Card className="p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-green-100 rounded-lg">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </div>
                <h2 className="text-sm font-semibold text-gray-900">Factuurregels</h2>
              </div>
              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Regel toevoegen
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, i) => (
                <div key={i} className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Titel</label>
                    <input
                      placeholder="Bijv: Week 40 Jan Jansen"
                      value={item.title}
                      onChange={e => updateItem(i, 'title', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Beschrijving</label>
                    <textarea
                      placeholder="Monteur	Datum	Uren	Opdrachtgever	Locaties"
                      value={item.description}
                      onChange={e => updateItem(i, 'description', e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Uren</label>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={e => updateItem(i, 'quantity', Number(e.target.value))}
                        min="0.1"
                        step="0.1"
                        className="w-full px-2 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">€/uur</label>
                      <input
                        type="number"
                        value={item.rate}
                        onChange={e => updateItem(i, 'rate', Number(e.target.value))}
                        min="0"
                        step="0.01"
                        className="w-full px-2 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Bedrag</label>
                      <div className="w-full px-2 py-2 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-right text-gray-900">
                        €{item.amount.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeItem(i)}
                    className="w-full p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-xs font-medium flex items-center justify-center gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Verwijderen
                  </button>
                </div>
              ))}
            </div>
          </Card>

          {/* Totals */}
          <Card className="p-5 sm:p-6 bg-gradient-to-br from-primary-50 to-indigo-50 border-primary-200">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Subtotaal:</span>
                <span className="text-lg font-semibold text-gray-900">€{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">BTW (21%):</span>
                <span className="text-lg font-semibold text-gray-900">€{vatAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-primary-200">
                <span className="text-sm font-semibold text-gray-900">Totaal:</span>
                <span className="text-2xl font-bold text-primary-600">€{total.toFixed(2)}</span>
              </div>
            </div>
          </Card>

          {/* Notes */}
          <Card className="p-5 sm:p-6 space-y-4">
            <label className="block text-xs font-medium text-gray-700">Opmerkingen</label>
            <textarea
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              placeholder="Eventuele opmerkingen op deze factuur..."
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary-500 transition-colors resize-none"
            />
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-3 pb-8">
            <Button
              type="button"
              onClick={() => setView('list')}
              variant="secondary"
              className="flex-1"
            >
              Annuleren
            </Button>
            <Button
              type="submit"
              disabled={formLoading}
              className="flex-1"
            >
              {formLoading ? 'Bezig...' : editingInvoice ? 'Bijwerken' : 'Opslaan'}
            </Button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0 pb-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Facturen</h1>
          <p className="text-sm text-gray-600 mt-2">
            {filteredInvoices.length} factuur{filteredInvoices.length !== 1 ? 'en' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowFilters(!showFilters)}
            variant="secondary"
            size="sm"
            icon={showFilters ? X : Search}
          >
            {showFilters ? 'Sluiten' : 'Filter'}
          </Button>
          <Button onClick={handleCreateNew} icon={Plus} size="sm">
            Nieuw
          </Button>
        </div>
      </div>

      {showFilters && (
        <Card className="p-4 sm:p-5 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Zoeken op naam of nummer..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10 py-2 text-xs sm:text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:border-primary-500 transition-colors"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs sm:text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:border-primary-500 transition-colors bg-white"
          >
            <option value="all">Alle statussen</option>
            <option value="draft">Concept</option>
            <option value="sent">Verstuurd</option>
            <option value="paid">Betaald</option>
            <option value="overdue">Vervallen</option>
          </select>
        </Card>
      )}

      {filteredInvoices.length === 0 ? (
        <Card>
          <EmptyState
            icon={Send}
            title="Geen facturen"
            description={searchTerm ? 'Geen resultaten gevonden.' : 'Maak uw eerste factuur aan.'}
            action={!searchTerm && <Button onClick={handleCreateNew} icon={Plus}>Nieuwe factuur</Button>}
          />
        </Card>
      ) : (
        <>
          <div className="space-y-3">
          {filteredInvoices.map(invoice => {
            const StatusIcon = getStatusIcon(invoice.status);
            const isExpanded = expandedInvoice === invoice.id;
            const isLoading = sendingWebhook === invoice.id;

            return (
              <Card
                key={invoice.id}
                className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer border-2 border-gray-200"
              >
                <button
                  onClick={() => setExpandedInvoice(isExpanded ? null : invoice.id)}
                  className="w-full"
                >
                  <div className="p-4 sm:p-5 flex items-center gap-3 sm:gap-4 hover:bg-gray-50 transition-colors">
                    <div className={`p-3 rounded-lg flex-shrink-0 ${
                      invoice.status === 'paid'
                        ? 'bg-green-100'
                        : invoice.status === 'sent'
                        ? 'bg-primary-100'
                        : invoice.status === 'overdue'
                        ? 'bg-red-100'
                        : 'bg-gray-100'
                    }`}>
                      <StatusIcon className={`h-5 w-5 ${
                        invoice.status === 'paid'
                          ? 'text-green-600'
                          : invoice.status === 'sent'
                          ? 'text-primary-600'
                          : invoice.status === 'overdue'
                          ? 'text-red-600'
                          : 'text-gray-600'
                      }`} />
                    </div>

                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-semibold text-gray-900 text-sm truncate">
                          {invoice.invoiceNumber}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusColor(invoice.status)}`}>
                          <StatusIcon className="h-3 w-3" />
                          {getStatusText(invoice.status)}
                        </span>
                      </div>
                      <div className="text-xs sm:text-sm text-gray-600">{invoice.clientName}</div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <div className="font-semibold text-gray-900 text-sm">€{invoice.totalAmount.toFixed(2)}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {invoice.invoiceDate.toLocaleDateString('nl-NL')}
                      </div>
                    </div>

                    <ChevronDown
                      className={`h-5 w-5 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t-2 border-gray-200 bg-gray-50 px-4 sm:px-5 py-4 space-y-4">
                    {invoice.items.length > 0 && (
                      <div className="bg-white rounded-lg p-4 space-y-2">
                        <h4 className="font-semibold text-sm text-gray-900 mb-3">Factuurregels</h4>
                        {invoice.items.map((item, i) => (
                          <div key={i} className="pb-3 last:pb-0">
                            {item.title && (
                              <p className="text-gray-900 font-semibold text-sm">{item.title}</p>
                            )}
                            {item.description && (
                              <p className="text-gray-600 text-xs mt-1 whitespace-pre-wrap font-mono">{item.description}</p>
                            )}
                            <div className="flex justify-between items-baseline mt-2 text-xs text-gray-700">
                              <span>{item.quantity}x @ €{item.rate.toFixed(2)}</span>
                              <span className="font-semibold text-gray-900">€{item.amount.toFixed(2)}</span>
                            </div>
                            {i < invoice.items.length - 1 && (
                              <div className="border-t border-gray-200 mt-3" />
                            )}
                          </div>
                        ))}
                        <div className="border-t border-gray-200 pt-2 mt-3 flex justify-between font-semibold">
                          <span className="text-gray-600">Totaal:</span>
                          <span className="text-primary-600">€{invoice.totalAmount.toFixed(2)}</span>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 flex-wrap">
                      <Button
                        onClick={() => handleEdit(invoice)}
                        variant="secondary"
                        size="sm"
                        icon={Edit}
                        className="flex-1 text-xs"
                      >
                        Bewerk
                      </Button>

                      {invoice.status === 'draft' && (
                        <Button
                          onClick={() => handleSendInvoice(invoice.id!)}
                          disabled={isLoading}
                          size="sm"
                          icon={Send}
                          className="flex-1 text-xs"
                        >
                          {isLoading ? '...' : 'Verstuur'}
                        </Button>
                      )}

                      {invoice.status === 'sent' && (
                        <Button
                          onClick={() => handleMarkAsPaid(invoice.id!)}
                          variant="primary"
                          size="sm"
                          icon={CheckCircle}
                          className="flex-1 text-xs"
                        >
                          Betaald
                        </Button>
                      )}

                      {invoice.status === 'draft' && (
                        <Button
                          onClick={() => handleDeleteInvoice(invoice.id!)}
                          variant="danger"
                          size="sm"
                          icon={Trash2}
                          className="flex-1 text-xs"
                        >
                          Verwijder
                        </Button>
                      )}

                      <Button
                        variant="secondary"
                        size="sm"
                        icon={Eye}
                        className="flex-1 text-xs"
                      >
                        Voorbeeld
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
          </div>

          <div className="bg-white border-2 border-gray-200 rounded-lg px-4 sm:px-6 py-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <p className="text-gray-600 font-medium">Totaal</p>
                <p className="text-lg sm:text-xl font-bold text-gray-900 mt-1">€{totalAmount.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-gray-600 font-medium">Concept</p>
                <p className="text-lg sm:text-xl font-bold text-gray-900 mt-1">{draftCount}</p>
              </div>
              <div>
                <p className="text-primary-600 font-medium">Verstuurd</p>
                <p className="text-lg sm:text-xl font-bold text-primary-600 mt-1">{sentCount}</p>
              </div>
              <div>
                <p className="text-green-600 font-medium">Betaald</p>
                <p className="text-lg sm:text-xl font-bold text-green-600 mt-1">{paidCount}</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default OutgoingInvoices;