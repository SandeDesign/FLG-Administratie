import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Clock, 
  AlertCircle,
  Calendar,
  CheckCircle,
  Zap,
  ChevronRight,
  Bell,
  Briefcase,
  Send,
  HeartPulse,
  FileText,
  Download,
  Settings
} from 'lucide-react';
import Card from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import {
  getPendingLeaveApprovals,
  getTimeEntries,
  getPendingExpenses,
  getLeaveRequests,
  getSickLeaveRecords
} from '../services/firebase';

interface PendingItem {
  id: string;
  type: 'leave' | 'timesheet' | 'expense' | 'absence' | 'invoice';
  title: string;
  description?: string;
  employee?: string;
  dateRange?: string;
  icon: React.ComponentType<any>;
  color: string;
  action: () => void;
}

interface QuickAction {
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  action: () => void;
  color: string;
  count?: number;
  badge?: string;
}

interface ActivityLog {
  id: string;
  action: string;
  employee?: string;
  time: string;
  status: 'completed' | 'pending' | 'warning';
}

const Dashboard: React.FC = () => {
  const { employees, companies, loading, selectedCompany } = useApp();
  const { user, userRole } = useAuth();
  const navigate = useNavigate();

  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([]);
  const [dashLoading, setDashLoading] = useState(false);
  const [statsOverview, setStatsOverview] = useState({
    activeEmployees: 0,
    pendingApprovals: 0,
    companiesCount: 0
  });

  // Fetch ALL pending items from Firebase
  const fetchPendingItems = useCallback(async () => {
    if (!user || !selectedCompany || userRole !== 'admin') return;

    setDashLoading(true);
    try {
      const items: PendingItem[] = [];
      const activities: ActivityLog[] = [];

      // ========== VERLOF ==========
      const leaveRequests = await getPendingLeaveApprovals(selectedCompany.id, user.uid);
      leaveRequests.forEach((leave: any) => {
        items.push({
          id: `leave-${leave.id}`,
          type: 'leave',
          title: `Verlofaanvraag van ${leave.employeeName || 'Medewerker'}`,
          description: leave.type === 'sick' ? 'Ziekmelding' : leave.type === 'vacation' ? 'Jaarlijks verlof' : 'Verlofaanvraag',
          employee: leave.employeeName,
          dateRange: leave.startDate && leave.endDate 
            ? `${new Date(leave.startDate).toLocaleDateString('nl-NL')} - ${new Date(leave.endDate).toLocaleDateString('nl-NL')}`
            : undefined,
          icon: Calendar,
          color: 'orange',
          action: () => navigate('/admin/leave-approvals')
        });
      });

      // ========== VERZUIM ==========
      try {
        const sickLeave = await getSickLeaveRecords(user.uid);
        const pendingSick = sickLeave.filter((s: any) => s.status === 'pending' || s.status === 'reported');
        if (pendingSick.length > 0) {
          items.push({
            id: 'absence-pending',
            type: 'absence',
            title: `Verzuim ter controle`,
            description: `${pendingSick.length} melding${pendingSick.length !== 1 ? 'en' : ''}`,
            icon: HeartPulse,
            color: 'red',
            action: () => navigate('/admin/absence-management')
          });
        }
      } catch (error) {
        console.error('Error fetching sick leave:', error);
      }

      // ========== UREN ==========
      const timeEntries = await getTimeEntries(user.uid);
      const pendingTime = timeEntries.filter((t: any) => t.status === 'submitted' || t.status === 'pending');
      if (pendingTime.length > 0) {
        items.push({
          id: 'timesheet-pending',
          type: 'timesheet',
          title: `Uren ter goedkeuring`,
          description: `${pendingTime.length} ingedie${pendingTime.length !== 1 ? 'ningen' : 'ning'}`,
          icon: Clock,
          color: 'blue',
          action: () => navigate('/timesheet-approvals')
        });
      }

      // ========== ONKOSTEN ==========
      try {
        const expenses = await getPendingExpenses(selectedCompany.id, user.uid);
        if (expenses.length > 0) {
          const totalAmount = expenses.reduce((sum: number, exp: any) => sum + (exp.amount || 0), 0);
          items.push({
            id: 'expense-pending',
            type: 'expense',
            title: `Onkosten ter goedkeuring`,
            description: `€ ${totalAmount.toFixed(2)} (${expenses.length} items)`,
            icon: AlertCircle,
            color: 'purple',
            action: () => navigate('/admin/expenses')
          });
        }
      } catch (error) {
        console.error('Error fetching expenses:', error);
      }

      // ========== FACTUREN ==========
      // Placeholder voor future invoice pending logic
      items.push({
        id: 'invoice-manage',
        type: 'invoice',
        title: `Facturen beheren`,
        description: `Uitgaande en inkomende facturen`,
        icon: Send,
        color: 'green',
        action: () => navigate('/outgoing-invoices')
      });

      setPendingItems(items);
      setPendingCount(items.length);

      // ========== ACTIVITY LOG ==========
      // Goedgekeurde verlofaanvragen
      const approvedLeave = leaveRequests
        .filter((l: any) => l.status === 'approved')
        .sort((a: any, b: any) => new Date(b.approvedAt).getTime() - new Date(a.approvedAt).getTime())
        .slice(0, 5);

      approvedLeave.forEach((leave: any) => {
        activities.push({
          id: `act-leave-${leave.id}`,
          action: 'Verlof goedgekeurd',
          employee: leave.employeeName,
          time: leave.approvedAt 
            ? `${new Date(leave.approvedAt).toLocaleDateString('nl-NL')} om ${new Date(leave.approvedAt).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`
            : 'Recent',
          status: 'completed'
        });
      });

      // Stats update
      setStatsOverview({
        activeEmployees: employees?.length || 0,
        pendingApprovals: items.length,
        companiesCount: companies?.length || 0
      });

      setRecentActivity(activities.slice(0, 3));
    } catch (error) {
      console.error('Error fetching pending items:', error);
    } finally {
      setDashLoading(false);
    }
  }, [user, selectedCompany, userRole, navigate, employees?.length, companies?.length]);

  useEffect(() => {
    fetchPendingItems();
  }, [fetchPendingItems]);

  // ========== QUICK ACTIONS - BASED ON ROLE ==========
  const getQuickActions = (): QuickAction[] => {
    if (userRole === 'admin') {
      return [
        {
          title: 'Werknemers',
          description: 'Team beheren',
          icon: Users,
          action: () => navigate('/employees'),
          color: 'blue'
        },
        {
          title: 'Verlof',
          description: 'Goedkeuren',
          icon: Calendar,
          action: () => navigate('/admin/leave-approvals'),
          color: 'orange',
          count: pendingItems.filter(i => i.type === 'leave').length || undefined
        },
        {
          title: 'Uren',
          description: 'Verwerken',
          icon: Clock,
          action: () => navigate('/timesheet-approvals'),
          color: 'purple',
          count: pendingItems.filter(i => i.type === 'timesheet').length || undefined
        },
        {
          title: 'Verzuim',
          description: 'Beheren',
          icon: HeartPulse,
          action: () => navigate('/admin/absence-management'),
          color: 'red',
          count: pendingItems.filter(i => i.type === 'absence').length || undefined
        },
        {
          title: 'Facturen',
          description: 'Beheren',
          icon: Send,
          action: () => navigate('/outgoing-invoices'),
          color: 'green'
        },
        {
          title: 'Exports',
          description: 'Downloaden',
          icon: Download,
          action: () => navigate('/timesheet-export'),
          color: 'indigo'
        },
        {
          title: 'Bedrijven',
          description: 'Instellingen',
          icon: Briefcase,
          action: () => navigate('/companies'),
          color: 'cyan'
        },
        {
          title: 'Instellingen',
          description: 'Systeem',
          icon: Settings,
          action: () => navigate('/settings'),
          color: 'gray'
        }
      ];
    }

    if (userRole === 'manager') {
      return [
        {
          title: 'Team',
          description: 'Werknemers',
          icon: Users,
          action: () => navigate('/employees'),
          color: 'blue'
        },
        {
          title: 'Uren',
          description: 'Goedkeuren',
          icon: Clock,
          action: () => navigate('/timesheet-approvals'),
          color: 'purple',
          count: pendingItems.filter(i => i.type === 'timesheet').length || undefined
        },
        {
          title: 'Verlof',
          description: 'Goedkeuren',
          icon: Calendar,
          action: () => navigate('/admin/leave-approvals'),
          color: 'orange',
          count: pendingItems.filter(i => i.type === 'leave').length || undefined
        },
        {
          title: 'Exports',
          description: 'Uren exporteren',
          icon: Download,
          action: () => navigate('/timesheet-export'),
          color: 'green'
        }
      ];
    }

    return [];
  };

  const quickActions = getQuickActions();

  if (loading || dashLoading) {
    return <LoadingSpinner />;
  }

  // Empty state
  if (userRole === 'admin' && (!companies || companies.length === 0)) {
    return (
      <div className="space-y-6 pb-24 sm:pb-6 px-4 sm:px-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Welkom!</h1>
          <p className="text-sm text-gray-600 mt-1">Laten we beginnen met je loonadministratie</p>
        </div>

        <EmptyState
          icon={Briefcase}
          title="Geen bedrijven gevonden"
          description="Maak je eerste bedrijf aan om werknemers en loonadministratie in te stellen"
          actionLabel="Bedrijf Toevoegen"
          onAction={() => navigate('/companies')}
        />
      </div>
    );
  }

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; text: string; icon: string; border: string }> = {
      blue: { bg: 'bg-blue-50', text: 'text-blue-700', icon: 'text-blue-500', border: 'border-blue-200' },
      orange: { bg: 'bg-orange-50', text: 'text-orange-700', icon: 'text-orange-500', border: 'border-orange-200' },
      purple: { bg: 'bg-purple-50', text: 'text-purple-700', icon: 'text-purple-500', border: 'border-purple-200' },
      green: { bg: 'bg-green-50', text: 'text-green-700', icon: 'text-green-500', border: 'border-green-200' },
      red: { bg: 'bg-red-50', text: 'text-red-700', icon: 'text-red-500', border: 'border-red-200' },
      indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', icon: 'text-indigo-500', border: 'border-indigo-200' },
      cyan: { bg: 'bg-cyan-50', text: 'text-cyan-700', icon: 'text-cyan-500', border: 'border-cyan-200' },
      gray: { bg: 'bg-gray-50', text: 'text-gray-700', icon: 'text-gray-500', border: 'border-gray-200' }
    };
    return colors[color] || colors.blue;
  };

  // ============ DYNAMISCHE LAYOUT CHECK ============
  const isProjectCompany = selectedCompany?.type === 'project';

  // ============ PROJECT COMPANY DASHBOARD ============
  if (isProjectCompany) {
    return (
      <div className="space-y-3 sm:space-y-4 pb-24 sm:pb-6 px-4 sm:px-0">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Project Dashboard</h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">
            {selectedCompany ? `${selectedCompany.name}` : 'Projectbeheer'}
          </p>
        </div>

        {/* Priority Alert */}
        {pendingCount > 0 && (
          <div
            onClick={() => {
              if (pendingItems.length > 0) {
                pendingItems[0].action();
              }
            }}
            className="p-3 sm:p-4 bg-orange-50 border border-orange-200 rounded-lg cursor-pointer hover:bg-orange-100 transition-colors flex items-start gap-3"
          >
            <Bell className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-orange-900">
                {pendingCount} item{pendingCount !== 1 ? 's' : ''} wachten op actie
              </p>
              <p className="text-xs text-orange-700 mt-0.5">Tap hier om te beginnen</p>
            </div>
            <ChevronRight className="h-5 w-5 text-orange-600 flex-shrink-0" />
          </div>
        )}

        {/* PROJECT QUICK ACTIONS - Productie, Statistieken, Facturatie */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* PRODUCTIE */}
          <button
            onClick={() => navigate('/projects')}
            className="p-4 rounded-lg border border-blue-200 hover:shadow-md transition-all flex flex-col items-start gap-3 bg-blue-50 group"
          >
            <div className="p-2 rounded-lg bg-blue-100">
              <Briefcase className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Productie</p>
              <p className="text-xs text-gray-600 mt-1">Projecten beheren</p>
            </div>
            <ChevronRight className="h-4 w-4 text-blue-600 mt-auto self-end group-hover:translate-x-1 transition-transform" />
          </button>

          {/* STATISTIEKEN */}
          <button
            onClick={() => navigate('/statistics')}
            className="p-4 rounded-lg border border-purple-200 hover:shadow-md transition-all flex flex-col items-start gap-3 bg-purple-50 group"
          >
            <div className="p-2 rounded-lg bg-purple-100">
              <Zap className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Statistieken</p>
              <p className="text-xs text-gray-600 mt-1">Projectoverzicht</p>
            </div>
            <ChevronRight className="h-4 w-4 text-purple-600 mt-auto self-end group-hover:translate-x-1 transition-transform" />
          </button>

          {/* FACTURATIE */}
          <button
            onClick={() => navigate('/outgoing-invoices')}
            className="p-4 rounded-lg border border-green-200 hover:shadow-md transition-all flex flex-col items-start gap-3 bg-green-50 group"
          >
            <div className="p-2 rounded-lg bg-green-100">
              <Send className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Facturatie</p>
              <p className="text-xs text-gray-600 mt-1">Facturen beheren</p>
            </div>
            <ChevronRight className="h-4 w-4 text-green-600 mt-auto self-end group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* PROJECT STATS */}
        <Card>
          <div className="p-3 sm:p-4 border-b border-gray-100">
            <h2 className="text-sm sm:text-base font-semibold text-gray-900">Projectoverzicht</h2>
          </div>

          <div className="p-3 sm:p-4 space-y-2">
            <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded transition-colors">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-blue-500 flex-shrink-0" />
                <span className="text-xs sm:text-sm text-gray-700">Actieve Projecten</span>
              </div>
              <span className="text-sm font-semibold text-gray-900">-</span>
            </div>

            <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded transition-colors">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                <span className="text-xs sm:text-sm text-gray-700">Afgerond</span>
              </div>
              <span className="text-sm font-semibold text-gray-900">-</span>
            </div>

            <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded transition-colors">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-orange-500 flex-shrink-0" />
                <span className="text-xs sm:text-sm text-gray-700">In Progress</span>
              </div>
              <span className="text-sm font-semibold text-orange-600">-</span>
            </div>
          </div>
        </Card>

        {/* Info Footer */}
        <div className="p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
          <p className="text-xs sm:text-sm text-blue-900">
            Dashboard geupdate op: {new Date().toLocaleDateString('nl-NL')} om {new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
    );
  }

  // ============ EMPLOYER COMPANY DASHBOARD (ORIGINEEL) ============
  return (
    <div className="space-y-3 sm:space-y-4 pb-24 sm:pb-6 px-4 sm:px-0">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          {userRole === 'admin' ? 'Management Dashboard' : 'Team Dashboard'}
        </h1>
        <p className="text-xs sm:text-sm text-gray-600 mt-1">
          {selectedCompany ? `${selectedCompany.name}` : 'Loonadministratie & HR'}
        </p>
      </div>

      {/* Priority Alert */}
      {pendingCount > 0 && (
        <div
          onClick={() => {
            // Navigate to first pending item
            if (pendingItems.length > 0) {
              pendingItems[0].action();
            }
          }}
          className="p-3 sm:p-4 bg-orange-50 border border-orange-200 rounded-lg cursor-pointer hover:bg-orange-100 transition-colors flex items-start gap-3"
        >
          <Bell className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-orange-900">
              {pendingCount} item{pendingCount !== 1 ? 's' : ''} wachten op actie
            </p>
            <p className="text-xs text-orange-700 mt-0.5">Tap hier om te beginnen</p>
          </div>
          <ChevronRight className="h-5 w-5 text-orange-600 flex-shrink-0" />
        </div>
      )}

      {/* Pending Items */}
      {pendingItems.length > 0 && (
        <Card>
          <div className="p-3 sm:p-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              <h2 className="text-sm sm:text-base font-semibold text-gray-900">
                Actie Vereist
              </h2>
            </div>
            <span className="inline-block bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-semibold">
              {pendingCount}
            </span>
          </div>
          
          <div className="divide-y divide-gray-100">
            {pendingItems.slice(0, 4).map((item) => {
              const IconComponent = item.icon;
              const colors = getColorClasses(item.color);
              
              return (
                <button
                  key={item.id}
                  onClick={item.action}
                  className="w-full p-3 sm:p-4 text-left hover:bg-gray-50 transition-colors flex items-start justify-between group"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className={`p-2 rounded-lg ${colors.bg} flex-shrink-0`}>
                      <IconComponent className={`h-4 w-4 sm:h-5 sm:w-5 ${colors.icon}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 line-clamp-1">
                        {item.title}
                      </p>
                      {item.description && (
                        <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                      )}
                      {item.dateRange && (
                        <p className="text-xs text-gray-400 mt-1">{item.dateRange}</p>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0 ml-2 group-hover:translate-x-0.5 transition-transform" />
                </button>
              );
            })}
          </div>

          {pendingItems.length > 4 && (
            <button
              onClick={() => navigate('/admin/leave-approvals')}
              className="w-full p-3 text-center text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors"
            >
              Alle items zien ({pendingItems.length})
            </button>
          )}
        </Card>
      )}

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
        {quickActions.map((action) => {
          const IconComponent = action.icon;
          const colors = getColorClasses(action.color);
          
          return (
            <button
              key={action.title}
              onClick={action.action}
              className={`p-3 sm:p-4 rounded-lg border ${colors.border} hover:shadow-md transition-all flex flex-col items-center gap-2 text-center relative group`}
            >
              <div className={`p-2 rounded-lg ${colors.bg}`}>
                <IconComponent className={`h-5 w-5 sm:h-6 sm:w-6 ${colors.icon}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-medium text-gray-900 line-clamp-1">
                  {action.title}
                </p>
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                  {action.description}
                </p>
              </div>
              
              {action.count && action.count > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  {action.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Status Summary */}
      <Card>
        <div className="p-3 sm:p-4 border-b border-gray-100">
          <h2 className="text-sm sm:text-base font-semibold text-gray-900">Overzicht</h2>
        </div>

        <div className="p-3 sm:p-4 space-y-2">
          <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded transition-colors">
            <div className="flex items-center gap-2 min-w-0">
              <Users className="h-4 w-4 text-blue-500 flex-shrink-0" />
              <span className="text-xs sm:text-sm text-gray-700">Werknemers</span>
            </div>
            <span className="text-sm font-semibold text-gray-900">
              {statsOverview.activeEmployees}
            </span>
          </div>

          {statsOverview.pendingApprovals > 0 && (
            <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded transition-colors">
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle className="h-4 w-4 text-orange-500 flex-shrink-0" />
                <span className="text-xs sm:text-sm text-gray-700">Wachten op actie</span>
              </div>
              <span className="text-sm font-semibold text-orange-600">
                {statsOverview.pendingApprovals}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded transition-colors">
            <div className="flex items-center gap-2 min-w-0">
              <Briefcase className="h-4 w-4 text-green-500 flex-shrink-0" />
              <span className="text-xs sm:text-sm text-gray-700">Bedrijven</span>
            </div>
            <span className="text-sm font-semibold text-gray-900">
              {statsOverview.companiesCount}
            </span>
          </div>
        </div>
      </Card>

      {/* Recent Activity */}
      {recentActivity.length > 0 && (
        <Card>
          <div className="p-3 sm:p-4 border-b border-gray-100">
            <h2 className="text-sm sm:text-base font-semibold text-gray-900">Recente Acties</h2>
          </div>

          <div className="p-3 sm:p-4 space-y-3">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-gray-900">
                    <span className="font-medium">{activity.action}</span>
                    {activity.employee && (
                      <span className="text-gray-600"> - {activity.employee}</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Info Footer */}
      <div className="p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
        <p className="text-xs sm:text-sm text-blue-900">
          Dashboard geupdate op: {new Date().toLocaleDateString('nl-NL')} om {new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-minute' })}
        </p>
      </div>
    </div>
  );
};

export default Dashboard;