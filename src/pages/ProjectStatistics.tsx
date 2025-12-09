import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import {
  Factory, Clock, DollarSign, TrendingUp, Users, Package, Calendar
} from 'lucide-react';
import Card from '../components/ui/Card';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface ProductionStats {
  employeeName: string;
  totalHours: number;
  invoicedHours: number;
  difference: number;
}

const ProjectStatistics: React.FC = () => {
  const { user, userRole, adminUserId } = useAuth();
  const { selectedCompany } = useApp();
  const [loading, setLoading] = useState(true);
  const [productionStats, setProductionStats] = useState<ProductionStats[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalProductionHours: 0,
    totalInvoicedHours: 0,
    totalRevenue: 0,
    averageHourlyRate: 0,
    activeEmployees: 0,
    completedProjects: 0,
  });

  useEffect(() => {
    if (selectedCompany && adminUserId) {
      loadStatistics();
    }
  }, [selectedCompany, adminUserId]);

  const loadStatistics = async () => {
    if (!selectedCompany || !adminUserId) return;

    try {
      setLoading(true);

      const employeesSnap = await getDocs(
        query(
          collection(db, 'employees'),
          where('userId', '==', adminUserId),
          where('companyId', '==', selectedCompany.id)
        )
      );

      const employees = employeesSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const timeEntriesSnap = await getDocs(
        query(
          collection(db, 'timeEntries'),
          where('userId', '==', adminUserId),
          where('companyId', '==', selectedCompany.id)
        )
      );

      const productionStatsMap = new Map<string, ProductionStats>();
      let totalHours = 0;

      timeEntriesSnap.docs.forEach(doc => {
        const entry = doc.data();
        const employeeId = entry.employeeId;
        const hours = entry.hours || 0;
        totalHours += hours;

        if (!productionStatsMap.has(employeeId)) {
          const employee = employees.find(e => e.id === employeeId);
          productionStatsMap.set(employeeId, {
            employeeName: employee ? `${employee.firstName} ${employee.lastName}` : 'Onbekend',
            totalHours: 0,
            invoicedHours: 0,
            difference: 0,
          });
        }

        const stats = productionStatsMap.get(employeeId)!;
        stats.totalHours += hours;
        stats.invoicedHours += hours;
      });

      const outgoingInvoicesSnap = await getDocs(
        query(
          collection(db, 'outgoingInvoices'),
          where('userId', '==', adminUserId),
          where('companyId', '==', selectedCompany.id)
        )
      );

      const totalRevenue = outgoingInvoicesSnap.docs.reduce((sum, doc) => {
        return sum + (doc.data().totalAmount || 0);
      }, 0);

      const monthlyDataMap = new Map<string, { month: string; hours: number; revenue: number }>();
      const now = new Date();

      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = date.toLocaleDateString('nl-NL', { month: 'short', year: '2-digit' });
        monthlyDataMap.set(monthKey, { month: monthKey, hours: 0, revenue: 0 });
      }

      const productionStatsList = Array.from(productionStatsMap.values());
      const avgRate = totalHours > 0 ? totalRevenue / totalHours : 0;

      setProductionStats(productionStatsList);
      setMonthlyData(Array.from(monthlyDataMap.values()));
      setStats({
        totalProductionHours: totalHours,
        totalInvoicedHours: totalHours,
        totalRevenue,
        averageHourlyRate: avgRate,
        activeEmployees: employees.length,
        completedProjects: outgoingInvoicesSnap.size,
      });
    } catch (error) {
      console.error('Error loading statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!selectedCompany) {
    return (
      <div className="p-6">
        <p className="text-gray-600">Selecteer eerst een project bedrijf om statistieken te bekijken.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Project Statistieken</h1>
        <p className="text-gray-600 mt-1">{selectedCompany.name}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Productie Uren</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{Math.round(stats.totalProductionHours)}</p>
            </div>
            <Clock className="h-10 w-10 text-blue-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Gefactureerd</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{Math.round(stats.totalInvoicedHours)}h</p>
            </div>
            <DollarSign className="h-10 w-10 text-green-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Omzet</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">€{(stats.totalRevenue / 1000).toFixed(1)}k</p>
            </div>
            <TrendingUp className="h-10 w-10 text-emerald-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Gem. Uurtarief</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">€{stats.averageHourlyRate.toFixed(2)}</p>
            </div>
            <Factory className="h-10 w-10 text-purple-500" />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Maandelijkse Productie (6m)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="hours" stroke="#3B82F6" name="Uren" strokeWidth={2} />
              <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#10B981" name="Omzet (€)" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Productie per Medewerker (Top 8)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={productionStats.slice(0, 8)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="employeeName" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="totalHours" fill="#3B82F6" name="Productie Uren" />
              <Bar dataKey="invoicedHours" fill="#10B981" name="Gefactureerd" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-sm text-gray-600">Actieve Medewerkers</p>
              <p className="text-xl font-bold text-gray-900">{stats.activeEmployees}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Package className="h-8 w-8 text-purple-500" />
            <div>
              <p className="text-sm text-gray-600">Facturen</p>
              <p className="text-xl font-bold text-gray-900">{stats.completedProjects}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Calendar className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-sm text-gray-600">Efficiency</p>
              <p className="text-xl font-bold text-gray-900">
                {stats.totalProductionHours > 0 ? ((stats.totalInvoicedHours / stats.totalProductionHours) * 100).toFixed(0) : 0}%
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ProjectStatistics;
