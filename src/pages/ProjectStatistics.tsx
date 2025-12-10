import React, { useEffect, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Factory, Euro, TrendingUp, Package, Clock } from 'lucide-react';
import Card from '../components/ui/Card';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

const ProjectStatistics: React.FC = () => {
  const { selectedCompany } = useApp();
  const { adminUserId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalProductionHours: 0,
    totalOvertime: 0,
    totalRevenue: 0,
    totalCosts: 0,
    totalInvoices: 0,
    averageHourlyRate: 0,
  });
  const [monthlyData, setMonthlyData] = useState<any[]>([]);

  useEffect(() => {
    if (!selectedCompany || !adminUserId || selectedCompany.companyType !== 'project') {
      setLoading(false);
      return;
    }

    loadProjectStatistics();
  }, [selectedCompany, adminUserId]);

  const loadProjectStatistics = async () => {
    if (!adminUserId || !selectedCompany) return;

    setLoading(true);
    try {
      console.log('📊 Loading project statistics...');

      // Time entries (productie) - Load all production hours for this company
      const timeEntriesQuery = query(
        collection(db, 'timeEntries'),
        where('companyId', '==', selectedCompany.id)
      );
      const timeEntriesSnap = await getDocs(timeEntriesQuery);
      let totalHours = 0;
      let totalOvertime = 0;

      timeEntriesSnap.forEach(doc => {
        const data = doc.data();
        totalHours += data.regularHours || 0;
        totalOvertime += data.overtimeHours || 0;
      });

      // Outgoing invoices (omzet)
      const outgoingQuery = query(
        collection(db, 'outgoingInvoices'),
        where('userId', '==', adminUserId),
        where('companyId', '==', selectedCompany.id)
      );
      const outgoingSnap = await getDocs(outgoingQuery);
      let totalRevenue = 0;
      const monthlyRevenueMap = new Map<string, number>();
      const monthlyHoursMap = new Map<string, number>();

      outgoingSnap.forEach(doc => {
        const data = doc.data();
        totalRevenue += data.totalAmount || 0;

        const invoiceDate = data.invoiceDate?.toDate?.() || new Date(data.invoiceDate);
        const monthKey = `${invoiceDate.getFullYear()}-${String(invoiceDate.getMonth() + 1).padStart(2, '0')}`;
        monthlyRevenueMap.set(monthKey, (monthlyRevenueMap.get(monthKey) || 0) + (data.totalAmount || 0));
      });

      // Incoming invoices (kosten)
      const incomingQuery = query(
        collection(db, 'incomingInvoices'),
        where('userId', '==', adminUserId),
        where('companyId', '==', selectedCompany.id)
      );
      const incomingSnap = await getDocs(incomingQuery);
      let totalCosts = 0;
      const monthlyCostsMap = new Map<string, number>();

      incomingSnap.forEach(doc => {
        const data = doc.data();
        totalCosts += data.totalAmount || 0;

        const invoiceDate = data.invoiceDate?.toDate?.() || new Date(data.invoiceDate);
        const monthKey = `${invoiceDate.getFullYear()}-${String(invoiceDate.getMonth() + 1).padStart(2, '0')}`;
        monthlyCostsMap.set(monthKey, (monthlyCostsMap.get(monthKey) || 0) + (data.totalAmount || 0));
      });

      // Time entries per maand tellen
      timeEntriesSnap.forEach(doc => {
        const data = doc.data();
        const date = data.date?.toDate?.() || new Date(data.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const hours = (data.regularHours || 0) + (data.overtimeHours || 0);
        monthlyHoursMap.set(monthKey, (monthlyHoursMap.get(monthKey) || 0) + hours);
      });

      const averageHourlyRate = totalHours > 0 ? totalRevenue / totalHours : 0;

      setStats({
        totalProductionHours: totalHours,
        totalOvertime,
        totalRevenue,
        totalCosts,
        totalInvoices: outgoingSnap.size,
        averageHourlyRate,
      });

      // Maandelijkse data voor chart
      const allMonthKeys = new Set([
        ...Array.from(monthlyRevenueMap.keys()),
        ...Array.from(monthlyCostsMap.keys()),
        ...Array.from(monthlyHoursMap.keys()),
      ]);
      const monthlyChartData = Array.from(allMonthKeys)
        .sort()
        .map(monthKey => ({
          month: monthKey,
          omzet: monthlyRevenueMap.get(monthKey) || 0,
          kosten: monthlyCostsMap.get(monthKey) || 0,
          uren: monthlyHoursMap.get(monthKey) || 0,
        }));
      setMonthlyData(monthlyChartData);

      console.log('✅ Project statistics loaded successfully');
    } catch (error) {
      console.error('❌ Error loading project statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!selectedCompany) {
    return (
      <div className="p-6">
        <p className="text-gray-500">Selecteer een project bedrijf om statistieken te bekijken.</p>
      </div>
    );
  }

  if (selectedCompany.companyType !== 'project') {
    return (
      <div className="p-6">
        <p className="text-gray-500">Deze pagina is alleen beschikbaar voor project bedrijven.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  const profit = stats.totalRevenue - stats.totalCosts;
  const profitMargin = stats.totalRevenue > 0 ? (profit / stats.totalRevenue) * 100 : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Project Statistieken</h1>
        <p className="text-gray-600 mt-1">Overzicht van {selectedCompany.name}</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Productie Uren</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {stats.totalProductionHours.toLocaleString('nl-NL')}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {stats.totalOvertime > 0 && `+${stats.totalOvertime.toFixed(0)} overuren`}
              </p>
            </div>
            <Clock className="h-8 w-8 text-blue-600" />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Totale Omzet</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                €{stats.totalRevenue.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-gray-500 mt-1">{stats.totalInvoices} facturen</p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-600" />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Winstmarge</p>
              <p className={`text-2xl font-bold mt-1 ${profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {profitMargin.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500 mt-1">
                €{profit.toLocaleString('nl-NL', { minimumFractionDigits: 2 })} winst
              </p>
            </div>
            <Factory className={`h-8 w-8 ${profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`} />
          </div>
        </Card>
      </div>

      {/* Financieel Overzicht */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <div>
            <p className="text-sm font-medium text-gray-600">Verkoop (Omzet)</p>
            <p className="text-2xl font-bold text-green-600 mt-1">
              €{stats.totalRevenue.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </Card>

        <Card>
          <div>
            <p className="text-sm font-medium text-gray-600">Inkoop (Kosten)</p>
            <p className="text-2xl font-bold text-red-600 mt-1">
              €{stats.totalCosts.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </Card>

        <Card>
          <div>
            <p className="text-sm font-medium text-gray-600">Netto Winst</p>
            <p className={`text-2xl font-bold mt-1 ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              €{profit.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </Card>
      </div>

      {/* Maandelijkse Omzet vs Kosten */}
      {monthlyData.length > 0 && (
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Maandelijkse Omzet vs Kosten</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(value) => `€${value.toLocaleString('nl-NL')}`} />
              <Tooltip formatter={(value) => `€${Number(value).toLocaleString('nl-NL')}`} />
              <Legend />
              <Line type="monotone" dataKey="omzet" stroke="#10B981" name="Omzet" strokeWidth={2} />
              <Line type="monotone" dataKey="kosten" stroke="#EF4444" name="Kosten" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Maandelijkse Productie Uren */}
      {monthlyData.length > 0 && (
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Maandelijkse Productie Uren</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="uren" fill="#3B82F6" name="Productie Uren" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Project Performance Indicatoren */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance Indicatoren</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm font-medium text-blue-900">Omzet per Uur</p>
            <p className="text-2xl font-bold text-blue-600 mt-2">
              €{stats.averageHourlyRate.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm font-medium text-green-900">Winstmarge</p>
            <p className="text-2xl font-bold text-green-600 mt-2">{profitMargin.toFixed(1)}%</p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <p className="text-sm font-medium text-purple-900">Totale Productie</p>
            <p className="text-2xl font-bold text-purple-600 mt-2">
              {stats.totalProductionHours.toLocaleString('nl-NL')} uur
            </p>
          </div>
        </div>
      </Card>

      {/* Geen werknemers notitie */}
      <Card>
        <div className="flex items-center gap-3 text-gray-600">
          <Package className="h-5 w-5" />
          <p className="text-sm">
            <strong>Let op:</strong> Project bedrijven hebben geen eigen personeel in dienst.
            Productie uren worden geregistreerd door werknemers van gekoppelde employer bedrijven.
          </p>
        </div>
      </Card>
    </div>
  );
};

export default ProjectStatistics;
