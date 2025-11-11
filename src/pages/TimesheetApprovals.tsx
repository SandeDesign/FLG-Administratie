import React, { useState, useEffect, useCallback } from 'react';
import { Check, X, Clock, Building2 } from 'lucide-react';
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
import { EmptyState } from '../components/ui/EmptyState';

export default function TimesheetApprovals() {
  const { user } = useAuth();
  const { selectedCompany, employees } = useApp();
  const { success, error: showError } = useToast();

  const [loading, setLoading] = useState(true);
  const [timesheets, setTimesheets] = useState<WeeklyTimesheet[]>([]);
  const [selectedTimesheet, setSelectedTimesheet] = useState<WeeklyTimesheet | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const loadData = useCallback(async () => {
    if (!user || !selectedCompany) {
      console.log('TimesheetApprovals: Cannot load - missing user or selectedCompany:', { user: !!user, selectedCompany: !!selectedCompany });
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('TimesheetApprovals: Loading pending timesheets for userId:', user.uid, 'companyId:', selectedCompany.id);
      console.log('TimesheetApprovals: Available employees:', employees.length);
      const pendingTimesheets = await getPendingTimesheets(user.uid, selectedCompany.id);
      console.log('TimesheetApprovals: Loaded pending timesheets:', pendingTimesheets.length);
      setTimesheets(pendingTimesheets);
    } catch (error) {
      console.error('TimesheetApprovals: Error loading timesheet approvals:', error);
      showError('Fout bij laden', 'Kon urenregistratie goedkeuringen niet laden');
    } finally {
      setLoading(false);
    }
  }, [user, selectedCompany, employees.length, showError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getEmployeeName = (employeeId: string) => {
    const employee = employees.find(e => e.id === employeeId);
    return employee 
      ? `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`
      : 'Onbekende medewerker';
  };

  const handleApprove = async (timesheet: WeeklyTimesheet) => {
    if (!user) return;

    try {
      await approveWeeklyTimesheet(timesheet.id!, timesheet.userId, user.uid);
      success('Uren goedgekeurd', 'Urenregistratie succesvol goedgekeurd');
      await loadData();
    } catch (error) {
      console.error('Error approving timesheet:', error);
      showError('Fout bij goedkeuren', 'Kon urenregistratie niet goedkeuren');
    }
  };

  const handleRejectClick = (timesheet: WeeklyTimesheet) => {
    setSelectedTimesheet(timesheet);
    setShowRejectModal(true);
  };

  const handleRejectConfirm = async () => {
    if (!selectedTimesheet || !user || !rejectionReason.trim()) {
      showError('Fout', 'Reden voor afwijzing is verplicht.');
      return;
    }

    try {
      await rejectWeeklyTimesheet(
        selectedTimesheet.id!,
        selectedTimesheet.userId,
        user.uid,
        rejectionReason
      );
      success('Uren afgekeurd', 'Urenregistratie succesvol afgekeurd');
      setShowRejectModal(false);
      setRejectionReason('');
      setSelectedTimesheet(null);
      await loadData();
    } catch (error) {
      console.error('Error rejecting timesheet:', error);
      showError('Fout bij afwijzen', 'Kon urenregistratie niet afwijzen');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (!selectedCompany) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Uren goedkeuren</h1>
        </div>
        <EmptyState
          icon={Building2}
          title="Geen bedrijf geselecteerd"
          description="Selecteer een bedrijf uit de dropdown in de zijbalk om urenregistraties goed te keuren."
        />
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
          <EmptyState
            icon={Clock}
            title="Geen uren ter goedkeuring"
            description="Er zijn momenteel geen urenregistraties die goedkeuring behoeven."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {timesheets.map((timesheet) => {
            const employee = employees.find(emp => emp.id === timesheet.employeeId);
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

                  {/* Low Hours Warning */}
                  {(() => {
                    const employee = employees.find(emp => emp.id === timesheet.employeeId);
                    const contractHoursPerWeek = employee?.contractInfo?.hoursPerWeek || 40;
                    const expectedWeeklyHours = contractHoursPerWeek;
                    const actualWeeklyHours = timesheet.totalRegularHours;
                    const underPerformanceThreshold = expectedWeeklyHours * 0.85; // 85% of contract hours
                    const workDays = timesheet.entries.filter(e => e.regularHours > 0).length;
                    const averageHoursPerDay = workDays > 0 ? actualWeeklyHours / workDays : 0;
                    
                    if (workDays > 0 && actualWeeklyHours < underPerformanceThreshold) {
                      return (
                        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                          <div className="flex items-start gap-2">
                            <div className="text-yellow-800 text-sm">
                              <strong>⚠️ Onder contract uren:</strong> {actualWeeklyHours}u van {contractHoursPerWeek}u contract 
                              (gemiddeld {averageHoursPerDay.toFixed(1)}u per werkdag)
                            </div>
                          </div>
                          {timesheet.lowHoursExplanation && (
                            <div className="mt-2 text-sm text-gray-700">
                              <strong>Verklaring werknemer:</strong> {timesheet.lowHoursExplanation}
                            </div>
                          )}
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Totaal uren</p>
                      <p className="font-medium">{timesheet.totalRegularHours} uur</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Reiskilometers</p>
                      <p className="font-medium">{timesheet.totalTravelKilometers} km</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Werkdagen</p>
                      <p className="font-medium">{timesheet.entries.filter(e => e.regularHours > 0).length} dagen</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Gemiddeld per dag</p>
                      <p className={`font-medium ${
                        (() => {
                          const workDays = timesheet.entries.filter(e => e.regularHours > 0).length;
                          const avg = workDays > 0 ? timesheet.totalRegularHours / workDays : 0;
                          return avg < 7 ? 'text-yellow-600' : 'text-gray-900';
                        })()
                      }`}>
                        {(() => {
                          const workDays = timesheet.entries.filter(e => e.regularHours > 0).length;
                          return workDays > 0 ? (timesheet.totalRegularHours / workDays).toFixed(1) : '0';
                        })()} uur
                      </p>
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
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Uren</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Reiskilometers</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Werkzaamheden</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Notities</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {timesheet.entries.map((entry, idx) => (
                            <tr key={idx} className={entry.notes?.includes('ITKnecht') ? 'bg-blue-50' : ''}>
                              <td className="px-3 py-2 text-sm">{entry.date.toLocaleDateString('nl-NL')}</td>
                              <td className="px-3 py-2 text-sm">{entry.regularHours}</td>
                              <td className="px-3 py-2 text-sm">{entry.travelKilometers}</td>
                              <td className="px-3 py-2 text-sm">
                                {entry.workActivities && entry.workActivities.length > 0 ? (
                                  <div className="space-y-1">
                                    {entry.workActivities.map((activity, actIdx) => (
                                      <div 
                                        key={actIdx} 
                                        className={`text-xs p-1 rounded ${
                                          activity.isITKnechtImport ? 'bg-blue-100 text-blue-800' : 'bg-gray-100'
                                        }`}
                                      >
                                        <span className="font-medium">{activity.hours}u:</span> {activity.description}
                                        {activity.isITKnechtImport && (
                                          <span className="ml-1 text-blue-600">📥</span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-gray-400 italic">Geen details</span>
                                )}
                              </td>
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
            placeholder="Bijvoorbeeld: Ongeldige uren op donderdag..."
          />
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowRejectModal(false);
                setRejectionReason('');
                setSelectedTimesheet(null);
              }}
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