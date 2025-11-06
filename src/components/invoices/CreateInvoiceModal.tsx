import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, ChevronDown } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import { outgoingInvoiceService, OutgoingInvoice } from '../../services/outgoingInvoiceService';
import Button from '../ui/Button';
import { useToast } from '../../hooks/useToast';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface CreateInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingInvoice?: OutgoingInvoice | null;
}

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
  address?: {
    street: string;
    city: string;
    zipCode: string;
    country: string;
  };
  kvk?: string;
  taxNumber?: string;
}

const CreateInvoiceModal: React.FC<CreateInvoiceModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  editingInvoice
}) => {
  const { user } = useAuth();
  const { selectedCompany } = useApp();
  const { success, error } = useToast();
  const [loading, setLoading] = useState(false);
  const [relations, setRelations] = useState<InvoiceRelation[]>([]);
  const [isRelationsOpen, setIsRelationsOpen] = useState(false);

  const [formData, setFormData] = useState({
    clientId: editingInvoice?.clientId || '',
    clientName: editingInvoice?.clientName || '',
    clientEmail: editingInvoice?.clientEmail || '',
    clientAddress: {
      street: editingInvoice?.clientAddress?.street || '',
      city: editingInvoice?.clientAddress?.city || '',
      zipCode: editingInvoice?.clientAddress?.zipCode || '',
      country: editingInvoice?.clientAddress?.country || 'Nederland'
    },
    clientPhone: editingInvoice?.clientPhone || '',
    clientKvk: editingInvoice?.clientKvk || '',
    clientTaxNumber: editingInvoice?.clientTaxNumber || '',
    description: editingInvoice?.description || '',
    invoiceDate: editingInvoice?.invoiceDate?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
    dueDate: editingInvoice?.dueDate?.toISOString().split('T')[0] || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    notes: editingInvoice?.notes || '',
    purchaseOrder: editingInvoice?.purchaseOrder || '',
    projectCode: editingInvoice?.projectCode || ''
  });

  const [items, setItems] = useState<InvoiceItem[]>(
    editingInvoice?.items?.length ? editingInvoice.items : [
      { description: '', quantity: 1, rate: 0, amount: 0 }
    ]
  );

  // Load relations
  useEffect(() => {
    if (!isOpen || !selectedCompany) return;

    const loadRelations = async () => {
      try {
        if (!user) return;
        
        const q = query(
          collection(db, 'invoiceRelations'),
          where('userId', '==', user.uid),
          where('companyId', '==', selectedCompany.id)
        );

        const querySnapshot = await getDocs(q);
        const relationsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as InvoiceRelation[];

        setRelations(relationsData);
      } catch (err) {
        console.error('Error loading relations:', err);
      }
    };

    loadRelations();
  }, [isOpen, selectedCompany, user]);

  if (!isOpen) return null;

  const calculateItemAmount = (quantity: number, rate: number) => quantity * rate;

  const updateItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    if (field === 'quantity' || field === 'rate') {
      newItems[index].amount = calculateItemAmount(
        newItems[index].quantity,
        newItems[index].rate
      );
    }
    
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { description: '', quantity: 1, rate: 0, amount: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const handleSelectRelation = (relation: InvoiceRelation) => {
    setFormData({
      ...formData,
      clientId: relation.id,
      clientName: relation.name,
      clientEmail: relation.email,
      clientPhone: relation.phone || '',
      clientKvk: relation.kvk || '',
      clientTaxNumber: relation.taxNumber || '',
      clientAddress: relation.address || {
        street: '',
        city: '',
        zipCode: '',
        country: 'Nederland'
      }
    });
    setIsRelationsOpen(false);
  };

  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const vatAmount = subtotal * 0.21;
  const total = subtotal + vatAmount;

  const generateInvoiceNumber = () => {
    const year = new Date().getFullYear();
    const timestamp = Date.now().toString().slice(-6);
    return `INV-${year}-${timestamp}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !selectedCompany) {
      error('Fout', 'Geen gebruiker of bedrijf geselecteerd');
      return;
    }

    if (!formData.clientName.trim()) {
      error('Validatie fout', 'Klantnaam is verplicht');
      return;
    }

    if (items.some(item => !item.description.trim())) {
      error('Validatie fout', 'Alle items moeten een beschrijving hebben');
      return;
    }

    setLoading(true);
    try {
      const invoiceData: Omit<OutgoingInvoice, 'id' | 'createdAt' | 'updatedAt'> = {
        userId: user.uid,
        companyId: selectedCompany.id,
        invoiceNumber: editingInvoice?.invoiceNumber || generateInvoiceNumber(),
        
        // Client gegevens
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
        
        // Extra velden
        purchaseOrder: formData.purchaseOrder.trim(),
        projectCode: formData.projectCode.trim(),
        
        invoiceDate: new Date(formData.invoiceDate),
        dueDate: new Date(formData.dueDate),
        status: 'draft',
        items: items.filter(item => item.description.trim()),
        notes: formData.notes.trim() || ''
      };

      if (editingInvoice?.id) {
        await outgoingInvoiceService.updateInvoice(editingInvoice.id, invoiceData);
        success('Factuur bijgewerkt', 'De factuur is succesvol bijgewerkt');
      } else {
        await outgoingInvoiceService.createInvoice(invoiceData);
        success('Factuur aangemaakt', 'De factuur is succesvol aangemaakt');
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error saving invoice:', err);
      error('Fout bij opslaan', 'Kon factuur niet opslaan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            {editingInvoice ? 'Factuur Bewerken' : 'Nieuwe Factuur'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-140px)]">
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* KLANTEN SELECTOR */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Klant Selecteren
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsRelationsOpen(!isRelationsOpen)}
                  className="w-full flex items-center justify-between p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  <span className={formData.clientName ? 'text-gray-900' : 'text-gray-500'}>
                    {formData.clientName || 'Selecteer een klant...'}
                  </span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${isRelationsOpen ? 'rotate-180' : ''}`} />
                </button>

                {isRelationsOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                    {relations.length === 0 ? (
                      <div className="p-4 text-center text-gray-500 text-sm">
                        Geen relaties gevonden. Maak eerst relaties aan!
                      </div>
                    ) : (
                      relations.map(relation => (
                        <button
                          key={relation.id}
                          type="button"
                          onClick={() => handleSelectRelation(relation)}
                          className="w-full text-left px-4 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
                        >
                          <div className="font-medium text-gray-900">{relation.name}</div>
                          <div className="text-xs text-gray-500">{relation.email}</div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* KLANT GEGEVENS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Klantnaam *
                </label>
                <input
                  type="text"
                  required
                  value={formData.clientName}
                  onChange={(e) => setFormData({...formData, clientName: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Bedrijfsnaam of naam"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  E-mailadres
                </label>
                <input
                  type="email"
                  value={formData.clientEmail}
                  onChange={(e) => setFormData({...formData, clientEmail: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="klant@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Telefoon
                </label>
                <input
                  type="tel"
                  value={formData.clientPhone}
                  onChange={(e) => setFormData({...formData, clientPhone: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="+31 6 12345678"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  KvK
                </label>
                <input
                  type="text"
                  value={formData.clientKvk}
                  onChange={(e) => setFormData({...formData, clientKvk: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="12345678"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Belasting Nummer
                </label>
                <input
                  type="text"
                  value={formData.clientTaxNumber}
                  onChange={(e) => setFormData({...formData, clientTaxNumber: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="NL123456789B01"
                />
              </div>
            </div>

            {/* ADRES */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Adres
                </label>
                <input
                  type="text"
                  value={formData.clientAddress.street}
                  onChange={(e) => setFormData({
                    ...formData, 
                    clientAddress: {...formData.clientAddress, street: e.target.value}
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Straat en huisnummer"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Postcode
                </label>
                <input
                  type="text"
                  value={formData.clientAddress.zipCode}
                  onChange={(e) => setFormData({
                    ...formData, 
                    clientAddress: {...formData.clientAddress, zipCode: e.target.value}
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="1234 AB"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Plaats
                </label>
                <input
                  type="text"
                  value={formData.clientAddress.city}
                  onChange={(e) => setFormData({
                    ...formData, 
                    clientAddress: {...formData.clientAddress, city: e.target.value}
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Amsterdam"
                />
              </div>
            </div>

            {/* FACTUUR DETAILS */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Factuurdatum
                </label>
                <input
                  type="date"
                  required
                  value={formData.invoiceDate}
                  onChange={(e) => setFormData({...formData, invoiceDate: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vervaldatum
                </label>
                <input
                  type="date"
                  required
                  value={formData.dueDate}
                  onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  PO nummer
                </label>
                <input
                  type="text"
                  value={formData.purchaseOrder}
                  onChange={(e) => setFormData({...formData, purchaseOrder: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="PO-123456"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Code
                </label>
                <input
                  type="text"
                  value={formData.projectCode}
                  onChange={(e) => setFormData({...formData, projectCode: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="PROJECT-001"
                />
              </div>
            </div>

            {/* ITEMS */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <label className="block text-sm font-medium text-gray-700">
                  Factuurregels
                </label>
                <Button type="button" variant="ghost" size="sm" icon={Plus} onClick={addItem}>
                  Regel toevoegen
                </Button>
              </div>
              
              <div className="space-y-3">
                {items.map((item, index) => (
                  <div key={index} className="grid grid-cols-12 gap-3 items-end">
                    <div className="col-span-5">
                      <input
                        type="text"
                        placeholder="Beschrijving"
                        value={item.description}
                        onChange={(e) => updateItem(index, 'description', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        placeholder="Aantal"
                        min="0"
                        step="0.01"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        placeholder="Prijs"
                        min="0"
                        step="0.01"
                        value={item.rate}
                        onChange={(e) => updateItem(index, 'rate', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="text"
                        value={`€${item.amount.toFixed(2)}`}
                        readOnly
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                      />
                    </div>
                    <div className="col-span-1">
                      {items.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          icon={Trash2}
                          onClick={() => removeItem(index)}
                          className="text-red-600 hover:text-red-700"
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* TOTAAL */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Subtotaal:</span>
                  <span>€{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>BTW (21%):</span>
                  <span>€{vatAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>Totaal:</span>
                  <span>€{total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* BESCHRIJVING & NOTITIES */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Beschrijving
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Extra informatie over de factuur..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notities (intern)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Interne notities..."
                />
              </div>
            </div>
          </form>
        </div>

        <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
          <Button type="button" variant="ghost" onClick={onClose}>
            Annuleren
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="min-w-24"
          >
            {loading ? 'Opslaan...' : editingInvoice ? 'Bijwerken' : 'Aanmaken'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CreateInvoiceModal;