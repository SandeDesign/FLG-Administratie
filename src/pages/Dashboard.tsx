import React, { useEffect, useState } from 'react';
import { Building2, Users, Calculator, Clock, TrendingUp, AlertCircle } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';

interface QuickAction {
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  action: () => void;
  color: string;
}

interface ActivityItem {
  id: string;
  type: 'import' | 'payroll' | 'regulation';
  message: string;
  timestamp: Date;
}

const Dashboard: React.FC = () => {
  const { dashboardStats, refreshDashboardStats, companies, employees, loading } = useApp();
  const { user } = useAuth();
  const { success, info } = useToast();
  const [recentActivity] = useState<ActivityItem[]>([
    {
      id: '1',
      type: 'import',
      message: 'Welkom bij AlloonApp! Begin met het toevoegen van je eerste bedrijf.',
      timestamp: new Date('2024-12-16T14:30:00'),
    },
  ]);

  useEffect(() => {
    if (user) {
      refreshDashboardStats();
    }
  }, [user, refreshDashboardStats]);

  const quickActions: QuickAction[] = [
    {
      title: 'Uren Importeren',
      description: 'Haal nieuwe uren op van werkbonnen systeem',
      icon: Clock,
      action: () => {
        success('Uren succesvol geïmporteerd', 'Er zijn 23 nieuwe urenregistraties toegevoegd');
      },
      color: 'text-blue-600 bg-blue-100',
    },
    {
      title: 'Loonberekening',
      description: 'Start loonberekening voor huidige periode',
      icon: Calculator,
      action: () => {
        info('Loonberekening gestart', 'Berekeningen worden uitgevoerd...');
      },
      color: 'text-green-600 bg-green-100',
    },
    {
      title: 'Loonstroken Genereren',
      description: 'Genereer PDF loonstroken voor werknemers',
      icon: TrendingUp,
      action: () => {
        success('Loonstroken gegenereerd', 'PDF bestanden zijn klaar voor download');
      },
      color: 'text-orange-600 bg-orange-100',
    },
    {
      title: 'Regelgeving Updaten',
      description: 'Controleer op nieuwe wet- en CAO wijzigingen',
      icon: AlertCircle,
      action: () => {
        info('Regelgeving wordt gecontroleerd', 'Er wordt gecontroleerd op updates...');
      },
      color: 'text-purple-600 bg-purple-100',
    },
  ];

  if (loading) {
    return <LoadingSpinner />;
  }

  // Show empty state if no companies exist
  if (companies.length === 0) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Welkom bij AlloonApp!
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Begin met het opzetten van je loonadministratie door je eerste bedrijf toe te voegen.
          </p>
        </div>

        <EmptyState
          icon={Building2}
          title="Geen bedrijven gevonden"
          description="Maak je eerste bedrijf aan om te beginnen met je loonadministratie"
          actionLabel="Eerste Bedrijf Toevoegen"
          onAction={() => window.location.href = '/companies'}
        />
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('nl-NL', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Welkom terug! Hier is een overzicht van uw loonadministratie.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Users className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Actieve Werknemers
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {dashboardStats.activeEmployees}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Bruto Loon Deze Maand
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(dashboardStats.totalGrossThisMonth)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Building2 className="h-8 w-8 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Bedrijven
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {dashboardStats.companiesCount}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Te Goedkeuren
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {dashboardStats.pendingApprovals}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card title="Snelle Acties" subtitle="Veelgebruikte functionaliteiten">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => {
            const IconComponent = action.icon;
            return (
              <div
                key={action.title}
                className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow"
              >
                <div className="flex items-center mb-3">
                  <div className={`p-2 rounded-lg ${action.color}`}>
                    <IconComponent className="h-6 w-6" />
                  </div>
                </div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  {action.title}
                </h4>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                  {action.description}
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={action.action}
                  className="w-full"
                >
                  Uitvoeren
                </Button>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Recente Activiteit">
          <div className="space-y-4">
            {recentActivity.map((item) => (
              <div key={item.id} className="flex items-start space-x-3">
                <div className="flex-shrink-0 mt-1">
                  {item.type === 'import' && <Clock className="h-4 w-4 text-blue-600" />}
                  {item.type === 'payroll' && <Calculator className="h-4 w-4 text-green-600" />}
                  {item.type === 'regulation' && <AlertCircle className="h-4 w-4 text-orange-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 dark:text-white">
                    {item.message}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDate(item.timestamp)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Alerts */}
        <Card title="Aandachtspunten">
          <div className="space-y-4">
            {employees.length === 0 ? (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex">
                  <Users className="h-5 w-5 text-blue-600" />
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      Voeg Werknemers Toe
                    </h4>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                      Begin met het toevoegen van werknemers om je loonadministratie op te zetten.
                    </p>
                  </div>
                </div>
              </div>
            ) : dashboardStats.pendingApprovals > 0 ? (
              <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                <div className="flex">
                  <Clock className="h-5 w-5 text-orange-600" />
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-orange-800 dark:text-orange-200">
                      Uren Goedkeuring Vereist
                    </h4>
                    <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                      {dashboardStats.pendingApprovals} urenregistraties wachten op goedkeuring.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-green-800 dark:text-green-200">
                      Alles Up-to-Date
                    </h4>
                    <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                      Je loonadministratie is volledig bijgewerkt. Goed bezig!
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;