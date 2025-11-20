import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Building2,
  Clock,
  AlertTriangle,
  TrendingUp,
  FileText,
  CheckCircle,
  Calendar,
  ArrowRight,
  HeartPulse,
  Bell,
  Zap,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import Card from '../components/ui/Card';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useToast } from '../hooks/useToast';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getEmployees, getCompanies, getLeaveRequests } from '../services/firebase';
import { getPendingTimesheets } from '../services/timesheetService';

interface ManagerStats {
  totalTeamMembers: number;
  employeesWithAccount: number;
  pendingLeaveRequests: number;
  pendingTimesheets: number;
}

const ManagerDashboard: React.FC = () => {
  const { user } = useAuth();
  const { selectedCompany, employees } = useApp();
  const { error: showError } = useToast();

  const [stats, setStats] = useState<ManagerStats | null>(null);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingLeaves, setPendingLeaves] = useState<any[]>([]);
  const [pendingTimesheetsList, setPendingTimesheetsList] = useState<any[]>([]);

  const loadDashboardData = useCallback(async () => {
    if (!user || !selectedCompany) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Get employees for this company
      const companyEmployees = await getEmployees(user.uid, selectedCompany.id);
      const employeesWithAccount = companyEmployees.filter(e => e.hasAccount).length;

      // Get pending leave requests
      const leaveRequests = await getLeaveRequests(user.uid);
      const pendingLeaves = leaveRequests.filter(r => r.status === 'pending' && r.companyId === selectedCompany.id);

      // Get pending timesheets
      const timesheets = await getPendingTimesheets(user.uid, selectedCompany.id);

      // Get recent audit logs for activity
      const auditQuery = query(
        collection(db, 'auditLogs'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(5)
      );
      const auditSnapshot = await getDocs(auditQuery);
      const activities = auditSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setStats({
        totalTeamMembers: companyEmployees.length,
        employeesWithAccount,
        pendingLeaveRequests: pendingLeaves.length,
        pendingTimesheets: timesheets.length,
      });

      setPendingLeaves(pendingLeaves.slice(0, 3));
      setPendingTimesheetsList(timesheets.slice(0, 3));
      setRecentActivities(activities);
    } catch (error) {
      console.error('Error loading manager dashboard:', error);
      showError('Fout', 'Kon dashboard data niet laden');
    } finally {
      setLoading(false);
    }
  }, [user, selectedCompany, showError]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="mx-auto h-12 w-12 text-red-600" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">Fout bij laden</h3>
      </div>
    );
  }

  const totalPending = stats.pendingTimesheets + stats.pendingLeaveRequests;

  return (
    <div className="space-y-4 pb-24 sm:pb-6">
      {/* Header - Mobile Optimized */}
      <div className="px-4 sm:px-0">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Manager Dashboard</h1>
        <p className="text-sm text-gray-600 mt-1">Team Management - {selectedCompany?.name || 'Loonadministratie'}</p>
      </div>

      {/* Alert Banner */}
      {totalPending > 0 && (
        <div className="px-4 sm:px-0">
          <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-lg flex items-start gap-3">
            <Bell className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-orange-900">{totalPending} items wachten op actie</h3>
              <p className="text-xs text-orange-700 mt-1">
                {stats.pendingTimesheets} uren • {stats.pendingLeaveRequests} verlof
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid - Mobile First */}
      <div className="px-4 sm:px-0 space-y-3 sm:space-y-4">
        {/* Row 1: Team Members */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Card className="p-4 sm:p-6 bg-gradient-to-br from-blue-50 to-blue-100">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-600">Team</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.totalTeamMembers}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.employeesWithAccount} met account
                </p>
              </div>
              <div className="p-2 sm:p-3 bg-blue-600 rounded-lg">
                <Users className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
            </div>
          </Card>

          <Card className="p-4 sm:p-6 bg-gradient-to-br from-green-50 to-green-100">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-600">Bedrijf</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{selectedCompany?.name.substring(0, 15)}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Selectie
                </p>
              </div>
              <div className="p-2 sm:p-3 bg-green-600 rounded-lg">
                <Building2 className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
            </div>
          </Card>
        </div>

        {/* Row 2: Pending Items */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Card className="p-4 sm:p-6 bg-gradient-to-br from-orange-50 to-orange-100">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-600">Uren Wachten</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.pendingTimesheets}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Te verwerken
                </p>
              </div>
              <div className="p-2 sm:p-3 bg-orange-600 rounded-lg">
                <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
            </div>
          </Card>

          <Card className="p-4 sm:p-6 bg-gradient-to-br from-purple-50 to-purple-100">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-600">Verlof Aanvragen</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.pendingLeaveRequests}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Wachten op goedkeuring
                </p>
              </div>
              <div className="p-2 sm:p-3 bg-purple-600 rounded-lg">
                <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Pending Timesheets - Mobile Card */}
      {stats.pendingTimesheets > 0 && (
        <div className="px-4 sm:px-0">
          <Card className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm sm:text-base font-semibold text-gray-900">
                Uren ter goedkeuring
              </h2>
              <button
                onClick={() => window.location.href = '/timesheet-approvals'}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                Alle →
              </button>
            </div>

            <div className="space-y-3">
              {pendingTimesheetsList.map((ts) => (
                <div key={ts.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      Week {ts.weekNumber || 'N/A'}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {ts.totalRegularHours || 0}u uren
                    </p>
                  </div>
                  <div className="ml-2 flex-shrink-0">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                      Wachting
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Pending Leave - Mobile Card */}
      {stats.pendingLeaveRequests > 0 && (
        <div className="px-4 sm:px-0">
          <Card className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm sm:text-base font-semibold text-gray-900">
                Verlofaanvragen
              </h2>
              <button
                onClick={() => window.location.href = '/admin/leave-approvals'}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                Alle →
              </button>
            </div>

            <div className="space-y-3">
              {pendingLeaves.map((leave) => (
                <div key={leave.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {leave.employeeName || 'Werknemer'}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {leave.reason || 'Verlof'}
                    </p>
                  </div>
                  <div className="ml-2 flex-shrink-0">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      In behandeling
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Quick Actions - Mobile Optimized */}
      <div className="px-4 sm:px-0">
        <Card className="p-4 sm:p-6">
          <h2 className="text-sm sm:text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            Snelle acties
          </h2>

          <div className="space-y-2">
            <button
              onClick={() => window.location.href = '/employees'}
              className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 hover:bg-blue-100 text-blue-900 rounded-lg transition-colors text-sm"
            >
              <span className="font-medium">Teamleden beheren</span>
              <ArrowRight className="h-4 w-4" />
            </button>

            <button
              onClick={() => window.location.href = '/admin/leave-approvals'}
              className="w-full flex items-center justify-between px-4 py-3 bg-orange-50 hover:bg-orange-100 text-orange-900 rounded-lg transition-colors text-sm"
            >
              <span className="font-medium">Verlofaanvragen</span>
              <ArrowRight className="h-4 w-4" />
            </button>

            <button
              onClick={() => window.location.href = '/timesheet-approvals'}
              className="w-full flex items-center justify-between px-4 py-3 bg-purple-50 hover:bg-purple-100 text-purple-900 rounded-lg transition-colors text-sm"
            >
              <span className="font-medium">Uren verwerken</span>
              <ArrowRight className="h-4 w-4" />
            </button>

            <button
              onClick={() => window.location.href = '/admin/absence-management'}
              className="w-full flex items-center justify-between px-4 py-3 bg-red-50 hover:bg-red-100 text-red-900 rounded-lg transition-colors text-sm"
            >
              <span className="font-medium">Verzuim beheren</span>
              <ArrowRight className="h-4 w-4" />
            </button>

            <button
              onClick={() => window.location.href = '/settings'}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 text-gray-900 rounded-lg transition-colors text-sm"
            >
              <span className="font-medium">Instellingen</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </Card>
      </div>

      {/* System Status - Mobile Card */}
      <div className="px-4 sm:px-0">
        <Card className="p-4 sm:p-6 border-l-4 border-green-500">
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-gray-900">Systeem Status</h3>
              <p className="text-xs text-gray-600 mt-1">
                ✓ Alle systemen operationeel
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ManagerDashboard;