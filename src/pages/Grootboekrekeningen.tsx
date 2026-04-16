import React, { useState, useEffect, useCallback } from 'react';
import {
  BookOpen,
  Plus,
  Download,
  FileText,
  Search,
  Edit2,
  Trash2,
  Save,
  X,
  ChevronDown,
  ChevronUp,
  Shield,
  Upload,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useToast } from '../hooks/useToast';
import { EmptyState } from '../components/ui/EmptyState';
import Modal from '../components/ui/Modal';
import { usePageTitle } from '../contexts/PageTitleContext';
import { supplierService } from '../services/supplierService';
import { Grootboekrekening, GrootboekCategory } from '../types/supplier';
import { grootboekCategoryLabels } from '../utils/grootboekTemplate';
import { generateGrootboekPDF } from '../lib/generateGrootboekPDF';

const CATEGORIES: { value: GrootboekCategory; label: string }[] = Object.entries(grootboekCategoryLabels).map(
  ([value, label]) => ({ value: value as GrootboekCategory, label })
);

const BTW_OPTIONS = [
  { value: '', label: 'Geen BTW' },
  { value: 'hoog', label: 'Hoog (21%)' },
  { value: 'laag', label: 'Laag (9%)' },
  { value: 'geen', label: 'Vrijgesteld (0%)' },
  { value: 'verlegd', label: 'Verlegd' },
];

