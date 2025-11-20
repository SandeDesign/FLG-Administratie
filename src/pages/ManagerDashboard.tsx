import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Clock,
  Calendar,
  CheckCircle,
  AlertCircle,
  Bell,
  ChevronRight,
  Zap,
  HeartPulse,
  Target,
  TrendingUp,
} from 'lucide-react';
import Card from '../components/ui/Card';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { getEmployees, getPendingLeaveApprovals } from '../services/firebase';
import { getPendingTimesheets } from '../services/timesheetService';

const ManagerDashboard: React.FC = () => {
  const { user } = useAuth();
  const { selectedCompany } = useApp();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [pendingTimesheets, setPendingTimesheets] = useState<any[]>([]);
  const [pendingLeaveRequests, setPendingLeaveRequests] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalTeam: 0,
    activeMembers: 0,
    pendingHours: 0,
    pendingLeave: 0,
  });

  const loadData = useCallback(async () => {
    if (!user || !selectedCompany) {
      console.log('No user or selectedCompany');
      return;
    }

    try {
      setLoading(true);
      console.log('Loading manager data for company:', selectedCompany.id);

      // Get team members
      const employees = await getEmployees(user.uid, selectedCompany.id);
      console.log('Employees:', employees.length);
      setTeamMembers(employees.slice(0, 8));

      // Get pending timesheets
      const timesheets = await getPendingTimesheets(user.uid, selectedCompany.id);
      console.log('Pending timesheets:', timesheets.length);
      setPendingTimesheets(timesheets.slice(0, 5));

      // Get pending leave approvals
      const leaveRequests = await getPendingLeaveApprovals(selectedCompany.id, user.uid);
      console.log('Pending leave:', leaveRequests.length);
      setPendingLeaveRequests(leaveRequests.slice(0, 5));

      // Calculate stats
      setStats({
        totalTeam: employees.length,
        activeMembers: employees.filter(e => e.status === 'active').length,
        pendingHours: timesheets.length,
        pendingLeave: leaveRequests.length,
      });
      console.log('Manager data loaded successfully');
    } catch (error) {
      console.error('Error loading manager data:', error);
    } finally {
      setLoading(false);
    }
  }, [user, selectedCompany]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!selectedCompany) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Selecteer een bedrijf</p>
      </div>
    );
  }

  const totalPending = stats.pendingHours + stats.pendingLeave;

  return (
    <div className="space-y-8 pb-24 sm:pb-0">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-2xl p-8 text-white shadow-lg">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold mb-2">Manager Dashboard</h1>
            <p className="text-indigo-100 flex items-center gap-2">
              <Users className="h-4 w-4" />
              {selectedCompany?.name || 'Team Management'}
            </p>
          </div>
          <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center">
            <Users className="h-8 w-8 text-white" />
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Team Grootte', value: stats.totalTeam, icon: Users },
            { label: 'Actief', value: stats.activeMembers, icon: CheckCircle },
            { label: 'Uren Wachting', value: stats.pendingHours, icon: Clock },
            { label: 'Verlof Wachting', value: stats.pendingLeave, icon: Calendar },
          ].map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div key={index} className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="h-4 w-4 text-indigo-100" />
                  <p className="text-xs text-indigo-100">{stat.label}</p>
                </div>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pending Alert */}
      {totalPending > 0 && (
        <div className="bg-orange-50 border-l-4 border-orange-500 p-6 rounded-lg">
          <div className="flex items-start gap-4">
            <Bell className="h-6 w-6 text-orange-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-lg font-bold text-orange-900">
                {totalPending} Items Wachten op Actie
              </h3>
              <p className="text-sm text-orange-800 mt-2">
                {stats.pendingHours} uren ter goedkeuring • {stats.pendingLeave} verlofaanvragen
              </p>
              <div className="flex gap-3 mt-4">
                {stats.pendingHours > 0 && (
                  <button
                    onClick={() => navigate('/timesheet-approvals')}
                    className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-semibold transition"
                  >
                    Uren Goedkeuren
                  </button>
                )}
                {stats.pendingLeave > 0 && (
                  <button
                    onClick={() => navigate('/admin/leave-approvals')}
                    className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-semibold transition"
                  >
                    Verlof Goedkeuren
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Zap className="h-6 w-6 text-amber-500" />
          Snelle Acties
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            {
              title: 'Uren',
              subtitle: 'Goedkeuren',
              icon: Clock,
              action: () => navigate('/timesheet-approvals'),
              bgGradient: 'from-blue-500 to-blue-600',
              iconBg: 'bg-blue-100',
              iconColor: 'text-blue-600'
            },
            {
              title: 'Verlof',
              subtitle: 'Goedkeuren',
              icon: Calendar,
              action: () => navigate('/admin/leave-approvals'),
              bgGradient: 'from-purple-500 to-purple-600',
              iconBg: 'bg-purple-100',
              iconColor: 'text-purple-600'
            },
            {
              title: 'Verzuim',
              subtitle: 'Beheren',
              icon: HeartPulse,
              action: () => navigate('/admin/absence-management'),
              bgGradient: 'from-red-500 to-red-600',
              iconBg: 'bg-red-100',
              iconColor: 'text-red-600'
            },
            {
              title: 'Team',
              subtitle: 'Beheren',
              icon: Users,
              action: () => navigate('/employees'),
              bgGradient: 'from-green-500 to-green-600',
              iconBg: 'bg-green-100',
              iconColor: 'text-green-600'
            },
          ].map((action, index) => {
            const Icon = action.icon;
            return (
              <button key={index} onClick={action.action} className="group">
                <div
                  className={`relative overflow-hidden rounded-xl p-6 h-full bg-gradient-to-br ${action.bgGradient} text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95`}
                >
                  <div className="flex flex-col items-center text-center h-full justify-center">
                    <div className={`inline-flex p-4 ${action.iconBg} rounded-xl mb-3 group-hover:scale-110 transition-transform duration-200`}>
                      <Icon className={`h-6 w-6 ${action.iconColor}`} />
                    </div>
                    <h3 className="font-bold text-sm mb-1">{action.title}</h3>
                    <p className="text-xs text-white/80">{action.subtitle}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Pending Timesheets */}
      {pendingTimesheets.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Clock className="h-6 w-6 text-blue-600" />
              Uren ter Goedkeuring ({pendingTimesheets.length})
            </h2>
            <button
              onClick={() => navigate('/timesheet-approvals')}
              className="text-sm text-blue-600 hover:text-blue-700 font-semibold"
            >
              Alle Bekijken →
            </button>
          </div>
          <div className="space-y-3">
            {pendingTimesheets.map((ts) => (
              <Card
                key={ts.id}
                className="p-4 border-l-4 border-blue-500 hover:bg-blue-50 transition cursor-pointer"
                onClick={() => navigate('/timesheet-approvals')}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">
                      Week {ts.weekNumber || 'N/A'} — {ts.totalRegularHours || 0}u uren
                    </p>
                    <p className="text-xs text-gray-600 mt-1">Status: {ts.status || 'Wachting'}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Pending Leave Requests */}
      {pendingLeaveRequests.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Calendar className="h-6 w-6 text-purple-600" />
              Verlofaanvragen ({pendingLeaveRequests.length})
            </h2>
            <button
              onClick={() => navigate('/admin/leave-approvals')}
              className="text-sm text-purple-600 hover:text-purple-700 font-semibold"
            >
              Alle Bekijken →
            </button>
          </div>
          <div className="space-y-3">
            {pendingLeaveRequests.map((leave) => (
              <Card
                key={leave.id}
                className="p-4 border-l-4 border-purple-500 hover:bg-purple-50 transition cursor-pointer"
                onClick={() => navigate('/admin/leave-approvals')}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">
                      {leave.employeeName || 'Werknemer'} — {leave.reason || 'Verlof'}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      {leave.startDate ? new Date(leave.startDate).toLocaleDateString('nl-NL') : 'N/A'}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Team Members Grid */}
      {teamMembers.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Users className="h-6 w-6 text-green-600" />
              Team ({teamMembers.length})
            </h2>
            <button
              onClick={() => navigate('/employees')}
              className="text-sm text-green-600 hover:text-green-700 font-semibold"
            >
              Alle Zien →
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {teamMembers.map((member) => (
              <Card key={member.id} className="p-4 hover:shadow-lg transition">
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                    {member.personalInfo?.firstName?.[0]?.toUpperCase() || 'E'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {member.personalInfo?.firstName} {member.personalInfo?.lastName}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      {member.status === 'active' ? '✓ Actief' : 'Inactief'}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-6 border-l-4 border-green-500">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0" />
            <div>
              <h3 className="text-lg font-bold text-gray-900">Status</h3>
              <p className="text-sm text-gray-600 mt-1">✓ Alle systemen operationeel</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-indigo-50 to-indigo-100">
          <div className="flex items-start gap-3">
            <TrendingUp className="h-6 w-6 text-indigo-600 flex-shrink-0" />
            <div>
              <h3 className="text-lg font-bold text-gray-900">Team Performance</h3>
              <p className="text-sm text-gray-600 mt-1">
                {stats.activeMembers}/{stats.totalTeam} medewerkers actief
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ManagerDashboard;