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
  const { user, userRole, currentEmployeeId } = useAuth();
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
  });

  // ========== LOAD ADMIN DATA ==========
  const loadAdminData = useCallback(async () => {
    if (!user || !selectedCompany || userRole !== 'admin') return;

    setDashLoading(true);
    try {
      // Pending timesheets
      const timesheets = await getPendingTimesheets(user.uid, selectedCompany.id);
      setPendingTimesheets(timesheets.slice(0, 5));

      // Pending leave
      const leave = await getPendingLeaveApprovals(selectedCompany.id, user.uid);
      setPendingLeave(leave.slice(0, 5));

      // Pending expenses
      try {
        const expenses = await getPendingExpenses(selectedCompany.id, user.uid);
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
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setDashLoading(false);
    }
  }, [user, selectedCompany, userRole, employees]);

  // ========== LOAD MANAGER DATA ==========
  const loadManagerData = useCallback(async () => {
    if (!user || !selectedCompany || userRole !== 'manager') return;

    setDashLoading(true);
    try {
      const timesheets = await getPendingTimesheets(user.uid, selectedCompany.id);
      setPendingTimesheets(timesheets.slice(0, 5));

      const leave = await getPendingLeaveApprovals(selectedCompany.id, user.uid);
      setPendingLeave(leave.slice(0, 5));

      setStats((prev) => ({
        ...prev,
        pendingActions: (timesheets.length || 0) + (leave.length || 0),
      }));
    } catch (error) {
      console.error('Error loading manager data:', error);
    } finally {
      setDashLoading(false);
    }
  }, [user, selectedCompany, userRole]);

  // ========== LOAD EMPLOYEE DATA ==========
  const loadEmployeeData = useCallback(async () => {
    if (!user || !currentEmployeeId) return;

    setDashLoading(true);
    try {
      // Get payroll for this employee
      const payroll = await getPayrollCalculations(user.uid, currentEmployeeId);
      // Use payroll data if needed
    } catch (error) {
      console.error('Error loading employee data:', error);
    } finally {
      setDashLoading(false);
    }
  }, [user, currentEmployeeId]);

  useEffect(() => {
    if (userRole === 'admin') loadAdminData();
    if (userRole === 'manager') loadManagerData();
    if (userRole === 'employee') loadEmployeeData();
  }, [loadAdminData, loadManagerData, loadEmployeeData, userRole]);

  if (loading || dashLoading) {
    return <LoadingSpinner />;
  }

  if (!selectedCompany && userRole !== 'employee') {
    return (
      <div className="space-y-6 pb-24 sm:pb-6 px-4 sm:px-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Welkom!</h1>
          <p className="text-sm text-gray-600 mt-1">Laten we beginnen met je loonadministratie</p>
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
  const totalPending = pendingTimesheets.length + pendingLeave.length + pendingExpenses.length;

  // ========== PROJECT COMPANY DASHBOARD ==========
  if (isProjectCompany && (userRole === 'admin' || userRole === 'manager')) {
    return (
      <div className="space-y-4 pb-24 sm:pb-6 px-4 sm:px-0">
        {/* Hero Header */}
        <div className="bg-gradient-to-br from-primary-600 via-primary-500 to-primary-700 rounded-xl p-6 text-white space-y-2">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold">Project Dashboard</h1>
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
                {pendingTimesheets.length} uren • {pendingLeave.length} verlof • €{stats.totalExpenses.toFixed(0)} onkosten
              </p>
            </div>
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Uren Wachten */}
          <Card className="p-4 bg-gradient-to-br from-primary-50 to-primary-100 border-primary-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-primary-700">Uren</p>
                <p className="text-2xl font-bold text-primary-900 mt-2">{pendingTimesheets.length}</p>
                <p className="text-xs text-primary-600 mt-2">wachten</p>
              </div>
              <Clock className="h-8 w-8 text-primary-300" />
            </div>
          </Card>

          {/* Verlof */}
          <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-purple-700">Verlof</p>
                <p className="text-2xl font-bold text-purple-900 mt-2">{pendingLeave.length}</p>
                <p className="text-xs text-purple-600 mt-2">aanvragen</p>
              </div>
              <Calendar className="h-8 w-8 text-purple-300" />
            </div>
          </Card>

          {/* Onkosten */}
          <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-green-700">Onkosten</p>
                <p className="text-2xl font-bold text-green-900 mt-2">€{(stats.totalExpenses / 100).toFixed(0)}</p>
                <p className="text-xs text-green-600 mt-2">in behandeling</p>
              </div>
              <ArrowUpRight className="h-8 w-8 text-green-300" />
            </div>
          </Card>

          {/* Team */}
          <Card className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-orange-700">Team</p>
                <p className="text-2xl font-bold text-orange-900 mt-2">{employees?.length || 0}</p>
                <p className="text-xs text-orange-600 mt-2">medewerkers</p>
              </div>
              <Users className="h-8 w-8 text-orange-300" />
            </div>
          </Card>
        </div>

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
            <p className="font-semibold text-gray-900 text-left">Productie</p>
            <p className="text-xs text-gray-600 mt-1 text-left">Projecten beheren</p>
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
            <p className="font-semibold text-gray-900 text-left">Statistieken</p>
            <p className="text-xs text-gray-600 mt-1 text-left">Projectoverzicht</p>
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
            <p className="font-semibold text-gray-900 text-left">Facturatie</p>
            <p className="text-xs text-gray-600 mt-1 text-left">Facturen beheren</p>
          </button>
        </div>

        {/* Pending Items */}
        {totalPending > 0 && (
          <Card>
            <div className="p-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Actie Vereist</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {pendingTimesheets.map((ts) => (
                <button
                  key={ts.id}
                  onClick={() => navigate('/timesheet-approvals')}
                  className="w-full p-4 text-left hover:bg-gray-50 transition-colors flex items-center justify-between group"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Week {ts.weekNumber} • {employees?.find((e: any) => e.id === ts.employeeId)?.personalInfo?.firstName || 'Medewerker'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{ts.totalRegularHours}u uren ingediend</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                </button>
              ))}
            </div>
          </Card>
        )}
      </div>
    );
  }

  // ========== ADMIN/MANAGER EMPLOYER DASHBOARD ==========
  if ((userRole === 'admin' || userRole === 'manager') && !isProjectCompany) {
    return (
      <div className="space-y-4 pb-24 sm:pb-6 px-4 sm:px-0">
        {/* Hero Header */}
        <div className="bg-gradient-to-br from-indigo-600 via-indigo-500 to-purple-700 rounded-xl p-6 text-white space-y-2">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold">
                {userRole === 'admin' ? 'Management Dashboard' : 'Team Dashboard'}
              </h1>
              <p className="text-indigo-100 mt-1">{selectedCompany?.name || 'Loonadministratie'}</p>
            </div>
            <TrendingUp className="h-12 w-12 text-indigo-200 opacity-50" />
          </div>
        </div>

        {/* Alert Banner */}
        {totalPending > 0 && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-900">{totalPending} items wachten!</h3>
              <p className="text-xs text-red-700 mt-1">
                {pendingTimesheets.length} uren • {pendingLeave.length} verlof • {pendingExpenses.length} onkosten
              </p>
            </div>
            <button
              onClick={() => {
                if (pendingTimesheets.length > 0) navigate('/timesheet-approvals');
                else if (pendingLeave.length > 0) navigate('/admin/leave-approvals');
              }}
              className="text-red-600 hover:text-red-700 font-semibold text-sm"
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
                <p className="text-xs font-medium text-gray-600">Actieve Medewerkers</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{stats.activeEmployees}</p>
              </div>
              <Users className="h-8 w-8 text-primary-400" />
            </div>
          </Card>

          {/* Pending Timesheets */}
          <Card className="p-4 bg-orange-50 border-orange-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-orange-700">Uren Wachten</p>
                <p className="text-2xl font-bold text-orange-900 mt-2">{pendingTimesheets.length}</p>
              </div>
              <Clock className="h-8 w-8 text-orange-300" />
            </div>
          </Card>

          {/* Pending Leave */}
          <Card className="p-4 bg-purple-50 border-purple-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-purple-700">Verlof Wachten</p>
                <p className="text-2xl font-bold text-purple-900 mt-2">{pendingLeave.length}</p>
              </div>
              <Calendar className="h-8 w-8 text-purple-300" />
            </div>
          </Card>

          {/* Pending Expenses */}
          <Card className="p-4 bg-green-50 border-green-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-green-700">Onkosten</p>
                <p className="text-2xl font-bold text-green-900 mt-2">€{(stats.totalExpenses / 100).toFixed(0)}</p>
              </div>
              <ArrowUpRight className="h-8 w-8 text-green-300" />
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
              blue: 'bg-primary-50 border-primary-200 hover:bg-primary-100',
              purple: 'bg-purple-50 border-purple-200 hover:bg-purple-100',
              green: 'bg-green-50 border-green-200 hover:bg-green-100',
              gray: 'bg-gray-50 border-gray-200 hover:bg-gray-100',
            }[action.color] || 'bg-gray-50 border-gray-200';

            const iconColor = {
              blue: 'text-primary-600',
              purple: 'text-purple-600',
              green: 'text-green-600',
              gray: 'text-gray-600',
            }[action.color] || 'text-gray-600';

            return (
              <button
                key={action.title}
                onClick={action.onClick}
                className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2 text-center group relative ${colorClass}`}
              >
                <Icon className={`h-6 w-6 ${iconColor}`} />
                <p className="text-xs font-medium text-gray-900 line-clamp-1">{action.title}</p>
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
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-500" />
                Vereist Actie
              </h2>
            </div>
            <div className="divide-y divide-gray-100">
              {pendingTimesheets.slice(0, 3).map((ts) => (
                <button
                  key={ts.id}
                  onClick={() => navigate('/timesheet-approvals')}
                  className="w-full p-4 text-left hover:bg-gray-50 transition-colors flex items-start justify-between group"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      📋 Week {ts.weekNumber} - {employees?.find((e: any) => e.id === ts.employeeId)?.personalInfo?.firstName}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{ts.totalRegularHours}u • Ingediend op {new Date(ts.submittedAt).toLocaleDateString('nl-NL')}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
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
    const [employeeStats, setEmployeeStats] = useState({
      pendingTimesheets: 0,
      approvedThisMonth: 0,
      nextPayday: null as Date | null,
    });

    useEffect(() => {
      const loadEmployeeStats = async () => {
        if (!user || !currentEmployeeId) return;
        try {
          const payroll = await getPayrollCalculations(user.uid, currentEmployeeId);
          if (payroll.length > 0) {
            setEmployeeStats((prev) => ({
              ...prev,
              approvedThisMonth: payroll.filter((p: any) => p.status === 'approved').length,
            }));
          }
        } catch (error) {
          console.error('Error:', error);
        }
      };
      loadEmployeeStats();
    }, [user, currentEmployeeId]);

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
            <p className="font-semibold text-gray-900">Uren Invoeren</p>
            <p className="text-xs text-gray-600 mt-1">Jouw uren registreren</p>
          </button>

          <button
            onClick={() => navigate('/employee-dashboard/leave')}
            className="p-4 rounded-lg bg-purple-50 border-2 border-purple-200 hover:bg-purple-100 transition-all text-left group"
          >
            <Calendar className="h-6 w-6 text-purple-600 mb-2" />
            <p className="font-semibold text-gray-900">Verlof Aanvragen</p>
            <p className="text-xs text-gray-600 mt-1">Verlof indienen</p>
          </button>

          <button
            onClick={() => navigate('/employee-dashboard/expenses')}
            className="p-4 rounded-lg bg-green-50 border-2 border-green-200 hover:bg-green-100 transition-all text-left group"
          >
            <AlertCircle className="h-6 w-6 text-green-600 mb-2" />
            <p className="font-semibold text-gray-900">Onkosten</p>
            <p className="text-xs text-gray-600 mt-1">Kosten indienen</p>
          </button>

          <button
            onClick={() => navigate('/employee-dashboard/payslips')}
            className="p-4 rounded-lg bg-amber-50 border-2 border-amber-200 hover:bg-amber-100 transition-all text-left group"
          >
            <FileText className="h-6 w-6 text-amber-600 mb-2" />
            <p className="font-semibold text-gray-900">Loonstroken</p>
            <p className="text-xs text-gray-600 mt-1">Jouw betalingen</p>
          </button>
        </div>

        {/* Info Card */}
        <Card>
          <div className="p-4 bg-gradient-to-r from-primary-50 to-indigo-50">
            <div className="flex items-start gap-3">
              <Target className="h-5 w-5 text-primary-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-900 text-sm">Tips</p>
                <p className="text-xs text-gray-600 mt-2">
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