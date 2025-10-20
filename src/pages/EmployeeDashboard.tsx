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
  ChevronRight
} from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';

const EmployeeDashboard: React.FC = () => {
  const { user, currentEmployeeId } = useAuth();
  const { selectedCompany, companies } = useApp();
  const [loading, setLoading] = useState(false);

  // Get user's first name for greeting
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

  // Quick actions data with real navigation
  const quickActions = [
    {
      title: 'Verlof',
      subtitle: 'Aanvragen en saldo',
      icon: Calendar,
      color: 'blue',
      href: '/employee-dashboard/leave',
      bgGradient: 'from-blue-500 to-blue-600',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600'
    },
    {
      title: 'Verzuim',
      subtitle: 'Ziek- en betermelden',
      icon: HeartPulse,
      color: 'red',
      href: '/employee-dashboard/absence',
      bgGradient: 'from-red-500 to-red-600',
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600'
    },
    {
      title: 'Declaraties',
      subtitle: 'Onkosten indienen',
      icon: Receipt,
      color: 'emerald',
      href: '/employee-dashboard/expenses',
      bgGradient: 'from-emerald-500 to-emerald-600',
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600'
    },
    {
      title: 'Uren',
      subtitle: 'Gewerkte uren',
      icon: Clock,
      color: 'amber',
      href: '/employee-dashboard/timesheets',
      bgGradient: 'from-amber-500 to-amber-600',
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600'
    }
  ];

  const recentActivities = [
    {
      icon: CheckCircle,
      title: 'Account aangemaakt',
      description: 'Je AlloonApp account is succesvol geactiveerd',
      time: 'Vandaag',
      type: 'success'
    },
    {
      icon: Bell,
      title: 'Welkom bij AlloonApp',
      description: 'Ontdek alle functies van het platform',
      time: 'Vandaag',
      type: 'info'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile-first header with gradient */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
        <div className="px-4 py-6 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold">
                {getGreeting()}, {getFirstName()}!
              </h1>
              <p className="mt-1 text-blue-100 text-sm sm:text-base">
                {selectedCompany ? `${selectedCompany.name}` : 'AlloonApp Dashboard'}
              </p>
            </div>
            
            {/* Profile Avatar */}
            <div className="flex-shrink-0">
              <div className="h-12 w-12 sm:h-14 sm:w-14 bg-white/20 rounded-full flex items-center justify-center">
                <User className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
              </div>
            </div>
          </div>
          
          {/* Quick stats row */}
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="text-center">
              <div className="text-2xl font-bold">25</div>
              <div className="text-xs text-blue-200">Verlof dagen</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">0</div>
              <div className="text-xs text-blue-200">Openstaand</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">160</div>
              <div className="text-xs text-blue-200">Uren/maand</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">2</div>
              <div className="text-xs text-blue-200">Meldingen</div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-6 sm:px-6 space-y-6">
        {/* Quick Actions - Mobile optimized grid */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Snelle Acties</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <Link
                  key={index}
                  to={action.href}
                  className="group block"
                >
                  <Card className="p-4 sm:p-6 h-full hover:shadow-lg transition-all duration-200 group-hover:scale-105 border-0 shadow-sm">
                    <div className="text-center">
                      <div className={`inline-flex p-3 ${action.iconBg} rounded-xl mb-3 group-hover:scale-110 transition-transform`}>
                        <Icon className={`h-6 w-6 ${action.iconColor}`} />
                      </div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-1">
                        {action.title}
                      </h3>
                      <p className="text-xs text-gray-600 leading-tight">
                        {action.subtitle}
                      </p>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Current Status Cards */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Huidige Status</h2>
          <div className="space-y-3">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Aanwezigheid</p>
                    <p className="text-sm text-gray-600">Je bent ingecheckt</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Calendar className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Volgende verlof</p>
                    <p className="text-sm text-gray-600">Geen geplande verlofperiodes</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </div>
            </Card>

            {selectedCompany && (
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Building2 className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Werkgever</p>
                      <p className="text-sm text-gray-600">{selectedCompany.name}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                </div>
              </Card>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <Card>
          <div className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Recente Activiteit</h2>
              <Button variant="ghost" size="sm">
                Alles bekijken
              </Button>
            </div>
            
            <div className="space-y-4">
              {recentActivities.map((activity, index) => {
                const Icon = activity.icon;
                return (
                  <div key={index} className="flex items-start space-x-3">
                    <div className={`flex-shrink-0 mt-1 p-2 rounded-lg ${
                      activity.type === 'success' ? 'bg-green-100' : 'bg-blue-100'
                    }`}>
                      <Icon className={`h-4 w-4 ${
                        activity.type === 'success' ? 'text-green-600' : 'text-blue-600'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {activity.title}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        {activity.description}
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        {activity.time}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Help Section - Compact for mobile */}
        <Card>
          <div className="p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Hulp & Ondersteuning</h2>
            <p className="text-sm text-gray-600 mb-4">
              Heb je vragen over AlloonApp? We helpen je graag verder.
            </p>
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
              <Button size="sm" variant="secondary" className="flex-1">
                Veelgestelde Vragen
              </Button>
              <Button size="sm" variant="secondary" className="flex-1">
                Contact HR
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default EmployeeDashboard;