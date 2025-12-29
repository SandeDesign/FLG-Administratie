import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Clock,
  AlertCircle,
  Calendar,
  CheckCircle,
  TrendingUp,
  ChevronRight,
  Bell,
  Briefcase,
  Send,
  HeartPulse,
  FileText,
  Download,
  Settings,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Target,
  Receipt,
  Euro,
  Upload,
  Wallet,
} from 'lucide-react';
import Card from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import {
  getPendingLeaveApprovals,
  getPendingExpenses,
  getSickLeaveRecords,
} from '../services/firebase';
import { getPendingTimesheets } from '../services/timesheetService';
import { getPayrollCalculations } from '../services/payrollService';

const Dashboard: React.FC = () => {
  const { employees, companies, loading, selectedCompany } = useApp();
  const { user, userRole, currentEmployeeId, adminUserId } = useAuth();
  const navigate = useNavigate();

  // ========== SHARED STATE ==========
  const [dashLoading, setDashLoading] = useState(false);
  const [pendingTimesheets, setPendingTimesheets] = useState<any[]>([]);
  const [pendingLeave, setPendingLeave] = useState<any[]>([]);
  const [pendingExpenses, setPendingExpenses] = useState<any[]>([]);
  const [stats, setStats] = useState({
    activeEmployees: 0,
    approvedThisMonth: 0,
    pendingActions: 0,
    totalExpenses: 0,
    outgoingInvoices: 0,
    outgoingTotal: 0,
    incomingInvoices: 0,
    incomingTotal: 0,
  });
  const [projectStats, setProjectStats] = useState<any>(null);
  const [loadingProjectStats, setLoadingProjectStats] = useState(true);
  const [employeeStats, setEmployeeStats] = useState({
    pendingTimesheets: 0,
    approvedThisMonth: 0,
    nextPayday: null as Date | null,
  });
  const [holdingStats, setHoldingStats] = useState({
    outgoingInvoices: 0,
    incomingInvoices: 0,
    budgetItems: 0,
  });

  // ========== LOAD INVOICE STATS (All Companies) ==========
  const loadInvoiceStats = useCallback(async () => {
    if (!user || !adminUserId || !selectedCompany) return;

    try {
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      console.log('📊 Loading invoice stats for company:', selectedCompany.id);
      console.log('🔍 Start of month:', startOfMonth);

      // Uitgaande facturen (Verkoop)
      const outgoingQuery = query(
        collection(db, 'outgoingInvoices'),
        where('companyId', '==', selectedCompany.id)
      );
      const outgoingSnap = await getDocs(outgoingQuery);
      console.log('✅ Outgoing invoices total:', outgoingSnap.size);

      let outgoingCount = 0;
      let outgoingTotal = 0;
      let outgoingThisMonth = 0;
      let outgoingTotalThisMonth = 0;

      outgoingSnap.forEach(doc => {
        const data = doc.data();
        outgoingCount++;
        outgoingTotal += data.totalAmount || data.amount || 0;
        
        // Check if created this month
        const docDate = data.invoiceDate || data.createdAt;
        if (docDate) {
          const date = typeof docDate === 'string' ? new Date(docDate) : docDate.toDate?.() || docDate;
          if (date >= startOfMonth) {
            outgoingThisMonth++;
            outgoingTotalThisMonth += data.totalAmount || data.amount || 0;
          }
        }
      });

      // Inkomende facturen (Inkoop)
      const incomingQuery = query(
        collection(db, 'incomingInvoices'),
        where('companyId', '==', selectedCompany.id)
      );
      const incomingSnap = await getDocs(incomingQuery);
      console.log('✅ Incoming invoices total:', incomingSnap.size);

      let incomingCount = 0;
      let incomingTotal = 0;
      let incomingThisMonth = 0;
      let incomingTotalThisMonth = 0;

      incomingSnap.forEach(doc => {
        const data = doc.data();
        incomingCount++;
        incomingTotal += data.totalAmount || data.amount || 0;

        // Check if created this month
        const docDate = data.invoiceDate || data.createdAt;
        if (docDate) {
          const date = typeof docDate === 'string' ? new Date(docDate) : docDate.toDate?.() || docDate;
          if (date >= startOfMonth) {
            incomingThisMonth++;
            incomingTotalThisMonth += data.totalAmount || data.amount || 0;
          }
        }
      });

      console.log('💰 Outgoing stats:', { count: outgoingCount, total: outgoingTotal, thisMonth: outgoingThisMonth, totalThisMonth: outgoingTotalThisMonth });
      console.log('💰 Incoming stats:', { count: incomingCount, total: incomingTotal, thisMonth: incomingThisMonth, totalThisMonth: incomingTotalThisMonth });

      setStats(prev => ({
        ...prev,
        outgoingInvoices: outgoingCount, // Totaal aantal facturen, niet alleen deze maand
        outgoingTotal: outgoingTotalThisMonth,
        incomingInvoices: incomingCount, // Totaal aantal facturen, niet alleen deze maand
        incomingTotal: incomingTotalThisMonth,
      }));
    } catch (error) {
      console.error('❌ Error loading invoice stats:', error);
    }
  }, [user, selectedCompany]);

  // ========== LOAD HOLDING DATA ==========
  const loadHoldingData = useCallback(async () => {
    if (!user || !adminUserId || !selectedCompany || userRole !== 'admin') return;
    if (selectedCompany.companyType !== 'holding') return;

    setDashLoading(true);
    try {
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      console.log('🏢 Loading holding data for:', selectedCompany.name);

      // Uitgaande facturen deze maand
      const outgoingQuery = query(
        collection(db, 'outgoingInvoices'),
        where('companyId', '==', selectedCompany.id)
      );
      const outgoingSnap = await getDocs(outgoingQuery);

      let outgoingThisMonth = 0;
      outgoingSnap.forEach(doc => {
        const data = doc.data();
        const docDate = data.invoiceDate || data.createdAt;
        if (docDate) {
          const date = typeof docDate === 'string' ? new Date(docDate) : docDate.toDate?.() || docDate;
          if (date >= startOfMonth) {
            outgoingThisMonth++;
          }
        }
      });

      // Inkomende facturen deze maand
      const incomingQuery = query(
        collection(db, 'incomingInvoices'),
        where('companyId', '==', selectedCompany.id)
      );
      const incomingSnap = await getDocs(incomingQuery);

      let incomingThisMonth = 0;
      incomingSnap.forEach(doc => {
        const data = doc.data();
        const docDate = data.invoiceDate || data.createdAt;
        if (docDate) {
          const date = typeof docDate === 'string' ? new Date(docDate) : docDate.toDate?.() || docDate;
          if (date >= startOfMonth) {
            incomingThisMonth++;
          }
        }
      });

      // Budget items
      const budgetQuery = query(
        collection(db, 'budgetItems'),
        where('companyId', '==', selectedCompany.id),
        where('isActive', '==', true)
      );
      const budgetSnap = await getDocs(budgetQuery);

      console.log('✅ Holding stats:', { outgoing: outgoingThisMonth, incoming: incomingThisMonth, budget: budgetSnap.size });

      setHoldingStats({
        outgoingInvoices: outgoingThisMonth,
        incomingInvoices: incomingThisMonth,
        budgetItems: budgetSnap.size,
      });
    } catch (error) {
      console.error('❌ Error loading holding data:', error);
    } finally {
      setDashLoading(false);
    }
  }, [user, selectedCompany, userRole]);

  // ========== LOAD ADMIN DATA ==========
  const loadAdminData = useCallback(async () => {
    if (!user || !adminUserId || !selectedCompany || userRole !== 'admin') return;

    setDashLoading(true);
    try {
      // Pending timesheets
      const timesheets = await getPendingTimesheets(adminUserId, selectedCompany.id);
      setPendingTimesheets(timesheets.slice(0, 5));

      // Pending leave
      const leave = await getPendingLeaveApprovals(selectedCompany.id, adminUserId);
      setPendingLeave(leave.slice(0, 5));

      // Pending expenses
      try {
        const expenses = await getPendingExpenses(selectedCompany.id, adminUserId);
        setPendingExpenses(expenses.slice(0, 5));
        setStats((prev) => ({
          ...prev,
          totalExpenses: expenses.reduce((sum: number, exp: any) => sum + (exp.amount || 0), 0),
        }));
      } catch (error) {
        console.error('Error loading expenses:', error);
      }

      // Stats
      const activeEmps = employees?.filter((e: any) => e.status === 'active').length || 0;
      setStats((prev) => ({
        ...prev,
        activeEmployees: activeEmps,
        pendingActions: (timesheets.length || 0) + (leave.length || 0),
      }));

      // Load invoice stats
      await loadInvoiceStats();
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setDashLoading(false);
    }
  }, [user, selectedCompany, userRole, employees, loadInvoiceStats]);

  // ========== LOAD MANAGER DATA ==========
  const loadManagerData = useCallback(async () => {
    if (!user || !adminUserId || !selectedCompany || userRole !== 'manager') return;

    setDashLoading(true);
    try {
      const timesheets = await getPendingTimesheets(adminUserId, selectedCompany.id);
      setPendingTimesheets(timesheets.slice(0, 5));

      const leave = await getPendingLeaveApprovals(selectedCompany.id, adminUserId);
      setPendingLeave(leave.slice(0, 5));

      setStats((prev) => ({
        ...prev,
        pendingActions: (timesheets.length || 0) + (leave.length || 0),
      }));

      // Load invoice stats
      await loadInvoiceStats();
    } catch (error) {
      console.error('Error loading manager data:', error);
    } finally {
      setDashLoading(false);
    }
  }, [user, selectedCompany, userRole, loadInvoiceStats]);

  // ========== LOAD EMPLOYEE DATA ==========
  const loadEmployeeData = useCallback(async () => {
    if (!user || !adminUserId || !currentEmployeeId) return;

    setDashLoading(true);
    try {
      // Get payroll for this employee
      const payroll = await getPayrollCalculations(adminUserId, currentEmployeeId);
      // Use payroll data if needed
    } catch (error) {
      console.error('Error loading employee data:', error);
    } finally {
      setDashLoading(false);
    }
  }, [user, currentEmployeeId]);

  // ========== LOAD PROJECT DATA ==========
  useEffect(() => {
    const loadProjectStats = async () => {
      if (!user || !adminUserId || !selectedCompany || selectedCompany.companyType !== 'project') {
        console.log('🏭 Not a project company, skipping project stats');
        setLoadingProjectStats(false);
        return;
      }

      try {
        setLoadingProjectStats(true);
        console.log('🏭 Loading project stats for:', selectedCompany.name);

        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const { db } = await import('../lib/firebase');

        console.log('⏱️ Querying timeEntries for workCompanyId:', selectedCompany.id);
        const timeEntriesQuery = query(
          collection(db, 'timeEntries'),
          where('workCompanyId', '==', selectedCompany.id)
        );
        const timeEntriesSnap = await getDocs(timeEntriesQuery);
        console.log('⏱️ TimeEntries found:', timeEntriesSnap.size);

        let totalHours = 0;
        let totalOvertimeHours = 0;
        let totalWeekendHours = 0;
        const employeeIds = new Set();

        timeEntriesSnap.forEach(doc => {
          const data = doc.data();
          totalHours += data.regularHours || 0;
          totalOvertimeHours += data.overtimeHours || 0;
          totalWeekendHours += data.weekendHours || 0;
          if (data.employeeId) employeeIds.add(data.employeeId);
        });

        console.log('📊 Total hours:', totalHours);
        console.log('👥 Unique employees:', employeeIds.size);

        console.log('💰 Querying invoices for companyId:', selectedCompany.id);
        const invoicesQuery = query(
          collection(db, 'outgoingInvoices'),
          where('companyId', '==', selectedCompany.id)
        );
        const invoicesSnap = await getDocs(invoicesQuery);
        console.log('💰 Invoices found:', invoicesSnap.size);

        let totalRevenue = 0;
        invoicesSnap.forEach(doc => {
          const data = doc.data();
          if (data.status !== 'cancelled') {
            totalRevenue += data.totalAmount || data.amount || 0;
          }
        });

        console.log('💵 Total revenue:', totalRevenue);

        const stats = {
          totalHours,
          totalOvertimeHours,
          totalWeekendHours,
          totalRevenue,
          activeEmployees: employeeIds.size,
          revenuePerHour: totalHours > 0 ? totalRevenue / totalHours : 0,
        };

        console.log('✅ Project stats:', stats);
        setProjectStats(stats);

        // Also load invoice stats
        await loadInvoiceStats();
      } catch (error) {
        console.error('❌ Error loading project stats:', error);
      } finally {
        setLoadingProjectStats(false);
      }
    };

    loadProjectStats();
  }, [user, selectedCompany?.id, selectedCompany?.companyType, loadInvoiceStats]);

  // ========== LOAD EMPLOYEE STATS ==========
  useEffect(() => {
    const loadEmployeeStatsData = async () => {
      if (!user || !adminUserId || !currentEmployeeId || userRole !== 'employee') return;
      try {
        const payroll = await getPayrollCalculations(adminUserId, currentEmployeeId);
        if (payroll.length > 0) {
          setEmployeeStats((prev) => ({
            ...prev,
            approvedThisMonth: payroll.filter((p: any) => p.status === 'approved').length,
          }));
        }
      } catch (error) {
        console.error('Error loading employee stats:', error);
      }
    };
    loadEmployeeStatsData();
  }, [user, currentEmployeeId, userRole]);

  useEffect(() => {
    if (userRole === 'admin') {
      loadAdminData();
      if (selectedCompany?.companyType === 'holding') {
        loadHoldingData();
      }
    }
    if (userRole === 'manager') loadManagerData();
    if (userRole === 'employee') loadEmployeeData();
  }, [loadAdminData, loadManagerData, loadEmployeeData, loadHoldingData, userRole, selectedCompany?.companyType]);

  if (loading || dashLoading) {
    return <LoadingSpinner />;
  }

  if (!selectedCompany && userRole !== 'employee') {
    return (
      <div className="space-y-6 pb-24 sm:pb-6 px-4 sm:px-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Welkom!</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Laten we beginnen met je loonadministratie</p>
        </div>
        <EmptyState
          icon={Briefcase}
          title="Geen bedrijf geselecteerd"
          description="Selecteer een bedrijf uit de dropdown om aan de slag te gaan"
        />
      </div>
    );
  }

  const isProjectCompany = selectedCompany?.companyType === 'project';
  const isHoldingCompany = selectedCompany?.companyType === 'holding';
  const totalPending = pendingTimesheets.length + pendingLeave.length + pendingExpenses.length;

  // ========== HOLDING COMPANY DASHBOARD ==========
  if (isHoldingCompany && (userRole === 'admin' || userRole === 'manager')) {
    return (
      <div className="space-y-4 pb-24 sm:pb-6 px-4 sm:px-0">
        {/* Hero Header */}
        <div className="bg-gradient-to-br from-primary-600 via-primary-500 to-primary-700 rounded-xl p-6 text-white space-y-2">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold">Holding Dashboard</h1>
              <p className="text-primary-50 mt-1">{selectedCompany?.name}</p>
            </div>
            <Briefcase className="h-12 w-12 text-primary-100 opacity-50" />
          </div>
        </div>

        {/* Key Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-blue-700">Bedrijven</p>
                <p className="text-2xl font-bold text-blue-900 mt-2">{companies?.length || 0}</p>
                <p className="text-xs text-blue-600 mt-2">totaal</p>
              </div>
              <Briefcase className="h-8 w-8 text-blue-300" />
            </div>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-green-700">Verkoop</p>
                <p className="text-2xl font-bold text-green-900 mt-2">€{(stats.outgoingTotal / 1000).toFixed(1)}k</p>
                <p className="text-xs text-green-600 mt-2">{stats.outgoingInvoices} facturen</p>
              </div>
              <Send className="h-8 w-8 text-green-300" />
            </div>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-purple-700">Inkoop</p>
                <p className="text-2xl font-bold text-purple-900 mt-2">€{(stats.incomingTotal / 1000).toFixed(1)}k</p>
                <p className="text-xs text-purple-600 mt-2">{stats.incomingInvoices} facturen</p>
              </div>
              <Upload className="h-8 w-8 text-purple-300" />
            </div>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-orange-700">Marge</p>
                <p className="text-2xl font-bold text-orange-900 mt-2">€{((stats.outgoingTotal - stats.incomingTotal) / 1000).toFixed(1)}k</p>
                <p className="text-xs text-orange-600 mt-2">verschil</p>
              </div>
              <Wallet className="h-8 w-8 text-orange-300" />
            </div>
          </Card>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button
            onClick={() => navigate('/outgoing-invoices')}
            className="p-5 rounded-lg border-2 border-green-200 bg-green-50 hover:bg-green-100 transition-all group"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 bg-green-200 rounded-lg">
                <Send className="h-5 w-5 text-green-700" />
              </div>
              <ChevronRight className="h-5 w-5 text-green-400 group-hover:translate-x-1 transition-transform" />
            </div>
            <p className="font-semibold text-gray-900 dark:text-gray-100 text-left">Facturatie</p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 text-left">Uitgaande facturen</p>
          </button>

          <button
            onClick={() => navigate('/incoming-invoices')}
            className="p-5 rounded-lg border-2 border-purple-200 bg-purple-50 hover:bg-purple-100 transition-all group"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 bg-purple-200 rounded-lg">
                <Upload className="h-5 w-5 text-purple-700" />
              </div>
              <ChevronRight className="h-5 w-5 text-purple-400 group-hover:translate-x-1 transition-transform" />
            </div>
            <p className="font-semibold text-gray-900 dark:text-gray-100 text-left">Inkoop</p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 text-left">Inkomende facturen</p>
          </button>

          <button
            onClick={() => navigate('/budgeting')}
            className="p-5 rounded-lg border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 transition-all group"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 bg-blue-200 rounded-lg">
                <Wallet className="h-5 w-5 text-blue-700" />
              </div>
              <ChevronRight className="h-5 w-5 text-blue-400 group-hover:translate-x-1 transition-transform" />
            </div>
            <p className="font-semibold text-gray-900 dark:text-gray-100 text-left">Begroting</p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 text-left">Budget beheren</p>
          </button>
        </div>
      </div>
    );
  }

  // ========== PROJECT COMPANY DASHBOARD ==========
  if (isProjectCompany && (userRole === 'admin' || userRole === 'manager')) {
    if (loadingProjectStats) {
      return <LoadingSpinner />;
    }

    return (
      <div className="space-y-4 pb-24 sm:pb-6 px-4 sm:px-0">
        {/* Hero Header */}
        <div className="bg-gradient-to-br from-primary-600 via-primary-500 to-primary-700 rounded-xl p-6 text-white space-y-2">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold">WerkMaatschappij</h1>
              <p className="text-primary-100 mt-1">{selectedCompany?.name}</p>
            </div>
            <Briefcase className="h-12 w-12 text-primary-200 opacity-50" />
          </div>
        </div>

        {/* Alert Banner */}
        {totalPending > 0 && (
          <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-lg flex items-start gap-3">
            <Bell className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-orange-900">{totalPending} items wachten op actie</h3>
              <p className="text-xs text-orange-700 mt-1">
                {pendingTimesheets.length} uren • {pendingLeave.length} verlof • {pendingExpenses.length} onkosten
              </p>
            </div>
            <button
              onClick={() => {
                if (pendingTimesheets.length > 0) navigate('/timesheet-approvals');
                else if (pendingLeave.length > 0) navigate('/admin/leave-approvals');
              }}
              className="text-orange-600 hover:text-orange-700 font-semibold text-sm whitespace-nowrap"
            >
              Bekijk →
            </button>
          </div>
        )}

        {/* Project Stats */}
        {projectStats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-blue-700">Totale Uren</p>
                  <p className="text-2xl font-bold text-blue-900 mt-2">{projectStats.totalHours.toFixed(0)}</p>
                  <p className="text-xs text-blue-600 mt-2">geregistreerd</p>
                </div>
                <Clock className="h-8 w-8 text-blue-300" />
              </div>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 border-green-200">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-green-700">Omzet</p>
                  <p className="text-2xl font-bold text-green-900 mt-2">€{(projectStats.totalRevenue / 1000).toFixed(0)}k</p>
                  <p className="text-xs text-green-600 mt-2">totaal</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-300" />
              </div>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-purple-700">€/Uur</p>
                  <p className="text-2xl font-bold text-purple-900 mt-2">€{projectStats.revenuePerHour.toFixed(0)}</p>
                  <p className="text-xs text-purple-600 mt-2">gemiddeld</p>
                </div>
                <Euro className="h-8 w-8 text-purple-300" />
              </div>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-orange-700">Medewerkers</p>
                  <p className="text-2xl font-bold text-orange-900 mt-2">{projectStats.activeEmployees}</p>
                  <p className="text-xs text-orange-600 mt-2">actief</p>
                </div>
                <Users className="h-8 w-8 text-orange-300" />
              </div>
            </Card>
          </div>
        )}

        {/* Verkoop / Inkoop Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-green-700">Verkoop</p>
                <p className="text-xl font-bold text-green-900 mt-2">€{(stats.outgoingTotal / 1000).toFixed(1)}k</p>
                <p className="text-xs text-green-600 mt-2">{stats.outgoingInvoices} facturen</p>
              </div>
              <Send className="h-8 w-8 text-green-300" />
            </div>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-purple-700">Inkoop</p>
                <p className="text-xl font-bold text-purple-900 mt-2">€{(stats.incomingTotal / 1000).toFixed(1)}k</p>
                <p className="text-xs text-purple-600 mt-2">{stats.incomingInvoices} facturen</p>
              </div>
              <Upload className="h-8 w-8 text-purple-300" />
            </div>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-blue-700">Marge</p>
                <p className="text-xl font-bold text-blue-900 mt-2">€{((stats.outgoingTotal - stats.incomingTotal) / 1000).toFixed(1)}k</p>
                <p className="text-xs text-blue-600 mt-2">winst</p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-300" />
            </div>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-orange-700">Marges %</p>
                <p className="text-xl font-bold text-orange-900 mt-2">
                  {stats.outgoingTotal > 0 ? (((stats.outgoingTotal - stats.incomingTotal) / stats.outgoingTotal) * 100).toFixed(0) : 0}%
                </p>
                <p className="text-xs text-orange-600 mt-2">ratio</p>
              </div>
              <BarChart3 className="h-8 w-8 text-orange-300" />
            </div>
          </Card>
        </div>

        {/* Pending Actions */}
        {totalPending > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <Card
              className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate('/timesheet-approvals')}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-orange-700">Uren</p>
                  <p className="text-2xl font-bold text-orange-900 mt-2">{pendingTimesheets.length}</p>
                  <p className="text-xs text-orange-600 mt-2">wachten</p>
                </div>
                <div className="relative">
                  <Clock className="h-8 w-8 text-orange-300" />
                  {pendingTimesheets.length > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                      {pendingTimesheets.length}
                    </span>
                  )}
                </div>
              </div>
            </Card>

            <Card
              className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate('/admin/leave-approvals')}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-purple-700">Verlof</p>
                  <p className="text-2xl font-bold text-purple-900 mt-2">{pendingLeave.length}</p>
                  <p className="text-xs text-purple-600 mt-2">aanvragen</p>
                </div>
                <div className="relative">
                  <Calendar className="h-8 w-8 text-purple-300" />
                  {pendingLeave.length > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                      {pendingLeave.length}
                    </span>
                  )}
                </div>
              </div>
            </Card>

            <Card
              className="p-4 bg-gradient-to-br from-green-50 to-green-100 border-green-200 cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate('/admin-expenses')}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-green-700">Onkosten</p>
                  <p className="text-2xl font-bold text-green-900 mt-2">{pendingExpenses.length}</p>
                  <p className="text-xs text-green-600 mt-2">pending</p>
                </div>
                <div className="relative">
                  <Receipt className="h-8 w-8 text-green-300" />
                  {pendingExpenses.length > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                      {pendingExpenses.length}
                    </span>
                  )}
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Action Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button
            onClick={() => navigate('/project-production')}
            className="p-5 rounded-lg border-2 border-primary-200 bg-primary-50 hover:bg-primary-100 transition-all group"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 bg-primary-200 rounded-lg">
                <Briefcase className="h-5 w-5 text-primary-700" />
              </div>
              <ChevronRight className="h-5 w-5 text-primary-400 group-hover:translate-x-1 transition-transform" />
            </div>
            <p className="font-semibold text-gray-900 dark:text-gray-100 text-left">Productie</p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 text-left">Projecten beheren</p>
          </button>

          <button
            onClick={() => navigate('/project-statistics')}
            className="p-5 rounded-lg border-2 border-purple-200 bg-purple-50 hover:bg-purple-100 transition-all group"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 bg-purple-200 rounded-lg">
                <BarChart3 className="h-5 w-5 text-purple-700" />
              </div>
              <ChevronRight className="h-5 w-5 text-purple-400 group-hover:translate-x-1 transition-transform" />
            </div>
            <p className="font-semibold text-gray-900 dark:text-gray-100 text-left">Statistieken</p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 text-left">Uitgebreide analyse</p>
          </button>

          <button
            onClick={() => navigate('/outgoing-invoices')}
            className="p-5 rounded-lg border-2 border-green-200 bg-green-50 hover:bg-green-100 transition-all group"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 bg-green-200 rounded-lg">
                <Send className="h-5 w-5 text-green-700" />
              </div>
              <ChevronRight className="h-5 w-5 text-green-400 group-hover:translate-x-1 transition-transform" />
            </div>
            <p className="font-semibold text-gray-900 dark:text-gray-100 text-left">Facturatie</p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 text-left">Omzet beheren</p>
          </button>
        </div>
      </div>
    );
  }

  // ========== ADMIN/MANAGER EMPLOYER DASHBOARD ==========
  if ((userRole === 'admin' || userRole === 'manager') && !isProjectCompany && !isHoldingCompany) {
    return (
      <div className="space-y-4 pb-24 sm:pb-6 px-4 sm:px-0">
        {/* Hero Header */}
        <div className="bg-gradient-to-br from-primary-600 via-primary-500 to-primary-700 rounded-xl p-6 text-white space-y-2">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold">
                {userRole === 'admin' ? 'Management Dashboard' : 'Team Dashboard'}
              </h1>
              <p className="text-primary-100 mt-1">{selectedCompany?.name || 'Loonadministratie'}</p>
            </div>
            <TrendingUp className="h-12 w-12 text-primary-200 opacity-50" />
          </div>
        </div>

        {/* Alert Banner */}
        {totalPending > 0 && (
          <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 dark:border-red-700 p-4 rounded-lg flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-900 dark:text-red-200">{totalPending} items wachten!</h3>
              <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                {pendingTimesheets.length} uren • {pendingLeave.length} verlof • {pendingExpenses.length} onkosten
              </p>
            </div>
            <button
              onClick={() => {
                if (pendingTimesheets.length > 0) navigate('/timesheet-approvals');
                else if (pendingLeave.length > 0) navigate('/admin/leave-approvals');
              }}
              className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-semibold text-sm"
            >
              Bekijk →
            </button>
          </div>
        )}

        {/* Key Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Active Employees */}
          <Card className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Actieve Medewerkers</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">{stats.activeEmployees}</p>
              </div>
              <Users className="h-8 w-8 text-primary-400" />
            </div>
          </Card>

          {/* Verkoop */}
          <Card className="p-4 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-green-700 dark:text-green-400">Verkoop</p>
                <p className="text-2xl font-bold text-green-900 dark:text-green-200 mt-2">€{(stats.outgoingTotal / 1000).toFixed(1)}k</p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-2">{stats.outgoingInvoices} facturen</p>
              </div>
              <Send className="h-8 w-8 text-green-300 dark:text-green-500" />
            </div>
          </Card>

          {/* Inkoop */}
          <Card className="p-4 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-purple-700 dark:text-purple-400">Inkoop</p>
                <p className="text-2xl font-bold text-purple-900 dark:text-purple-200 mt-2">€{(stats.incomingTotal / 1000).toFixed(1)}k</p>
                <p className="text-xs text-purple-600 dark:text-purple-400 mt-2">{stats.incomingInvoices} facturen</p>
              </div>
              <Upload className="h-8 w-8 text-purple-300 dark:text-purple-500" />
            </div>
          </Card>

          {/* Pending Expenses */}
          <Card className="p-4 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-orange-700 dark:text-orange-400">Onkosten</p>
                <p className="text-2xl font-bold text-orange-900 dark:text-orange-200 mt-2">€{(stats.totalExpenses / 100).toFixed(0)}</p>
                <p className="text-xs text-orange-600 dark:text-orange-400 mt-2">{pendingExpenses.length} wachten</p>
              </div>
              <ArrowUpRight className="h-8 w-8 text-orange-300 dark:text-orange-500" />
            </div>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              title: 'Uren Goedkeuren',
              count: pendingTimesheets.length,
              icon: Clock,
              onClick: () => navigate('/timesheet-approvals'),
              color: 'blue',
            },
            {
              title: 'Verlof Goedkeuren',
              count: pendingLeave.length,
              icon: Calendar,
              onClick: () => navigate('/admin/leave-approvals'),
              color: 'purple',
            },
            {
              title: 'Team Beheren',
              icon: Users,
              onClick: () => navigate('/employees'),
              color: 'green',
            },
            {
              title: 'Instellingen',
              icon: Settings,
              onClick: () => navigate('/settings'),
              color: 'gray',
            },
          ].map((action) => {
            const Icon = action.icon;
            const colorClass = {
              blue: 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800 hover:bg-primary-100 dark:hover:bg-primary-900/30',
              purple: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/30',
              green: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/30',
              gray: 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:bg-gray-800',
            }[action.color] || 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-700';

            const iconColor = {
              blue: 'text-primary-600',
              purple: 'text-purple-600 dark:text-purple-400',
              green: 'text-green-600 dark:text-green-400',
              gray: 'text-gray-600 dark:text-gray-400 dark:text-gray-500',
            }[action.color] || 'text-gray-600 dark:text-gray-400 dark:text-gray-500';

            return (
              <button
                key={action.title}
                onClick={action.onClick}
                className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2 text-center group relative ${colorClass}`}
              >
                <Icon className={`h-6 w-6 ${iconColor}`} />
                <p className="text-xs font-medium text-gray-900 dark:text-gray-100 line-clamp-1">{action.title}</p>
                {action.count && action.count > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                    {action.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Pending Items Details */}
        {(pendingTimesheets.length > 0 || pendingLeave.length > 0 || pendingExpenses.length > 0) && (
          <Card>
            <div className="p-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-500" />
                Vereist Actie
              </h2>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {pendingTimesheets.slice(0, 3).map((ts) => (
                <button
                  key={ts.id}
                  onClick={() => navigate('/timesheet-approvals')}
                  className="w-full p-4 text-left hover:bg-gray-50 dark:bg-gray-900 transition-colors flex items-start justify-between group"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      📋 Week {ts.weekNumber} - {employees?.find((e: any) => e.id === ts.employeeId)?.personalInfo?.firstName}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{ts.totalRegularHours}u • Ingediend op {new Date(ts.submittedAt).toLocaleDateString('nl-NL')}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400 dark:text-gray-500 group-hover:translate-x-0.5 transition-transform" />
                </button>
              ))}
            </div>
          </Card>
        )}
      </div>
    );
  }

  // ========== EMPLOYEE DASHBOARD ==========
  if (userRole === 'employee') {

    return (
      <div className="space-y-4 pb-24 sm:pb-6 px-4 sm:px-0">
        {/* Welcome Hero */}
        <div className="bg-gradient-to-br from-green-500 via-green-400 to-emerald-600 rounded-xl p-6 text-white space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold">Welkom terug!</h1>
              <p className="text-green-100 mt-1">Hier is je overzicht</p>
            </div>
            <CheckCircle className="h-12 w-12 text-green-200 opacity-50" />
          </div>
        </div>

        {/* Key Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Card className="p-4 bg-primary-50 border-primary-200">
            <p className="text-xs font-medium text-primary-700">Uren Deze Week</p>
            <p className="text-2xl font-bold text-primary-900 mt-2">-</p>
            <p className="text-xs text-primary-600 mt-1">uren</p>
          </Card>

          <Card className="p-4 bg-green-50 border-green-200">
            <p className="text-xs font-medium text-green-700">Goedgekeurd</p>
            <p className="text-2xl font-bold text-green-900 mt-2">{employeeStats.approvedThisMonth}</p>
            <p className="text-xs text-green-600 mt-1">deze maand</p>
          </Card>

          <Card className="p-4 bg-purple-50 border-purple-200">
            <p className="text-xs font-medium text-purple-700">Saldo</p>
            <p className="text-2xl font-bold text-purple-900 mt-2">-</p>
            <p className="text-xs text-purple-600 mt-1">verlof</p>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate('/employee-dashboard/timesheets')}
            className="p-4 rounded-lg bg-primary-50 border-2 border-primary-200 hover:bg-primary-100 transition-all text-left group"
          >
            <Clock className="h-6 w-6 text-primary-600 mb-2" />
            <p className="font-semibold text-gray-900 dark:text-gray-100">Uren Invoeren</p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Jouw uren registreren</p>
          </button>

          <button
            onClick={() => navigate('/employee-dashboard/leave')}
            className="p-4 rounded-lg bg-purple-50 border-2 border-purple-200 hover:bg-purple-100 transition-all text-left group"
          >
            <Calendar className="h-6 w-6 text-purple-600 mb-2" />
            <p className="font-semibold text-gray-900 dark:text-gray-100">Verlof Aanvragen</p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Verlof indienen</p>
          </button>

          <button
            onClick={() => navigate('/employee-dashboard/expenses')}
            className="p-4 rounded-lg bg-green-50 border-2 border-green-200 hover:bg-green-100 transition-all text-left group"
          >
            <AlertCircle className="h-6 w-6 text-green-600 mb-2" />
            <p className="font-semibold text-gray-900 dark:text-gray-100">Onkosten</p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Kosten indienen</p>
          </button>

          <button
            onClick={() => navigate('/employee-dashboard/payslips')}
            className="p-4 rounded-lg bg-amber-50 border-2 border-amber-200 hover:bg-amber-100 transition-all text-left group"
          >
            <FileText className="h-6 w-6 text-amber-600 mb-2" />
            <p className="font-semibold text-gray-900 dark:text-gray-100">Loonstroken</p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Jouw betalingen</p>
          </button>
        </div>

        {/* Info Card */}
        <Card>
          <div className="p-4 bg-gradient-to-r from-primary-50 to-indigo-50">
            <div className="flex items-start gap-3">
              <Target className="h-5 w-5 text-primary-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Tips</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                  Zorg dat je uren op tijd indient en verlof vooraf aanvraagt. Je loonstroken zijn beschikbaar na verwerking.
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return null;
};

export default Dashboard;