import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Send, Search, Calendar, Euro, Building2, User, CheckCircle, AlertCircle, Clock, Edit, Trash2, ChevronDown, X, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import Button from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useToast } from '../hooks/useToast';
import { EmptyState } from '../components/ui/EmptyState';
import { outgoingInvoiceService, OutgoingInvoice, CompanyInfo } from '../services/outgoingInvoiceService';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';

const MAKE_WEBHOOK_URL = 'https://hook.eu2.make.com/ttdixmxlu9n7rvbnxgfomilht2ihllc2';

interface InvoiceItem {
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

const OutgoingInvoices: React.FC = () => {
  const { user } = useAuth();
  const { selectedCompany } = useApp();
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

  const [items, setItems] = useState<InvoiceItem[]>([{ description: '', quantity: 1, rate: 0, amount: 0 }]);

  const loadInvoices = useCallback(async () => {
    if (!user || !selectedCompany) { setLoading(false); return; }
    try {
      setLoading(true);
      const data = await outgoingInvoiceService.getInvoices(user.uid, selectedCompany.id);
      setInvoices(data);
    } catch (e) { showError('Fout', 'Kon facturen niet laden'); }
    finally { setLoading(false); }
  }, [user, selectedCompany, showError]);

  useEffect(() => { loadInvoices(); }, [loadInvoices]);

  const loadRelations = useCallback(async () => {
    if (!user || !selectedCompany) return;
    try {
      const q = query(collection(db, 'invoiceRelations'), where('userId', '==', user.uid), where('companyId', '==', selectedCompany.id));
      const snap = await getDocs(q);
      setRelations(snap.docs.map(d => ({ id: d.id, ...d.data() } as InvoiceRelation)));
    } catch (e) { console.error(e); }
  }, [user, selectedCompany]);

  const generateNextInvoiceNumber = useCallback(async () => {
    if (!user || !selectedCompany) return;
    try {
      const num = await outgoingInvoiceService.getNextInvoiceNumber(user.uid, selectedCompany.id);
      setInvoiceNumber(num);
    } catch (e) { console.error(e); }
  }, [user, selectedCompany]);

  const handleCreateNew = () => {
    setEditingInvoice(null);
    setFormData({ clientId: '', clientName: '', clientEmail: '', clientAddress: { street: '', city: '', zipCode: '', country: 'Nederland' }, clientPhone: '', clientKvk: '', clientTaxNumber: '', description: '', invoiceDate: new Date().toISOString().split('T')[0], dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], notes: '', purchaseOrder: '', projectCode: '' });
    setItems([{ description: '', quantity: 1, rate: 0, amount: 0 }]);
    loadRelations();
    generateNextInvoiceNumber();
    setView('create');
  };

  const handleEdit = (inv: OutgoingInvoice) => {
    setEditingInvoice(inv);
    setFormData({ clientId: inv.clientId || '', clientName: inv.clientName, clientEmail: inv.clientEmail, clientAddress: inv.clientAddress, clientPhone: inv.clientPhone || '', clientKvk: inv.clientKvk || '', clientTaxNumber: inv.clientTaxNumber || '', description: inv.description, invoiceDate: inv.invoiceDate.toISOString().split('T')[0], dueDate: inv.dueDate.toISOString().split('T')[0], notes: inv.notes || '', purchaseOrder: inv.purchaseOrder || '', projectCode: inv.projectCode || '' });
    setItems(inv.items);
    setInvoiceNumber(inv.invoiceNumber);
    loadRelations();
    setView('create');
  };

  const handleSelectRelation = (rel: InvoiceRelation) => {
    setFormData({ ...formData, clientId: rel.id, clientName: rel.name, clientEmail: rel.email, clientPhone: rel.phone || '', clientKvk: rel.kvk || '', clientTaxNumber: rel.taxNumber || '', clientAddress: rel.address || { street: '', city: '', zipCode: '', country: 'Nederland' } });
    setIsRelationsOpen(false);
  };

