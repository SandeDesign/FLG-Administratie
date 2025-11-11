import React, { useState, useEffect, useCallback } from 'react';
import { Check, X, Clock, Building2, ChevronRight, AlertCircle, CheckCircle, User, ChevronDown } from 'lucide-react';
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

interface EmployeeTimesheetSummary {
  employeeId: string;
  firstName: string;
  lastName: string;
  contractHoursPerWeek: number;
  pendingTimesheets: WeeklyTimesheet[];
  hasPending: boolean;
}

export default function TimesheetApprovals() {
  const { user } = useAuth();
  const { selectedCompany, employees } = useApp();
  const { success, error: showError } = useToast();

  const [loading, setLoading] = useState(true);
  const [timesheets, setTimesheets] = useState<WeeklyTimesheet[]>([]);
  const [selectedTimesheet, setSelectedTimesheet] = useState<WeeklyTimesheet | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [employeeSummaries, setEmployeeSummaries] = useState<EmployeeTimesheetSummary[]>([]);
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user || !selectedCompany) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const pendingTimesheets = await getPendingTimesheets(user.uid, selectedCompany.id);
      setTimesheets(pendingTimesheets);

      // Build employee summaries
      const summaries: EmployeeTimesheetSummary[] = [];

      employees.forEach(employee => {
        const employeePendingTimesheets = pendingTimesheets.filter(t => t.employeeId === employee.id);

        summaries.push({
          employeeId: employee.id,
          firstName: employee.personalInfo.firstName,
          lastName: employee.personalInfo.lastName,
          contractHoursPerWeek: employee.contractInfo?.hoursPerWeek || 40,
          pendingTimesheets: employeePendingTimesheets,
          hasPending: employeePendingTimesheets.length > 0
        });
      });

      setEmployeeSummaries(summaries.sort((a, b) => {
        // Sort: pending first, then by name
        if (a.hasPending && !b.hasPending) return -1;
        if (!a.hasPending && b.hasPending) return 1;
        return a.firstName.localeCompare(b.firstName);
      }));
    } catch (error) {
      console.error('Error loading timesheet approvals:', error);
      showError('Fout bij laden', 'Kon urenregistratie goedkeuringen niet laden');
    } finally {
      setLoading(false);
    }
  }, [user, selectedCompany, employees, showError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleApprove = async (timesheet: WeeklyTimesheet) => {
    if (!user) return;

    try {
      await approveWeeklyTimesheet(timesheet.id!, timesheet.userId, user.uid);
      success('Uren goedgekeurd', `Week ${timesheet.weekNumber} goedgekeurd`);
      setShowDetailsModal(false);
      setSelectedTimesheet(null);
      await loadData();
    } catch (error) {
      console.error('Error approving timesheet:', error);
      showError('Fout bij goedkeuren', 'Kon urenregistratie niet goedkeuren');
    }
  };

  const handleRejectClick = () => {
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
      success('Uren afgekeurd', `Week ${selectedTimesheet.weekNumber} afgekeurd`);
      setShowRejectModal(false);
      setRejectionReason('');
      setShowDetailsModal(false);
      setSelectedTimesheet(null);
      await loadData();
    } catch (error) {
      console.error('Error rejecting timesheet:', error);
      showError('Fout bij afwijzen', 'Kon urenregistratie niet afwijzen');
    }
  };

  const closeDetailsModal = () => {
    setShowDetailsModal(false);
    setSelectedTimesheet(null);
    setRejectionReason('');
    setShowRejectModal(false);
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
      <div className="space-y-6 px-4 sm:px-0">
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

  const pendingCount = employeeSummaries.reduce((sum, e) => sum + e.pendingTimesheets.length, 0);
  const employeesWithPending = employeeSummaries.filter(e => e.hasPending).length;

  return (
    <div className="space-y-3 sm:space-y-6 px-4 sm:px-0 pb-24 sm:pb-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Uren goedkeuren</h1>
        <p className="text-xs sm:text-sm text-gray-600 mt-1">
          {pendingCount} aanvraag{pendingCount !== 1 ? 'en' : ''} • {employeesWithPending} medewerker{employeesWithPending !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
        <Card className="p-3 sm:p-4">
          <div className="space-y-1">
            <p className="text-xs text-gray-600">Totaal</p>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900">{employees.length}</p>
            <p className="text-xs text-gray-500">medewerkers</p>
          </div>
        </Card>

        <Card className="p-3 sm:p-4 border border-orange-200 bg-orange-50">
          <div className="space-y-1">
            <p className="text-xs text-orange-700">Wachten</p>
            <p className="text-2xl sm:text-3xl font-bold text-orange-700">{pendingCount}</p>
            <p className="text-xs text-orange-600">aanvraag{pendingCount !== 1 ? 'en' : ''}</p>
          </div>
        </Card>

        <Card className="p-3 sm:p-4 border border-blue-200 bg-blue-50">
          <div className="space-y-1">
            <p className="text-xs text-blue-700">Medewerkers</p>
            <p className="text-2xl sm:text-3xl font-bold text-blue-700">{employeesWithPending}</p>
            <p className="text-xs text-blue-600">met aanvragen</p>
          </div>
        </Card>

        <Card className="p-3 sm:p-4 border border-green-200 bg-green-50">
          <div className="space-y-1">
            <p className="text-xs text-green-700">Klaar</p>
            <p className="text-2xl sm:text-3xl font-bold text-green-700">
              {employees.length - employeesWithPending}
            </p>
            <p className="text-xs text-green-600">deze week</p>
          </div>
        </Card>
      </div>

      {/* Employee List */}
      {employeeSummaries.length === 0 ? (
        <Card>
          <EmptyState
            icon={Clock}
            title="Geen medewerkers"
            description="Er zijn geen medewerkers in uw bedrijf."
          />
        </Card>
      ) : (
        <div className="space-y-2 sm:space-y-3">
          {employeeSummaries.map((summary) => {
            const isExpanded = expandedEmployee === summary.employeeId;

            return (
              <div key={summary.employeeId} className="space-y-2">
                {/* Employee Card - Button */}
                <button
                  onClick={() => {
                    if (summary.hasPending) {
                      setExpandedEmployee(isExpanded ? null : summary.employeeId);
                    }
                  }}
                  disabled={!summary.hasPending}
                  className={`w-full p-3 sm:p-4 rounded-lg border-l-4 transition-all hover:shadow-md text-left ${
                    summary.hasPending 
                      ? 'border-l-orange-500 bg-white border border-gray-200 hover:bg-gray-50 cursor-pointer' 
                      : 'border-l-gray-200 bg-white border border-gray-200 cursor-default'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                        <User className="h-4 w-4 text-gray-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-900 text-sm sm:text-base">
                          {summary.firstName} {summary.lastName}
                        </p>
                        {summary.hasPending && (
                          <p className="text-xs text-orange-600">
                            {summary.pendingTimesheets.length} aanvraag{summary.pendingTimesheets.length !== 1 ? 'en' : ''} wachten
                          </p>
                        )}
                        {!summary.hasPending && (
                          <p className="text-xs text-green-600 flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" /> Alles goedgekeurd
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {summary.hasPending ? (
                        <>
                          <span className="inline-block px-2 py-1 rounded text-xs font-semibold bg-orange-100 text-orange-700">
                            {summary.pendingTimesheets.length}
                          </span>
                          <ChevronDown
                            className={`h-4 w-4 text-gray-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          />
                        </>
                      ) : (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      )}
                    </div>
                  </div>
                </button>

                {/* Expanded Pending Timesheets */}
                {isExpanded && summary.hasPending && (
                  <div className="space-y-2 pl-2 sm:pl-4 border-l-2 border-orange-200">
                    {summary.pendingTimesheets.map((timesheet) => {
                      const hoursPercentage = (timesheet.totalRegularHours / summary.contractHoursPerWeek) * 100;
                      const isUnder = hoursPercentage < 85;

                      return (
                        <button
                          key={timesheet.id}
                          onClick={() => {
                            setSelectedTimesheet(timesheet);
                            setShowDetailsModal(true);
                          }}
                          className="w-full p-3 sm:p-4 bg-orange-50 border border-orange-200 rounded-lg hover:shadow-md transition-all text-left"
                        >
                          <div className="space-y-2">
                            {/* Week Info */}
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-medium text-gray-900 text-sm">
                                  Week {timesheet.weekNumber}, {timesheet.year}
                                </p>
                                <p className="text-xs text-gray-600 mt-0.5">
                                  {timesheet.submittedAt?.toLocaleDateString('nl-NL')} ingediend
                                </p>
                              </div>
                              <span className="text-xs font-semibold px-2 py-1 bg-white text-orange-700 rounded border border-orange-200 flex-shrink-0">
                                Wachten
                              </span>
                            </div>

                            {/* Hours Info */}
                            <div className="space-y-1.5 bg-white rounded p-2">
                              <div className="flex items-center justify-between text-xs sm:text-sm">
                                <span className="text-gray-600">Gewerkt vs Contract</span>
                                <span className={`font-semibold ${isUnder ? 'text-red-600' : 'text-gray-900'}`}>
                                  {timesheet.totalRegularHours}u / {summary.contractHoursPerWeek}u
                                </span>
                              </div>

                              {/* Progress Bar */}
                              <div className="w-full bg-gray-200 rounded-full h-1.5">
                                <div
                                  className={`h-1.5 rounded-full transition-all ${isUnder ? 'bg-red-500' : 'bg-green-500'}`}
                                  style={{ width: `${Math.min(hoursPercentage, 100)}%` }}
                                />
                              </div>

                              <div className="flex items-center justify-between text-xs text-gray-600">
                                <span>{hoursPercentage.toFixed(0)}% van contract</span>
                                {isUnder && <AlertCircle className="h-3 w-3 text-red-500" />}
                              </div>
                            </div>

                            {/* Quick Stats */}
                            <div className="grid grid-cols-3 gap-2 text-xs bg-white rounded p-2">
                              <div className="text-center">
                                <p className="text-gray-600">Werkdagen</p>
                                <p className="font-semibold text-gray-900">
                                  {timesheet.entries.filter(e => e.regularHours > 0).length}
                                </p>
                              </div>
                              <div className="text-center">
                                <p className="text-gray-600">Gem./dag</p>
                                <p className="font-semibold text-gray-900">
                                  {(() => {
                                    const workDays = timesheet.entries.filter(e => e.regularHours > 0).length;
                                    return workDays > 0 ? (timesheet.totalRegularHours / workDays).toFixed(1) : '0';
                                  })()} u
                                </p>
                              </div>
                              <div className="text-center">
                                <p className="text-gray-600">Km</p>
                                <p className="font-semibold text-gray-900">{timesheet.totalTravelKilometers}</p>
                              </div>
                            </div>

                            {/* Action Hint */}
                            <div className="flex items-center gap-1 text-xs text-blue-600 pt-1 border-t border-orange-100">
                              <Clock className="h-3 w-3" />
                              <span>Klik voor details en goedkeuring</span>
                              <ChevronRight className="h-3 w-3 ml-auto" />
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Details Modal */}
      <Modal
        isOpen={showDetailsModal}
        onClose={closeDetailsModal}
        title={selectedTimesheet ? `Week ${selectedTimesheet.weekNumber}, ${selectedTimesheet.year}` : 'Uren details'}
      >
        {selectedTimesheet && (
          <div className="space-y-4 max-h-[80vh] overflow-y-auto">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 rounded-lg text-sm">
              <div>
                <p className="text-gray-600">Totaal uren</p>
                <p className="text-lg font-bold text-gray-900">{selectedTimesheet.totalRegularHours}u</p>
              </div>
              <div>
                <p className="text-gray-600">Reiskilometers</p>
                <p className="text-lg font-bold text-gray-900">{selectedTimesheet.totalTravelKilometers}km</p>
              </div>
              <div>
                <p className="text-gray-600">Werkdagen</p>
                <p className="text-lg font-bold text-gray-900">
                  {selectedTimesheet.entries.filter(e => e.regularHours > 0).length}
                </p>
              </div>
              <div>
                <p className="text-gray-600">Gemiddeld/dag</p>
                <p className="text-lg font-bold text-gray-900">
                  {(() => {
                    const workDays = selectedTimesheet.entries.filter(e => e.regularHours > 0).length;
                    return workDays > 0 ? (selectedTimesheet.totalRegularHours / workDays).toFixed(1) : '0';
                  })()} u
                </p>
              </div>
            </div>

            {/* Low Hours Warning */}
            {(() => {
              const employee = employees.find(emp => emp.id === selectedTimesheet.employeeId);
              const contractHours = employee?.contractInfo?.hoursPerWeek || 40;
              const actual = selectedTimesheet.totalRegularHours;
              const threshold = contractHours * 0.85;

              if (actual < threshold) {
                return (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex gap-2">
                      <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-red-700">
                        <strong>⚠️ Onder contract uren</strong>
                        <p className="mt-1">
                          {actual}u van {contractHours}u contract ({(actual / contractHours * 100).toFixed(0)}%)
                        </p>
                        {selectedTimesheet.lowHoursExplanation && (
                          <p className="mt-2 text-red-600">
                            <strong>Verklaring:</strong> {selectedTimesheet.lowHoursExplanation}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            {/* Daily Details */}
            <div>
              <h4 className="font-semibold text-sm mb-2">Dagelijkse details</h4>
              <div className="space-y-2 text-xs">
                {selectedTimesheet.entries.map((entry, idx) => (
                  <div key={idx} className="p-2 bg-gray-50 rounded">
                    <div className="flex justify-between mb-1">
                      <span className="font-medium">{entry.date.toLocaleDateString('nl-NL')}</span>
                      <span className="text-gray-600 font-semibold">{entry.regularHours}u</span>
                    </div>
                    {entry.workActivities && entry.workActivities.length > 0 && (
                      <div className="space-y-1 mt-1 pl-2 border-l border-gray-300">
                        {entry.workActivities.map((activity, actIdx) => (
                          <div key={actIdx} className="flex justify-between text-gray-600">
                            <span className="text-xs">{activity.description}</span>
                            <span className="font-semibold text-xs">{activity.hours}u</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            {!showRejectModal && (
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  onClick={() => handleApprove(selectedTimesheet)}
                  variant="primary"
                  className="flex-1"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Goedkeuren
                </Button>
                <Button
                  onClick={handleRejectClick}
                  variant="secondary"
                  className="flex-1"
                >
                  <X className="h-4 w-4 mr-2" />
                  Afkeuren
                </Button>
              </div>
            )}

            {/* Rejection Form */}
            {showRejectModal && (
              <div className="space-y-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm font-semibold text-red-900">Geef een reden voor afkeuring:</p>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-red-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
                  rows={3}
                  placeholder="Bijvoorbeeld: Ongeldige uren op donderdag..."
                />
                <div className="flex gap-2">
                  <Button
                    onClick={() => setShowRejectModal(false)}
                    variant="secondary"
                    className="flex-1"
                  >
                    Annuleren
                  </Button>
                  <Button
                    onClick={handleRejectConfirm}
                    disabled={!rejectionReason.trim()}
                    className="flex-1"
                  >
                    Bevestigen
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}