import React, { useEffect, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Users, Clock, Euro, TrendingUp, Calendar, HeartPulse, Receipt } from 'lucide-react';
import Card from '../components/ui/Card';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line, LineChart, PieChart, Pie, Cell } from 'recharts';

const EmployerStatistics: React.FC = () => {
  const { selectedCompany, employees } = useApp();
  const { adminUserId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalEmployees: 0,
    activeEmployees: 0,
    totalHours: 0,
    totalOvertime: 0,
    totalGrossPay: 0,
    totalSickDays: 0,
    totalLeaveRequests: 0,
    totalRevenue: 0,
    totalCosts: 0,
  });
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [employeeHoursData, setEmployeeHoursData] = useState<any[]>([]);

  useEffect(() => {
    if (!selectedCompany || !adminUserId || selectedCompany.companyType !== 'employer') {
      setLoading(false);
      return;
    }

    loadEmployerStatistics();
  }, [selectedCompany, adminUserId]);

  const loadEmployerStatistics = async () => {
    if (!adminUserId || !selectedCompany) return;

    setLoading(true);
    try {
      console.log('📊 Loading employer statistics...');

      // Werknemers voor dit bedrijf
      const companyEmployees = employees.filter(
        e => e.companyId === selectedCompany.id || e.userId === adminUserId
      );
      const activeEmps = companyEmployees.filter(e => e.status === 'active');

      // Time entries (uren registraties) - Load all hours for this company's employees
      const timeEntriesQuery = query(
        collection(db, 'timeEntries'),
        where('companyId', '==', selectedCompany.id)
      );
      const timeEntriesSnap = await getDocs(timeEntriesQuery);
      let totalHours = 0;
      let totalOvertime = 0;
      const employeeHoursMap = new Map<string, number>();

      timeEntriesSnap.forEach(doc => {
        const data = doc.data();
        const hours = (data.regularHours || 0) + (data.overtimeHours || 0);
        totalHours += data.regularHours || 0;
        totalOvertime += data.overtimeHours || 0;

        if (data.employeeId) {
          employeeHoursMap.set(
            data.employeeId,
            (employeeHoursMap.get(data.employeeId) || 0) + hours
          );
        }
      });

      // Payroll (loonberekeningen)
      const payrollQuery = query(
        collection(db, 'payrollCalculations'),
        where('userId', '==', adminUserId)
      );
      const payrollSnap = await getDocs(payrollQuery);
      let totalGrossPay = 0;
      payrollSnap.forEach(doc => {
        const data = doc.data();
        totalGrossPay += data.grossPay || 0;
      });

      // Sick leave (ziekteverzuim)
      const sickLeaveQuery = query(
        collection(db, 'sickLeave'),
        where('userId', '==', adminUserId)
      );
      const sickLeaveSnap = await getDocs(sickLeaveQuery);
      let totalSickDays = 0;
      sickLeaveSnap.forEach(doc => {
        const data = doc.data();
        if (data.startDate && data.endDate) {
          const start = data.startDate.toDate ? data.startDate.toDate() : new Date(data.startDate);
          const end = data.endDate.toDate ? data.endDate.toDate() : new Date(data.endDate);
          const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
          totalSickDays += days;
        }
      });

      // Leave requests (verlofaanvragen)
      const leaveQuery = query(
        collection(db, 'leaveRequests'),
        where('userId', '==', adminUserId)
      );
      const leaveSnap = await getDocs(leaveQuery);

      // Outgoing invoices (omzet)
      const outgoingQuery = query(
        collection(db, 'outgoingInvoices'),
        where('userId', '==', adminUserId),
        where('companyId', '==', selectedCompany.id)
      );
      const outgoingSnap = await getDocs(outgoingQuery);
      let totalRevenue = 0;
      const monthlyRevenueMap = new Map<string, number>();

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

      setStats({
        totalEmployees: companyEmployees.length,
        activeEmployees: activeEmps.length,
        totalHours,
        totalOvertime,
        totalGrossPay,
        totalSickDays,
        totalLeaveRequests: leaveSnap.size,
        totalRevenue,
        totalCosts,
      });

      // Maandelijkse data voor chart
      const allMonthKeys = new Set([
        ...Array.from(monthlyRevenueMap.keys()),
        ...Array.from(monthlyCostsMap.keys()),
      ]);
      const monthlyChartData = Array.from(allMonthKeys)
        .sort()
        .map(monthKey => ({
          month: monthKey,
          omzet: monthlyRevenueMap.get(monthKey) || 0,
          kosten: monthlyCostsMap.get(monthKey) || 0,
        }));
      setMonthlyData(monthlyChartData);

      // Uren per werknemer
      const empHoursData = companyEmployees
        .map(emp => ({
          name: `${emp.personalInfo?.firstName || ''} ${emp.personalInfo?.lastName || ''}`.trim() || 'Onbekend',
          uren: employeeHoursMap.get(emp.id) || 0,
        }))
        .filter(e => e.uren > 0)
        .sort((a, b) => b.uren - a.uren)
        .slice(0, 10);
      setEmployeeHoursData(empHoursData);

      console.log('✅ Statistics loaded successfully');
    } catch (error) {
      console.error('❌ Error loading employer statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!selectedCompany) {
    return (
      <div className="p-6">
        <p className="text-gray-500 dark:text-gray-400">Selecteer een employer bedrijf om statistieken te bekijken.</p>
      </div>
    );
  }

  if (selectedCompany.companyType !== 'employer') {
    return (
      <div className="p-6">
        <p className="text-gray-500 dark:text-gray-400">Deze pagina is alleen beschikbaar voor employer bedrijven.</p>
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

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
  const profit = stats.totalRevenue - stats.totalCosts;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Employer Statistieken</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Overzicht van {selectedCompany.name}</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Werknemers</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{stats.activeEmployees}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">van {stats.totalEmployees} totaal</p>
            </div>
            <Users className="h-8 w-8 text-blue-600" />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Totaal Uren</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                {stats.totalHours.toLocaleString('nl-NL')}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {stats.totalOvertime > 0 && `+${stats.totalOvertime.toFixed(0)} overuren`}
              </p>
            </div>
            <Clock className="h-8 w-8 text-purple-600" />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Loonkosten</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                €{stats.totalGrossPay.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <Euro className="h-8 w-8 text-green-600" />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Ziekteverzuim</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{stats.totalSickDays}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">dagen totaal</p>
            </div>
            <HeartPulse className="h-8 w-8 text-red-600" />
          </div>
        </Card>
      </div>

      {/* Financiële Overzicht */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Totale Omzet</p>
            <p className="text-2xl font-bold text-green-600 mt-1">
              €{stats.totalRevenue.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </Card>

        <Card>
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Totale Kosten</p>
            <p className="text-2xl font-bold text-red-600 mt-1">
              €{stats.totalCosts.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </Card>

        <Card>
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Winst</p>
            <p className={`text-2xl font-bold mt-1 ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              €{profit.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </Card>
      </div>

      {/* Maandelijkse Omzet vs Kosten */}
      {monthlyData.length > 0 && (
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Maandelijkse Omzet vs Kosten</h2>
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

      {/* Top 10 Werknemers (Uren) */}
      {employeeHoursData.length > 0 && (
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Top 10 Werknemers (Gewerkte Uren)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={employeeHoursData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="uren" fill="#3B82F6" name="Uren" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Verlof Statistieken */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Verlof & Verzuim Overzicht</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Verlofaanvragen</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-2">{stats.totalLeaveRequests}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Ziektedagen</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-2">{stats.totalSickDays}</p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default EmployerStatistics;
