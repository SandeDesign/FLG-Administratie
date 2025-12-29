import React, { useEffect, useState, useCallback } from 'react';
import { HeartPulse, Plus, Building2 } from 'lucide-react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import AbsenceStatsCard from '../components/absence/AbsenceStatsCard';
import SickLeaveModal from '../components/absence/SickLeaveModal';
import RecoveryModal from '../components/absence/RecoveryModal';
import { SickLeave, AbsenceStatistics } from '../types';
import * as firebaseService from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { useApp } from '../contexts/AppContext';

const Absence: React.FC = () => {
  const { user, currentEmployeeId, adminUserId } = useAuth();
  const { selectedCompany } = useApp(); // Get selectedCompany from AppContext
  const { error: showError } = useToast();
  const [loading, setLoading] = useState(true);
  const [sickLeaveRecords, setSickLeaveRecords] = useState<SickLeave[]>([]);
  const [absenceStats, setAbsenceStats] = useState<AbsenceStatistics | null>(null);
  const [isSickLeaveModalOpen, setIsSickLeaveModalOpen] = useState(false);
  const [isRecoveryModalOpen, setIsRecoveryModalOpen] = useState(false);

  const loadAbsenceData = useCallback(async () => {
    if (!user || !adminUserId || !currentEmployeeId || !selectedCompany) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const currentYear = new Date().getFullYear();

      // Get employee data to find the admin userId (if different from current user.uid)
      // In this setup, user.uid is the adminUserId for all data.
      const currentEmployee = await firebaseService.getEmployeeById(currentEmployeeId);
      if (!currentEmployee) {
        showError('Fout', 'Werknemergegevens niet gevonden.');
        setLoading(false);
        return;
      }

      const [records, stats] = await Promise.all([
        firebaseService.getSickLeaveRecords(adminUserId, currentEmployeeId),
        firebaseService.getAbsenceStatistics(currentEmployeeId, adminUserId, currentYear),
      ]);

      setSickLeaveRecords(records);
      setAbsenceStats(stats);
    } catch (err) {
      console.error('Error loading absence data:', err);
      showError('Fout bij laden', 'Kan verzuimgegevens niet laden');
    } finally {
      setLoading(false);
    }
  }, [user, adminUserId, currentEmployeeId, selectedCompany, showError]);

  useEffect(() => {
    loadAbsenceData();
  }, [loadAbsenceData]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-red-100 text-red-800';
      case 'recovered':
        return 'bg-green-100 text-green-800';
      case 'partially_recovered':
        return 'bg-yellow-100 text-yellow-800';
      case 'long_term':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      active: 'Actief',
      recovered: 'Hersteld',
      partially_recovered: 'Gedeeltelijk hersteld',
      long_term: 'Langdurig',
    };
    return statusMap[status] || status;
  };

  const activeSickLeave = sickLeaveRecords.find(record =>
    record.status === 'active' || record.status === 'partially_recovered'
  );

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!currentEmployeeId) {
    return (
      <EmptyState
        icon={Building2}
        title="Geen werknemer geselecteerd"
        description="Selecteer een werknemer om verzuim te beheren."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Verzuim</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Bekijk je verzuimhistorie en statistieken
          </p>
        </div>
        <Button
          variant={activeSickLeave ? 'secondary' : 'primary'}
          onClick={() => activeSickLeave ? setIsRecoveryModalOpen(true) : setIsSickLeaveModalOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          {activeSickLeave ? 'Beter Melden' : 'Ziek Melden'}
        </Button>
      </div>

      {activeSickLeave && (
        <Card className="p-6 border-l-4 border-red-600">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Actieve Ziekmelding
              </h3>
              <div className="space-y-1 text-sm">
                <p className="text-gray-600 dark:text-gray-400">
                  <span className="font-medium">Start datum:</span>{' '}
                  {new Date(activeSickLeave.startDate).toLocaleDateString('nl-NL')}
                </p>
                <p className="text-gray-600 dark:text-gray-400">
                  <span className="font-medium">Arbeidsgeschiktheid:</span>{' '}
                  {activeSickLeave.workCapacityPercentage}%
                </p>
                {activeSickLeave.poortwachterActive && (
                  <p className="text-orange-600 font-medium">
                    Poortwachter actief
                  </p>
                )}
              </div>
            </div>
            <span className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(activeSickLeave.status)}`}>
              {getStatusText(activeSickLeave.status)}
            </span>
          </div>
        </Card>
      )}

      {absenceStats && (
        <AbsenceStatsCard stats={absenceStats} />
      )}

      <Card>
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Verzuimhistorie
          </h2>
        </div>

        {sickLeaveRecords.length === 0 ? (
          <EmptyState
            icon={HeartPulse}
            title="Geen verzuim geregistreerd"
            description="Er is geen verzuim geregistreerd"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Start Datum
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Eind Datum
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Duur
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Arbeidsgeschiktheid
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {sickLeaveRecords.map((record) => {
                  const duration = record.endDate
                    ? Math.floor(
                        (new Date(record.endDate).getTime() - new Date(record.startDate).getTime()) /
                          (1000 * 60 * 60 * 24)
                      )
                    : Math.floor(
                        (new Date().getTime() - new Date(record.startDate).getTime()) /
                          (1000 * 60 * 60 * 24)
                      );

                  return (
                    <tr key={record.id} className="hover:bg-gray-50 dark:bg-gray-900">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {new Date(record.startDate).toLocaleDateString('nl-NL')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {record.endDate
                          ? new Date(record.endDate).toLocaleDateString('nl-NL')
                          : 'Nog actief'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {duration} dagen
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(record.status)}`}>
                          {getStatusText(record.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {record.workCapacityPercentage}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <SickLeaveModal
        isOpen={isSickLeaveModalOpen}
        onClose={() => setIsSickLeaveModalOpen(false)}
        onSuccess={loadAbsenceData}
        employeeId={currentEmployeeId || ''}
      />

      {activeSickLeave && (
        <RecoveryModal
          isOpen={isRecoveryModalOpen}
          onClose={() => setIsRecoveryModalOpen(false)}
          onSuccess={loadAbsenceData}
          sickLeave={activeSickLeave}
          employeeId={currentEmployeeId || ''}
        />
      )}
    </div>
  );
};

export default Absence;