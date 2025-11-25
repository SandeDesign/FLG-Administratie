import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Download,
  Users,
  Briefcase,
  Package,
  Lightbulb,
  Handshake,
  Award,
  Target,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Megaphone,
  Home,
  BarChart3,
  FileText,
  Eye,
  EyeOff,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { BudgetItem, BudgetCategory, BudgetFrequency, BudgetType, BudgetCostCategory, BudgetIncomeCategory, ProjectionConfidence } from '../types';
import {
  getBudgetItems,
  createBudgetItem,
  updateBudgetItem,
  deleteBudgetItem,
  calculateMonthlyBudget,
  calculateYearlyBudget,
} from '../services/firebase';
import { outgoingInvoiceService, OutgoingInvoice } from '../services/outgoingInvoiceService';
import { incomingInvoiceService } from '../services/incomingInvoiceService';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../hooks/useToast';

// Cost category configuration
const COST_CATEGORY_CONFIG: Record<BudgetCostCategory, {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
}> = {
  telecom: { icon: Phone, label: 'Telecom', bgColor: 'bg-blue-50', textColor: 'text-blue-600', borderColor: 'border-blue-200' },
  software: { icon: Monitor, label: 'Software', bgColor: 'bg-purple-50', textColor: 'text-purple-600', borderColor: 'border-purple-200' },
  vehicle: { icon: Car, label: 'Voertuigen', bgColor: 'bg-emerald-50', textColor: 'text-emerald-600', borderColor: 'border-emerald-200' },
  insurance: { icon: Shield, label: 'Verzekeringen', bgColor: 'bg-orange-50', textColor: 'text-orange-600', borderColor: 'border-orange-200' },
  utilities: { icon: Zap, label: 'Nutsvoorzieningen', bgColor: 'bg-yellow-50', textColor: 'text-yellow-600', borderColor: 'border-yellow-200' },
  subscriptions: { icon: CreditCard, label: 'Abonnementen', bgColor: 'bg-pink-50', textColor: 'text-pink-600', borderColor: 'border-pink-200' },
  personnel: { icon: Users, label: 'Personeel', bgColor: 'bg-indigo-50', textColor: 'text-indigo-600', borderColor: 'border-indigo-200' },
  marketing: { icon: Megaphone, label: 'Marketing', bgColor: 'bg-rose-50', textColor: 'text-rose-600', borderColor: 'border-rose-200' },
  office: { icon: Home, label: 'Kantoor', bgColor: 'bg-teal-50', textColor: 'text-teal-600', borderColor: 'border-teal-200' },
  other: { icon: MoreHorizontal, label: 'Overig', bgColor: 'bg-gray-50', textColor: 'text-gray-600', borderColor: 'border-gray-200' },
};

// Income category configuration
const INCOME_CATEGORY_CONFIG: Record<BudgetIncomeCategory, {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
}> = {
  services: { icon: Briefcase, label: 'Diensten', bgColor: 'bg-emerald-50', textColor: 'text-emerald-600', borderColor: 'border-emerald-200' },
  products: { icon: Package, label: 'Producten', bgColor: 'bg-blue-50', textColor: 'text-blue-600', borderColor: 'border-blue-200' },
  subscriptions: { icon: CreditCard, label: 'SaaS/Abonnementen', bgColor: 'bg-purple-50', textColor: 'text-purple-600', borderColor: 'border-purple-200' },
  consulting: { icon: Lightbulb, label: 'Consultancy', bgColor: 'bg-amber-50', textColor: 'text-amber-600', borderColor: 'border-amber-200' },
  licensing: { icon: Award, label: 'Licenties', bgColor: 'bg-indigo-50', textColor: 'text-indigo-600', borderColor: 'border-indigo-200' },
  partnerships: { icon: Handshake, label: 'Partnerships', bgColor: 'bg-pink-50', textColor: 'text-pink-600', borderColor: 'border-pink-200' },
  grants: { icon: Target, label: 'Subsidies', bgColor: 'bg-teal-50', textColor: 'text-teal-600', borderColor: 'border-teal-200' },
  other: { icon: MoreHorizontal, label: 'Overig', bgColor: 'bg-gray-50', textColor: 'text-gray-600', borderColor: 'border-gray-200' },
};

const CONFIDENCE_CONFIG: Record<ProjectionConfidence, {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
  bgColor: string;
  weight: number;
}> = {
  confirmed: { icon: CheckCircle2, label: 'Bevestigd', color: 'text-emerald-600', bgColor: 'bg-emerald-100', weight: 1.0 },
  likely: { icon: TrendingUp, label: 'Waarschijnlijk', color: 'text-blue-600', bgColor: 'bg-blue-100', weight: 0.75 },
  potential: { icon: AlertCircle, label: 'Potentieel', color: 'text-amber-600', bgColor: 'bg-amber-100', weight: 0.5 },
  speculative: { icon: HelpCircle, label: 'Speculatief', color: 'text-gray-500', bgColor: 'bg-gray-100', weight: 0.25 },
};

const FREQUENCY_LABELS: Record<BudgetFrequency, string> = {
  monthly: 'per maand',
  quarterly: 'per kwartaal',
  yearly: 'per jaar',
};

type ViewTab = 'overview' | 'costs' | 'income' | 'projections';

interface BudgetFormData {
  type: BudgetType;
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
  confidence: ProjectionConfidence;
  growthRate: string;
}

const initialFormData: BudgetFormData = {
  type: 'cost',
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
  confidence: 'confirmed',
  growthRate: '0',
};

