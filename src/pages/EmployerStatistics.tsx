import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import {
  Users, Clock, DollarSign, TrendingUp, TrendingDown,
  Calendar, Building2, UserCheck, Package
} from 'lucide-react';
import Card from '../components/ui/Card';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface EmployeeStats {
  id: string;
  name: string;
  totalHours: number;
  productionHours: number;
  difference: number;
  efficiency: number;
}

const EmployerStatistics: React.FC = () => {
  const { user, userRole, adminUserId } = useAuth();
  const { selectedCompany } = useApp();
  const [loading, setLoading] = useState(true);
  const [employeeStats, setEmployeeStats] = useState<EmployeeStats[]>([]);
  const [stats, setStats] = useState({
    totalEmployees: 0,
    totalHoursWorked: 0,
    totalProductionHours: 0,
    averageEfficiency: 0,
    totalRevenue: 0,
    totalCosts: 0,
    totalClients: 0,
    totalSuppliers: 0,
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

      // Load employees
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

      // Load time entries (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const timeEntriesSnap = await getDocs(
        query(
          collection(db, 'timeEntries'),
          where('userId', '==', adminUserId),
          where('companyId', '==', selectedCompany.id)
        )
      );

      // Calculate employee stats
      const employeeStatsMap = new Map<string, EmployeeStats>();

      timeEntriesSnap.docs.forEach(doc => {
        const entry = doc.data();
        const employeeId = entry.employeeId;
        const hours = entry.hours || 0;

        if (!employeeStatsMap.has(employeeId)) {
          const employee = employees.find(e => e.id === employeeId);
          employeeStatsMap.set(employeeId, {
            id: employeeId,
            name: employee ? `${employee.firstName} ${employee.lastName}` : 'Onbekend',
            totalHours: 0,
            productionHours: 0,
            difference: 0,
            efficiency: 0,
          });
        }

        const stats = employeeStatsMap.get(employeeId)!;
        stats.totalHours += hours;
      });

      // Load outgoing invoices for revenue
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

      // Load incoming invoices for costs
      const incomingInvoicesSnap = await getDocs(
        query(
          collection(db, 'incomingInvoices'),
          where('userId', '==', adminUserId),
          where('companyId', '==', selectedCompany.id)
        )
      );

      const totalCosts = incomingInvoicesSnap.docs.reduce((sum, doc) => {
        return sum + (doc.data().amount || 0);
      }, 0);

      // Load invoice relations
      const relationsSnap = await getDocs(
        query(
          collection(db, 'invoiceRelations'),
          where('userId', '==', adminUserId),
          where('companyId', '==', selectedCompany.id)
        )
      );

      const employeeStatsList = Array.from(employeeStatsMap.values());
      const totalHours = employeeStatsList.reduce((sum, e) => sum + e.totalHours, 0);

      setEmployeeStats(employeeStatsList);
      setStats({
        totalEmployees: employees.length,
        totalHoursWorked: totalHours,
        totalProductionHours: totalHours, // In real app, calculate from production data
        averageEfficiency: totalHours > 0 ? 100 : 0,
        totalRevenue,
        totalCosts,
        totalClients: relationsSnap.size,
        totalSuppliers: relationsSnap.size,
      });
    } catch (error) {
      console.error('Error loading statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

  if (!selectedCompany) {
    return (
      <div className="p-6">
        <p className="text-gray-600">Selecteer eerst een bedrijf om statistieken te bekijken.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Statistieken</h1>
        <p className="text-gray-600 mt-1">{selectedCompany.name}</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Werknemers</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalEmployees}</p>
            </div>
            <Users className="h-10 w-10 text-blue-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Gewerkte Uren (30d)</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{Math.round(stats.totalHoursWorked)}</p>
            </div>
            <Clock className="h-10 w-10 text-green-500" />
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
              <p className="text-sm text-gray-600">Kosten</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">€{(stats.totalCosts / 1000).toFixed(1)}k</p>
            </div>
            <TrendingDown className="h-10 w-10 text-red-500" />
          </div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Uren per Medewerker (Top 10)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={employeeStats.slice(0, 10)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="totalHours" fill="#3B82F6" name="Gewerkte Uren" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Omzet vs Kosten</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={[
                  { name: 'Omzet', value: stats.totalRevenue },
                  { name: 'Kosten', value: stats.totalCosts },
                ]}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {[0, 1].map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `€${Number(value).toLocaleString('nl-NL')}`} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Employee Details Table */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Medewerker Details</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Naam
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Gewerkte Uren
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Productie Uren
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Verschil
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Efficiëntie
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {employeeStats.map((employee) => (
                <tr key={employee.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {employee.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {employee.totalHours.toFixed(1)}h
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {employee.productionHours.toFixed(1)}h
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className={employee.difference >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {employee.difference > 0 ? '+' : ''}{employee.difference.toFixed(1)}h
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {employee.efficiency.toFixed(0)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <UserCheck className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-sm text-gray-600">Klanten</p>
              <p className="text-xl font-bold text-gray-900">{stats.totalClients}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Package className="h-8 w-8 text-purple-500" />
            <div>
              <p className="text-sm text-gray-600">Leveranciers</p>
              <p className="text-xl font-bold text-gray-900">{stats.totalSuppliers}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-sm text-gray-600">Marge</p>
              <p className="text-xl font-bold text-gray-900">
                €{((stats.totalRevenue - stats.totalCosts) / 1000).toFixed(1)}k
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default EmployerStatistics;