const Grootboekrekeningen: React.FC = () => {
  const { userRole } = useAuth();
  const { selectedCompany } = useApp();
  const { success, error: showError } = useToast();
  usePageTitle('Rekeningschema');

  const [rekeningen, setRekeningen] = useState<Grootboekrekening[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    category: 'overige' as GrootboekCategory,
    type: 'debet' as 'debet' | 'credit',
    btw: '' as string,
  });
  const [saving, setSaving] = useState(false);
  const [importingTemplate, setImportingTemplate] = useState(false);

  if (userRole !== 'admin') {
    return (
      <div className="p-6">
        <EmptyState icon={Shield} title="Geen toegang" description="Alleen administrators kunnen het rekeningschema beheren" />
      </div>
    );
  }

  const loadData = useCallback(async () => {
    if (!selectedCompany) return;
    try {
      setLoading(true);
      const data = await supplierService.getGrootboekrekeningen(selectedCompany.id);
      setRekeningen(data);
    } catch (e) {
      console.error('Error loading grootboekrekeningen:', e);
    } finally {
      setLoading(false);
    }
  }, [selectedCompany]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = rekeningen.filter(
    (r) =>
      !searchTerm ||
      r.code.includes(searchTerm) ||
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (grootboekCategoryLabels[r.category as keyof typeof grootboekCategoryLabels] || '')
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
  );

  const grouped = filtered.reduce((acc, r) => {
    const label = grootboekCategoryLabels[r.category as keyof typeof grootboekCategoryLabels] || r.category;
    if (!acc[label]) acc[label] = [];
    acc[label].push(r);
    return acc;
  }, {} as Record<string, Grootboekrekening[]>);

  const toggleCategory = (cat: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const resetForm = () => {
    setFormData({ code: '', name: '', category: 'overige', type: 'debet', btw: '' });
    setEditingId(null);
  };

  const handleAdd = async () => {
    if (!selectedCompany || !formData.code.trim() || !formData.name.trim()) {
      showError('Fout', 'Code en naam zijn verplicht');
      return;
    }
    try {
      setSaving(true);
      await supplierService.addGrootboekrekening(
        selectedCompany.id,
        formData.code.trim(),
        formData.name.trim(),
        formData.category,
        formData.type,
        formData.btw ? (formData.btw as 'hoog' | 'laag' | 'geen' | 'verlegd') : undefined
      );
      success('Toegevoegd', `${formData.code} - ${formData.name} aangemaakt`);
      resetForm();
      setShowAddModal(false);
      loadData();
    } catch (e: any) {
      showError('Fout', e.message || 'Kon rekening niet toevoegen');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (r: Grootboekrekening) => {
    setEditingId(r.id || null);
    setFormData({
      code: r.code,
      name: r.name,
      category: r.category,
      type: r.type || 'debet',
      btw: r.btw || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    try {
      setSaving(true);
      await supplierService.updateGrootboekrekening(editingId, {
        code: formData.code.trim(),
        name: formData.name.trim(),
        category: formData.category,
        type: formData.type,
        btw: formData.btw ? (formData.btw as 'hoog' | 'laag' | 'geen' | 'verlegd') : undefined,
      });
      success('Opgeslagen', 'Rekening bijgewerkt');
      resetForm();
      loadData();
    } catch (e: any) {
      showError('Fout', e.message || 'Kon rekening niet bijwerken');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (r: Grootboekrekening) => {
    if (!r.id) return;
    if (!confirm(`Weet je zeker dat je ${r.code} - ${r.name} wilt verwijderen?`)) return;
    try {
      await supplierService.deleteGrootboekrekening(r.id);
      success('Verwijderd', `${r.code} verwijderd`);
      loadData();
    } catch (e: any) {
      showError('Fout', e.message || 'Kon rekening niet verwijderen');
    }
  };

  const handleImportTemplate = async () => {
    if (!selectedCompany) return;
    try {
      setImportingTemplate(true);
      const count = await supplierService.importGrootboekTemplate(selectedCompany.id);
      if (count > 0) {
        success('Geïmporteerd', `${count} standaard rekeningen aangemaakt`);
        loadData();
      } else {
        success('Rekeningschema', 'Alle standaard rekeningen bestaan al');
      }
    } catch (e: any) {
      showError('Fout', e.message || 'Kon sjabloon niet importeren');
    } finally {
      setImportingTemplate(false);
    }
  };

  if (!selectedCompany) {
    return (
      <div className="p-6">
        <EmptyState icon={BookOpen} title="Geen bedrijf geselecteerd" description="Selecteer eerst een bedrijf" />
      </div>
    );
  }

  const FormFields = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Code</label>
          <input
            type="text"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            placeholder="bijv. 4100"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
          <select
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value as 'debet' | 'credit' })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="debet">Debet</option>
            <option value="credit">Credit</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Naam</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="bijv. Kantoorkosten"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Categorie</label>
          <select
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value as GrootboekCategory })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">BTW</label>
          <select
            value={formData.btw}
            onChange={(e) => setFormData({ ...formData, btw: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            {BTW_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="hidden lg:block">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Rekeningschema</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {rekeningen.length} rekeningen in {Object.keys(grouped).length} categorieën
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => { resetForm(); setShowAddModal(true); }} variant="outline">
            <Plus className="w-4 h-4 mr-1" />
            Toevoegen
          </Button>
          <Button onClick={handleImportTemplate} disabled={importingTemplate} variant="outline">
            {importingTemplate ? <LoadingSpinner size="sm" /> : <><Upload className="w-4 h-4 mr-1" />Sjabloon</>}
          </Button>
          {rekeningen.length > 0 && (
            <Button onClick={() => generateGrootboekPDF(rekeningen, selectedCompany.name)} variant="outline">
              <FileText className="w-4 h-4 mr-1" />
              PDF
            </Button>
          )}
        </div>
      </div>

      <Card>
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Zoek op code, naam of categorie..."
              className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>
      ) : rekeningen.length === 0 ? (
        <Card>
          <div className="p-12 text-center">
            <BookOpen className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Nog geen rekeningschema</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Importeer het standaard MKB-rekeningschema of voeg handmatig rekeningen toe.
            </p>
            <Button onClick={handleImportTemplate} disabled={importingTemplate}>
              {importingTemplate ? <LoadingSpinner size="sm" /> : <><Download className="w-4 h-4 mr-2" />Importeer standaard rekeningschema</>}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {Object.entries(grouped).map(([category, accounts]) => {
            const isCollapsed = collapsedCategories.has(category);
            return (
              <Card key={category}>
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">{category}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                      {accounts.length}
                    </span>
                  </div>
                  {isCollapsed ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronUp className="w-4 h-4 text-gray-400" />}
                </button>
                {!isCollapsed && (
                  <div className="border-t border-gray-100 dark:border-gray-700">
                    <table className="w-full">
                      <thead>
                        <tr className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                          <th className="text-left px-4 py-2 w-20">Code</th>
                          <th className="text-left px-4 py-2">Naam</th>
                          <th className="text-left px-4 py-2 w-16">Type</th>
                          <th className="text-left px-4 py-2 w-20">BTW</th>
                          <th className="text-right px-4 py-2 w-24">Acties</th>
                        </tr>
                      </thead>
                      <tbody>
                        {accounts.map((r) => (
                          <tr key={r.id} className="border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                            {editingId === r.id ? (
                              <>
                                <td className="px-4 py-2">
                                  <input
                                    type="text"
                                    value={formData.code}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                    className="w-full px-2 py-1 text-sm border rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                                  />
                                </td>
                                <td className="px-4 py-2">
                                  <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-2 py-1 text-sm border rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                                  />
                                </td>
                                <td className="px-4 py-2">
                                  <select
                                    value={formData.type}
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value as 'debet' | 'credit' })}
                                    className="w-full px-1 py-1 text-xs border rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                                  >
                                    <option value="debet">D</option>
                                    <option value="credit">C</option>
                                  </select>
                                </td>
                                <td className="px-4 py-2">
                                  <select
                                    value={formData.btw}
                                    onChange={(e) => setFormData({ ...formData, btw: e.target.value })}
                                    className="w-full px-1 py-1 text-xs border rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                                  >
                                    {BTW_OPTIONS.map((o) => (
                                      <option key={o.value} value={o.value}>{o.value || '-'}</option>
                                    ))}
                                  </select>
                                </td>
                                <td className="px-4 py-2 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <button onClick={handleSaveEdit} disabled={saving} className="p-1 text-green-600 hover:bg-green-100 dark:hover:bg-green-900 rounded">
                                      <Save className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={resetForm} className="p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="px-4 py-2">
                                  <span className="font-mono text-sm font-bold text-blue-600 dark:text-blue-400">{r.code}</span>
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">{r.name}</td>
                                <td className="px-4 py-2">
                                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                                    r.type === 'debet'
                                      ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                                      : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                                  }`}>
                                    {r.type === 'debet' ? 'D' : 'C'}
                                  </span>
                                </td>
                                <td className="px-4 py-2">
                                  {r.btw && (
                                    <span className="text-xs text-gray-500 dark:text-gray-400">{r.btw}</span>
                                  )}
                                </td>
                                <td className="px-4 py-2 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <button onClick={() => handleEdit(r)} className="p-1 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900 rounded">
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={() => handleDelete(r)} className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900 rounded">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {showAddModal && (
        <Modal isOpen={showAddModal} onClose={() => { setShowAddModal(false); resetForm(); }} title="Nieuwe grootboekrekening" size="md">
          <div className="space-y-4">
            <FormFields />
            <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button variant="outline" onClick={() => { setShowAddModal(false); resetForm(); }}>Annuleren</Button>
              <Button onClick={handleAdd} disabled={saving}>
                {saving ? <LoadingSpinner size="sm" /> : <><Plus className="w-4 h-4 mr-1" />Toevoegen</>}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Grootboekrekeningen;
