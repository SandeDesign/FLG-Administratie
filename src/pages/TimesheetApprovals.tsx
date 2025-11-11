import React, { useState, useEffect, useCallback } from 'react';
import { Check, X, Clock, Building2, ChevronRight, AlertCircle, TrendingDown, CheckCircle, User } from 'lucide-react';
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
  approvedHours: number;
  pendingTimesheet?: WeeklyTimesheet;
  hoursPercentage: number;
  status: 'under' | 'on-track' | 'over';
  weekNumber: number;
  year: number;
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
        const pendingTimesheet = pendingTimesheets.find(t => t.employeeId === employee.id);
        const contractHours = employee.contractInfo?.hoursPerWeek || 40;
        const approvedHours = pendingTimesheet?.totalRegularHours || 0;
        const percentage = (approvedHours / contractHours) * 100;

        let status: 'under' | 'on-track' | 'over' = 'on-track';
        if (percentage < 85) status = 'under';
        if (percentage > 105) status = 'over';

        summaries.push({
          employeeId: employee.id,
          firstName: employee.personalInfo.firstName,
          lastName: employee.personalInfo.lastName,
          contractHoursPerWeek: contractHours,
          approvedHours: approvedHours,
          pendingTimesheet: pendingTimesheet,
          hoursPercentage: percentage,
          status: status,
          weekNumber: pendingTimesheet?.weekNumber || new Date().getWeek(),
          year: pendingTimesheet?.year || new Date().getFullYear()
        });
      });

      setEmployeeSummaries(summaries.sort((a, b) => {
        // Sort: pending first, then by status (under > over > on-track)
        if (a.pendingTimesheet && !b.pendingTimesheet) return -1;
        if (!a.pendingTimesheet && b.pendingTimesheet) return 1;
        if (a.status === 'under' && b.status !== 'under') return -1;
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
      success('Uren goedgekeurd', 'Urenregistratie succesvol goedgekeurd');
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
      success('Uren afgekeurd', 'Urenregistratie succesvol afgekeurd');
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'under':
        return { bg: 'bg-red-50', text: 'text-red-700', badge: 'bg-red-100 text-red-700', icon: 'text-red-500' };
      case 'over':
        return { bg: 'bg-green-50', text: 'text-green-700', badge: 'bg-green-100 text-green-700', icon: 'text-green-500' };
      case 'on-track':
        return { bg: 'bg-blue-50', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700', icon: 'text-blue-500' };
      default:
        return { bg: 'bg-gray-50', text: 'text-gray-700', badge: 'bg-gray-100 text-gray-700', icon: 'text-gray-500' };
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'under':
        return 'Onder contract';
      case 'over':
        return 'Boven contract';
      case 'on-track':
        return 'Op schema';
      default:
        return 'Onbekend';
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

  const pendingCount = employeeSummaries.filter(e => e.pendingTimesheet).length;
  const underHoursCount = employeeSummaries.filter(e => e.status === 'under').length;

  return (
    <div className="space-y-3 sm:space-y-6 px-4 sm:px-0 pb-24 sm:pb-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Uren goedkeuren</h1>
        <p className="text-xs sm:text-sm text-gray-600 mt-1">
          {pendingCount} ter goedkeuring • {underHoursCount} onder contract uren
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

        <Card className="p-3 sm:p-4 border-orange-200 bg-orange-50">
          <div className="space-y-1">
            <p className="text-xs text-orange-700">Wachten</p>
            <p className="text-2xl sm:text-3xl font-bold text-orange-700">{pendingCount}</p>
            <p className="text-xs text-orange-600">goedkeuring</p>
          </div>
        </Card>

        <Card className="p-3 sm:p-4 border-red-200 bg-red-50">
          <div className="space-y-1">
            <p className="text-xs text-red-700">Onvoldoende</p>
            <p className="text-2xl sm:text-3xl font-bold text-red-700">{underHoursCount}</p>
            <p className="text-xs text-red-600">uren</p>
          </div>
        </Card>

        <Card className="p-3 sm:p-4 border-green-200 bg-green-50">
          <div className="space-y-1">
            <p className="text-xs text-green-700">Goedgekeurd</p>
            <p className="text-2xl sm:text-3xl font-bold text-green-700">
              {employees.length - pendingCount}
            </p>
            <p className="text-xs text-green-600">deze week</p>
          </div>
        </Card>
      </div>

      {/* Employee List */}
      {employeeSummaries.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title="Geen medewerkers"
            description="Er zijn geen medewerkers in uw bedrijf."
          />
        </Card>
      ) : (
        <div className="space-y-2 sm:space-y-3">
          {employeeSummaries.map((summary) => {
            const colors = getStatusColor(summary.status);
            const isPending = !!summary.pendingTimesheet;

            return (
              <Card
                key={summary.employeeId}
                className={`p-3 sm:p-4 cursor-pointer transition-all hover:shadow-md border-l-4 ${isPending ? 'border-l-orange-500' : 'border-l-gray-200'}`}
                onClick={() => {
                  if (isPending) {
                    setSelectedTimesheet(summary.pendingTimesheet!);
                    setShowDetailsModal(true);
                  }
                }}
              >
                <div className="space-y-3">
                  {/* Employee Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                          <User className="h-4 w-4 text-gray-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-gray-900 text-sm sm:text-base">
                            {summary.firstName} {summary.lastName}
                          </p>
                          {isPending && (
                            <p className="text-xs text-orange-600">Week {summary.weekNumber}, {summary.year}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {isPending && (
                      <span className="inline-block px-2 py-1 rounded text-xs font-semibold bg-orange-100 text-orange-700 flex-shrink-0">
                        Wachten
                      </span>
                    )}

                    {!isPending && (
                      <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${colors.badge} flex-shrink-0`}>
                        {getStatusLabel(summary.status)}
                      </span>
                    )}
                  </div>

                  {/* Hours Progress */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="text-gray-600">Gewerkt vs Contract</span>
                      <span className="font-semibold text-gray-900">
                        {summary.approvedHours}u / {summary.contractHoursPerWeek}u
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          summary.status === 'under' ? 'bg-red-500' : summary.status === 'over' ? 'bg-green-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${Math.min(summary.hoursPercentage, 100)}%` }}
                      />
                    </div>

                    {/* Percentage */}
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-gray-600">
                        {summary.hoursPercentage.toFixed(0)}% van contract
                      </span>
                      {summary.status === 'under' && (
                        <AlertCircle className="h-3 w-3 text-red-500" />
                      )}
                    </div>
                  </div>

                  {/* Action Hint */}
                  {isPending && (
                    <div className="flex items-center gap-2 text-xs text-blue-600 pt-2 border-t border-gray-100">
                      <Clock className="h-3 w-3" />
                      <span>Klik voor details en goedkeuring</span>
                      <ChevronRight className="h-3 w-3 ml-auto" />
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Details Modal */}
      <Modal
        isOpen={showDetailsModal}
        onClose={() => {
          setShowDetailsModal(false);
          setSelectedTimesheet(null);
          setRejectionReason('');
        }}
        title={selectedTimesheet ? `${selectedTimesheet.employeeId} - Uren details` : 'Uren details'}
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
                      <span className="text-gray-600">{entry.regularHours}u</span>
                    </div>
                    {entry.workActivities && entry.workActivities.length > 0 && (
                      <div className="space-y-1 mt-1">
                        {entry.workActivities.map((activity, actIdx) => (
                          <div key={actIdx} className="flex justify-between text-gray-600">
                            <span>{activity.description}</span>
                            <span>{activity.hours}u</span>
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