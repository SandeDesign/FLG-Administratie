import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Clock, 
  AlertCircle,
  Calendar,
  CheckCircle,
  Plus,
  ArrowRight,
  Zap,
  ChevronRight,
  Activity,
  Bell,
  Briefcase
} from 'lucide-react';
import Card from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';

interface PendingItem {
  id: string;
  type: 'leave' | 'timesheet' | 'expense';
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
}

const Dashboard: React.FC = () => {
  const { employees, companies, loading, selectedCompany } = useApp();
  const { user, userRole } = useAuth();
  const { info } = useToast();
  const navigate = useNavigate();

  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => {
    if (userRole === 'admin' && selectedCompany) {
      // Simulated - in real app, fetch from Firebase
      const mockPendingItems: PendingItem[] = [
        {
          id: '1',
          type: 'leave',
          title: 'Verlofaanvraag van Jan Jansen',
          description: 'Zomervakantie aanvraag',
          employee: 'Jan Jansen',
          dateRange: '15-22 Augustus',
          icon: Calendar,
          color: 'orange',
          action: () => navigate('/admin/leave-approvals')
        },
        {
          id: '2',
          type: 'timesheet',
          title: 'Uren goedkeuring wachten',
          description: '3 medewerkers',
          icon: Clock,
          color: 'blue',
          action: () => navigate('/timesheet-approvals')
        },
        {
          id: '3',
          type: 'expense',
          title: 'Onkosten ter goedkeuring',
          description: 'Reiskosten € 145,50',
          icon: AlertCircle,
          color: 'red',
          action: () => navigate('/admin/expenses')
        }
      ];

      // Filter based on actual pending items
      setPendingItems(mockPendingItems);
      setPendingCount(mockPendingItems.length);

      // Mock activity
      setRecentActivity([
        {
          id: '1',
          action: 'Loon verwerkt',
          employee: 'Maria Garcia',
          time: 'Vandaag om 14:30',
          status: 'completed'
        },
        {
          id: '2',
          action: 'Verlof goedgekeurd',
          employee: 'Peter van der Meer',
          time: 'Gisteren om 10:15',
          status: 'completed'
        }
      ]);
    }
  }, [userRole, selectedCompany, navigate]);

  const quickActions: QuickAction[] = [
    {
      title: 'Werknemers',
      description: 'Toevoegen/bewerken',
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
      count: pendingCount > 0 ? pendingCount : undefined
    },
    {
      title: 'Uren',
      description: 'Verwerken',
      icon: Clock,
      action: () => navigate('/timesheet-approvals'),
      color: 'purple'
    },
    {
      title: 'Loonstroken',
      description: 'Genereren',
      icon: Briefcase,
      action: () => navigate('/payslips'),
      color: 'green'
    }
  ];

  if (loading) {
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
    const colors: Record<string, { bg: string; text: string; icon: string }> = {
      blue: { bg: 'bg-blue-50', text: 'text-blue-700', icon: 'text-blue-500' },
      orange: { bg: 'bg-orange-50', text: 'text-orange-700', icon: 'text-orange-500' },
      purple: { bg: 'bg-purple-50', text: 'text-purple-700', icon: 'text-purple-500' },
      green: { bg: 'bg-green-50', text: 'text-green-700', icon: 'text-green-500' },
      red: { bg: 'bg-red-50', text: 'text-red-700', icon: 'text-red-500' }
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="space-y-3 sm:space-y-4 pb-24 sm:pb-6 px-4 sm:px-0">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          {userRole === 'admin' ? 'Managementdashboard' : 'Mijn Dashboard'}
        </h1>
        <p className="text-xs sm:text-sm text-gray-600 mt-1">
          {selectedCompany ? `${selectedCompany.name}` : 'Loonadministratie overzicht'}
        </p>
      </div>

      {/* Priority Alert - Show if there are pending items */}
      {pendingCount > 0 && (
        <div
          onClick={() => navigate('/admin/leave-approvals')}
          className="p-3 sm:p-4 bg-orange-50 border border-orange-200 rounded-lg cursor-pointer hover:bg-orange-100 transition-colors flex items-start gap-3"
        >
          <Bell className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-orange-900">
              {pendingCount} item{pendingCount !== 1 ? 's' : ''} wachten op goedkeuring
            </p>
            <p className="text-xs text-orange-700 mt-0.5">Tap hier om deze in te zien</p>
          </div>
          <ChevronRight className="h-5 w-5 text-orange-600 flex-shrink-0" />
        </div>
      )}

      {/* Pending Items - Mobile Optimized */}
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
            {pendingItems.slice(0, 3).map((item) => {
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

          {pendingItems.length > 3 && (
            <button
              onClick={() => navigate('/admin/leave-approvals')}
              className="w-full p-3 text-center text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors"
            >
              Alle items zien ({pendingItems.length})
            </button>
          )}
        </Card>
      )}

      {/* Quick Actions - Mobile First */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {quickActions.map((action) => {
          const IconComponent = action.icon;
          const colors = getColorClasses(action.color);
          
          return (
            <button
              key={action.title}
              onClick={action.action}
              className={`p-3 sm:p-4 rounded-lg border border-gray-200 hover:shadow-md transition-all flex flex-col items-center gap-2 text-center relative group`}
            >
              <div className={`p-2 rounded-lg ${colors.bg}`}>
                <IconComponent className={`h-5 w-5 sm:h-6 sm:w-6 ${colors.icon}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-medium text-gray-900">
                  {action.title}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {action.description}
                </p>
              </div>
              
              {action.count && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  {action.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Status Summary - Mobile Friendly */}
      <Card>
        <div className="p-3 sm:p-4 border-b border-gray-100">
          <h2 className="text-sm sm:text-base font-semibold text-gray-900">Status</h2>
        </div>

        <div className="p-3 sm:p-4 space-y-2">
          {/* Employees Status */}
          <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded transition-colors">
            <div className="flex items-center gap-2 min-w-0">
              <Users className="h-4 w-4 text-blue-500 flex-shrink-0" />
              <span className="text-xs sm:text-sm text-gray-700">Werknemers</span>
            </div>
            <span className="text-sm font-semibold text-gray-900 ml-auto">
              {employees?.length || 0}
            </span>
          </div>

          {/* Pending Approvals */}
          {pendingCount > 0 && (
            <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded transition-colors">
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle className="h-4 w-4 text-orange-500 flex-shrink-0" />
                <span className="text-xs sm:text-sm text-gray-700">Te Goedkeuren</span>
              </div>
              <span className="text-sm font-semibold text-orange-600 ml-auto">
                {pendingCount}
              </span>
            </div>
          )}

          {/* Bedrijven */}
          <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded transition-colors">
            <div className="flex items-center gap-2 min-w-0">
              <Briefcase className="h-4 w-4 text-green-500 flex-shrink-0" />
              <span className="text-xs sm:text-sm text-gray-700">Bedrijven</span>
            </div>
            <span className="text-sm font-semibold text-gray-900 ml-auto">
              {companies?.length || 0}
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
                    <span className="text-gray-600"> - {activity.employee}</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Help CTA */}
      <div className="p-3 sm:p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg text-center">
        <p className="text-xs sm:text-sm text-gray-700">
          Hulp nodig? Bekijk onze <button className="font-semibold text-blue-600 hover:underline">documentatie</button>
        </p>
      </div>
    </div>
  );
};

export default Dashboard;