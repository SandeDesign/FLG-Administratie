import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Mail,
  Phone,
  MapPin,
  Building2,
  X
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useToast } from '../hooks/useToast';
import { EmptyState } from '../components/ui/EmptyState';
import { collection, addDoc, getDocs, query, where, updateDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface InvoiceRelation {
  id?: string;
  userId: string;
  companyId: string;
  name: string;
  email: string;
  phone?: string;
  address?: {
    street: string;
    city: string;
    zipCode: string;
    country: string;
  };
  taxNumber?: string;
  kvk?: string;
  website?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const COLLECTION_NAME = 'invoiceRelations';

const InvoiceRelations: React.FC = () => {
  const { user } = useAuth();
  const { selectedCompany, queryUserId } = useApp(); // ✅ Gebruik queryUserId voor queries
  const { success, error: showError } = useToast();
  const [relations, setRelations] = useState<InvoiceRelation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRelation, setEditingRelation] = useState<InvoiceRelation | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<InvoiceRelation>>({
    name: '',
    email: '',
    phone: '',
    address: {
      street: '',
      city: '',
      zipCode: '',
      country: 'Nederland'
    },
    taxNumber: '',
    kvk: '',
    website: '',
    notes: ''
  });

  // Load relations
  const loadRelations = useCallback(async () => {
    if (!user || !selectedCompany || !queryUserId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const q = query(
        collection(db, COLLECTION_NAME),
        where('userId', '==', queryUserId),
        where('companyId', '==', selectedCompany.id)
      );

      const querySnapshot = await getDocs(q);
      const relationsData = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        } as InvoiceRelation;
      });

      setRelations(relationsData);
    } catch (error) {
      console.error('Error loading relations:', error);
      showError('Fout bij laden', 'Kon relaties niet laden');
    } finally {
      setLoading(false);
    }
  }, [user, selectedCompany, queryUserId, showError]);

  useEffect(() => {
    loadRelations();
  }, [loadRelations]);

  const handleCreate = () => {
    setEditingRelation(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      address: {
        street: '',
        city: '',
        zipCode: '',
        country: 'Nederland'
      },
      taxNumber: '',
      kvk: '',
      website: '',
      notes: ''
    });
    setIsModalOpen(true);
  };

  const handleEdit = (relation: InvoiceRelation) => {
    setEditingRelation(relation);
    setFormData(relation);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || !selectedCompany || !queryUserId) {
      showError('Fout', 'Geen gebruiker of bedrijf geselecteerd');
      return;
    }

    if (!formData.name?.trim() || !formData.email?.trim()) {
      showError('Validatie fout', 'Naam en email zijn verplicht');
      return;
    }

    setIsSaving(true);
    try {
      const now = new Date();
      const relationData = {
        userId: queryUserId,
        companyId: selectedCompany.id,
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone?.trim() || '',
        address: formData.address || {
          street: '',
          city: '',
          zipCode: '',
          country: 'Nederland'
        },
        taxNumber: formData.taxNumber?.trim() || '',
        kvk: formData.kvk?.trim() || '',
        website: formData.website?.trim() || '',
        notes: formData.notes?.trim() || '',
        updatedAt: Timestamp.fromDate(now)
      };

      if (editingRelation?.id) {
        // Update
        await updateDoc(doc(db, COLLECTION_NAME, editingRelation.id), relationData);
        success('Relatie bijgewerkt', 'De relatie is succesvol bijgewerkt');
      } else {
        // Create
        await addDoc(collection(db, COLLECTION_NAME), {
          ...relationData,
          createdAt: Timestamp.fromDate(now)
        });
        success('Relatie aangemaakt', 'De relatie is succesvol aangemaakt');
      }

      setIsModalOpen(false);
      loadRelations();
    } catch (error) {
      console.error('Error saving relation:', error);
      showError('Fout bij opslaan', 'Kon relatie niet opslaan');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Weet je zeker dat je deze relatie wilt verwijderen?')) return;

    try {
      await deleteDoc(doc(db, COLLECTION_NAME, id));
      success('Relatie verwijderd', 'De relatie is succesvol verwijderd');
      loadRelations();
    } catch (error) {
      console.error('Error deleting relation:', error);
      showError('Fout bij verwijderen', 'Kon relatie niet verwijderen');
    }
  };

  const filteredRelations = relations.filter(relation =>
    relation.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    relation.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!selectedCompany) {
    return (
      <EmptyState
        icon={Building2}
        title="Geen bedrijf geselecteerd"
        description="Selecteer een bedrijf om relaties te beheren"
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Relaties (Klanten)</h1>
          <p className="mt-1 text-sm text-gray-500">
            Beheer klanten voor {selectedCompany.name}
          </p>
        </div>
        <Button
          onClick={handleCreate}
          className="mt-4 sm:mt-0"
          icon={Plus}
        >
          Nieuwe Relatie
        </Button>
      </div>

      <Card>
        <div className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Zoek op naam of email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>
      </Card>

      {filteredRelations.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Geen relaties gevonden"
          description={searchTerm ? "Geen relaties gevonden die voldoen aan de zoekterm" : "Maak je eerste relatie aan"}
          action={
            <Button onClick={handleCreate} icon={Plus}>
              Nieuwe Relatie
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          {filteredRelations.map((relation) => (
            <Card key={relation.id}>
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">{relation.name}</h3>
                    {relation.kvk && (
                      <p className="text-sm text-gray-500">KvK: {relation.kvk}</p>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Edit}
                      onClick={() => handleEdit(relation)}
                    />
                    <Button
                      variant="danger"
                      size="sm"
                      icon={Trash2}
                      onClick={() => handleDelete(relation.id!)}
                    />
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  {relation.email && (
                    <div className="flex items-center text-gray-600">
                      <Mail className="h-4 w-4 mr-2 flex-shrink-0" />
                      <a href={`mailto:${relation.email}`} className="hover:text-primary-600">
                        {relation.email}
                      </a>
                    </div>
                  )}
                  {relation.phone && (
                    <div className="flex items-center text-gray-600">
                      <Phone className="h-4 w-4 mr-2 flex-shrink-0" />
                      <a href={`tel:${relation.phone}`} className="hover:text-primary-600">
                        {relation.phone}
                      </a>
                    </div>
                  )}
                  {relation.address && (relation.address.street || relation.address.city) && (
                    <div className="flex items-start text-gray-600">
                      <MapPin className="h-4 w-4 mr-2 flex-shrink-0 mt-0.5" />
                      <div>
                        {relation.address.street && <div>{relation.address.street}</div>}
                        {relation.address.city && (
                          <div>{relation.address.zipCode} {relation.address.city}</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {relation.notes && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-xs font-medium text-gray-600 mb-1">Notities:</p>
                    <p className="text-sm text-gray-600">{relation.notes}</p>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                {editingRelation ? 'Relatie Bewerken' : 'Nieuwe Relatie'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto max-h-[calc(90vh-140px)]">
              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {/* Naam & Email */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Naam / Bedrijf *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name || ''}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="Bedrijfsnaam"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email || ''}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="email@bedrijf.nl"
                    />
                  </div>
                </div>

                {/* Telefoon & Website */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Telefoon
                    </label>
                    <input
                      type="tel"
                      value={formData.phone || ''}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="+31 6 12345678"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Website
                    </label>
                    <input
                      type="url"
                      value={formData.website || ''}
                      onChange={(e) => setFormData({...formData, website: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="https://example.com"
                    />
                  </div>
                </div>

                {/* KvK & Belasting nummer */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      KvK Nummer
                    </label>
                    <input
                      type="text"
                      value={formData.kvk || ''}
                      onChange={(e) => setFormData({...formData, kvk: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="12345678"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Belasting Nummer (VAT)
                    </label>
                    <input
                      type="text"
                      value={formData.taxNumber || ''}
                      onChange={(e) => setFormData({...formData, taxNumber: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="NL123456789B01"
                    />
                  </div>
                </div>

                {/* Adres */}
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-4">Adres</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Straat
                      </label>
                      <input
                        type="text"
                        value={formData.address?.street || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          address: {...formData.address, street: e.target.value}
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        placeholder="Straat en huisnummer"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Postcode
                        </label>
                        <input
                          type="text"
                          value={formData.address?.zipCode || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            address: {...formData.address, zipCode: e.target.value}
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          placeholder="1234 AB"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Plaats
                        </label>
                        <input
                          type="text"
                          value={formData.address?.city || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            address: {...formData.address, city: e.target.value}
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          placeholder="Amsterdam"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Land
                        </label>
                        <input
                          type="text"
                          value={formData.address?.country || 'Nederland'}
                          onChange={(e) => setFormData({
                            ...formData,
                            address: {...formData.address, country: e.target.value}
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          placeholder="Nederland"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notities */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notities
                  </label>
                  <textarea
                    value={formData.notes || ''}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Interne notities..."
                  />
                </div>
              </form>
            </div>

            <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
              <Button 
                type="button" 
                variant="ghost" 
                icon={X}
                onClick={() => setIsModalOpen(false)}
              >
                Annuleren
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={isSaving}
                icon={editingRelation ? Edit : Plus}
              >
                {isSaving ? 'Opslaan...' : editingRelation ? 'Bijwerken' : 'Aanmaken'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceRelations;