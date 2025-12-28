import React, { useEffect, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Building2, Euro, TrendingUp, TrendingDown, Package, Receipt } from 'lucide-react';
import Card from '../components/ui/Card';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface CompanyStats {
  companyId: string;
  companyName: string;
  companyType: 'employer' | 'project' | 'holding';
  outgoingInvoicesCount: number;
  outgoingInvoicesTotal: number;
  incomingInvoicesCount: number;
  incomingInvoicesTotal: number;
  budgetCostsMonthly: number;
  budgetIncomeMonthly: number;
  profit: number;
}

const HoldingStatistics: React.FC = () => {
  const { selectedCompany, companies } = useApp();
  const { adminUserId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [companyStats, setCompanyStats] = useState<CompanyStats[]>([]);
  const [totalStats, setTotalStats] = useState({
    totalRevenue: 0,
    totalCosts: 0,
    totalProfit: 0,
    totalCompanies: 0,
  });

  useEffect(() => {
    if (!selectedCompany || !adminUserId || selectedCompany.companyType !== 'holding') {
      setLoading(false);
      return;
    }

    loadHoldingStatistics();
  }, [selectedCompany, adminUserId]);

  const loadHoldingStatistics = async () => {
    if (!adminUserId) return;

    setLoading(true);
    try {
      console.log('📊 Loading holding statistics...');

      // DEBUG: Laat alle companies zien met hun primaryEmployerId
      console.log('🔍 ALL COMPANIES DEBUG:');
      companies.forEach(c => {
        console.log(`  - ${c.name} (${c.companyType}): primaryEmployerId = ${c.primaryEmployerId || 'NONE'}, id = ${c.id}`);
      });
      console.log(`🎯 Current holding: ${selectedCompany.name} (id: ${selectedCompany.id})`);

      // Werkmaatschappijen ophalen:
      // 1. EERST: companies met primaryEmployerId === holding.id (expliciete link)
      // 2. FALLBACK: employer/project companies ZONDER primaryEmployerId (backwards compatibility)
      // 3. EXCLUDE: andere holdings (companyType === 'holding')
      const workCompanies = companies.filter(c => {
        // Skip de holding zelf
        if (c.id === selectedCompany.id) return false;

        // Skip andere holdings (dit zijn waarschijnlijk aandeelhouders zoals Sandebeheer/Carlibeheer)
        if (c.companyType === 'holding') return false;

        // User moet matchen
        if (c.userId !== adminUserId) return false;

        // Include als het expliciet linked is via primaryEmployerId
        if (c.primaryEmployerId === selectedCompany.id) return true;

        // FALLBACK: Include employer/project companies zonder primaryEmployerId (backwards compatibility)
        if (!c.primaryEmployerId && (c.companyType === 'employer' || c.companyType === 'project')) {
          return true;
        }

        return false;
      });

      console.log(`✅ Found ${workCompanies.length} work companies under ${selectedCompany.name}`);
      console.log(`📋 Companies: ${workCompanies.map(c => c.name).join(', ')}`);

      const stats: CompanyStats[] = [];

      for (const company of workCompanies) {
        console.log(`📈 Loading stats for: ${company.name} (${company.companyType})`);

        // Uitgaande facturen (ALLE statussen: concept, betaald, etc.)
        const outgoingQuery = query(
          collection(db, 'outgoingInvoices'),
          where('userId', '==', adminUserId),
          where('companyId', '==', company.id)
        );
        const outgoingSnap = await getDocs(outgoingQuery);
        let outgoingTotal = 0;
        const outgoingByStatus: Record<string, number> = {};
        outgoingSnap.forEach(doc => {
          const data = doc.data();
          const amount = data.totalAmount || 0;
          const status = data.status || 'unknown';
          outgoingTotal += amount;
          outgoingByStatus[status] = (outgoingByStatus[status] || 0) + 1;
        });
        console.log(`  💰 Outgoing: ${outgoingSnap.size} facturen, €${outgoingTotal.toFixed(2)}`);
        console.log(`     Status breakdown:`, outgoingByStatus);

        // Inkomende facturen (ALLE statussen: concept, betaald, etc.)
        const incomingQuery = query(
          collection(db, 'incomingInvoices'),
          where('userId', '==', adminUserId),
          where('companyId', '==', company.id)
        );
        const incomingSnap = await getDocs(incomingQuery);
        let incomingTotal = 0;
        const incomingByStatus: Record<string, number> = {};
        incomingSnap.forEach(doc => {
          const data = doc.data();
          const amount = data.totalAmount || 0;
          const status = data.status || 'unknown';
          incomingTotal += amount;
          incomingByStatus[status] = (incomingByStatus[status] || 0) + 1;
        });
        console.log(`  💸 Incoming: ${incomingSnap.size} facturen, €${incomingTotal.toFixed(2)}`);
        console.log(`     Status breakdown:`, incomingByStatus);

        // Budget items
        const budgetQuery = query(
          collection(db, 'budgetItems'),
          where('userId', '==', adminUserId),
          where('companyId', '==', company.id),
          where('isActive', '==', true)
        );
        const budgetSnap = await getDocs(budgetQuery);
        let monthlyCosts = 0;
        let monthlyIncome = 0;

        budgetSnap.forEach(doc => {
          const data = doc.data();
          const amount = data.amount || 0;
          let monthlyAmount = 0;

          // Bereken maandelijks bedrag
          switch (data.frequency) {
            case 'monthly':
              monthlyAmount = amount;
              break;
            case 'quarterly':
              monthlyAmount = amount / 3;
              break;
            case 'yearly':
              monthlyAmount = amount / 12;
              break;
          }

          if (data.type === 'cost') {
            monthlyCosts += monthlyAmount;
          } else if (data.type === 'income') {
            monthlyIncome += monthlyAmount;
          }
        });

        const profit = outgoingTotal - incomingTotal;

        stats.push({
          companyId: company.id,
          companyName: company.name,
          companyType: company.companyType,
          outgoingInvoicesCount: outgoingSnap.size,
          outgoingInvoicesTotal: outgoingTotal,
          incomingInvoicesCount: incomingSnap.size,
          incomingInvoicesTotal: incomingTotal,
          budgetCostsMonthly: monthlyCosts,
          budgetIncomeMonthly: monthlyIncome,
          profit,
        });

        console.log(`✓ ${company.name}: €${outgoingTotal.toFixed(2)} revenue, €${incomingTotal.toFixed(2)} costs`);
      }

      setCompanyStats(stats);

      // Totalen berekenen
      const totalRevenue = stats.reduce((sum, s) => sum + s.outgoingInvoicesTotal, 0);
      const totalCosts = stats.reduce((sum, s) => sum + s.incomingInvoicesTotal, 0);
      const totalProfit = totalRevenue - totalCosts;

      setTotalStats({
        totalRevenue,
        totalCosts,
        totalProfit,
        totalCompanies: stats.length,
      });

      console.log(`💰 Total: €${totalRevenue.toFixed(2)} revenue, €${totalCosts.toFixed(2)} costs, €${totalProfit.toFixed(2)} profit`);
    } catch (error) {
      console.error('❌ Error loading holding statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!selectedCompany) {
    return (
      <div className="p-6">
        <p className="text-gray-500">Selecteer een holding bedrijf om statistieken te bekijken.</p>
      </div>
    );
  }

  if (selectedCompany.companyType !== 'holding') {
    return (
      <div className="p-6">
        <p className="text-gray-500">Deze pagina is alleen beschikbaar voor holding bedrijven.</p>
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

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

  // Data voor charts
  const revenueChartData = companyStats.map(s => ({
    name: s.companyName,
    omzet: s.outgoingInvoicesTotal,
    kosten: s.incomingInvoicesTotal,
  }));

  const profitChartData = companyStats
    .filter(s => s.profit !== 0)
    .map(s => ({
      name: s.companyName,
      value: s.profit,
    }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Holding Statistieken</h1>
        <p className="text-gray-600 mt-1">Overzicht van alle bedrijven onder {selectedCompany.name}</p>
      </div>

      {/* Totalen Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Totale Omzet</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                €{totalStats.totalRevenue.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-600" />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Totale Kosten</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                €{totalStats.totalCosts.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <TrendingDown className="h-8 w-8 text-red-600" />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Totale Winst</p>
              <p className={`text-2xl font-bold mt-1 ${totalStats.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                €{totalStats.totalProfit.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <Euro className={`h-8 w-8 ${totalStats.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`} />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Aantal Bedrijven</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{totalStats.totalCompanies}</p>
            </div>
            <Building2 className="h-8 w-8 text-blue-600" />
          </div>
        </Card>
      </div>

      {/* Omzet vs Kosten per Bedrijf */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Omzet vs Kosten per Bedrijf</h2>
        {revenueChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={revenueChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis tickFormatter={(value) => `€${value.toLocaleString('nl-NL')}`} />
              <Tooltip formatter={(value) => `€${Number(value).toLocaleString('nl-NL')}`} />
              <Legend />
              <Bar dataKey="omzet" fill="#10B981" name="Omzet" />
              <Bar dataKey="kosten" fill="#EF4444" name="Kosten" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-gray-500 text-center py-8">Geen data beschikbaar</p>
        )}
      </Card>

      {/* Winst Distributie */}
      {profitChartData.length > 0 && (
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Winst Distributie</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={profitChartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={(entry) => `${entry.name}: €${entry.value.toLocaleString('nl-NL')}`}
              >
                {profitChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `€${Number(value).toLocaleString('nl-NL')}`} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Details Tabel */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Bedrijven Overzicht</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bedrijf
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Omzet
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Kosten
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Budget (mnd)
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Winst
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {companyStats.map((stat) => (
                <tr key={stat.companyId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {stat.companyName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      stat.companyType === 'employer' ? 'bg-blue-100 text-blue-800' :
                      stat.companyType === 'project' ? 'bg-purple-100 text-purple-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {stat.companyType === 'employer' ? 'Werkgever' :
                       stat.companyType === 'project' ? 'Project' : 'Holding'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600 font-medium">
                    €{stat.outgoingInvoicesTotal.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                    <span className="text-gray-400 ml-2">({stat.outgoingInvoicesCount})</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600 font-medium">
                    €{stat.incomingInvoicesTotal.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                    <span className="text-gray-400 ml-2">({stat.incomingInvoicesCount})</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-600">
                    <span className="text-red-600">-€{stat.budgetCostsMonthly.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}</span>
                    {stat.budgetIncomeMonthly > 0 && (
                      <span className="text-green-600 ml-2">+€{stat.budgetIncomeMonthly.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}</span>
                    )}
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-bold ${
                    stat.profit >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    €{stat.profit.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default HoldingStatistics;
