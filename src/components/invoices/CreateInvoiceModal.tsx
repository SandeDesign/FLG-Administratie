import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, ChevronDown } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import { outgoingInvoiceService, OutgoingInvoice } from '../../services/outgoingInvoiceService';
import FactuurWerkbonnenImport from './FactuurWerkbonnenImport';
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

// HARDCODED CONFIG VOOR WERKBONNEN FACTUURATIE
const WERKBONNEN_FACTUUR_CONFIG = {
  companyId: 'FmbKRF1sL3waJ8zesz42', // IT Knecht
  clientId: 'A6lpSEtH0LMQKUgSy6o'    // Riset BV
};

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
  const [invoiceNumber, setInvoiceNumber] = useState('');

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

  // Load relations and generate invoice number
  useEffect(() => {
    if (!isOpen || !selectedCompany || !user) return;

    const loadData = async () => {
      try {
        // Load relations
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

        // Generate next invoice number
        if (!editingInvoice) {
          const nextNumber = await outgoingInvoiceService.getNextInvoiceNumber(
            user.uid,
            selectedCompany.id
          );
          setInvoiceNumber(nextNumber);
        } else {
          setInvoiceNumber(editingInvoice.invoiceNumber);
        }
      } catch (err) {
        console.error('Error loading data:', err);
      }
    };

    loadData();
  }, [isOpen, selectedCompany, user, editingInvoice]);

  if (!isOpen) return null;

  // Check if this is werkbonnen factuur (alleen op bedrijfsnaam)
  const isWerkbonnenFactuur = selectedCompany?.id === WERKBONNEN_FACTUUR_CONFIG.companyId;

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

  // HANDLER VOOR WERKBONNEN IMPORT
  const handleImportWerkbonnen = (importedItems: any[]) => {
    setItems([...items, ...importedItems]);
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

    const validItems = items.filter(item => item.description.trim());
    if (validItems.length === 0) {
      error('Validatie fout', 'Voeg minimaal één factuuregel toe');
      return;
    }

    setLoading(true);
    try {
      const invoiceData: Omit<OutgoingInvoice, 'id' | 'createdAt' | 'updatedAt'> = {
        userId: user.uid,
        companyId: selectedCompany.id,
        invoiceNumber: invoiceNumber,
        
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
        items: validItems,
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
            {/* FACTUURNUMMER DISPLAY */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Factuurnummer
              </label>
              <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm font-medium text-gray-900">
                {invoiceNumber}
              </div>
            </div>

            {/* KLANTEN SELECTOR */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Klant Selecteren
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsRelationsOpen(!isRelationsOpen)}
                  className="w-full flex items-center justify-between p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                >
                  <span className={formData.clientName ? 'text-gray-900' : 'text-gray-500'}>
                    {formData.clientName || 'Selecteer een klant...'}
                  </span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${isRelationsOpen ? 'rotate-180' : ''}`} />
                </button>

                {isRelationsOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-10">
                    <div className="max-h-48 overflow-y-auto">
                      {relations.length === 0 ? (
                        <div className="p-3 text-sm text-gray-500">
                          Geen relaties gevonden
                        </div>
                      ) : (
                        relations.map(relation => (
                          <button
                            key={relation.id}
                            type="button"
                            onClick={() => handleSelectRelation(relation)}
                            className="w-full text-left px-3 py-2 hover:bg-gray-100 transition-colors"
                          >
                            <div className="font-medium text-gray-900">{relation.name}</div>
                            <div className="text-xs text-gray-500">{relation.email}</div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* WERKBONNEN SECTION - ALLEEN VOOR SPECIFIEKE BEDRIJF/KLANT */}
            {isWerkbonnenFactuur && (
              <div className="border-l-4 border-primary-500 bg-primary-50 p-4 rounded">
                <h3 className="font-semibold text-primary-900 mb-3">
                  Werkbonnen Factuurgegevens
                </h3>
                <FactuurWerkbonnenImport
                  companyId={selectedCompany!.id}
                  onImport={handleImportWerkbonnen}
                />
              </div>
            )}

            {/* FACTUUR VELDEN */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Factuurdatum
                </label>
                <input
                  type="date"
                  value={formData.invoiceDate}
                  onChange={(e) => setFormData({ ...formData, invoiceDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vervaldatum
                </label>
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>

            {/* ITEMS */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900">Factuurregels</h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  icon={Plus}
                  onClick={addItem}
                >
                  Regel toevoegen
                </Button>
              </div>

              <div className="space-y-2">
                {items.map((item, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Beschrijving"
                      value={item.description}
                      onChange={(e) => updateItem(index, 'description', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                    />
                    <input
                      type="number"
                      placeholder="Hoeveelheid"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                      className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                    />
                    <input
                      type="number"
                      placeholder="Tarief"
                      value={item.rate}
                      onChange={(e) => updateItem(index, 'rate', Number(e.target.value))}
                      className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                    />
                    <div className="w-24 px-3 py-2 bg-gray-50 rounded-lg text-sm font-medium">
                      €{item.amount.toFixed(2)}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* TOTALEN */}
            <div className="border-t pt-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotaal:</span>
                  <span className="font-medium">€{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">BTW (21%):</span>
                  <span className="font-medium">€{vatAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t">
                  <span>Totaal:</span>
                  <span>€{total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* NOTITIES */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Opmerkingen
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </form>
        </div>

        {/* BUTTONS */}
        <div className="flex gap-3 p-6 border-t border-gray-200 justify-end">
          <Button
            variant="ghost"
            onClick={onClose}
          >
            Annuleren
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={loading}
            className={loading ? 'opacity-50' : ''}
          >
            {loading ? 'Opslaan...' : editingInvoice ? 'Bijwerken' : 'Factuur Aanmaken'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CreateInvoiceModal;