const Budgeting: React.FC = () => {
  const { user } = useAuth();
  const { selectedCompany } = useApp();
  const { success, error: showError } = useToast();
  const exportRef = useRef<HTMLDivElement>(null);

  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [outgoingInvoices, setOutgoingInvoices] = useState<OutgoingInvoice[]>([]);
  const [incomingInvoices, setIncomingInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null);
  const [formData, setFormData] = useState<BudgetFormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<ViewTab>('overview');
  const [showActualData, setShowActualData] = useState(true);
  const [projectionYears, setProjectionYears] = useState(3);
  const [refreshing, setRefreshing] = useState(false);
  const [drillDownCategory, setDrillDownCategory] = useState<{ type: 'cost' | 'income', category: string } | null>(null);

  const loadData = useCallback(async () => {
    if (!user || !selectedCompany) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Load budget items
      const items = await getBudgetItems(user.uid, selectedCompany.id);
      setBudgetItems(items);

      // Load actual invoice data for comparison
      const [outgoing, incoming] = await Promise.all([
        outgoingInvoiceService.getInvoices(user.uid, selectedCompany.id),
        incomingInvoiceService.getInvoices(user.uid, selectedCompany.id),
      ]);

      setOutgoingInvoices(outgoing);
      setIncomingInvoices(incoming);
    } catch (error) {
      console.error('Error loading data:', error);
      showError('Fout bij laden', 'Kon gegevens niet laden');
    } finally {
      setLoading(false);
    }
  }, [user, selectedCompany, showError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Refresh functie
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setTimeout(() => setRefreshing(false), 500);
    success('Ververst', 'Gegevens zijn bijgewerkt');
  };

  // Map budget categories to invoice categories for matching
  const matchInvoiceToCategory = (invoice: OutgoingInvoice | any, type: 'income' | 'cost'): BudgetCategory | null => {
    // Voor nu een eenvoudige matching - kan later uitgebreid worden
    const description = invoice.description?.toLowerCase() || invoice.notes?.toLowerCase() || '';

    if (type === 'income') {
      if (description.includes('consultancy') || description.includes('advies')) return 'consulting';
      if (description.includes('product')) return 'products';
      if (description.includes('subscription') || description.includes('abonnement')) return 'subscriptions';
      if (description.includes('licentie') || description.includes('license')) return 'licensing';
      return 'services';
    } else {
      if (description.includes('telefoon') || description.includes('mobiel')) return 'telecom';
      if (description.includes('software') || description.includes('saas')) return 'software';
      if (description.includes('auto') || description.includes('lease') || description.includes('benzine')) return 'vehicle';
      if (description.includes('verzekering') || description.includes('insurance')) return 'insurance';
      if (description.includes('elektra') || description.includes('gas') || description.includes('water')) return 'utilities';
      if (description.includes('personeel') || description.includes('salaris')) return 'personnel';
      if (description.includes('marketing') || description.includes('advertentie')) return 'marketing';
      if (description.includes('kantoor') || description.includes('huur')) return 'office';
      return 'other';
    }
  };

  // Get invoices for a specific category
  const getInvoicesForCategory = (category: string, type: 'income' | 'cost') => {
    if (type === 'income') {
      return outgoingInvoices.filter(inv => {
        const invDate = inv.invoiceDate instanceof Date ? inv.invoiceDate : new Date(inv.invoiceDate);
        return invDate.getFullYear() === currentYear &&
               inv.status !== 'cancelled' &&
               matchInvoiceToCategory(inv, 'income') === category;
      });
    } else {
      return incomingInvoices.filter(inv => {
        const invDate = inv.invoiceDate instanceof Date ? inv.invoiceDate : new Date(inv.invoiceDate);
        return invDate.getFullYear() === currentYear &&
               matchInvoiceToCategory(inv, 'cost') === category;
      });
    }
  };

  // Calculate monthly amount from any frequency
  const getMonthlyAmount = (item: BudgetItem) => {
    switch (item.frequency) {
      case 'monthly': return item.amount;
      case 'quarterly': return item.amount / 3;
      case 'yearly': return item.amount / 12;
      default: return item.amount;
    }
  };

  // Filter items by type
  const costItems = budgetItems.filter(i => i.type === 'cost' || !i.type); // backwards compatible
  const incomeItems = budgetItems.filter(i => i.type === 'income');
  const activeCostItems = costItems.filter(i => i.isActive);
  const activeIncomeItems = incomeItems.filter(i => i.isActive);

  // Calculate totals
  const monthlyCosts = activeCostItems.reduce((sum, item) => sum + getMonthlyAmount(item), 0);
  const monthlyIncome = activeIncomeItems.reduce((sum, item) => sum + getMonthlyAmount(item), 0);
  const monthlyProfit = monthlyIncome - monthlyCosts;
  const yearlyCosts = monthlyCosts * 12;
  const yearlyIncome = monthlyIncome * 12;
  const yearlyProfit = yearlyIncome - yearlyCosts;

  // Calculate weighted projections (based on confidence)
  const weightedMonthlyIncome = activeIncomeItems.reduce((sum, item) => {
    const weight = CONFIDENCE_CONFIG[item.confidence || 'confirmed'].weight;
    return sum + (getMonthlyAmount(item) * weight);
  }, 0);

  // Calculate actual data from invoices (current year)
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  const actualYTDIncome = outgoingInvoices
    .filter(inv => {
      const invDate = inv.invoiceDate instanceof Date ? inv.invoiceDate : new Date(inv.invoiceDate);
      return invDate.getFullYear() === currentYear && inv.status !== 'cancelled';
    })
    .reduce((sum, inv) => sum + (inv.totalAmount || inv.amount || 0), 0);

  const actualYTDCosts = incomingInvoices
    .filter(inv => {
      const invDate = inv.invoiceDate instanceof Date ? inv.invoiceDate : new Date(inv.invoiceDate);
      return invDate.getFullYear() === currentYear;
    })
    .reduce((sum, inv) => sum + (inv.amount || 0), 0);

  // Projected vs Actual comparison
  const projectedYTDIncome = monthlyIncome * (currentMonth + 1);
  const projectedYTDCosts = monthlyCosts * (currentMonth + 1);
  const incomeVariance = actualYTDIncome - projectedYTDIncome;
  const costVariance = actualYTDCosts - projectedYTDCosts;

  // Helper to safely convert date to ISO string
  const toDateString = (date: any): string => {
    if (!date) return new Date().toISOString().split('T')[0];

    // If it's already a Date object
    if (date instanceof Date) {
      return date.toISOString().split('T')[0];
    }

    // If it's a Firebase Timestamp with toDate method
    if (date.toDate && typeof date.toDate === 'function') {
      return date.toDate().toISOString().split('T')[0];
    }

    // Try to parse as string/number
    try {
      return new Date(date).toISOString().split('T')[0];
    } catch {
      return new Date().toISOString().split('T')[0];
    }
  };

  const handleOpenModal = (item?: BudgetItem, type?: BudgetType) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        type: item.type || 'cost',
        name: item.name,
        category: item.category,
        amount: item.amount.toString(),
        frequency: item.frequency,
        startDate: toDateString(item.startDate),
        endDate: item.endDate ? toDateString(item.endDate) : '',
        supplier: item.supplier || '',
        contractNumber: item.contractNumber || '',
        notes: item.notes || '',
        isActive: item.isActive,
        confidence: item.confidence || 'confirmed',
        growthRate: (item.growthRate || 0).toString(),
      });
    } else {
      setEditingItem(null);
      setFormData({
        ...initialFormData,
        type: type || 'cost',
        category: type === 'income' ? 'services' : 'software',
      });
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
        type: formData.type,
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
        confidence: formData.confidence,
        growthRate: parseFloat(formData.growthRate) || 0,
        companyId: selectedCompany.id,
      };

      if (editingItem) {
        await updateBudgetItem(editingItem.id, itemData, user.uid);
        success('Bijgewerkt', 'Item is bijgewerkt');
      } else {
        await createBudgetItem(itemData, user.uid);
        success('Toegevoegd', 'Item is toegevoegd');
      }

      handleCloseModal();
      await loadData();
    } catch (error) {
      console.error('Error saving:', error);
      showError('Fout bij opslaan', 'Kon item niet opslaan');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: BudgetItem) => {
    if (!user) return;

    if (window.confirm(`Weet je zeker dat je "${item.name}" wilt verwijderen?`)) {
      try {
        await deleteBudgetItem(item.id, user.uid);
        success('Verwijderd', 'Item is verwijderd');
        await loadData();
      } catch (error) {
        console.error('Error deleting:', error);
        showError('Fout bij verwijderen', 'Kon item niet verwijderen');
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

  // Generate projection data for charts
  const generateProjections = () => {
    const projections = [];
    const now = new Date();

    for (let year = 0; year < projectionYears; year++) {
      const projYear = now.getFullYear() + year;
      let yearIncome = 0;
      let yearCosts = 0;

      activeIncomeItems.forEach(item => {
        const baseMonthly = getMonthlyAmount(item);
        const growth = item.growthRate || 0;
        const yearlyAmount = baseMonthly * 12 * Math.pow(1 + growth / 100, year);
        const weight = CONFIDENCE_CONFIG[item.confidence || 'confirmed'].weight;
        yearIncome += yearlyAmount * weight;
      });

      activeCostItems.forEach(item => {
        const baseMonthly = getMonthlyAmount(item);
        const growth = item.growthRate || 0;
        yearCosts += baseMonthly * 12 * Math.pow(1 + growth / 100, year);
      });

      projections.push({
        year: projYear,
        income: yearIncome,
        costs: yearCosts,
        profit: yearIncome - yearCosts,
      });
    }

    return projections;
  };

  // Export to HTML file (downloadable)
  const handleExport = () => {
    const projections = generateProjections();
    const companyName = selectedCompany?.name || 'Bedrijf';
    const dateStr = new Date().toLocaleDateString('nl-NL');
    const fileName = `Financiele-Projectie-${companyName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.html`;

    const html = `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Financiële Projectie - ${companyName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 40px;
      color: #1a1a1a;
      background: white;
      max-width: 1200px;
      margin: 0 auto;
    }
    .print-btn {
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 24px;
      background: #4f46e5;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .print-btn:hover { background: #4338ca; }
    .header {
      text-align: center;
      margin-bottom: 40px;
      border-bottom: 3px solid #4f46e5;
      padding-bottom: 20px;
    }
    .header h1 { font-size: 32px; color: #4f46e5; margin-bottom: 8px; }
    .header p { color: #666; font-size: 14px; }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-bottom: 40px;
    }
    .summary-card {
      padding: 24px;
      border-radius: 12px;
      text-align: center;
    }
    .summary-card.income { background: linear-gradient(135deg, #ecfdf5, #d1fae5); }
    .summary-card.costs { background: linear-gradient(135deg, #fef2f2, #fecaca); }
    .summary-card.profit { background: linear-gradient(135deg, #eef2ff, #c7d2fe); }
    .summary-card h3 { font-size: 14px; color: #666; margin-bottom: 8px; }
    .summary-card .amount { font-size: 28px; font-weight: 700; }
    .summary-card.income .amount { color: #059669; }
    .summary-card.costs .amount { color: #dc2626; }
    .summary-card.profit .amount { color: #4f46e5; }
    .section { margin-bottom: 40px; }
    .section h2 {
      font-size: 20px;
      color: #1a1a1a;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e5e7eb;
    }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f9fafb; font-weight: 600; color: #374151; }
    .projection-row { background: #f9fafb; }
    .positive { color: #059669; }
    .negative { color: #dc2626; }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-top: 20px;
    }
    .metric-card {
      background: #f9fafb;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
    }
    .metric-card .value { font-size: 24px; font-weight: 700; color: #1a1a1a; }
    .metric-card .label { font-size: 12px; color: #666; margin-top: 4px; }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #9ca3af;
      font-size: 12px;
    }
    @media print {
      .print-btn { display: none; }
      body { padding: 20px; }
    }
    @media (max-width: 768px) {
      .summary-grid { grid-template-columns: 1fr; }
      .metrics-grid { grid-template-columns: repeat(2, 1fr); }
    }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">Print / PDF</button>

  <div class="header">
    <h1>${companyName}</h1>
    <p>Financiële Projectie & Begroting | Gegenereerd op ${dateStr}</p>
  </div>

  <div style="background: linear-gradient(135deg, #fef3c7, #fde68a); padding: 16px; border-radius: 12px; margin-bottom: 24px; border-left: 4px solid #f59e0b;">
    <h3 style="font-size: 16px; font-weight: 600; color: #92400e; margin-bottom: 8px;">⚠️ Gewogen Projectie</h3>
    <p style="font-size: 14px; color: #78350f; line-height: 1.5;">
      Inkomsten worden gewogen op zekerheid: <strong>Bevestigd (100%)</strong>, <strong>Waarschijnlijk (75%)</strong>,
      <strong>Potentieel (50%)</strong>, <strong>Speculatief (25%)</strong>. Dit geeft een realistischer beeld voor investeerders.
    </p>
  </div>

  <div class="summary-grid">
    <div class="summary-card income">
      <h3>Jaarlijkse Inkomsten (Gewogen)</h3>
      <div class="amount">${formatCurrency(weightedMonthlyIncome * 12)}</div>
    </div>
    <div class="summary-card costs">
      <h3>Jaarlijkse Kosten</h3>
      <div class="amount">${formatCurrency(yearlyCosts)}</div>
    </div>
    <div class="summary-card profit">
      <h3>Verwachte Winst</h3>
      <div class="amount">${formatCurrency(weightedMonthlyIncome * 12 - yearlyCosts)}</div>
    </div>
  </div>

  <div class="section">
    <h2>Kerngetallen</h2>
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="value">${formatCurrency(weightedMonthlyIncome * 12)}</div>
        <div class="label">ARR (Gewogen)</div>
      </div>
      <div class="metric-card">
        <div class="value">${formatCurrency(monthlyIncome)}</div>
        <div class="label">MRR (Max)</div>
      </div>
      <div class="metric-card">
        <div class="value" style="color: ${yearlyProfit >= 0 ? '#059669' : '#dc2626'}">${yearlyIncome > 0 ? ((yearlyProfit / yearlyIncome) * 100).toFixed(1) : 0}%</div>
        <div class="label">Winstmarge</div>
      </div>
      <div class="metric-card">
        <div class="value">${activeIncomeItems.length}</div>
        <div class="label">Inkomstenbronnen</div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>Meerjarenprojectie</h2>
    <table>
      <thead>
        <tr>
          <th>Jaar</th>
          <th>Inkomsten</th>
          <th>Kosten</th>
          <th>Resultaat</th>
          <th>Marge</th>
        </tr>
      </thead>
      <tbody>
        ${projections.map(p => `
          <tr class="projection-row">
            <td><strong>${p.year}</strong></td>
            <td class="positive">${formatCurrency(p.income)}</td>
            <td class="negative">${formatCurrency(p.costs)}</td>
            <td class="${p.profit >= 0 ? 'positive' : 'negative'}">${formatCurrency(p.profit)}</td>
            <td class="${p.profit >= 0 ? 'positive' : 'negative'}">${p.income > 0 ? ((p.profit / p.income) * 100).toFixed(1) : 0}%</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  ${activeIncomeItems.length > 0 ? `
  <div class="section">
    <h2>Inkomstenbronnen (${activeIncomeItems.length})</h2>
    <table>
      <thead>
        <tr>
          <th>Bron</th>
          <th>Categorie</th>
          <th>Bedrag/mnd</th>
          <th>Zekerheid</th>
          <th>Groei/jaar</th>
        </tr>
      </thead>
      <tbody>
        ${activeIncomeItems.map(item => `
          <tr>
            <td><strong>${item.name}</strong>${item.supplier ? `<br><small style="color:#666">${item.supplier}</small>` : ''}</td>
            <td>${INCOME_CATEGORY_CONFIG[item.category as BudgetIncomeCategory]?.label || item.category}</td>
            <td class="positive">${formatCurrency(getMonthlyAmount(item))}</td>
            <td>${CONFIDENCE_CONFIG[item.confidence || 'confirmed'].label}</td>
            <td>${item.growthRate || 0}%</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  ` : ''}

  ${activeCostItems.length > 0 ? `
  <div class="section">
    <h2>Kostenstructuur (${activeCostItems.length})</h2>
    <table>
      <thead>
        <tr>
          <th>Kostenpost</th>
          <th>Categorie</th>
          <th>Bedrag/mnd</th>
          <th>Leverancier</th>
        </tr>
      </thead>
      <tbody>
        ${activeCostItems.map(item => `
          <tr>
            <td><strong>${item.name}</strong></td>
            <td>${COST_CATEGORY_CONFIG[item.category as BudgetCostCategory]?.label || item.category}</td>
            <td class="negative">${formatCurrency(getMonthlyAmount(item))}</td>
            <td>${item.supplier || '-'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  ` : ''}

  ${showActualData && (actualYTDIncome > 0 || actualYTDCosts > 0) ? `
  <div class="section">
    <h2>YTD Realiteit vs Projectie (${currentYear})</h2>
    <p style="color: #666; font-size: 14px; margin-bottom: 16px;">
      <em>Gebaseerd op ${outgoingInvoices.filter(inv => {
        const invDate = inv.invoiceDate instanceof Date ? inv.invoiceDate : new Date(inv.invoiceDate);
        return invDate.getFullYear() === currentYear && inv.status !== 'cancelled';
      }).length} uitgaande facturen en ${incomingInvoices.filter(inv => {
        const invDate = inv.invoiceDate instanceof Date ? inv.invoiceDate : new Date(inv.invoiceDate);
        return invDate.getFullYear() === currentYear;
      }).length} inkomende facturen in ${currentYear}</em>
    </p>
    <table>
      <thead>
        <tr>
          <th>Metric</th>
          <th>Geprojecteerd YTD</th>
          <th>Werkelijk YTD (Facturen)</th>
          <th>Verschil</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Inkomsten</td>
          <td>${formatCurrency(projectedYTDIncome)}</td>
          <td class="positive">${formatCurrency(actualYTDIncome)}</td>
          <td class="${incomeVariance >= 0 ? 'positive' : 'negative'}">${incomeVariance >= 0 ? '+' : ''}${formatCurrency(incomeVariance)}</td>
        </tr>
        <tr>
          <td>Kosten</td>
          <td>${formatCurrency(projectedYTDCosts)}</td>
          <td class="negative">${actualYTDCosts > 0 ? formatCurrency(actualYTDCosts) : '<span style="color: #9ca3af;">Geen facturen</span>'}</td>
          <td class="${costVariance <= 0 ? 'positive' : 'negative'}">${actualYTDCosts > 0 ? (costVariance <= 0 ? '' : '+') + formatCurrency(costVariance) : '<span style="color: #9ca3af;">-</span>'}</td>
        </tr>
      </tbody>
    </table>
    ${actualYTDCosts === 0 ? `
    <div style="background: #f3f4f6; padding: 12px; border-radius: 8px; margin-top: 12px;">
      <p style="font-size: 13px; color: #6b7280; margin: 0;">
        <strong>Let op:</strong> Er zijn nog geen inkomende facturen geregistreerd in ${currentYear}.
        Upload facturen via "Inkoop Upload" om een realistisch beeld te krijgen van de werkelijke kosten.
      </p>
    </div>
    ` : ''}
  </div>
  ` : ''}

  <div class="footer">
    <p>Dit document is automatisch gegenereerd en bevat financiële projecties gebaseerd op ingevoerde begrotingsdata.</p>
    <p>Gewogen inkomsten zijn gecorrigeerd voor zekerheid: Bevestigd (100%), Waarschijnlijk (75%), Potentieel (50%), Speculatief (25%)</p>
  </div>
</body>
</html>`;

    // Create downloadable file
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    success('Gedownload', `${fileName} is gedownload. Open het bestand en klik op "Print / PDF" voor een PDF.`);
  };

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

  const projections = generateProjections();

  return (
    <div className="space-y-6 pb-20" ref={exportRef}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Begroting & Projecties</h1>
          <p className="mt-1 text-sm text-gray-500">
            Financieel overzicht voor {selectedCompany.name}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={handleRefresh}
            disabled={refreshing}
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Ververs
          </Button>
          <Button variant="secondary" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Exporteer
          </Button>
          <Button onClick={() => handleOpenModal(undefined, activeTab === 'income' ? 'income' : 'cost')}>
            <Plus className="h-4 w-4 mr-2" />
            Nieuw Item
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-gray-200 pb-2 overflow-x-auto">
        {[
          { id: 'overview' as ViewTab, label: 'Overzicht', icon: PieChart },
          { id: 'costs' as ViewTab, label: `Kosten (${costItems.length})`, icon: TrendingDown },
          { id: 'income' as ViewTab, label: `Inkomsten (${incomeItems.length})`, icon: TrendingUp },
          { id: 'projections' as ViewTab, label: 'Projecties', icon: BarChart3 },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-primary-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Variance Alerts */}
          {(Math.abs(incomeVariance / projectedYTDIncome) > 0.15 || Math.abs(costVariance / projectedYTDCosts) > 0.15) && (
            <Card className="p-4 bg-amber-50 border-amber-200">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-amber-900">Significante Afwijkingen Gedetecteerd</h3>
                  <div className="mt-2 space-y-1 text-sm text-amber-800">
                    {Math.abs(incomeVariance / projectedYTDIncome) > 0.15 && (
                      <p>
                        • Inkomsten wijken {((incomeVariance / projectedYTDIncome) * 100).toFixed(1)}% af van projectie
                        {incomeVariance > 0 ? ' (hoger dan verwacht ✓)' : ' (lager dan verwacht ⚠️)'}
                      </p>
                    )}
                    {Math.abs(costVariance / projectedYTDCosts) > 0.15 && (
                      <p>
                        • Kosten wijken {((costVariance / projectedYTDCosts) * 100).toFixed(1)}% af van projectie
                        {costVariance < 0 ? ' (lager dan verwacht ✓)' : ' (hoger dan verwacht ⚠️)'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Main Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-6 bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-emerald-600">Maandelijkse Inkomsten</p>
                  <p className="text-3xl font-bold text-emerald-900 mt-1">
                    {formatCurrency(monthlyIncome)}
                  </p>
                  <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    {activeIncomeItems.length} bronnen
                  </p>
                </div>
                <div className="p-3 bg-emerald-100 rounded-xl">
                  <ArrowUpRight className="h-6 w-6 text-emerald-600" />
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-gradient-to-br from-red-50 to-rose-50 border-red-200">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-red-600">Maandelijkse Kosten</p>
                  <p className="text-3xl font-bold text-red-900 mt-1">
                    {formatCurrency(monthlyCosts)}
                  </p>
                  <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
                    <TrendingDown className="h-3 w-3" />
                    {activeCostItems.length} posten
                  </p>
                </div>
                <div className="p-3 bg-red-100 rounded-xl">
                  <ArrowDownRight className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </Card>

            <Card className={`p-6 ${monthlyProfit >= 0
              ? 'bg-gradient-to-br from-primary-50 to-indigo-50 border-primary-200'
              : 'bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200'}`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className={`text-sm font-medium ${monthlyProfit >= 0 ? 'text-primary-600' : 'text-orange-600'}`}>
                    Maandelijks Resultaat
                  </p>
                  <p className={`text-3xl font-bold mt-1 ${monthlyProfit >= 0 ? 'text-primary-900' : 'text-orange-900'}`}>
                    {monthlyProfit >= 0 ? '+' : ''}{formatCurrency(monthlyProfit)}
                  </p>
                  <p className={`text-xs mt-2 ${monthlyProfit >= 0 ? 'text-primary-600' : 'text-orange-600'}`}>
                    {formatCurrency(yearlyProfit)}/jaar
                  </p>
                </div>
                <div className={`p-3 rounded-xl ${monthlyProfit >= 0 ? 'bg-primary-100' : 'bg-orange-100'}`}>
                  <Wallet className={`h-6 w-6 ${monthlyProfit >= 0 ? 'text-primary-600' : 'text-orange-600'}`} />
                </div>
              </div>
            </Card>
          </div>

          {/* Reality Check Section */}
          {showActualData && (actualYTDIncome > 0 || actualYTDCosts > 0) && (
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Realiteit vs Projectie ({currentYear} YTD)
                </h2>
                <button
                  onClick={() => setShowActualData(!showActualData)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                >
                  {showActualData ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Income Comparison */}
                <div className="p-4 bg-emerald-50 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-emerald-700">Inkomsten</span>
                    <span className={`text-sm font-bold ${incomeVariance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {incomeVariance >= 0 ? '+' : ''}{formatCurrency(incomeVariance)}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600">Geprojecteerd</span>
                      <span className="font-medium">{formatCurrency(projectedYTDIncome)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600">Werkelijk (facturen)</span>
                      <span className="font-medium text-emerald-700">{formatCurrency(actualYTDIncome)}</span>
                    </div>
                  </div>
                  <div className="mt-2 h-2 bg-emerald-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${Math.min((actualYTDIncome / projectedYTDIncome) * 100, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Costs Comparison */}
                <div className="p-4 bg-red-50 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-red-700">Kosten</span>
                    <span className={`text-sm font-bold ${costVariance <= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {costVariance >= 0 ? '+' : ''}{formatCurrency(costVariance)}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600">Geprojecteerd</span>
                      <span className="font-medium">{formatCurrency(projectedYTDCosts)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600">Werkelijk (facturen)</span>
                      <span className="font-medium text-red-700">{formatCurrency(actualYTDCosts)}</span>
                    </div>
                  </div>
                  <div className="mt-2 h-2 bg-red-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500 rounded-full"
                      style={{ width: `${Math.min((actualYTDCosts / projectedYTDCosts) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => handleOpenModal(undefined, 'income')}
              className="p-4 bg-emerald-50 border-2 border-dashed border-emerald-300 rounded-xl hover:bg-emerald-100 transition-colors"
            >
              <Plus className="h-6 w-6 text-emerald-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-emerald-700">Inkomstenbron Toevoegen</p>
            </button>
            <button
              onClick={() => handleOpenModal(undefined, 'cost')}
              className="p-4 bg-red-50 border-2 border-dashed border-red-300 rounded-xl hover:bg-red-100 transition-colors"
            >
              <Plus className="h-6 w-6 text-red-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-red-700">Kostenpost Toevoegen</p>
            </button>
          </div>
        </div>
      )}

      {/* Costs Tab */}
      {activeTab === 'costs' && (
        <div className="space-y-6">
          {costItems.length === 0 ? (
            <EmptyState
              icon={TrendingDown}
              title="Geen kosten"
              description="Voeg terugkerende kosten toe"
              actionLabel="Eerste Kost Toevoegen"
              onAction={() => handleOpenModal(undefined, 'cost')}
            />
          ) : (
            // Group items by category
            Object.entries(
              costItems.reduce((groups, item) => {
                const category = item.category as BudgetCostCategory;
                if (!groups[category]) groups[category] = [];
                groups[category].push(item);
                return groups;
              }, {} as Record<BudgetCostCategory, BudgetItem[]>)
            ).map(([category, items]) => {
              const config = COST_CATEGORY_CONFIG[category as BudgetCostCategory] || COST_CATEGORY_CONFIG.other;
              const Icon = config.icon;
              const categoryTotal = items.reduce((sum, item) => sum + (item.isActive ? getMonthlyAmount(item) : 0), 0);

              const categoryInvoices = getInvoicesForCategory(category, 'cost');
              const isExpanded = drillDownCategory?.type === 'cost' && drillDownCategory?.category === category;

              return (
                <div key={category} className="space-y-2">
                  {/* Category Header - Clickable */}
                  <button
                    onClick={() => setDrillDownCategory(isExpanded ? null : { type: 'cost', category })}
                    className={`w-full flex items-center justify-between p-3 rounded-lg ${config.bgColor} border ${config.borderColor} transition-all hover:shadow-md`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={`h-5 w-5 ${config.textColor}`} />
                      <h3 className={`font-semibold ${config.textColor}`}>{config.label}</h3>
                      <span className="text-xs text-gray-500">({items.length})</span>
                      {categoryInvoices.length > 0 && (
                        <span className="text-xs bg-white px-2 py-0.5 rounded-full text-gray-600">
                          {categoryInvoices.length} facturen
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className={`text-sm font-bold ${config.textColor}`}>
                          {formatCurrency(categoryTotal)}/mnd
                        </p>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className={`h-4 w-4 ${config.textColor}`} />
                      ) : (
                        <ChevronDown className={`h-4 w-4 ${config.textColor}`} />
                      )}
                    </div>
                  </button>

                  {/* Drill-down: Show Invoices */}
                  {isExpanded && categoryInvoices.length > 0 && (
                    <Card className="ml-4 p-4 bg-gray-50">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">
                        Facturen in deze categorie ({currentYear})
                      </h4>
                      <div className="space-y-2">
                        {categoryInvoices.map((inv: any) => {
                          const invDate = inv.invoiceDate instanceof Date ? inv.invoiceDate : new Date(inv.invoiceDate);
                          return (
                            <div key={inv.id} className="flex items-center justify-between p-2 bg-white rounded border border-gray-200 text-sm">
                              <div className="flex-1">
                                <p className="font-medium text-gray-900">{inv.supplier || inv.description || 'Onbekend'}</p>
                                <p className="text-xs text-gray-500">
                                  {invDate.toLocaleDateString('nl-NL')} • {inv.invoiceNumber || 'Geen nr'}
                                </p>
                              </div>
                              <p className="font-bold text-red-600">
                                {formatCurrency(inv.amount || 0)}
                              </p>
                            </div>
                          );
                        })}
                        <div className="pt-2 border-t border-gray-200 flex justify-between text-sm font-semibold">
                          <span>Totaal YTD</span>
                          <span className="text-red-600">
                            {formatCurrency(categoryInvoices.reduce((sum: number, inv: any) => sum + (inv.amount || 0), 0))}
                          </span>
                        </div>
                      </div>
                    </Card>
                  )}

                  {/* Items in this category */}
                  <div className="space-y-2 pl-2">
                    {items.map((item) => (
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
                              {item.supplier && <span>{item.supplier}</span>}
                              {item.contractNumber && <span>• Contract: {item.contractNumber}</span>}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-red-600">
                              -{formatCurrencyDetailed(item.amount)}
                            </p>
                            <p className="text-xs text-gray-500">{FREQUENCY_LABELS[item.frequency]}</p>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleOpenModal(item)}
                              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Bewerken"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(item)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Verwijderen"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Income Tab */}
      {activeTab === 'income' && (
        <div className="space-y-6">
          {incomeItems.length === 0 ? (
            <EmptyState
              icon={TrendingUp}
              title="Geen inkomsten"
              description="Voeg verwachte inkomsten toe voor projecties"
              actionLabel="Eerste Inkomst Toevoegen"
              onAction={() => handleOpenModal(undefined, 'income')}
            />
          ) : (
            // Group items by category
            Object.entries(
              incomeItems.reduce((groups, item) => {
                const category = item.category as BudgetIncomeCategory;
                if (!groups[category]) groups[category] = [];
                groups[category].push(item);
                return groups;
              }, {} as Record<BudgetIncomeCategory, BudgetItem[]>)
            ).map(([category, items]) => {
              const config = INCOME_CATEGORY_CONFIG[category as BudgetIncomeCategory] || INCOME_CATEGORY_CONFIG.other;
              const Icon = config.icon;
              const categoryTotal = items.reduce((sum, item) => sum + (item.isActive ? getMonthlyAmount(item) : 0), 0);
              const weightedTotal = items.reduce((sum, item) => {
                if (!item.isActive) return sum;
                const weight = CONFIDENCE_CONFIG[item.confidence || 'confirmed'].weight;
                return sum + (getMonthlyAmount(item) * weight);
              }, 0);

              const categoryInvoices = getInvoicesForCategory(category, 'income');
              const isExpanded = drillDownCategory?.type === 'income' && drillDownCategory?.category === category;

              return (
                <div key={category} className="space-y-2">
                  {/* Category Header - Clickable */}
                  <button
                    onClick={() => setDrillDownCategory(isExpanded ? null : { type: 'income', category })}
                    className={`w-full flex items-center justify-between p-3 rounded-lg ${config.bgColor} border ${config.borderColor} transition-all hover:shadow-md`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={`h-5 w-5 ${config.textColor}`} />
                      <h3 className={`font-semibold ${config.textColor}`}>{config.label}</h3>
                      <span className="text-xs text-gray-500">({items.length})</span>
                      {categoryInvoices.length > 0 && (
                        <span className="text-xs bg-white px-2 py-0.5 rounded-full text-gray-600">
                          {categoryInvoices.length} facturen
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className={`text-sm font-bold ${config.textColor}`}>
                          {formatCurrency(categoryTotal)}/mnd
                        </p>
                        <p className="text-xs text-gray-500">
                          Gewogen: {formatCurrency(weightedTotal)}/mnd
                        </p>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className={`h-4 w-4 ${config.textColor}`} />
                      ) : (
                        <ChevronDown className={`h-4 w-4 ${config.textColor}`} />
                      )}
                    </div>
                  </button>

                  {/* Drill-down: Show Invoices */}
                  {isExpanded && categoryInvoices.length > 0 && (
                    <Card className="ml-4 p-4 bg-gray-50">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">
                        Facturen in deze categorie ({currentYear})
                      </h4>
                      <div className="space-y-2">
                        {categoryInvoices.map((inv: any) => {
                          const invDate = inv.invoiceDate instanceof Date ? inv.invoiceDate : new Date(inv.invoiceDate);
                          return (
                            <div key={inv.id} className="flex items-center justify-between p-2 bg-white rounded border border-gray-200 text-sm">
                              <div className="flex-1">
                                <p className="font-medium text-gray-900">{inv.clientName || inv.description || 'Onbekend'}</p>
                                <p className="text-xs text-gray-500">
                                  {invDate.toLocaleDateString('nl-NL')} • {inv.invoiceNumber || 'Geen nr'}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-emerald-600">
                                  {formatCurrency(inv.totalAmount || inv.amount || 0)}
                                </p>
                                {inv.status && (
                                  <span className={`text-xs ${
                                    inv.status === 'paid' ? 'text-green-600' :
                                    inv.status === 'sent' ? 'text-blue-600' :
                                    'text-gray-600'
                                  }`}>
                                    {inv.status === 'paid' ? 'Betaald' :
                                     inv.status === 'sent' ? 'Verzonden' :
                                     inv.status === 'draft' ? 'Concept' : inv.status}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        <div className="pt-2 border-t border-gray-200 flex justify-between text-sm font-semibold">
                          <span>Totaal YTD</span>
                          <span className="text-emerald-600">
                            {formatCurrency(categoryInvoices.reduce((sum: number, inv: any) => sum + (inv.totalAmount || inv.amount || 0), 0))}
                          </span>
                        </div>
                      </div>
                    </Card>
                  )}

                  {/* Items in this category */}
                  <div className="space-y-2 pl-2">
                    {items.map((item) => {
                      const confConfig = CONFIDENCE_CONFIG[item.confidence || 'confirmed'];
                      const ConfIcon = confConfig.icon;

                      return (
                        <Card key={item.id} className={`p-4 ${!item.isActive ? 'opacity-60' : ''}`}>
                          <div className="flex items-center gap-4">
                            <div className={`p-2.5 rounded-lg ${config.bgColor} ${config.textColor}`}>
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium text-gray-900 truncate">{item.name}</h4>
                                <span className={`px-2 py-0.5 text-xs rounded flex items-center gap-1 ${confConfig.bgColor} ${confConfig.color}`}>
                                  <ConfIcon className="h-3 w-3" />
                                  {confConfig.label}
                                </span>
                                {!item.isActive && (
                                  <span className="px-2 py-0.5 text-xs bg-gray-200 text-gray-600 rounded">
                                    Inactief
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                                {item.supplier && <span>{item.supplier}</span>}
                                {item.contractNumber && <span>• Contract: {item.contractNumber}</span>}
                                {item.growthRate && item.growthRate > 0 && (
                                  <span className="text-emerald-600">• +{item.growthRate}%/jaar</span>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-emerald-600">
                                +{formatCurrencyDetailed(item.amount)}
                              </p>
                              <p className="text-xs text-gray-500">{FREQUENCY_LABELS[item.frequency]}</p>
                            </div>
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleOpenModal(item)}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                title="Bewerken"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(item)}
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Verwijderen"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Projections Tab */}
      {activeTab === 'projections' && (
        <div className="space-y-6">
          {/* Projection Controls */}
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-gray-900">Projectie Instellingen</h3>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Jaren:</span>
                {[1, 3, 5].map(years => (
                  <button
                    key={years}
                    onClick={() => setProjectionYears(years)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium ${
                      projectionYears === years
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {years}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {/* Weighted Income Note */}
          <Card className="p-4 bg-amber-50 border-amber-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-amber-800">Gewogen Projectie</h4>
                <p className="text-sm text-amber-700 mt-1">
                  Inkomsten worden gewogen op zekerheid: Bevestigd (100%), Waarschijnlijk (75%),
                  Potentieel (50%), Speculatief (25%). Dit geeft een realistischer beeld voor investeerders.
                </p>
              </div>
            </div>
          </Card>

          {/* Projection Table */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Jaar</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Inkomsten</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Kosten</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Resultaat</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Marge</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {projections.map((proj, idx) => (
                    <tr key={proj.year} className={idx === 0 ? 'bg-primary-50' : ''}>
                      <td className="px-4 py-4">
                        <span className="font-semibold text-gray-900">{proj.year}</span>
                        {idx === 0 && (
                          <span className="ml-2 px-2 py-0.5 text-xs bg-primary-100 text-primary-700 rounded">
                            Huidig
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="font-medium text-emerald-600">{formatCurrency(proj.income)}</span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="font-medium text-red-600">{formatCurrency(proj.costs)}</span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className={`font-bold ${proj.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {proj.profit >= 0 ? '+' : ''}{formatCurrency(proj.profit)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className={`font-medium ${proj.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {proj.income > 0 ? ((proj.profit / proj.income) * 100).toFixed(1) : 0}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Key Metrics for Investors */}
          <Card className="p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Kerngetallen voor Investeerders</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(weightedMonthlyIncome * 12)}
                </p>
                <p className="text-xs text-gray-500 mt-1">ARR (Gewogen)</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(monthlyIncome)}
                </p>
                <p className="text-xs text-gray-500 mt-1">MRR (Max)</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className={`text-2xl font-bold ${yearlyProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {yearlyIncome > 0 ? ((yearlyProfit / yearlyIncome) * 100).toFixed(1) : 0}%
                </p>
                <p className="text-xs text-gray-500 mt-1">Winstmarge</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">
                  {activeIncomeItems.length}
                </p>
                <p className="text-xs text-gray-500 mt-1">Inkomstenbronnen</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={handleCloseModal} />
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold text-gray-900 mb-6">
                {editingItem ? 'Item Bewerken' : `Nieuw ${formData.type === 'income' ? 'Inkomst' : 'Kost'}`}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Type Toggle */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, type: 'cost', category: 'software' })}
                      className={`p-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${
                        formData.type === 'cost'
                          ? 'border-red-500 bg-red-50 text-red-700'
                          : 'border-gray-200 hover:border-gray-300 text-gray-600'
                      }`}
                    >
                      <TrendingDown className="h-4 w-4" />
                      Kost
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, type: 'income', category: 'services' })}
                      className={`p-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${
                        formData.type === 'income'
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                          : 'border-gray-200 hover:border-gray-300 text-gray-600'
                      }`}
                    >
                      <TrendingUp className="h-4 w-4" />
                      Inkomst
                    </button>
                  </div>
                </div>

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
                    placeholder={formData.type === 'income' ? 'bijv. Enterprise Klant A' : 'bijv. Microsoft 365'}
                    required
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categorie</label>
                  <div className="grid grid-cols-4 gap-2">
                    {(formData.type === 'cost'
                      ? Object.keys(COST_CATEGORY_CONFIG) as BudgetCostCategory[]
                      : Object.keys(INCOME_CATEGORY_CONFIG) as BudgetIncomeCategory[]
                    ).map((cat) => {
                      const config = formData.type === 'cost'
                        ? COST_CATEGORY_CONFIG[cat as BudgetCostCategory]
                        : INCOME_CATEGORY_CONFIG[cat as BudgetIncomeCategory];
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
                          <Icon className={`h-4 w-4 ${isSelected ? config.textColor : 'text-gray-400'}`} />
                          <span className={`text-xs truncate w-full text-center ${isSelected ? config.textColor : 'text-gray-500'}`}>
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bedrag *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                        placeholder="0.00"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Frequentie</label>
                    <select
                      value={formData.frequency}
                      onChange={(e) => setFormData({ ...formData, frequency: e.target.value as BudgetFrequency })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="monthly">Maandelijks</option>
                      <option value="quarterly">Per kwartaal</option>
                      <option value="yearly">Jaarlijks</option>
                    </select>
                  </div>
                </div>

                {/* Income-specific: Confidence & Growth */}
                {formData.type === 'income' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Zekerheid</label>
                      <div className="grid grid-cols-4 gap-2">
                        {(Object.keys(CONFIDENCE_CONFIG) as ProjectionConfidence[]).map((conf) => {
                          const config = CONFIDENCE_CONFIG[conf];
                          const Icon = config.icon;
                          const isSelected = formData.confidence === conf;
                          return (
                            <button
                              key={conf}
                              type="button"
                              onClick={() => setFormData({ ...formData, confidence: conf })}
                              className={`p-2 rounded-lg border-2 transition-all flex flex-col items-center gap-1 ${
                                isSelected
                                  ? `border-gray-800 ${config.bgColor}`
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <Icon className={`h-4 w-4 ${isSelected ? config.color : 'text-gray-400'}`} />
                              <span className={`text-xs ${isSelected ? config.color : 'text-gray-500'}`}>
                                {config.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Verwachte Groei per Jaar (%)
                      </label>
                      <input
                        type="number"
                        step="1"
                        value={formData.growthRate}
                        onChange={(e) => setFormData({ ...formData, growthRate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                        placeholder="0"
                      />
                    </div>
                  </>
                )}

                {/* Supplier/Client */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {formData.type === 'income' ? 'Klant' : 'Leverancier'}
                  </label>
                  <input
                    type="text"
                    value={formData.supplier}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder={formData.type === 'income' ? 'bijv. ACME Corp' : 'bijv. Microsoft'}
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notities</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
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