  const updateItem = (idx: number, field: keyof InvoiceItem, val: string | number) => {
    const newItems = [...items];
    newItems[idx] = { ...newItems[idx], [field]: val };
    if (field === 'quantity' || field === 'rate') newItems[idx].amount = newItems[idx].quantity * newItems[idx].rate;
    setItems(newItems);
  };

  const addItem = () => { setItems([...items, { description: '', quantity: 1, rate: 0, amount: 0 }]); };
  const removeItem = (idx: number) => { if (items.length > 1) setItems(items.filter((_, i) => i !== idx)); };

  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const vatAmount = subtotal * 0.21;
  const total = subtotal + vatAmount;

  const handleSubmitInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedCompany) { showError('Fout', 'Geen gebruiker/bedrijf'); return; }
    if (!formData.clientName.trim()) { showError('Fout', 'Klantnaam verplicht'); return; }
    const validItems = items.filter(i => i.description.trim());
    if (validItems.length === 0) { showError('Fout', 'Min 1 regel'); return; }

    setFormLoading(true);
    try {
      const data: Omit<OutgoingInvoice, 'id' | 'createdAt' | 'updatedAt'> = {
        userId: user.uid,
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
        success('Bijgewerkt', 'OK');
      } else {
        await outgoingInvoiceService.createInvoice(data);
        success('Aangemaakt', 'OK');
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
    if (!invoice) { showError('Fout', 'Niet gevonden'); return; }
    setSendingWebhook(invoiceId);
    try {
      const info: CompanyInfo = {
        id: selectedCompany?.id || '',
        name: selectedCompany?.name || '',
        kvk: selectedCompany?.kvk || '',
        taxNumber: selectedCompany?.taxNumber || '',
        contactInfo: { email: selectedCompany?.contactInfo?.email || '', phone: selectedCompany?.contactInfo?.phone || '' },
        address: { street: selectedCompany?.address?.street || '', city: selectedCompany?.address?.city || '', zipCode: selectedCompany?.address?.zipCode || '', country: selectedCompany?.address?.country || '' }
      };
      const html = await outgoingInvoiceService.generateInvoiceHTML(invoice, info);
      const payload = { event: 'invoice.sent', timestamp: new Date().toISOString(), client: { name: invoice.clientName, email: invoice.clientEmail, phone: invoice.clientPhone || null }, invoice: { id: invoice.id, invoiceNumber: invoice.invoiceNumber, status: 'sent', totalAmount: invoice.totalAmount, items: invoice.items }, company: { id: selectedCompany?.id, name: selectedCompany?.name }, user: { id: user?.uid, email: user?.email }, htmlContent: html };
      const res = await fetch(MAKE_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error('Webhook error');
      await outgoingInvoiceService.sendInvoice(invoiceId);
      success('Verstuurd', 'OK');
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
      success('Betaald', 'OK');
      loadInvoices();
    } catch (e) {
      showError('Fout', 'Kon niet bijwerken');
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!confirm('Verwijderen?')) return;
    try {
      await outgoingInvoiceService.deleteInvoice(invoiceId);
      success('Verwijderd', 'OK');
      loadInvoices();
    } catch (e) {
      showError('Fout', 'Kon niet verwijderen');
    }
  };

  const getStatusColor = (status: OutgoingInvoice['status']) => ({ draft: 'bg-gray-100 text-gray-800', sent: 'bg-blue-100 text-blue-800', paid: 'bg-green-100 text-green-800', overdue: 'bg-red-100 text-red-800', cancelled: 'bg-gray-100 text-gray-800' }[status] || 'bg-gray-100 text-gray-800');
  const getStatusIcon = (status: OutgoingInvoice['status']) => ({ draft: Clock, sent: Send, paid: CheckCircle, overdue: AlertCircle, cancelled: AlertCircle }[status] || Clock);
  const getStatusText = (status: OutgoingInvoice['status']) => ({ draft: 'Concept', sent: 'Verstuurd', paid: 'Betaald', overdue: 'Vervallen', cancelled: 'Geannuleerd' }[status] || status);

  const filteredInvoices = invoices.filter(inv => (inv.clientName.toLowerCase().includes(searchTerm.toLowerCase()) || inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase())) && (statusFilter === 'all' || inv.status === statusFilter));

  const totalAmount = filteredInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
  const draftCount = filteredInvoices.filter(inv => inv.status === 'draft').length;
  const sentCount = filteredInvoices.filter(inv => inv.status === 'sent').length;
  const paidCount = filteredInvoices.filter(inv => inv.status === 'paid').length;

  if (loading && view === 'list') return <LoadingSpinner />;
  if (!selectedCompany) return <EmptyState icon={Building2} title="Geen bedrijf" description="Selecteer bedrijf" />;

  if (view === 'create') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="px-4 py-4 flex items-center gap-3">
            <button onClick={() => setView('list')} className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft className="h-5 w-5 text-gray-600" /></button>
            <div><h1 className="text-xl font-bold text-gray-900">{editingInvoice ? 'Bewerken' : 'Nieuw'}</h1><p className="text-xs text-gray-600">{invoiceNumber}</p></div>
          </div>
        </div>
        <div className="px-4 py-4 pb-24">
          <form onSubmit={handleSubmitInvoice} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">Klant</label>
              <div className="relative">
                <button type="button" onClick={() => setIsRelationsOpen(!isRelationsOpen)} className="w-full flex items-center justify-between p-3 border border-gray-300 rounded-lg bg-white text-sm">
                  <span className={formData.clientName ? 'text-gray-900' : 'text-gray-500'}>{formData.clientName || 'Selecteer...'}</span>
                  <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isRelationsOpen ? 'rotate-180' : ''}`} />
                </button>
                {isRelationsOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                    {relations.length === 0 ? <div className="p-3 text-xs text-gray-500">Geen relaties</div> : relations.map(rel => (
                      <button key={rel.id} type="button" onClick={() => handleSelectRelation(rel)} className="w-full text-left px-3 py-2 hover:bg-gray-100 text-xs">
                        <div className="font-medium text-gray-900">{rel.name}</div>
                        <div className="text-gray-500">{rel.email}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Factuurdatum</label><input type="date" value={formData.invoiceDate} onChange={(e) => setFormData({ ...formData, invoiceDate: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Vervaldatum</label><input type="date" value={formData.dueDate} onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2"><label className="text-xs font-medium text-gray-700">Regels</label><button type="button" onClick={addItem} className="text-xs text-blue-600 font-medium flex items-center gap-1"><Plus className="h-3 w-3" />Regel</button></div>
              <div className="space-y-2">
                {items.map((item, i) => (
                  <div key={i} className="flex gap-2 items-end">
                    <input placeholder="Beschrijving" value={item.description} onChange={(e) => updateItem(i, 'description', e.target.value)} className="flex-1 px-2 py-2 border border-gray-300 rounded-lg text-xs" />
                    <input type="number" placeholder="Qty" value={item.quantity} onChange={(e) => updateItem(i, 'quantity', Number(e.target.value))} className="w-16 px-2 py-2 border border-gray-300 rounded-lg text-xs" />
                    <input type="number" placeholder="Rate" value={item.rate} onChange={(e) => updateItem(i, 'rate', Number(e.target.value))} className="w-20 px-2 py-2 border border-gray-300 rounded-lg text-xs" />
                    <div className="w-20 px-2 py-2 bg-gray-50 rounded-lg text-xs font-medium text-right">€{item.amount.toFixed(2)}</div>
                    <button type="button" onClick={() => removeItem(i)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-600">Subtotaal:</span><span className="font-medium">€{subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">BTW:</span><span className="font-medium">€{vatAmount.toFixed(2)}</span></div>
              <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-200"><span>Totaal:</span><span>€{total.toFixed(2)}</span></div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Opmerkingen</label>
              <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>

            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 flex gap-2">
              <Button variant="ghost" onClick={() => setView('list')} className="flex-1">Annuleren</Button>
              <Button variant="primary" type="submit" disabled={formLoading} className="flex-1">{formLoading ? '...' : 'Opslaan'}</Button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div><h1 className="text-xl font-bold text-gray-900">Facturen</h1><p className="text-xs text-gray-600">{selectedCompany.name}</p></div>
            <Button onClick={handleCreateNew} icon={Plus} size="sm">Nieuw</Button>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1"><Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /><input type="text" placeholder="Zoeken..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-8 pr-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500" />{searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"><X className="h-3 w-3" /></button>}</div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-2 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500"><option value="all">Alle</option><option value="draft">Concept</option><option value="sent">Verstuurd</option><option value="paid">Betaald</option></select>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 pb-20">
        {filteredInvoices.length === 0 ? <EmptyState icon={Send} title="Geen facturen" description="Maak nieuw" action={<Button onClick={handleCreateNew} icon={Plus}>Nieuw</Button>} /> : (
          <div className="space-y-2">
            {filteredInvoices.map((invoice) => {
              const StatusIcon = getStatusIcon(invoice.status);
              const isExpanded = expandedInvoice === invoice.id;
              const isLoading = sendingWebhook === invoice.id;
              return (
                <div key={invoice.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-sm transition-shadow">
                  <button onClick={() => setExpandedInvoice(isExpanded ? null : invoice.id)} className="w-full px-3 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors">
                    <ChevronDown className={`h-5 w-5 text-gray-400 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900 text-sm truncate">{invoice.invoiceNumber}</span>
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}><StatusIcon className="h-3 w-3" />{getStatusText(invoice.status)}</span>
                      </div>
                      <div className="text-xs text-gray-600">{invoice.clientName}</div>
                    </div>
                    <div className="text-right flex-shrink-0"><div className="font-semibold text-gray-900 text-sm">€{invoice.totalAmount.toFixed(2)}</div><div className="text-xs text-gray-500">{invoice.invoiceDate.toLocaleDateString('nl-NL')}</div></div>
                  </button>
                  {isExpanded && (
                    <div className="border-t border-gray-200 bg-gray-50 px-3 py-3 space-y-2 text-xs">
                      {invoice.items.length > 0 && (
                        <div className="bg-white rounded p-2">
                          <div className="font-semibold text-gray-900 mb-1">Regels</div>
                          {invoice.items.map((item, i) => (
                            <div key={i} className="flex justify-between text-gray-600 mb-1 last:mb-0">
                              <span className="truncate flex-1">{item.description}</span>
                              <span className="ml-2 flex-shrink-0">€{item.amount.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2 flex-wrap">
                        <Button variant="ghost" size="sm" icon={Edit} onClick={() => handleEdit(invoice)} className="text-xs flex-1">Bewerk</Button>
                        {invoice.status === 'draft' && <Button variant="primary" size="sm" icon={Send} onClick={() => handleSendInvoice(invoice.id!)} disabled={isLoading} className="text-xs flex-1">{isLoading ? '...' : 'Verstuur'}</Button>}
                        {invoice.status === 'sent' && <Button variant="primary" size="sm" icon={CheckCircle} onClick={() => handleMarkAsPaid(invoice.id!)} className="text-xs flex-1">Betaald</Button>}
                        {invoice.status === 'draft' && <Button variant="danger" size="sm" icon={Trash2} onClick={() => handleDeleteInvoice(invoice.id!)} className="text-xs flex-1">Del</Button>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {filteredInvoices.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3">
          <div className="grid grid-cols-4 gap-3 text-xs">
            <div><div className="text-gray-600">Totaal</div><div className="text-lg font-bold text-gray-900">€{totalAmount.toFixed(2)}</div></div>
            <div><div className="text-gray-600">Concept</div><div className="text-lg font-bold text-gray-600">{draftCount}</div></div>
            <div><div className="text-gray-600">Verstuurd</div><div className="text-lg font-bold text-blue-600">{sentCount}</div></div>
            <div><div className="text-gray-600">Betaald</div><div className="text-lg font-bold text-green-600">{paidCount}</div></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OutgoingInvoices;