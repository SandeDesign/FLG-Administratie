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
  TrendingDown,
  Calendar,
  Building2,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  FileText,
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

// Category configuration with icons, labels and colors
const CATEGORY_CONFIG: Record<BudgetCategory, {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
}> = {
  telecom: { icon: Phone, label: 'Telecom', bgColor: 'bg-blue-50', textColor: 'text-blue-600', borderColor: 'border-blue-200' },
  software: { icon: Monitor, label: 'Software & Licenties', bgColor: 'bg-purple-50', textColor: 'text-purple-600', borderColor: 'border-purple-200' },
  vehicle: { icon: Car, label: 'Voertuigen', bgColor: 'bg-emerald-50', textColor: 'text-emerald-600', borderColor: 'border-emerald-200' },
  insurance: { icon: Shield, label: 'Verzekeringen', bgColor: 'bg-orange-50', textColor: 'text-orange-600', borderColor: 'border-orange-200' },
  utilities: { icon: Zap, label: 'Nutsvoorzieningen', bgColor: 'bg-yellow-50', textColor: 'text-yellow-600', borderColor: 'border-yellow-200' },
  subscriptions: { icon: CreditCard, label: 'Abonnementen', bgColor: 'bg-pink-50', textColor: 'text-pink-600', borderColor: 'border-pink-200' },
  other: { icon: MoreHorizontal, label: 'Overig', bgColor: 'bg-gray-50', textColor: 'text-gray-600', borderColor: 'border-gray-200' },
};

