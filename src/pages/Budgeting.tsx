import React, { useState, useEffect, useCallback } from 'react';
import {
  Wallet,
  Plus,
  Pencil,
  Trash2,
  Phone,
  Monitor,
  Car,
  Shield,
  Zap,
  CreditCard,
  MoreHorizontal,
  TrendingUp,
  Calendar,
  Building2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { BudgetItem, BudgetCategory, BudgetFrequency } from '../types';
import {
  getBudgetItems,
  createBudgetItem,
  updateBudgetItem,
  deleteBudgetItem,
  calculateMonthlyBudget,
  calculateYearlyBudget,
  getBudgetItemsByCategory,
} from '../services/firebase';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../hooks/useToast';

// Category configuration with icons and labels
const CATEGORY_CONFIG: Record<BudgetCategory, { icon: React.ComponentType<{ className?: string }>; label: string; color: string }> = {
  telecom: { icon: Phone, label: 'Telecom', color: 'bg-blue-100 text-blue-600' },
  software: { icon: Monitor, label: 'Software & Licenties', color: 'bg-purple-100 text-purple-600' },
  vehicle: { icon: Car, label: 'Voertuigen', color: 'bg-green-100 text-green-600' },
  insurance: { icon: Shield, label: 'Verzekeringen', color: 'bg-orange-100 text-orange-600' },
  utilities: { icon: Zap, label: 'Nutsvoorzieningen', color: 'bg-yellow-100 text-yellow-600' },
  subscriptions: { icon: CreditCard, label: 'Abonnementen', color: 'bg-pink-100 text-pink-600' },
  other: { icon: MoreHorizontal, label: 'Overig', color: 'bg-gray-100 text-gray-600' },
};

const FREQUENCY_LABELS: Record<BudgetFrequency, string> = {
  monthly: 'Maandelijks',
  quarterly: 'Per kwartaal',
  yearly: 'Jaarlijks',
};

interface BudgetFormData {
  name: string;
  category: BudgetCategory;
  amount: string;
  frequency: BudgetFrequency;
  startDate: string;
  endDate: string;
  supplier: string;
  contractNumber: string;
  notes: string;
  isActive: boolean;
}

const initialFormData: BudgetFormData = {
  name: '',
  category: 'other',
  amount: '',
  frequency: 'monthly',
  startDate: new Date().toISOString().split('T')[0],
  endDate: '',
  supplier: '',
  contractNumber: '',
  notes: '',
  isActive: true,
};

const Budgeting: React.FC = () => {
  const { user } = useAuth();
  const { selectedCompany } = useApp();
  const { success, error: showError } = useToast();

  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null);
  const [formData, setFormData] = useState<BudgetFormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [filterCategory, setFilterCategory] = useState<BudgetCategory | 'all'>('all');

  const loadData = useCallback(async () => {
    if (!user || !selectedCompany) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const items = await getBudgetItems(user.uid, selectedCompany.id);
      setBudgetItems(items);
    } catch (error) {
      console.error('Error loading budget items:', error);
      showError('Fout bij laden', 'Kon begrotingsitems niet laden');
    } finally {
      setLoading(false);
    }
  }, [user, selectedCompany, showError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenModal = (item?: BudgetItem) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        category: item.category,
        amount: item.amount.toString(),
        frequency: item.frequency,
        startDate: item.startDate instanceof Date
          ? item.startDate.toISOString().split('T')[0]
          : new Date(item.startDate).toISOString().split('T')[0],
        endDate: item.endDate
          ? (item.endDate instanceof Date
              ? item.endDate.toISOString().split('T')[0]
              : new Date(item.endDate).toISOString().split('T')[0])
          : '',
        supplier: item.supplier || '',
        contractNumber: item.contractNumber || '',
        notes: item.notes || '',
        isActive: item.isActive,
      });
    } else {
      setEditingItem(null);
      setFormData(initialFormData);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
    setFormData(initialFormData);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedCompany) return;

    if (!formData.name.trim()) {
      showError('Validatiefout', 'Naam is verplicht');
      return;
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      showError('Validatiefout', 'Voer een geldig bedrag in');
      return;
    }

    setSaving(true);
    try {
      const itemData = {
        name: formData.name.trim(),
        category: formData.category,
        amount: parseFloat(formData.amount),
        frequency: formData.frequency,
        startDate: new Date(formData.startDate),
        endDate: formData.endDate ? new Date(formData.endDate) : undefined,
        supplier: formData.supplier.trim() || undefined,
        contractNumber: formData.contractNumber.trim() || undefined,
        notes: formData.notes.trim() || undefined,
        isActive: formData.isActive,
        companyId: selectedCompany.id,
      };

      if (editingItem) {
        await updateBudgetItem(editingItem.id, itemData, user.uid);
        success('Bijgewerkt', 'Begrotingsitem is bijgewerkt');
      } else {
        await createBudgetItem(itemData, user.uid);
        success('Toegevoegd', 'Begrotingsitem is toegevoegd');
      }

      handleCloseModal();
      await loadData();
    } catch (error) {
      console.error('Error saving budget item:', error);
      showError('Fout bij opslaan', 'Kon begrotingsitem niet opslaan');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: BudgetItem) => {
    if (!user) return;

    if (window.confirm(`Weet je zeker dat je "${item.name}" wilt verwijderen?`)) {
      try {
        await deleteBudgetItem(item.id, user.uid);
        success('Verwijderd', 'Begrotingsitem is verwijderd');
        await loadData();
      } catch (error) {
        console.error('Error deleting budget item:', error);
        showError('Fout bij verwijderen', 'Kon begrotingsitem niet verwijderen');
      }
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const getMonthlyAmount = (item: BudgetItem) => {
    switch (item.frequency) {
      case 'monthly':
        return item.amount;
      case 'quarterly':
        return item.amount / 3;
      case 'yearly':
        return item.amount / 12;
      default:
        return item.amount;
    }
  };

  // Filter items
  const filteredItems = filterCategory === 'all'
    ? budgetItems
    : budgetItems.filter(item => item.category === filterCategory);

  // Calculate totals
  const monthlyTotal = calculateMonthlyBudget(budgetItems);
  const yearlyTotal = calculateYearlyBudget(budgetItems);
  const itemsByCategory = getBudgetItemsByCategory(budgetItems);

  if (!selectedCompany) {
    return (
      <EmptyState
        icon={Building2}
        title="Geen bedrijf geselecteerd"
        description="Selecteer een bedrijf om de begroting te beheren"
      />
    );
  }

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Begroting</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Terugkerende kosten voor {selectedCompany.name}
          </p>
        </div>
        <Button onClick={() => handleOpenModal()}>
          <Plus className="h-4 w-4 mr-2" />
          Nieuwe Kost
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-primary-100 dark:bg-primary-900/20 rounded-lg">
              <Calendar className="h-6 w-6 text-primary-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Maandelijks</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(monthlyTotal)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Jaarlijks</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(yearlyTotal)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <Wallet className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Actieve Items</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {budgetItems.filter(i => i.isActive).length}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterCategory('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filterCategory === 'all'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
          }`}
        >
          Alle ({budgetItems.length})
        </button>
        {(Object.keys(CATEGORY_CONFIG) as BudgetCategory[]).map((cat) => {
          const count = itemsByCategory[cat]?.length || 0;
          if (count === 0) return null;
          const config = CATEGORY_CONFIG[cat];
          return (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterCategory === cat
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
              }`}
            >
              {config.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Budget Items List */}
      {budgetItems.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Geen begrotingsitems"
          description="Voeg terugkerende kosten toe zoals telefoonabonnementen, software licenties of autokosten"
          actionLabel="Eerste Item Toevoegen"
          onAction={() => handleOpenModal()}
        />
      ) : filteredItems.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-gray-500">Geen items gevonden in deze categorie</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredItems.map((item) => {
            const categoryConfig = CATEGORY_CONFIG[item.category];
            const CategoryIcon = categoryConfig.icon;

            return (
              <Card key={item.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4">
                    <div className={`p-3 rounded-lg ${categoryConfig.color}`}>
                      <CategoryIcon className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {item.name}
                        </h3>
                        {!item.isActive && (
                          <span className="px-2 py-0.5 text-xs bg-gray-200 text-gray-600 rounded-full">
                            Inactief
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
                        <span>{categoryConfig.label}</span>
                        <span>{FREQUENCY_LABELS[item.frequency]}</span>
                        {item.supplier && <span>Leverancier: {item.supplier}</span>}
                        {item.contractNumber && <span>Contract: {item.contractNumber}</span>}
                      </div>
                      {item.notes && (
                        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{item.notes}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="text-right">
                      <p className="text-xl font-bold text-gray-900 dark:text-white">
                        {formatCurrency(item.amount)}
                      </p>
                      <p className="text-sm text-gray-500">
                        {FREQUENCY_LABELS[item.frequency].toLowerCase()}
                      </p>
                      {item.frequency !== 'monthly' && (
                        <p className="text-xs text-gray-400 mt-1">
                          ({formatCurrency(getMonthlyAmount(item))}/maand)
                        </p>
                      )}
                    </div>

                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleOpenModal(item)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(item)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={handleCloseModal} />
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                {editingItem ? 'Begrotingsitem Bewerken' : 'Nieuw Begrotingsitem'}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Naam *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                    placeholder="bijv. KPN Telefoonabonnement"
                    required
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Categorie
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as BudgetCategory })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                  >
                    {(Object.keys(CATEGORY_CONFIG) as BudgetCategory[]).map((cat) => (
                      <option key={cat} value={cat}>
                        {CATEGORY_CONFIG[cat].label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Amount & Frequency */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Bedrag *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                        placeholder="0.00"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Frequentie
                    </label>
                    <select
                      value={formData.frequency}
                      onChange={(e) => setFormData({ ...formData, frequency: e.target.value as BudgetFrequency })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                    >
                      {(Object.keys(FREQUENCY_LABELS) as BudgetFrequency[]).map((freq) => (
                        <option key={freq} value={freq}>
                          {FREQUENCY_LABELS[freq]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Start Date & End Date */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Startdatum *
                    </label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Einddatum
                    </label>
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>

                {/* Supplier & Contract Number */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Leverancier
                    </label>
                    <input
                      type="text"
                      value={formData.supplier}
                      onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                      placeholder="bijv. KPN"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Contractnummer
                    </label>
                    <input
                      type="text"
                      value={formData.contractNumber}
                      onChange={(e) => setFormData({ ...formData, contractNumber: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                      placeholder="bijv. KPN-12345"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Notities
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                    placeholder="Eventuele opmerkingen..."
                  />
                </div>

                {/* Active Toggle */}
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label htmlFor="isActive" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    Actief (meerekenen in totalen)
                  </label>
                </div>

                {/* Buttons */}
                <div className="flex justify-end space-x-3 pt-4">
                  <Button type="button" variant="secondary" onClick={handleCloseModal}>
                    Annuleren
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Opslaan...' : editingItem ? 'Bijwerken' : 'Toevoegen'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Budgeting;
