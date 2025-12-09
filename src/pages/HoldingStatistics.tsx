import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import {
  Building2, DollarSign, TrendingUp, TrendingDown, Wallet, PieChart as PieChartIcon
} from 'lucide-react';
import Card from '../components/ui/Card';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface CompanyStats {
  id: string;
  name: string;
  revenue: number;
  costs: number;
  margin: number;
  marginPercentage: number;
}

const HoldingStatistics: React.FC = () => {
  const { user, userRole, adminUserId } = useAuth();
  const { selectedCompany, companies } = useApp();
  const [loading, setLoading] = useState(true);
  const [companyStats, setCompanyStats] = useState<CompanyStats[]>([]);
  const [stats, setStats] = useState({
    totalCompanies: 0,
    totalRevenue: 0,
    totalCosts: 0,
    totalMargin: 0,
    avgMarginPercentage: 0,
  });

  useEffect(() => {
    if (selectedCompany && adminUserId) {
      loadStatistics();
    }
  }, [selectedCompany, adminUserId, companies]);

  const loadStatistics = async () => {
    if (!selectedCompany || !adminUserId) return;

    try {
      setLoading(true);

      const companyStatsMap = new Map<string, CompanyStats>();
      let totalRevenue = 0;
      let totalCosts = 0;

      for (const company of companies || []) {
        const outgoingSnap = await getDocs(
          query(
            collection(db, 'outgoingInvoices'),
            where('userId', '==', adminUserId),
            where('companyId', '==', company.id)
          )
        );

        const revenue = outgoingSnap.docs.reduce((sum, doc) => sum + (doc.data().totalAmount || 0), 0);

        const incomingSnap = await getDocs(
          query(
            collection(db, 'incomingInvoices'),
            where('userId', '==', adminUserId),
            where('companyId', '==', company.id)
          )
        );

        const costs = incomingSnap.docs.reduce((sum, doc) => sum + (doc.data().amount || 0), 0);

        const margin = revenue - costs;
        const marginPercentage = revenue > 0 ? (margin / revenue) * 100 : 0;

        companyStatsMap.set(company.id, {
          id: company.id,
          name: company.name,
          revenue,
          costs,
          margin,
          marginPercentage,
        });

        totalRevenue += revenue;
        totalCosts += costs;
      }

      const companyStatsList = Array.from(companyStatsMap.values()).sort((a, b) => b.revenue - a.revenue);
      const totalMargin = totalRevenue - totalCosts;
      const avgMarginPercentage = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;

      setCompanyStats(companyStatsList);
      setStats({
        totalCompanies: companyStatsList.length,
        totalRevenue,
        totalCosts,
        totalMargin,
        avgMarginPercentage,
      });
    } catch (error) {
      console.error('Error loading statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

  if (!selectedCompany) {
    return (
      <div className="p-6">
        <p className="text-gray-600">Selecteer eerst een holding bedrijf om statistieken te bekijken.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Holding Statistieken</h1>
        <p className="text-gray-600 mt-1">{selectedCompany.name}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Bedrijven</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalCompanies}</p>
            </div>
            <Building2 className="h-10 w-10 text-blue-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Totale Omzet</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">€{(stats.totalRevenue / 1000).toFixed(0)}k</p>
            </div>
            <TrendingUp className="h-10 w-10 text-green-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Totale Kosten</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">€{(stats.totalCosts / 1000).toFixed(0)}k</p>
            </div>
            <TrendingDown className="h-10 w-10 text-red-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Totale Marge</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">€{(stats.totalMargin / 1000).toFixed(0)}k</p>
              <p className="text-xs text-gray-500 mt-1">{stats.avgMarginPercentage.toFixed(1)}%</p>
            </div>
            <Wallet className="h-10 w-10 text-purple-500" />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Omzet per Bedrijf</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={companyStats}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip formatter={(value) => \`€\${Number(value).toLocaleString('nl-NL')}\`} />
              <Legend />
              <Bar dataKey="revenue" fill="#10B981" name="Omzet" />
              <Bar dataKey="costs" fill="#EF4444" name="Kosten" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Omzet Verdeling</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={companyStats}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => \`\${name}: \${(percent * 100).toFixed(0)}%\`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="revenue"
              >
                {companyStats.map((entry, index) => (
                  <Cell key={\`cell-\${index}\`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => \`€\${Number(value).toLocaleString('nl-NL')}\`} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Bedrijf Details</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bedrijf
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Omzet
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Kosten
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Marge
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Marge %
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {companyStats.map((company) => (
                <tr key={company.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {company.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    €{company.revenue.toLocaleString('nl-NL')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    €{company.costs.toLocaleString('nl-NL')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={company.margin >= 0 ? 'text-green-600' : 'text-red-600'}>
                      €{company.margin.toLocaleString('nl-NL')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={company.marginPercentage >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {company.marginPercentage.toFixed(1)}%
                    </span>
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