const FREQUENCY_LABELS: Record<BudgetFrequency, string> = {
  monthly: 'per maand',
  quarterly: 'per kwartaal',
  yearly: 'per jaar',
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
  category: 'software',
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
  const [viewMode, setViewMode] = useState<'list' | 'category'>('category');

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
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatCurrencyDetailed = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const getMonthlyAmount = (item: BudgetItem) => {
    switch (item.frequency) {
      case 'monthly': return item.amount;
      case 'quarterly': return item.amount / 3;
      case 'yearly': return item.amount / 12;
      default: return item.amount;
    }
  };

  // Calculate totals
  const monthlyTotal = calculateMonthlyBudget(budgetItems);
  const yearlyTotal = calculateYearlyBudget(budgetItems);
  const itemsByCategory = getBudgetItemsByCategory(budgetItems);
  const activeItems = budgetItems.filter(i => i.isActive);

  // Calculate category totals (monthly)
  const categoryTotals = Object.entries(itemsByCategory).map(([cat, items]) => {
    const monthlySum = items.filter(i => i.isActive).reduce((sum, item) => sum + getMonthlyAmount(item), 0);
    return { category: cat as BudgetCategory, items, monthlySum };
  }).sort((a, b) => b.monthlySum - a.monthlySum);

  // Filter items
  const filteredItems = filterCategory === 'all'
    ? budgetItems
    : budgetItems.filter(item => item.category === filterCategory);

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
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Begroting</h1>
          <p className="mt-1 text-sm text-gray-500">
            Terugkerende kosten voor {selectedCompany.name}
          </p>
        </div>
        <Button onClick={() => handleOpenModal()}>
          <Plus className="h-4 w-4 mr-2" />
          Nieuwe Kost
        </Button>
      </div>

      {/* Main Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Monthly Card */}
        <Card className="p-6 bg-gradient-to-br from-primary-50 to-indigo-50 border-primary-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-primary-600">Maandelijkse Kosten</p>
              <p className="text-3xl font-bold text-primary-900 mt-1">
                {formatCurrency(monthlyTotal)}
              </p>
              <p className="text-xs text-primary-600 mt-2">
                {activeItems.length} actieve items
              </p>
            </div>
            <div className="p-3 bg-primary-100 rounded-xl">
              <Calendar className="h-6 w-6 text-primary-600" />
            </div>
          </div>
        </Card>

        {/* Yearly Card */}
        <Card className="p-6 bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-600">Jaarlijkse Kosten</p>
              <p className="text-3xl font-bold text-emerald-900 mt-1">
                {formatCurrency(yearlyTotal)}
              </p>
              <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                12x maandelijks
              </p>
            </div>
            <div className="p-3 bg-emerald-100 rounded-xl">
              <TrendingUp className="h-6 w-6 text-emerald-600" />
            </div>
          </div>
        </Card>

        {/* Categories Card */}
        <Card className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600">Categorieën</p>
              <p className="text-3xl font-bold text-purple-900 mt-1">
                {categoryTotals.filter(c => c.items.length > 0).length}
              </p>
              <p className="text-xs text-purple-600 mt-2">
                {budgetItems.length} totaal items
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-xl">
              <PieChart className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Category Breakdown */}
      {categoryTotals.length > 0 && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Verdeling per Categorie</h2>
          <div className="space-y-3">
            {categoryTotals.filter(c => c.items.length > 0).map(({ category, items, monthlySum }) => {
              const config = CATEGORY_CONFIG[category];
              const Icon = config.icon;
              const percentage = monthlyTotal > 0 ? (monthlySum / monthlyTotal) * 100 : 0;
              const activeCount = items.filter(i => i.isActive).length;

              return (
                <div
                  key={category}
                  className={`p-4 rounded-xl border ${config.borderColor} ${config.bgColor} cursor-pointer hover:shadow-md transition-shadow`}
                  onClick={() => setFilterCategory(filterCategory === category ? 'all' : category)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg bg-white ${config.textColor}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className={`font-semibold ${config.textColor}`}>{config.label}</p>
                        <p className="text-xs text-gray-500">{activeCount} item{activeCount !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${config.textColor}`}>
                        {formatCurrency(monthlySum)}
                      </p>
                      <p className="text-xs text-gray-500">/maand</p>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="h-2 bg-white rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${config.textColor.replace('text-', 'bg-')}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1 text-right">{percentage.toFixed(1)}% van totaal</p>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* View Toggle & Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('category')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'category'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <PieChart className="h-4 w-4 inline mr-2" />
            Per Categorie
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'list'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <FileText className="h-4 w-4 inline mr-2" />
            Lijst
          </button>
        </div>

        {viewMode === 'list' && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilterCategory('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterCategory === 'all'
                  ? 'bg-gray-800 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Alle ({budgetItems.length})
            </button>
            {(Object.keys(CATEGORY_CONFIG) as BudgetCategory[]).map((cat) => {
              const count = itemsByCategory[cat]?.length || 0;
              if (count === 0) return null;
              return (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    filterCategory === cat
                      ? 'bg-gray-800 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {CATEGORY_CONFIG[cat].label} ({count})
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Items Display */}
      {budgetItems.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Geen begrotingsitems"
          description="Voeg terugkerende kosten toe zoals telefoonabonnementen, software licenties of autokosten"
          actionLabel="Eerste Item Toevoegen"
          onAction={() => handleOpenModal()}
        />
      ) : viewMode === 'category' ? (
        // Category View
        <div className="space-y-6">
          {categoryTotals.filter(c => c.items.length > 0).map(({ category, items }) => {
            const config = CATEGORY_CONFIG[category];
            const Icon = config.icon;

            return (
              <div key={category}>
                <div className="flex items-center gap-2 mb-3">
                  <Icon className={`h-5 w-5 ${config.textColor}`} />
                  <h3 className={`font-semibold ${config.textColor}`}>{config.label}</h3>
                  <span className="text-xs text-gray-400">({items.length})</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((item) => (
                    <Card
                      key={item.id}
                      className={`p-4 border-l-4 ${config.borderColor} hover:shadow-md transition-shadow ${!item.isActive ? 'opacity-60' : ''}`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 truncate">{item.name}</h4>
                          {item.supplier && (
                            <p className="text-xs text-gray-500 truncate">{item.supplier}</p>
                          )}
                        </div>
                        <div className="flex gap-1 ml-2">
                          <button
                            onClick={() => handleOpenModal(item)}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(item)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-end justify-between">
                        <div>
                          <p className="text-lg font-bold text-gray-900">
                            {formatCurrencyDetailed(item.amount)}
                          </p>
                          <p className="text-xs text-gray-500">{FREQUENCY_LABELS[item.frequency]}</p>
                        </div>
                        {item.frequency !== 'monthly' && (
                          <p className="text-xs text-gray-400">
                            {formatCurrency(getMonthlyAmount(item))}/mnd
                          </p>
                        )}
                      </div>
                      {!item.isActive && (
                        <span className="inline-block mt-2 px-2 py-0.5 text-xs bg-gray-200 text-gray-600 rounded">
                          Inactief
                        </span>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // List View
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const config = CATEGORY_CONFIG[item.category];
            const Icon = config.icon;

            return (
              <Card key={item.id} className={`p-4 ${!item.isActive ? 'opacity-60' : ''}`}>
                <div className="flex items-center gap-4">
                  <div className={`p-2.5 rounded-lg ${config.bgColor} ${config.textColor}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-gray-900 truncate">{item.name}</h4>
                      {!item.isActive && (
                        <span className="px-2 py-0.5 text-xs bg-gray-200 text-gray-600 rounded">
                          Inactief
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                      <span>{config.label}</span>
                      {item.supplier && <span>• {item.supplier}</span>}
                      {item.contractNumber && <span>• {item.contractNumber}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-900">
                      {formatCurrencyDetailed(item.amount)}
                    </p>
                    <p className="text-xs text-gray-500">{FREQUENCY_LABELS[item.frequency]}</p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleOpenModal(item)}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
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
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">
                {editingItem ? 'Begrotingsitem Bewerken' : 'Nieuw Begrotingsitem'}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Naam *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="bijv. Microsoft 365 Business"
                    required
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Categorie
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {(Object.keys(CATEGORY_CONFIG) as BudgetCategory[]).map((cat) => {
                      const config = CATEGORY_CONFIG[cat];
                      const Icon = config.icon;
                      const isSelected = formData.category === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setFormData({ ...formData, category: cat })}
                          className={`p-2 rounded-lg border-2 transition-all flex flex-col items-center gap-1 ${
                            isSelected
                              ? `${config.borderColor} ${config.bgColor}`
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <Icon className={`h-5 w-5 ${isSelected ? config.textColor : 'text-gray-400'}`} />
                          <span className={`text-xs ${isSelected ? config.textColor : 'text-gray-500'}`}>
                            {config.label.split(' ')[0]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Amount & Frequency */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
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
                        className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        placeholder="0.00"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Frequentie
                    </label>
                    <select
                      value={formData.frequency}
                      onChange={(e) => setFormData({ ...formData, frequency: e.target.value as BudgetFrequency })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="monthly">Maandelijks</option>
                      <option value="quarterly">Per kwartaal</option>
                      <option value="yearly">Jaarlijks</option>
                    </select>
                  </div>
                </div>

                {/* Supplier & Contract Number */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Leverancier
                    </label>
                    <input
                      type="text"
                      value={formData.supplier}
                      onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="bijv. Microsoft"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Contractnummer
                    </label>
                    <input
                      type="text"
                      value={formData.contractNumber}
                      onChange={(e) => setFormData({ ...formData, contractNumber: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="bijv. MS-12345"
                    />
                  </div>
                </div>

                {/* Start Date & End Date */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Startdatum
                    </label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Einddatum (optioneel)
                    </label>
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notities
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
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
                  <label htmlFor="isActive" className="ml-2 text-sm text-gray-700">
                    Actief (meerekenen in totalen)
                  </label>
                </div>

                {/* Buttons */}
                <div className="flex justify-end space-x-3 pt-4 border-t">
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
