import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, HeartPulse, Receipt, Clock, TrendingUp } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';

const EmployeeDashboard: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Welkom terug!
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Hallo {user?.displayName || user?.email?.split('@')[0]}, hier is je persoonlijke dashboard.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <Calendar className="h-8 w-8 text-blue-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Verlof
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Aanvragen en saldo
                </p>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <Link to="/employee-dashboard/leave">
              <Button size="sm" className="w-full">
                Verlof Beheren
              </Button>
            </Link>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-lg">
                <HeartPulse className="h-8 w-8 text-red-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Verzuim
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Ziek- en betermelden
                </p>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <Link to="/employee-dashboard/absence">
              <Button size="sm" className="w-full">
                Verzuim Beheren
              </Button>
            </Link>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <Receipt className="h-8 w-8 text-green-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Declaraties
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Onkosten indienen
                </p>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <Link to="/employee-dashboard/expenses">
              <Button size="sm" className="w-full">
                Declaraties Beheren
              </Button>
            </Link>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="p-3 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
                <Clock className="h-8 w-8 text-orange-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Uren
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Gewerkte uren bekijken
                </p>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <Link to="/employee-dashboard/hours">
              <Button size="sm" className="w-full">
                Uren Bekijken
              </Button>
            </Link>
          </div>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card title="Recente Activiteit" subtitle="Je laatste acties en updates">
        <div className="space-y-4">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 mt-1">
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900 dark:text-white">
                Welkom bij AlloonApp! Je kunt nu verlof aanvragen, verzuim melden en declaraties indienen.
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Vandaag
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Help Section */}
      <Card title="Hulp & Ondersteuning" subtitle="Veelgestelde vragen en contact">
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Heb je vragen over het gebruik van AlloonApp? Neem contact op met je HR-afdeling of leidinggevende.
          </p>
          <div className="flex space-x-4">
            <Button size="sm" variant="secondary">
              Veelgestelde Vragen
            </Button>
            <Button size="sm" variant="secondary">
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