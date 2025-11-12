import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import {
  BarChart3, Building2, TrendingUp, TrendingDown, DollarSign, Clock,
  Users, AlertCircle, CheckCircle2, PieChart as PieChartIcon,
  Calendar, FileText, Zap, Target, ArrowUpRight, ArrowDownLeft
} from 'lucide-react';
import { EmptyState } from '../components/ui/EmptyState';
import Card from '../components/ui/Card';
import { projectStatisticsService } from '../services/projectStatisticsService';
import type { ProjectStatistics, InvoiceMetrics, ProductionMetrics, EmployeeMetrics } from '../types/statistics';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter
} from 'recharts';

const ProjectStatistics: React.FC = () => {
  const { user } = useAuth();
  const { selectedCompany } = useApp();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for different data sections
  const [stats, setStats] = useState<ProjectStatistics | null>(null);
  const [invoiceMetrics, setInvoiceMetrics] = useState<InvoiceMetrics | null>(null);
  const [productionMetrics, setProductionMetrics] = useState<ProductionMetrics | null>(null);
  const [employeeMetrics, setEmployeeMetrics] = useState<EmployeeMetrics | null>(null);

  useEffect(() => {
    const loadStatistics = async () => {
      if (!selectedCompany?.id || !user?.uid) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Parallel loading of all statistics
        const [stats, invoices, production, employees] = await Promise.all([
          projectStatisticsService.getProjectStatistics(selectedCompany.id, user.uid),
          projectStatisticsService.getInvoiceMetrics(selectedCompany.id, user.uid),
          projectStatisticsService.getProductionMetrics(selectedCompany.id, user.uid),
          projectStatisticsService.getEmployeeMetrics(selectedCompany.id, user.uid)
        ]);

        setStats(stats);
        setInvoiceMetrics(invoices);
        setProductionMetrics(production);
        setEmployeeMetrics(employees);
      } catch (err) {
        console.error('Error loading statistics:', err);
        setError('Kon statistieken niet laden');
      } finally {
        setLoading(false);
      }
    };

    loadStatistics();
  }, [selectedCompany, user]);

  if (!selectedCompany) {
    return (
      <EmptyState
        icon={Building2}
        title="Geen bedrijf geselecteerd"
        description="Selecteer een projectbedrijf om statistieken te bekijken."
      />
    );
  }

  if (selectedCompany.companyType !== 'project') {
    return (
      <EmptyState
        icon={BarChart3}
        title="Dit is geen projectbedrijf"
        description="Statistieken zijn alleen beschikbaar voor projectbedrijven."
      />
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Fout bij laden"
        description={error}
      />
    );
  }

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Statistieken</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Compleet overzicht voor {selectedCompany.name}
        </p>
      </div>

      {/* KPI Cards - Top Row */}
      {stats && <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Invoice Value */}
        <Card className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Totaal Gefactureerd</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                €{stats.totalInvoiceValue.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                {stats.totalInvoices} facturen
              </p>
            </div>
            <div className="p-3 bg-blue-500/20 rounded-lg">
              <DollarSign className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </Card>

        {/* Total Production Hours */}
        <Card className="p-6 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Totaal Gewerkte Uren</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                {stats.totalProductionHours.toLocaleString('nl-NL')}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                {stats.averageHoursPerEmployee.toFixed(1)}h per medewerker
              </p>
            </div>
            <div className="p-3 bg-green-500/20 rounded-lg">
              <Clock className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </Card>

        {/* Active Employees */}
        <Card className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Actieve Medewerkers</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                {stats.activeEmployees}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                {stats.totalEmployees} totaal
              </p>
            </div>
            <div className="p-3 bg-purple-500/20 rounded-lg">
              <Users className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </Card>

        {/* Average Invoice Amount */}
        <Card className="p-6 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Gemiddelde Factuur</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                €{(stats.totalInvoiceValue / stats.totalInvoices).toLocaleString('nl-NL', { maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                per factuur
              </p>
            </div>
            <div className="p-3 bg-orange-500/20 rounded-lg">
              <Target className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
        </Card>
      </div>}

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Invoice Value Trend */}
        {invoiceMetrics && invoiceMetrics.monthlyTrend.length > 0 && <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Facturatie Trend
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={invoiceMetrics.monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => `€${value.toLocaleString('nl-NL')}`} />
              <Legend />
              <Line
                type="monotone"
                dataKey="total"
                stroke="#3b82f6"
                dot={{ r: 4 }}
                name="Totaal Gefactureerd"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#10b981"
                yAxisId="right"
                dot={{ r: 4 }}
                name="Aantal Facturen"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>}

        {/* Production Hours Distribution */}
        {productionMetrics && productionMetrics.hoursByType.length > 0 && <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <PieChartIcon className="w-5 h-5" />
            Uurverdeling
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={productionMetrics.hoursByType}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {productionMetrics.hoursByType.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `${value}h`} />
            </PieChart>
          </ResponsiveContainer>
        </Card>}
      </div>

      {/* Invoice Status & Production Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Invoice Status Distribution */}
        {invoiceMetrics && <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Factuurstatus
          </h3>
          <div className="space-y-3">
            {Object.entries(invoiceMetrics.statusBreakdown).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {status === 'draft' && <AlertCircle className="w-4 h-4 text-yellow-500" />}
                  {status === 'approved' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                  {status === 'paid' && <CheckCircle2 className="w-4 h-4 text-blue-500" />}
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                    {status === 'draft' && 'Concept'}
                    {status === 'approved' && 'Goedgekeurd'}
                    {status === 'paid' && 'Betaald'}
                    {status === 'rejected' && 'Afgewezen'}
                  </span>
                </div>
                <span className="text-sm font-bold text-gray-900 dark:text-white">{count}</span>
              </div>
            ))}
          </div>
        </Card>}

        {/* Production Status */}
        {productionMetrics && <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Productiestatus
          </h3>
          <div className="space-y-3">
            {Object.entries(productionMetrics.statusBreakdown).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {status === 'draft' && <AlertCircle className="w-4 h-4 text-yellow-500" />}
                  {status === 'ready' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                  {status === 'invoiced' && <CheckCircle2 className="w-4 h-4 text-blue-500" />}
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                    {status === 'draft' && 'Concept'}
                    {status === 'ready' && 'Klaar'}
                    {status === 'invoiced' && 'Gefactureerd'}
                  </span>
                </div>
                <span className="text-sm font-bold text-gray-900 dark:text-white">{count}</span>
              </div>
            ))}
          </div>
        </Card>}
      </div>

      {/* Employee Performance */}
      {employeeMetrics && employeeMetrics.topPerformers.length > 0 && <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Users className="w-5 h-5" />
          Medewerker Prestaties
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Medewerker</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Uren</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Gefactureerd</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Gem. Uurtarief</th>
              </tr>
            </thead>
            <tbody>
              {employeeMetrics.topPerformers.map((emp, idx) => (
                <tr key={idx} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">{emp.name}</td>
                  <td className="text-right py-3 px-4 text-gray-700 dark:text-gray-300">{emp.totalHours}h</td>
                  <td className="text-right py-3 px-4 font-semibold text-gray-900 dark:text-white">
                    €{emp.totalInvoiced.toLocaleString('nl-NL')}
                  </td>
                  <td className="text-right py-3 px-4 text-gray-700 dark:text-gray-300">
                    €{(emp.totalInvoiced / emp.totalHours).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>}

      {/* Customer Performance */}
      {invoiceMetrics && invoiceMetrics.topCustomers.length > 0 && <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Building2 className="w-5 h-5" />
          Top Klanten
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={invoiceMetrics.topCustomers}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip formatter={(value) => `€${value.toLocaleString('nl-NL')}`} />
            <Bar dataKey="value" fill="#3b82f6" name="Gefactureerd" />
          </BarChart>
        </ResponsiveContainer>
      </Card>}

      {/* Invoice-Production Correlation */}
      {invoiceMetrics && productionMetrics && <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <ArrowUpRight className="w-5 h-5" />
          Correlatie: Productie ↔ Facturatie
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">Conversieratio</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {invoiceMetrics.conversionRate.toFixed(1)}%
            </p>
          </div>
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">Gemiddelde waarde/uur</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              €{invoiceMetrics.averageValuePerHour.toFixed(2)}
            </p>
          </div>
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">Wachttijd factuur</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {invoiceMetrics.averageDaysToInvoice.toFixed(0)} dagen
            </p>
          </div>
        </div>
      </Card>}

      {/* Additional Insights */}
      {stats && <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <TrendingDown className="w-5 h-5" />
            Inzichten
          </h3>
          <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <li className="flex items-start gap-2">
              <span className="text-blue-500 font-bold mt-0.5">•</span>
              <span>Gemiddelde productie per week: {(stats.totalProductionHours / 52).toFixed(1)}h</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 font-bold mt-0.5">•</span>
              <span>Medewerkers per project: {(stats.totalEmployees / stats.projectCount || 1).toFixed(1)}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-500 font-bold mt-0.5">•</span>
              <span>Facturatie snelheid: {stats.invoiceProcessingSpeed}% op tijd</span>
            </li>
          </ul>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Activiteit deze maand
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Producties gemaakt:</span>
              <span className="font-semibold text-gray-900 dark:text-white">{stats.productionsThisMonth}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Facturen gemaakt:</span>
              <span className="font-semibold text-gray-900 dark:text-white">{stats.invoicesThisMonth}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Waarde gegenereerd:</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                €{stats.valueThisMonth.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>
        </Card>
      </div>}

      {loading && (
        <div className="text-center py-12">
          <div className="inline-block">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
          <p className="text-gray-500 dark:text-gray-400 mt-4">Statistieken laden...</p>
        </div>
      )}
    </div>
  );
};

export default ProjectStatistics;