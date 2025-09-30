import React, { useState, useEffect } from 'react';
import { Check, X, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import Modal from '../components/ui/Modal';
import { WeeklyTimesheet } from '../types/timesheet';
import {
  getPendingTimesheets,
  approveWeeklyTimesheet,
  rejectWeeklyTimesheet
} from '../services/timesheetService';
import { getEmployees } from '../services/firebase';
import { useToast } from '../hooks/useToast';

export default function TimesheetApprovals() {
  const { user } = useAuth();
  const { selectedCompany } = useApp();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [timesheets, setTimesheets] = useState<WeeklyTimesheet[]>([]);
  const [employees, setEmployees] = useState<Map<string, any>>(new Map());
  const [selectedTimesheet, setSelectedTimesheet] = useState<WeeklyTimesheet | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    loadData();
  }, [user, selectedCompany]);

  const loadData = async () => {
    if (!user || !selectedCompany) return;

    try {
      setLoading(true);
      const [pendingTimesheets, allEmployees] = await Promise.all([
        getPendingTimesheets(user.uid, selectedCompany.id),
        getEmployees(user.uid, selectedCompany.id)
      ]);

      setTimesheets(pendingTimesheets);

      const employeeMap = new Map();
      allEmployees.forEach(emp => employeeMap.set(emp.id, emp));
      setEmployees(employeeMap);
    } catch (error) {
      console.error('Error loading timesheet approvals:', error);
      showToast('Fout bij laden van goedkeuringen', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (timesheet: WeeklyTimesheet) => {
    if (!user) return;

    try {
      await approveWeeklyTimesheet(timesheet.id!, timesheet.userId, user.uid);
      showToast('Uren goedgekeurd', 'success');
      await loadData();
    } catch (error) {
      console.error('Error approving timesheet:', error);
      showToast('Fout bij goedkeuren', 'error');
    }
  };

  const handleRejectClick = (timesheet: WeeklyTimesheet) => {
    setSelectedTimesheet(timesheet);
    setShowRejectModal(true);
  };

  const handleRejectConfirm = async () => {
    if (!selectedTimesheet || !user || !rejectionReason.trim()) return;

    try {
      await rejectWeeklyTimesheet(
        selectedTimesheet.id!,
        selectedTimesheet.userId,
        user.uid,
        rejectionReason
      );
      showToast('Uren afgekeurd', 'success');
      setShowRejectModal(false);
      setRejectionReason('');
      setSelectedTimesheet(null);
      await loadData();
    } catch (error) {
      console.error('Error rejecting timesheet:', error);
      showToast('Fout bij afkeuren', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Uren goedkeuren</h1>
        <p className="text-gray-600 mt-1">
          {timesheets.length} uren wachten op goedkeuring
        </p>
      </div>

      {timesheets.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Geen uren ter goedkeuring</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {timesheets.map((timesheet) => {
            const employee = employees.get(timesheet.employeeId);
            return (
              <Card key={timesheet.id}>
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">
                        {employee ? `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}` : 'Onbekende medewerker'}
                      </h3>
                      <p className="text-sm text-gray-600">
                        Week {timesheet.weekNumber}, {timesheet.year}
                      </p>
                      {timesheet.submittedAt && (
                        <p className="text-sm text-gray-500 mt-1">
                          Ingediend op {timesheet.submittedAt.toLocaleString('nl-NL')}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleApprove(timesheet)}
                        size="sm"
                        variant="primary"
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Goedkeuren
                      </Button>
                      <Button
                        onClick={() => handleRejectClick(timesheet)}
                        size="sm"
                        variant="secondary"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Afkeuren
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Normale uren</p>
                      <p className="font-medium">{timesheet.totalRegularHours} uur</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Overuren</p>
                      <p className="font-medium">{timesheet.totalOvertimeHours} uur</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Avond/Nacht uren</p>
                      <p className="font-medium">
                        {timesheet.totalEveningHours + timesheet.totalNightHours} uur
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Reiskilometers</p>
                      <p className="font-medium">{timesheet.totalTravelKilometers} km</p>
                    </div>
                  </div>

                  <details className="text-sm">
                    <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                      Details bekijken
                    </summary>
                    <div className="mt-4 overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Datum</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Normaal</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Overuren</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Avond</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Nacht</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Weekend</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Reiskilometers</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Notities</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {timesheet.entries.map((entry, idx) => (
                            <tr key={idx}>
                              <td className="px-3 py-2 text-sm">{entry.date.toLocaleDateString('nl-NL')}</td>
                              <td className="px-3 py-2 text-sm">{entry.regularHours}</td>
                              <td className="px-3 py-2 text-sm">{entry.overtimeHours}</td>
                              <td className="px-3 py-2 text-sm">{entry.eveningHours}</td>
                              <td className="px-3 py-2 text-sm">{entry.nightHours}</td>
                              <td className="px-3 py-2 text-sm">{entry.weekendHours}</td>
                              <td className="px-3 py-2 text-sm">{entry.travelKilometers}</td>
                              <td className="px-3 py-2 text-sm">{entry.notes}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={showRejectModal}
        onClose={() => {
          setShowRejectModal(false);
          setRejectionReason('');
          setSelectedTimesheet(null);
        }}
        title="Uren afkeuren"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Geef een reden op waarom deze uren worden afgekeurd:
          </p>
          <textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={4}
            placeholder="Bijvoorbeeld: Ongeldige overuren op donderdag..."
          />
          <div className="flex justify-end gap-3">
            <Button
              onClick={() => {
                setShowRejectModal(false);
                setRejectionReason('');
                setSelectedTimesheet(null);
              }}
              variant="secondary"
            >
              Annuleren
            </Button>
            <Button
              onClick={handleRejectConfirm}
              disabled={!rejectionReason.trim()}
            >
              Afkeuren
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
