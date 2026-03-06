import React, { useEffect, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Users, Clock, Euro, TrendingUp, HeartPulse, AlertTriangle } from 'lucide-react';
import Card from '../components/ui/Card';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line, LineChart } from 'recharts';
import { usePageTitle } from '../contexts/PageTitleContext';

const AVERAGE_MONTHLY_COST_PER_EMPLOYEE = 3000;

const formatCurrency = (amount: number): string => {
  if (Math.abs(amount) >= 100000) {
    return `€${(amount / 1000).toFixed(0)}k`;
  }
  return `€${amount.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const EmployerStatistics: React.FC = () => {
  const { selectedCompany, employees } = useApp();
  const { adminUserId } = useAuth();
  usePageTitle('Employer Statistieken');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalEmployees: 0,
    activeEmployees: 0,
    totalHours: 0,
    totalOvertime: 0,
    estimatedMonthlyPayroll: 0,
    totalSickDays: 0,
    activeSickCount: 0,
    sickPercentage: 0,
    totalLeaveRequests: 0,
    approvedLeave: 0,
    totalRevenue: 0,
    totalCosts: 0,
  });
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [employeeHoursData, setEmployeeHoursData] = useState<any[]>([]);
  const [sickEmployees, setSickEmployees] = useState<any[]>([]);

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
      // Werknemers voor dit bedrijf
      const companyEmployees = employees.filter(
        e => e.companyId === selectedCompany.id || e.userId === adminUserId
      );
      const activeEmps = companyEmployees.filter(e => e.status === 'active');

      // Loonkosten: gemiddeld €3k per actieve medewerker per maand
      const estimatedMonthlyPayroll = activeEmps.length * AVERAGE_MONTHLY_COST_PER_EMPLOYEE;

      // Time entries (uren registraties)
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

      // Sick leave (ziekteverzuim) - filter op companyId
      const sickLeaveQuery = query(
        collection(db, 'sickLeave'),
        where('userId', '==', adminUserId)
      );
      const sickLeaveSnap = await getDocs(sickLeaveQuery);
      let totalSickDays = 0;
      let activeSickCount = 0;
      const sickEmpList: any[] = [];
      const now = new Date();

      sickLeaveSnap.forEach(doc => {
        const data = doc.data();
        // Filter op companyId
        if (data.companyId !== selectedCompany.id) return;

        const start = data.startDate?.toDate ? data.startDate.toDate() : new Date(data.startDate);
        const end = data.endDate
          ? (data.endDate?.toDate ? data.endDate.toDate() : new Date(data.endDate))
          : now;
        const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
        totalSickDays += days;

        if (data.status === 'active' || data.status === 'partially_recovered') {
          activeSickCount++;
          const emp = companyEmployees.find(e => e.id === data.employeeId);
          sickEmpList.push({
            id: doc.id,
            employeeName: emp
              ? `${emp.personalInfo?.firstName || ''} ${emp.personalInfo?.lastName || ''}`.trim()
              : 'Onbekend',
            startDate: start,
            days: Math.max(1, Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1),
            status: data.status,
            capacity: data.workCapacityPercentage || 0,
          });
        }
      });

      setSickEmployees(sickEmpList.sort((a, b) => b.days - a.days));

      // Ziekteverzuim percentage: actief ziek / totaal actieve medewerkers
      const sickPercentage = activeEmps.length > 0
        ? (activeSickCount / activeEmps.length) * 100
        : 0;

      // Leave requests (verlofaanvragen) - filter op companyId
      const leaveQuery = query(
        collection(db, 'leaveRequests'),
        where('userId', '==', adminUserId)
      );
      const leaveSnap = await getDocs(leaveQuery);
      let totalLeaveRequests = 0;
      let approvedLeave = 0;
      leaveSnap.forEach(doc => {
        const data = doc.data();
        if (data.companyId !== selectedCompany.id) return;
        totalLeaveRequests++;
        if (data.status === 'approved') approvedLeave++;
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
        estimatedMonthlyPayroll,
        totalSickDays,
        activeSickCount,
        sickPercentage,
        totalLeaveRequests,
        approvedLeave,
        totalRevenue,
        totalCosts,
      });

      // Maandelijkse data voor chart - inclusief loonkosten lijn
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
          loonkosten: estimatedMonthlyPayroll,
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
    } catch (error) {
      console.error('Error loading employer statistics:', error);
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

  const profit = stats.totalRevenue - stats.totalCosts;

  return (
    <div className="space-y-6">
      <div className="hidden lg:block">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Employer Statistieken</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Overzicht van {selectedCompany.name}</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                {stats.totalOvertime > 0 ? `+${stats.totalOvertime.toFixed(0)} overuren` : 'geregistreerd'}
              </p>
            </div>
            <Clock className="h-8 w-8 text-purple-600" />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Loonkosten /mnd</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                {formatCurrency(stats.estimatedMonthlyPayroll)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                ~€{AVERAGE_MONTHLY_COST_PER_EMPLOYEE.toLocaleString('nl-NL')} p.p.
              </p>
            </div>
            <Euro className="h-8 w-8 text-green-600" />
          </div>
        </Card>

        <Card className={stats.sickPercentage > 5 ? 'border-red-300 dark:border-red-700' : ''}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Ziekteverzuim</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                {stats.sickPercentage.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {stats.activeSickCount} ziek • {stats.totalSickDays} dagen totaal
              </p>
            </div>
            <HeartPulse className={`h-8 w-8 ${stats.sickPercentage > 5 ? 'text-red-600' : 'text-orange-500'}`} />
          </div>
        </Card>
      </div>

      {/* Financieel Overzicht */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

      {/* Actief Zieke Medewerkers */}
      {sickEmployees.length > 0 && (
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Actief Zieke Medewerkers ({sickEmployees.length})
          </h2>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {sickEmployees.map((emp) => (
              <div key={emp.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{emp.employeeName}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Sinds {emp.startDate.toLocaleDateString('nl-NL')} • {emp.days} dagen
                    {emp.days > 42 && <span className="text-orange-600 font-medium ml-1">(Poortwachter)</span>}
                  </p>
                </div>
                <div className="text-right">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                    emp.status === 'active' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                    'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                  }`}>
                    {emp.status === 'active' ? 'Ziek' : 'Gedeeltelijk'}
                  </span>
                  {emp.capacity > 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{emp.capacity}% inzetbaar</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

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
              <Line type="monotone" dataKey="loonkosten" stroke="#F59E0B" name="Loonkosten" strokeWidth={2} strokeDasharray="5 5" />
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

      {/* Verlof Overzicht */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Verlof & Verzuim Overzicht</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{stats.totalLeaveRequests}</p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Verlofaanvragen</p>
          </div>
          <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <p className="text-2xl font-bold text-green-700 dark:text-green-400">{stats.approvedLeave}</p>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">Goedgekeurd</p>
          </div>
          <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <p className="text-2xl font-bold text-red-700 dark:text-red-400">{stats.totalSickDays}</p>
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">Ziektedagen</p>
          </div>
          <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
            <p className="text-2xl font-bold text-orange-700 dark:text-orange-400">{stats.activeSickCount}</p>
            <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">Nu ziek</p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default EmployerStatistics;
