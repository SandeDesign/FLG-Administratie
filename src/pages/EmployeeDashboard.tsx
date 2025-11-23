import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  HeartPulse,
  Receipt,
  Clock,
  TrendingUp,
  User,
  Building2,
  CheckCircle,
  Zap,
  Target,
  Award,
  Briefcase,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { getEmployeeById } from '../services/firebase';
import { getWeeklyTimesheets, getWeekNumber } from '../services/timesheetService';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const EmployeeDashboard: React.FC = () => {
  const { user, adminUserId, currentEmployeeId } = useAuth();
  const { selectedCompany } = useApp();
  const [loading, setLoading] = useState(true);
  const [employeeData, setEmployeeData] = useState<any>(null);
  const [timesheets, setTimesheets] = useState<any[]>([]);
  const [currentYear] = useState(new Date().getFullYear());
  const [currentWeek] = useState(getWeekNumber(new Date()));

  // Load employee data and timesheets
  useEffect(() => {
    const loadData = async () => {
      if (!currentEmployeeId || !adminUserId || !selectedCompany) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // Get employee data
        const employee = await getEmployeeById(currentEmployeeId);
        setEmployeeData(employee);

        // Get all timesheets for employee in current year (single efficient query)
        const allTimesheets = await getWeeklyTimesheets(
          adminUserId,
          currentEmployeeId,
          currentYear
        );

        setTimesheets(allTimesheets);
      } catch (error) {
        console.error('Error loading employee data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [currentEmployeeId, adminUserId, selectedCompany, currentYear]);

  // Calculate stats from real data
  const calculateStats = () => {
    const totalHours = timesheets.reduce((sum, ts) => sum + ts.totalRegularHours, 0);
    const totalKm = timesheets.reduce((sum, ts) => sum + ts.totalTravelKilometers, 0);
    const contractHours = employeeData?.contractInfo?.hoursPerWeek || 40;
    const approvedTimesheets = timesheets.filter(ts => ts.status === 'approved').length;
    
    return {
      totalHours: totalHours.toFixed(1),
      totalKm,
      approvedWeeks: approvedTimesheets,
      contractHours
    };
  };

  const stats = calculateStats();

  // Chart data from real timesheets
  const hoursChartData = timesheets
    .sort((a, b) => a.weekNumber - b.weekNumber)
    .slice(-8)
    .map(ts => ({
      week: `W${ts.weekNumber}`,
      hours: ts.totalRegularHours,
      target: employeeData?.contractInfo?.hoursPerWeek || 40
    }));

  const getFirstName = () => {
    if (employeeData?.personalInfo?.firstName) {
      return employeeData.personalInfo.firstName;
    }
    if (user?.displayName) {
      return user.displayName.split(' ')[0];
    }
    return 'Gebruiker';
  };

  const getFullName = () => {
    if (employeeData?.personalInfo?.firstName && employeeData?.personalInfo?.lastName) {
      return `${employeeData.personalInfo.firstName} ${employeeData.personalInfo.lastName}`;
    }
    return user?.displayName || 'Gebruiker';
  };

  const getUserEmail = () => {
    return user?.email || 'geen-email@flg-administratie.nl';
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Goedemorgen';
    if (hour < 18) return 'Goedemiddag';
    return 'Goedenavond';
  };

  const quickActions = [
    {
      title: 'Verlof',
      subtitle: 'Aanvragen en saldo',
      icon: Calendar,
      href: '/employee-dashboard/leave',
      bgGradient: 'from-blue-500 to-blue-600',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600'
    },
    {
      title: 'Verzuim',
      subtitle: 'Ziek- en betermelden',
      icon: HeartPulse,
      href: '/employee-dashboard/absence',
      bgGradient: 'from-red-500 to-red-600',
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600'
    },
    {
      title: 'Declaraties',
      subtitle: 'Onkosten indienen',
      icon: Receipt,
      href: '/employee-dashboard/expenses',
      bgGradient: 'from-emerald-500 to-emerald-600',
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600'
    },
    {
      title: 'Uren',
      subtitle: 'Gewerkte uren',
      icon: Clock,
      href: '/employee-dashboard/timesheets',
      bgGradient: 'from-amber-500 to-amber-600',
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600'
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-8 text-white shadow-lg">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold mb-2">
              {getGreeting()}, {getFirstName()}!
            </h1>
            <p className="text-blue-100 flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              {selectedCompany?.name || 'FLG-Administratie'}
            </p>
            {employeeData?.personalInfo?.firstName && (
              <p className="text-blue-200 text-sm mt-2">
                {getFullName()}
              </p>
            )}
          </div>
          <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center">
            <User className="h-8 w-8 text-white" />
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Uren deze maand', value: stats.totalHours, icon: Clock },
            { label: 'Kilometers', value: stats.totalKm, icon: TrendingUp },
            { label: 'Goedgekeurd', value: stats.approvedWeeks, icon: CheckCircle },
            { label: 'Contract/week', value: stats.contractHours, icon: Target }
          ].map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div key={index} className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="h-4 w-4 text-blue-100" />
                  <p className="text-xs text-blue-100">{stat.label}</p>
                </div>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Zap className="h-6 w-6 text-amber-500" />
          Snelle Acties
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <Link
                key={index}
                to={action.href}
                className="group"
              >
                <div className={`relative overflow-hidden rounded-xl p-6 h-full bg-gradient-to-br ${action.bgGradient} text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95`}>
                  <div className="flex flex-col items-center text-center h-full justify-center">
                    <div className={`inline-flex p-4 ${action.iconBg} rounded-xl mb-3 group-hover:scale-110 transition-transform duration-200`}>
                      <Icon className={`h-6 w-6 ${action.iconColor}`} />
                    </div>
                    <h3 className="font-bold text-sm mb-1">{action.title}</h3>
                    <p className="text-xs text-white/80">{action.subtitle}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Charts Section */}
      {hoursChartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Hours Chart */}
          <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-600" />
                Uren overzicht
              </h3>
              <span className="text-xs text-gray-600 bg-gray-100 px-3 py-1 rounded-full">Deze maand</span>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={hoursChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="week" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.5rem'
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="hours" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} />
                <Line type="monotone" dataKey="target" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Info Card */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Award className="h-5 w-5 text-amber-600" />
              Informatie
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">Totale uren</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalHours}u</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Reiskilometers</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalKm}km</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Weken ingediend</p>
                <p className="text-2xl font-bold text-gray-900">{timesheets.length}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Cards */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Target className="h-6 w-6 text-blue-600" />
          Huidige Status
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            {
              title: 'Bedrijf',
              description: selectedCompany?.name || 'Geen bedrijf',
              icon: Building2,
              color: 'from-blue-50 to-blue-100',
              iconColor: 'text-blue-600'
            },
            {
              title: 'Contract uren',
              description: `${employeeData?.contractInfo?.hoursPerWeek || 40}u per week`,
              icon: Clock,
              color: 'from-purple-50 to-purple-100',
              iconColor: 'text-purple-600'
            },
            {
              title: 'Ingediende weken',
              description: `${timesheets.filter(t => t.status === 'submitted' || t.status === 'approved').length} weken`,
              icon: CheckCircle,
              color: 'from-emerald-50 to-emerald-100',
              iconColor: 'text-emerald-600'
            },
            {
              title: 'Status',
              description: 'Alles is up-to-date',
              icon: CheckCircle,
              color: 'from-green-50 to-green-100',
              iconColor: 'text-green-600'
            }
          ].map((item, index) => {
            const Icon = item.icon;
            return (
              <div key={index} className={`bg-gradient-to-br ${item.color} rounded-xl p-6 border border-gray-200`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 text-sm">{item.title}</p>
                    <p className="text-xs text-gray-600 mt-1">{item.description}</p>
                  </div>
                  <div className={`flex-shrink-0 p-3 rounded-lg bg-white`}>
                    <Icon className={`h-5 w-5 ${item.iconColor}`} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default EmployeeDashboard;