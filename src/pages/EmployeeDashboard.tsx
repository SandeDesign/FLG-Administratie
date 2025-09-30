import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { User, Clock, FileText, Settings, LogOut } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

const EmployeeDashboard: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <User className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Werknemers Dashboard
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Welkom, {user?.displayName || user?.email}
                </p>
              </div>
            </div>
            <Button onClick={signOut} variant="ghost">
              <LogOut className="h-5 w-5 mr-2" />
              Uitloggen
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Quick Actions */}
          <Card title="Mijn Uren" subtitle="Bekijk en beheer je gewerkte uren">
            <div className="flex items-center justify-between">
              <Clock className="h-12 w-12 text-blue-600" />
              <Button size="sm" onClick={() => navigate('/hours')}>
                Uren Bekijken
              </Button>
            </div>
          </Card>

          <Card title="Loonstroken" subtitle="Download je loonstroken">
            <div className="flex items-center justify-between">
              <FileText className="h-12 w-12 text-green-600" />
              <Button size="sm" onClick={() => navigate('/payslips')}>
                Loonstroken
              </Button>
            </div>
          </Card>

          <Card title="Profiel" subtitle="Beheer je persoonlijke gegevens">
            <div className="flex items-center justify-between">
              <Settings className="h-12 w-12 text-orange-600" />
              <Button size="sm" onClick={() => navigate('/settings')}>
                Profiel
              </Button>
            </div>
          </Card>
        </div>

        {/* Welcome Message */}
        <div className="mt-8">
          <Card>
            <div className="text-center py-8">
              <User className="mx-auto h-16 w-16 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Welkom bij je Werknemers Dashboard
              </h3>
              <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                Hier kun je je gewerkte uren bekijken, loonstroken downloaden en je persoonlijke gegevens beheren. 
                Deze functionaliteiten worden binnenkort uitgebreid.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default EmployeeDashboard;