import React, { useEffect, useState, useCallback } from 'react';
import { HeartPulse, AlertTriangle, Calendar, User, Clock, Building2 } from 'lucide-react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import { SickLeave, Employee } from '../types';
import * as firebaseService from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { useToast } from '../hooks/useToast';

const AdminAbsenceManagement: React.FC = () => {
  const { user } = useAuth();
  const { companies, employees, selectedCompany } = useApp();
  const { success, error: showError } = useToast();
  const [loading, setLoading] = useState(true);
  const [activeSickLeave, setActiveSickLeave] = useState<SickLeave[]>([]);

  const loadActiveSickLeave = useCallback(async () => {
    if (!user || !selectedCompany) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // Get ALL sick leave records for this user and filter for active
      const allSickLeaveRecords = await firebaseService.getSickLeaveRecords(user.uid);
      const active = allSickLeaveRecords.filter(record => 
        (record.status === 'active' || record.status === 'partially_recovered') && record.companyId === selectedCompany.id
      );
      setActiveSickLeave(active);
    } catch (err) {
      console.error('Error loading active sick leave:', err);
      showError('Fout bij laden', 'Kon verzuimgegevens niet laden');
    } finally {
      setLoading(false);
    }
  }, [user, selectedCompany, showError]);

  useEffect(() => {
    loadActiveSickLeave();
  }, [loadActiveSickLeave]);

  const getEmployeeName = (employeeId: string) => {
    const employee = employees.find(e => e.id === employeeId);
    return employee 
      ? `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`
      : 'Onbekende werknemer';
  };

  const getCompanyName = (companyId: string) => {
    const company = companies.find(c => c.id === companyId);
    return company?.name || 'Onbekend bedrijf';
  };

  const getDaysSick = (startDate: Date, endDate?: Date) => {
    const end = endDate || new Date();
    const diffTime = end.getTime() - new Date(startDate).getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      case 'partially_recovered':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
      case 'long_term':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      active: 'Actief',
      partially_recovered: 'Gedeeltelijk hersteld',
      long_term: 'Langdurig',
    };
    return statusMap[status] || status;
  };

  const longTermCases = activeSickLeave.filter(leave => getDaysSick(leave.startDate) > 42);
  const poortwachterCases = activeSickLeave.filter(leave => leave.poortwachterActive);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!selectedCompany) {
    return (
      <EmptyState
        icon={Building2}
        title="Geen bedrijf geselecteerd"
        description="Selecteer een bedrijf om verzuim te beheren."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Verzuim Beheren
          </h1>
          <p className="text-gray-600 mt-2">
            Overzicht van actief verzuim en re-integratie
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6 bg-gradient-to-br from-red-50 to-red-100">
          <div className="flex items-center">
            <div className="p-3 bg-red-600 rounded-xl mr-4">
              <HeartPulse className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Actief Verzuim</p>
              <p className="text-2xl font-bold text-gray-900">
                {activeSickLeave.length}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-6 bg-gradient-to-br from-orange-50 to-orange-100">
          <div className="flex items-center">
            <div className="p-3 bg-orange-600 rounded-xl mr-4">
              <AlertTriangle className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Langdurig (&gt;6 weken)</p>
              <p className="text-2xl font-bold text-gray-900">
                {longTermCases.length}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-6 bg-gradient-to-br from-primary-50 to-primary-100">
          <div className="flex items-center">
            <div className="p-3 bg-primary-600 rounded-xl mr-4">
              <Clock className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Poortwachter</p>
              <p className="text-2xl font-bold text-gray-900">
                {poortwachterCases.length}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-6 bg-gradient-to-br from-green-50 to-green-100">
          <div className="flex items-center">
            <div className="p-3 bg-green-600 rounded-xl mr-4">
              <User className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Werknemers</p>
              <p className="text-2xl font-bold text-gray-900">
                {employees.length}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900">
            Actief Verzuim
          </h2>
        </div>

        {activeSickLeave.length === 0 ? (
          <EmptyState
            icon={HeartPulse}
            title="Geen actief verzuim"
            description="Er zijn momenteel geen werknemers met actief verzuim"
            actionLabel=""
            onAction={() => {}}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Werknemer
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Bedrijf
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Start Datum
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dagen Ziek
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Arbeidsgeschiktheid
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Poortwachter
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {activeSickLeave.map((sickLeave) => {
                  const daysSick = getDaysSick(sickLeave.startDate, sickLeave.endDate);
                  const isLongTerm = daysSick > 42;

                  return (
                    <tr key={sickLeave.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <User className="h-5 w-5 text-gray-400 mr-2" />
                          <span className="text-sm font-medium text-gray-900">
                            {getEmployeeName(sickLeave.employeeId)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {getCompanyName(sickLeave.companyId)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {new Date(sickLeave.startDate).toLocaleDateString('nl-NL')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className={`text-sm font-medium ${isLongTerm ? 'text-orange-600' : 'text-gray-900'}`}>
                            {daysSick} dagen
                          </span>
                          {isLongTerm && (
                            <AlertTriangle className="h-4 w-4 text-orange-600 ml-2" />
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {sickLeave.workCapacityPercentage}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(sickLeave.status)}`}>
                          {getStatusText(sickLeave.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {sickLeave.poortwachterActive ? (
                          <span className="inline-flex items-center px-3 py-1 text-xs font-medium bg-primary-100 text-primary-800 rounded-full">
                            <Clock className="h-3 w-3 mr-1" />
                            Actief
                          </span>
                        ) : (
                          <span className="text-xs text-gray-500">
                            Niet actief
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Alerts for long-term cases */}
      {longTermCases.length > 0 && (
        <Card>
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-orange-600 mr-2" />
              <h2 className="text-xl font-semibold text-gray-900">
                Aandachtspunten
              </h2>
            </div>
          </div>
          <div className="p-6">
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <p className="text-sm text-orange-800">
                <strong>{longTermCases.length} werknemers</strong> zijn langer dan 6 weken ziek. 
                Overweeg contact op te nemen met de arbodienst en activeer de poortwachter procedure indien nog niet gedaan.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default AdminAbsenceManagement;