import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Clock,
  AlertCircle,
  Calendar,
  CheckCircle,
  ChevronRight,
  Bell,
  FileText,
  Settings,
  ArrowRight,
  HeartPulse,
} from 'lucide-react';
import Card from '../components/ui/Card';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import {
  getPendingLeaveApprovals,
  getLeaveRequests,
  getSickLeaveRecords,
  getEmployeesByCompany,
} from '../services/firebase';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';

interface ManagerStats {
  totalTeamMembers: number;
  pendingLeaveRequests: number;
  pendingTimesheets: number;
  pendingAbsences: number;
  teamOnLeave: number;
  teamOnSickness: number;
}

interface PendingItem {
  id: string;
  type: 'leave' | 'timesheet' | 'absence';
  title: string;
  description?: string;
  employee: string;
  dateRange?: string;
  icon: React.ComponentType<any>;
  color: string;
}

interface TeamMember {
  id: string;
  name: string;
  department?: string;
  role?: string;
}

const ManagerDashboard: React.FC = () => {
  const { selectedCompany, employees } = useApp();
  const { user, userRole } = useAuth();
  const { success, error: showError } = useToast();
  const navigate = useNavigate();

  const [stats, setStats] = useState<ManagerStats | null>(null);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  // Format date range helper
  const formatDateRange = (startDate: any, endDate: any): string => {
    try {
      const start = startDate?.toDate ? startDate.toDate() : new Date(startDate);
      const end = endDate?.toDate ? endDate.toDate() : new Date(endDate);
      
      const formatDate = (date: Date) => {
        return new Intl.DateTimeFormat('nl-NL', {
          day: 'numeric',
          month: 'short',
          year: '2-digit'
        }).format(date);
      };

      if (start.toDateString() === end.toDateString()) {
        return formatDate(start);
      }
      return `${formatDate(start)} - ${formatDate(end)}`;
    } catch {
      return 'Geen datum';
    }
  };

  // Load dashboard data
  const loadDashboardData = useCallback(async () => {
    if (!user || !selectedCompany || userRole !== 'manager') {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // ========== GET TEAM MEMBERS ==========
      const companyEmployees = await getEmployeesByCompany(selectedCompany.id);
      setTeamMembers(
        companyEmployees.map((emp: any) => ({
          id: emp.id,
          name: emp.personalInfo?.firstName
            ? `${emp.personalInfo.firstName} ${emp.personalInfo.lastName || ''}`
            : emp.email || 'Medewerker',
          department: emp.department,
          role: emp.role,
        }))
      );

      // ========== GET PENDING LEAVE REQUESTS ==========
      const pendingLeaves = await getPendingLeaveApprovals(selectedCompany.id, user.uid);
      const leaveItems: PendingItem[] = pendingLeaves.slice(0, 5).map((leave: any) => ({
        id: `leave-${leave.id}`,
        type: 'leave',
        title: `Verlof van ${leave.employeeName || 'Medewerker'}`,
        description: leave.type === 'sick' ? 'Ziekmelding' : 'Jaarlijks verlof',
        employee: leave.employeeName || 'Onbekend',
        dateRange:
          leave.startDate && leave.endDate
            ? formatDateRange(leave.startDate, leave.endDate)
            : 'Geen datum',
        icon: Calendar,
        color: 'bg-orange-50 border-orange-200',
      }));

      // ========== GET PENDING TIMESHEETS ==========
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const timesheetsRef = collection(db, 'timesheets');
      const timesheetQuery = query(
        timesheetsRef,
        where('companyId', '==', selectedCompany.id),
        where('status', '==', 'pending'),
        where('createdAt', '>=', Timestamp.fromDate(startOfMonth)),
        where('createdAt', '<=', Timestamp.fromDate(endOfMonth))
      );
      const timesheetsSnapshot = await getDocs(timesheetQuery);
      const pendingTimesheets = timesheetsSnapshot.size;

      const timesheetItems: PendingItem[] = Array.from(
        { length: Math.min(pendingTimesheets, 3) },
        (_, i) => ({
          id: `timesheet-${i}`,
          type: 'timesheet',
          title: `Urenregistratie ter goedkeuring`,
          description: `${pendingTimesheets} uren in afwachting`,
          employee: 'Team',
          icon: Clock,
          color: 'bg-blue-50 border-blue-200',
        })
      );

      // ========== GET PENDING ABSENCES ==========
      const absenceRef = collection(db, 'absences');
      const absenceQuery = query(
        absenceRef,
        where('companyId', '==', selectedCompany.id),
        where('status', '==', 'pending')
      );
      const absenceSnapshot = await getDocs(absenceQuery);
      const pendingAbsences = absenceSnapshot.size;

      const absenceItems: PendingItem[] = Array.from(
        { length: Math.min(pendingAbsences, 2) },
        (_, i) => ({
          id: `absence-${i}`,
          type: 'absence',
          title: `Ziekte rapportage ter goedkeuring`,
          description: `${pendingAbsences} verzuimen in afwachting`,
          employee: 'Team',
          icon: HeartPulse,
          color: 'bg-red-50 border-red-200',
        })
      );

      // ========== GET TEAM ON LEAVE TODAY ==========
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const leaves = await getLeaveRequests(selectedCompany.id);
      const teamOnLeaveToday = leaves.filter((leave: any) => {
        const startDate = leave.startDate?.toDate ? leave.startDate.toDate() : new Date(leave.startDate);
        const endDate = leave.endDate?.toDate ? leave.endDate.toDate() : new Date(leave.endDate);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        return startDate <= today && today <= endDate && leave.status === 'approved';
      }).length;

      // ========== GET TEAM ON SICKNESS TODAY ==========
      const sickLeaves = await getSickLeaveRecords(selectedCompany.id);
      const teamOnSicknessToday = sickLeaves.filter((sick: any) => {
        const startDate = sick.startDate?.toDate ? sick.startDate.toDate() : new Date(sick.startDate);
        const endDate = sick.endDate?.toDate ? sick.endDate.toDate() : new Date(sick.endDate);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        return startDate <= today && today <= endDate && sick.status === 'approved';
      }).length;

      // ========== COMBINE ALL PENDING ITEMS ==========
      const allPendingItems = [...leaveItems, ...timesheetItems, ...absenceItems];
      setPendingItems(allPendingItems);
      setPendingCount(pendingLeaves.length + pendingTimesheets + pendingAbsences);

      // ========== SET STATS ==========
      setStats({
        totalTeamMembers: companyEmployees.length,
        pendingLeaveRequests: pendingLeaves.length,
        pendingTimesheets: pendingTimesheets,
        pendingAbsences: pendingAbsences,
        teamOnLeave: teamOnLeaveToday,
        teamOnSickness: teamOnSicknessToday,
      });
    } catch (error) {
      console.error('Error loading manager dashboard:', error);
      showError('Fout', 'Kon dashboard gegevens niet laden');
    } finally {
      setLoading(false);
    }
  }, [user, selectedCompany, userRole, showError]);

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
        <AlertCircle className="mx-auto h-12 w-12 text-red-600" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">Fout bij laden</h3>
        <p className="text-xs text-gray-500 mt-1">Kon dashboard niet laden</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4 pb-24 sm:pb-6 px-4 sm:px-0">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Manager Dashboard</h1>
        <p className="text-xs sm:text-sm text-gray-600 mt-1">
          {selectedCompany ? `Team Management - ${selectedCompany.name}` : 'Teamoverzicht'}
        </p>
      </div>

      {/* Priority Alert - Pending Items */}
      {pendingCount > 0 && (
        <div className="p-3 sm:p-4 bg-orange-50 border border-orange-200 rounded-lg flex items-start gap-3">
          <Bell className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-orange-900">
              {pendingCount} item{pendingCount !== 1 ? 's' : ''} wachten op goedkeuring
            </p>
            <p className="text-xs text-orange-800 mt-0.5">
              {stats.pendingLeaveRequests} verlofaanvragen • {stats.pendingTimesheets} uren •{' '}
              {stats.pendingAbsences} verzuimen
            </p>
          </div>
        </div>
      )}

      {/* Team Status - Mobile First Grid */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {/* Total Team Members */}
        <Card className="p-3 sm:p-4 bg-gradient-to-br from-blue-50 to-blue-100">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-600">Team Grootte</p>
              <p className="text-lg sm:text-2xl font-bold text-gray-900 mt-1">{stats.totalTeamMembers}</p>
            </div>
            <Users className="h-8 w-8 text-blue-500 opacity-20" />
          </div>
        </Card>

        {/* Team On Leave */}
        <Card className="p-3 sm:p-4 bg-gradient-to-br from-orange-50 to-orange-100">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-600">Op Verlof Vandaag</p>
              <p className="text-lg sm:text-2xl font-bold text-gray-900 mt-1">{stats.teamOnLeave}</p>
            </div>
            <Calendar className="h-8 w-8 text-orange-500 opacity-20" />
          </div>
        </Card>

        {/* Pending Leaves */}
        <Card className="p-3 sm:p-4 bg-gradient-to-br from-yellow-50 to-yellow-100">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-600">Verlof Aanvragen</p>
              <p className="text-lg sm:text-2xl font-bold text-gray-900 mt-1">
                {stats.pendingLeaveRequests}
              </p>
            </div>
            <Clock className="h-8 w-8 text-yellow-500 opacity-20" />
          </div>
        </Card>

        {/* Team On Sickness */}
        <Card className="p-3 sm:p-4 bg-gradient-to-br from-red-50 to-red-100">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-600">Ziekgemeld Vandaag</p>
              <p className="text-lg sm:text-2xl font-bold text-gray-900 mt-1">{stats.teamOnSickness}</p>
            </div>
            <HeartPulse className="h-8 w-8 text-red-500 opacity-20" />
          </div>
        </Card>
      </div>

      {/* Pending Items List */}
      {pendingItems.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-900 px-0 mb-2">Te Goedkeuren</h2>
          <div className="space-y-2">
            {pendingItems.map((item) => (
              <Card
                key={item.id}
                className={`p-3 sm:p-4 border cursor-pointer hover:shadow-md transition-all ${item.color}`}
                onClick={() => {
                  if (item.type === 'leave') navigate('/admin/leave-approvals');
                  else if (item.type === 'timesheet') navigate('/timesheet-approvals');
                  else if (item.type === 'absence') navigate('/admin/absence-management');
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <item.icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-medium text-gray-900">{item.title}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{item.employee}</p>
                      {item.dateRange && (
                        <p className="text-xs text-gray-500 mt-1">{item.dateRange}</p>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Team Members Section */}
      {teamMembers.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-900">Team Leden ({teamMembers.length})</h2>
            <button
              onClick={() => navigate('/employees')}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              Alle zien →
            </button>
          </div>
          <div className="space-y-2">
            {teamMembers.slice(0, 5).map((member) => (
              <Card key={member.id} className="p-3 sm:p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-gray-900">{member.name}</p>
                    {member.department && (
                      <p className="text-xs text-gray-600 mt-0.5">{member.department}</p>
                    )}
                  </div>
                  <div className="h-2 w-2 rounded-full bg-green-500 flex-shrink-0 mt-1" />
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold text-gray-900 px-0 mb-2">Snelle Acties</h2>
        <div className="space-y-2">
          <button
            onClick={() => navigate('/employees')}
            className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 hover:bg-blue-100 text-blue-900 rounded-lg transition-colors text-sm"
          >
            <span className="font-medium">Teamleden beheren</span>
            <ArrowRight className="h-4 w-4" />
          </button>

          <button
            onClick={() => navigate('/admin/leave-approvals')}
            className="w-full flex items-center justify-between px-4 py-3 bg-orange-50 hover:bg-orange-100 text-orange-900 rounded-lg transition-colors text-sm"
          >
            <span className="font-medium">Verlofaanvragen</span>
            <ArrowRight className="h-4 w-4" />
          </button>

          <button
            onClick={() => navigate('/timesheet-approvals')}
            className="w-full flex items-center justify-between px-4 py-3 bg-purple-50 hover:bg-purple-100 text-purple-900 rounded-lg transition-colors text-sm"
          >
            <span className="font-medium">Uren goedkeuren</span>
            <ArrowRight className="h-4 w-4" />
          </button>

          <button
            onClick={() => navigate('/settings')}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 text-gray-900 rounded-lg transition-colors text-sm"
          >
            <span className="font-medium">Instellingen</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* System Status */}
      <div>
        <Card className="p-4 sm:p-6 border-l-4 border-green-500">
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-gray-900">Systeem Status</h3>
              <p className="text-xs text-gray-600 mt-1">✓ Alle systemen operationeel</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ManagerDashboard;