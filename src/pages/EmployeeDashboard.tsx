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
  AlertCircle,
  Bell,
  ChevronRight,
  Zap,
  Target,
  Award,
  Briefcase
} from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const EmployeeDashboard: React.FC = () => {
  const { user, currentEmployeeId } = useAuth();
  const { selectedCompany, companies } = useApp();
  const [loading, setLoading] = useState(false);
  const [animateCount, setAnimateCount] = useState(false);

  useEffect(() => {
    setAnimateCount(true);
  }, []);

  const getFirstName = () => {
    if (user?.displayName) {
      return user.displayName.split(' ')[0];
    }
    if (user?.email) {
      return user.email.split('@')[0];
    }
    return 'Gebruiker';
  };

  const currentTime = new Date();
  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Goedemorgen';
    if (hour < 18) return 'Goedemiddag';
    return 'Goedenavond';
  };

  // Chart data
  const hoursData = [
    { week: 'Week 44', hours: 40, target: 40 },
    { week: 'Week 45', hours: 38, target: 40 },
    { week: 'Week 46', hours: 42, target: 40 },
    { week: 'Week 47', hours: 40, target: 40 },
    { week: 'Week 48', hours: 39, target: 40 },
  ];

  const leaveData = [
    { name: 'Gebruikt', value: 12, fill: '#ef4444' },
    { name: 'Beschikbaar', value: 13, fill: '#10b981' }
  ];

  const quickActions = [
    {
      title: 'Verlof',
      subtitle: 'Aanvragen en saldo',
      icon: Calendar,
      href: '/employee-dashboard/leave',
      bgGradient: 'from-blue-600 to-blue-400',
      iconBg: 'bg-blue-100/20',
      iconColor: 'text-blue-400',
      accent: 'blue'
    },
    {
      title: 'Verzuim',
      subtitle: 'Ziek- en betermelden',
      icon: HeartPulse,
      href: '/employee-dashboard/absence',
      bgGradient: 'from-red-600 to-red-400',
      iconBg: 'bg-red-100/20',
      iconColor: 'text-red-400',
      accent: 'red'
    },
    {
      title: 'Declaraties',
      subtitle: 'Onkosten indienen',
      icon: Receipt,
      href: '/employee-dashboard/expenses',
      bgGradient: 'from-emerald-600 to-emerald-400',
      iconBg: 'bg-emerald-100/20',
      iconColor: 'text-emerald-400',
      accent: 'emerald'
    },
    {
      title: 'Uren',
      subtitle: 'Gewerkte uren',
      icon: Clock,
      href: '/employee-dashboard/timesheets',
      bgGradient: 'from-amber-600 to-amber-400',
      iconBg: 'bg-amber-100/20',
      iconColor: 'text-amber-400',
      accent: 'amber'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-32 right-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Main content */}
      <div className="relative z-10">
        {/* Premium Header */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-pink-600/20"></div>
          <div className="absolute inset-0 backdrop-blur-3xl"></div>
          
          <div className="relative px-4 py-8 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex-1">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-white via-blue-100 to-blue-200 bg-clip-text text-transparent">
                  {getGreeting()}, {getFirstName()}!
                </h1>
                <p className="mt-2 text-blue-200/80 text-sm sm:text-base flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  {selectedCompany ? `${selectedCompany.name}` : 'AlloonApp Dashboard'}
                </p>
              </div>
              
              {/* Profile Avatar */}
              <div className="flex-shrink-0">
                <div className="relative h-16 w-16 sm:h-20 sm:w-20">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-purple-600 rounded-full blur opacity-75 animate-pulse"></div>
                  <div className="relative h-full w-full bg-gradient-to-br from-slate-700 to-slate-800 rounded-full flex items-center justify-center border border-blue-400/30">
                    <User className="h-8 w-8 sm:h-10 sm:w-10 text-blue-300" />
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Stats - Premium Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Verlof dagen', value: '25', icon: Calendar, color: 'from-blue-500 to-blue-600' },
                { label: 'Openstaand', value: '0', icon: AlertCircle, color: 'from-emerald-500 to-emerald-600' },
                { label: 'Uren/maand', value: '160', icon: Clock, color: 'from-purple-500 to-purple-600' },
                { label: 'Meldingen', value: '2', icon: Bell, color: 'from-orange-500 to-orange-600' }
              ].map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <div
                    key={index}
                    className="group relative overflow-hidden rounded-xl p-4 backdrop-blur-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all duration-300 transform hover:scale-105"
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}></div>
                    <div className="relative z-10">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-white/60 text-xs sm:text-sm font-medium mb-1">{stat.label}</p>
                          <p className="text-2xl sm:text-3xl font-bold text-white">{stat.value}</p>
                        </div>
                        <div className={`p-2 bg-gradient-to-br ${stat.color} rounded-lg opacity-80 group-hover:opacity-100 transition-all`}>
                          <Icon className="h-4 w-4 text-white" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="px-4 py-8 sm:px-6 lg:px-8 space-y-8">
          {/* Quick Actions */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Zap className="h-6 w-6 text-amber-400" />
                Snelle Acties
              </h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {quickActions.map((action, index) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={index}
                    to={action.href}
                    className="group"
                  >
                    <div className={`relative overflow-hidden rounded-2xl p-6 h-full backdrop-blur-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all duration-300 hover:shadow-2xl hover:shadow-${action.accent}-500/20 transform hover:scale-105 active:scale-95`}>
                      {/* Gradient background */}
                      <div className={`absolute inset-0 bg-gradient-to-br ${action.bgGradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}></div>
                      
                      {/* Content */}
                      <div className="relative z-10 flex flex-col items-center text-center h-full justify-center">
                        <div className={`inline-flex p-4 ${action.iconBg} rounded-2xl mb-3 group-hover:scale-110 transition-transform duration-300 backdrop-blur-sm`}>
                          <Icon className={`h-6 w-6 ${action.iconColor}`} />
                        </div>
                        <h3 className="text-sm font-bold text-white mb-1">
                          {action.title}
                        </h3>
                        <p className="text-xs text-white/60 leading-tight group-hover:text-white/80 transition-colors">
                          {action.subtitle}
                        </p>
                      </div>

                      {/* Hover glow */}
                      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r ${action.bgGradient} blur-2xl -z-10`}></div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Analytics Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Hours Chart */}
            <div className="lg:col-span-2 backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all duration-300">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-400" />
                  Uren overzicht
                </h3>
                <span className="text-xs text-white/60 bg-white/5 px-3 py-1 rounded-full">Deze maand</span>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={hoursData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="week" stroke="rgba(255,255,255,0.5)" />
                  <YAxis stroke="rgba(255,255,255,0.5)" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(15,23,42,0.8)', 
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '0.75rem'
                    }}
                    labelStyle={{ color: 'white' }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="hours" stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#3b82f6', r: 5 }} />
                  <Line type="monotone" dataKey="target" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Leave Balance */}
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all duration-300">
              <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
                <Award className="h-5 w-5 text-green-400" />
                Verlof saldo
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={leaveData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {leaveData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(15,23,42,0.8)', 
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '0.75rem'
                    }}
                    labelStyle={{ color: 'white' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between text-white/80">
                  <span>Gebruikt</span>
                  <span className="font-bold">12 dagen</span>
                </div>
                <div className="flex justify-between text-white/80">
                  <span>Beschikbaar</span>
                  <span className="font-bold text-emerald-400">13 dagen</span>
                </div>
              </div>
            </div>
          </div>

          {/* Status Cards */}
          <div>
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <Target className="h-6 w-6 text-cyan-400" />
              Huidige Status
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                {
                  title: 'Aanwezigheid',
                  description: 'Je bent ingecheckt',
                  icon: CheckCircle,
                  status: 'online',
                  color: 'from-emerald-500 to-emerald-600'
                },
                {
                  title: 'Volgende verlof',
                  description: 'Geen geplande verlofperiodes',
                  icon: Calendar,
                  status: 'neutral',
                  color: 'from-blue-500 to-blue-600'
                },
                {
                  title: 'Werkgever',
                  description: selectedCompany?.name || 'Geen bedrijf',
                  icon: Building2,
                  status: 'info',
                  color: 'from-purple-500 to-purple-600'
                },
                {
                  title: 'Declaraties',
                  description: 'Geen openstaande',
                  icon: Receipt,
                  status: 'neutral',
                  color: 'from-amber-500 to-amber-600'
                }
              ].map((item, index) => {
                const Icon = item.icon;
                return (
                  <div key={index} className="group relative overflow-hidden rounded-xl p-4 backdrop-blur-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all duration-300 hover:shadow-lg hover:shadow-white/10">
                    <div className={`absolute inset-0 bg-gradient-to-br ${item.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300`}></div>
                    <div className="relative z-10 flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className={`flex-shrink-0 p-2.5 rounded-lg bg-gradient-to-br ${item.color} opacity-80 group-hover:opacity-100 transition-all`}>
                          <Icon className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold text-white text-sm">{item.title}</p>
                          <p className="text-xs text-white/60 mt-1">{item.description}</p>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-white/40 group-hover:text-white/60 transition-colors" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Help Section */}
          <div className="backdrop-blur-xl bg-gradient-to-br from-blue-600/10 to-purple-600/10 border border-white/10 rounded-2xl p-8 hover:border-white/20 transition-all duration-300">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div>
                <h2 className="text-xl font-bold text-white mb-2">Hulp & Ondersteuning</h2>
                <p className="text-white/60">Heb je vragen? Ons support team is 24/7 beschikbaar.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <Button size="sm" variant="secondary" className="flex-1 sm:flex-none bg-white/10 hover:bg-white/20 text-white border border-white/20">
                  FAQ
                </Button>
                <Button size="sm" className="flex-1 sm:flex-none bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white">
                  Contact Support
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeDashboard;