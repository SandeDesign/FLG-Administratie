import React, { useState, useEffect, useCallback } from 'react';
import { Check, X, Clock, Building2, ChevronRight, AlertCircle, CheckCircle, User, ChevronDown, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import Modal from '../components/ui/Modal';
import { WeeklyTimesheet } from '../types/timesheet';
import {
  getAllPendingTimesheets,
  approveWeeklyTimesheet,
  rejectWeeklyTimesheet
} from '../services/timesheetService';
import { getEmployees } from '../services/firebase';
import { useToast } from '../hooks/useToast';
import { EmptyState } from '../components/ui/EmptyState';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface EmployeeTimesheetSummary {
  employeeId: string;
  firstName: string;
  lastName: string;
  contractHoursPerWeek: number;
  pendingTimesheets: WeeklyTimesheet[];
  allTimesheets: WeeklyTimesheet[];
  hasPending: boolean;
  totalPendingHours?: number;
  hoursLacking?: number;
  totalAllHours?: number;
}

export default function TimesheetApprovals() {
  const { user } = useAuth();
  const { selectedCompany, employees } = useApp();
  const { success, error: showError } = useToast();

  const [loading, setLoading] = useState(true);
  const [timesheets, setTimesheets] = useState<WeeklyTimesheet[]>([]);
  const [allTimesheets, setAllTimesheets] = useState<WeeklyTimesheet[]>([]);
  const [selectedTimesheet, setSelectedTimesheet] = useState<WeeklyTimesheet | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [employeeSummaries, setEmployeeSummaries] = useState<EmployeeTimesheetSummary[]>([]);
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);
  const [dashboardEmployeeId, setDashboardEmployeeId] = useState<string | null>(null);

  // 🔥 Load ALL timesheets from Firebase (not just pending)
  const loadAllTimesheets = useCallback(async (userId: string, companyId: string) => {
    try {
      const q = query(
        collection(db, 'weeklyTimesheets'),
        where('userId', '==', userId),
        where('companyId', '==', companyId)
      );
      const querySnapshot = await getDocs(q);
      const docs = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          entries: (data.entries || []).map((entry: any) => ({
            ...entry,
            date: entry.date instanceof Timestamp ? entry.date.toDate() : new Date(entry.date)
          })),
          submittedAt: data.submittedAt instanceof Timestamp ? data.submittedAt.toDate() : data.submittedAt,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : data.createdAt,
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : data.updatedAt
        } as WeeklyTimesheet;
      });
      return docs;
    } catch (error) {
      console.error('Error loading all timesheets:', error);
      return [];
    }
  }, []);

  const loadData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Get ALL pending timesheets (not filtered by company - admin sees everything)
      const pendingTimesheets = await getAllPendingTimesheets(user.uid);
      setTimesheets(pendingTimesheets);

      // Get ALL timesheets - use first company or skip if none
      const companyIdForAll = selectedCompany?.id || '';
      const allTimesheetsData = companyIdForAll ? await loadAllTimesheets(user.uid, companyIdForAll) : [];
      setAllTimesheets(allTimesheetsData);

      const summaries: EmployeeTimesheetSummary[] = [];

      employees.forEach(employee => {
        const employeePendingTimesheets = pendingTimesheets.filter(t => t.employeeId === employee.id);
        const employeeAllTimesheets = allTimesheetsData.filter(t => t.employeeId === employee.id);
        
        // Calculate pending totals
        const totalPendingHours = employeePendingTimesheets.reduce((sum, t) => sum + t.totalRegularHours, 0);
        const contractHours = employee.contractInfo?.hoursPerWeek || 40;
        const expectedHours = contractHours * employeePendingTimesheets.length;
        const hoursLacking = Math.max(0, expectedHours - totalPendingHours);

        // Calculate all timesheets totals
        const totalAllHours = employeeAllTimesheets.reduce((sum, t) => sum + t.totalRegularHours, 0);

        summaries.push({
          employeeId: employee.id,
          firstName: employee.personalInfo.firstName,
          lastName: employee.personalInfo.lastName,
          contractHoursPerWeek: contractHours,
          pendingTimesheets: employeePendingTimesheets,
          allTimesheets: employeeAllTimesheets,
          hasPending: employeePendingTimesheets.length > 0,
          totalPendingHours,
          hoursLacking,
          totalAllHours
        });
      });

      setEmployeeSummaries(summaries.sort((a, b) => {
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
  }, [user, selectedCompany?.id, employees, showError, loadAllTimesheets]);

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

  // No longer require company selection - admin sees all pending timesheets

  const pendingCount = employeeSummaries.reduce((sum, e) => sum + e.pendingTimesheets.length, 0);
  const employeesWithPending = employeeSummaries.filter(e => e.hasPending).length;
  const approvedCount = employees.length - employeesWithPending;

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0 pb-24 sm:pb-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Uren goedkeuren</h1>
        <p className="text-sm text-gray-600 mt-2">
          {pendingCount} aanvraag{pendingCount !== 1 ? 'en' : ''} wachtend op goedkeuring
        </p>
      </div>

      {/* Minimale Stats Cards - Veel kleiner */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3 bg-white">
          <p className="text-xs font-medium text-gray-600">Wachten</p>
          <p className="text-xl font-bold text-orange-600 mt-1">{pendingCount}</p>
        </Card>
        <Card className="p-3 bg-white">
          <p className="text-xs font-medium text-gray-600">Medewerkers</p>
          <p className="text-xl font-bold text-primary-600 mt-1">{employeesWithPending}</p>
        </Card>
        <Card className="p-3 bg-white">
          <p className="text-xs font-medium text-gray-600">Klaar</p>
          <p className="text-xl font-bold text-green-600 mt-1">{approvedCount}</p>
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
        <div className="space-y-3">
          {employeeSummaries.map((summary) => {
            const isExpanded = expandedEmployee === summary.employeeId;

            return (
              <div key={summary.employeeId} className="space-y-2">
                {/* Employee Card - ALTIJD MET DASHBOARD BUTTON */}
                <div className={`w-full p-4 sm:p-5 rounded-lg border-2 transition-all text-left ${
                  summary.hasPending 
                    ? 'border-orange-300 bg-white hover:bg-orange-50' 
                    : 'border-gray-200 bg-white'
                }`}>
                  <div className="flex items-center justify-between gap-3">
                    {/* Left section - expandable */}
                    <button
                      onClick={() => {
                        if (summary.hasPending) {
                          setExpandedEmployee(isExpanded ? null : summary.employeeId);
                        }
                      }}
                      className={`flex-1 flex items-center gap-3 min-w-0 text-left ${summary.hasPending ? 'cursor-pointer' : 'cursor-default'}`}
                    >
                      <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center flex-shrink-0">
                        <User className="h-5 w-5 sm:h-6 sm:w-6 text-primary-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-900 text-sm sm:text-base truncate">
                          {summary.firstName} {summary.lastName}
                        </p>
                        {/* Info sous le nom - TOUJOURS visible */}
                        <div className="flex flex-col gap-1 mt-2 text-xs">
                          <div className="flex items-center gap-2 flex-wrap">
                            {summary.hasPending ? (
                              <>
                                <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-semibold whitespace-nowrap">
                                  {summary.pendingTimesheets.length} week{summary.pendingTimesheets.length !== 1 ? 'en' : ''}
                                </span>
                                <span className="px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 font-semibold whitespace-nowrap">
                                  {summary.totalPendingHours}u uren
                                </span>
                                {summary.hoursLacking && summary.hoursLacking > 0 && (
                                  <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold whitespace-nowrap flex items-center gap-1">
                                    <TrendingDown className="h-3 w-3" />
                                    -{summary.hoursLacking.toFixed(1)}u
                                  </span>
                                )}
                              </>
                            ) : (
                              <>
                                <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-semibold whitespace-nowrap">
                                  {summary.allTimesheets.length} weken
                                </span>
                                <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold whitespace-nowrap flex items-center gap-1">
                                  <CheckCircle className="h-3 w-3" />
                                  {summary.totalAllHours}u totaal
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>

                    {/* Right section - Buttons Container - ALWAYS clickable */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => {
                          setDashboardEmployeeId(summary.employeeId);
                        }}
                        className="px-2 py-1 rounded-lg bg-primary-100 text-primary-700 text-xs font-semibold hover:bg-primary-200 active:bg-primary-300 flex items-center gap-1 whitespace-nowrap transition-colors"
                        title="Dashboard met alle weken"
                      >
                        <BarChart3 className="h-3 w-3" />
                        Dashboard
                      </button>
                      {summary.hasPending && (
                        <>
                          <span className="inline-flex items-center justify-center h-6 w-6 sm:h-8 sm:w-8 rounded-full bg-orange-100 text-orange-700 text-xs sm:text-sm font-bold">
                            {summary.pendingTimesheets.length}
                          </span>
                          <ChevronDown
                            className={`h-5 w-5 text-gray-400 transition-transform flex-shrink-0 cursor-pointer ${isExpanded ? 'rotate-180' : ''}`}
                          />
                        </>
                      )}
                      {!summary.hasPending && (
                        <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Pending Timesheets */}
                {isExpanded && summary.hasPending && (
                  <div className="space-y-2 ml-4 sm:ml-6 border-l-3 border-orange-300 pl-4">
                    {summary.pendingTimesheets.map((timesheet) => {
                      const hoursPercentage = (timesheet.totalRegularHours / summary.contractHoursPerWeek) * 100;
                      const isUnder = hoursPercentage < 85;
                      const workDays = timesheet.entries.filter(e => e.regularHours > 0).length;
                      const avgPerDay = workDays > 0 ? (timesheet.totalRegularHours / workDays).toFixed(1) : '0';

                      return (
                        <button
                          key={timesheet.id}
                          onClick={() => {
                            setSelectedTimesheet(timesheet);
                            setShowDetailsModal(true);
                          }}
                          className="w-full p-4 bg-white border-2 border-orange-200 rounded-lg hover:shadow-md active:shadow-sm transition-all text-left"
                        >
                          <div className="space-y-3">
                            {/* Week Header */}
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold text-gray-900 text-sm sm:text-base">
                                  Week {timesheet.weekNumber}, {timesheet.year}
                                </p>
                                {timesheet.submittedAt && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    Ingediend: {
                                      typeof timesheet.submittedAt === 'string'
                                        ? new Date(timesheet.submittedAt).toLocaleDateString('nl-NL')
                                        : (timesheet.submittedAt instanceof Date)
                                          ? timesheet.submittedAt.toLocaleDateString('nl-NL')
                                          : typeof timesheet.submittedAt.toDate === 'function'
                                            ? timesheet.submittedAt.toDate().toLocaleDateString('nl-NL')
                                            : 'onbekende datum'
                                    }
                                  </p>
                                )}
                              </div>
                              <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 flex-shrink-0">
                                Wachten
                              </span>
                            </div>

                            {/* Hours Info */}
                            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-3 space-y-2">
                              <div className="flex items-baseline justify-between">
                                <span className="text-xs text-gray-600 font-medium">Uren geregistreerd</span>
                                <span className={`text-lg sm:text-xl font-bold ${isUnder ? 'text-red-600' : 'text-green-600'}`}>
                                  {timesheet.totalRegularHours}u
                                </span>
                              </div>
                              <div className="flex items-baseline justify-between text-xs text-gray-600">
                                <span>Contract: {summary.contractHoursPerWeek}u/week</span>
                                <span className="font-semibold">{hoursPercentage.toFixed(0)}%</span>
                              </div>

                              {/* Progress Bar */}
                              <div className="w-full bg-gray-300 rounded-full h-2 overflow-hidden mt-2">
                                <div
                                  className={`h-2 rounded-full transition-all ${isUnder ? 'bg-red-500' : 'bg-green-500'}`}
                                  style={{ width: `${Math.min(hoursPercentage, 100)}%` }}
                                />
                              </div>

                              {isUnder && (
                                <div className="flex items-center gap-1 pt-1 text-xs text-red-600 font-medium">
                                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                                  Onder contract uren
                                </div>
                              )}
                            </div>

                            {/* Quick Stats */}
                            <div className="grid grid-cols-3 gap-2 text-center">
                              <div className="p-2 bg-gray-50 rounded">
                                <p className="text-xs text-gray-600">Werkdagen</p>
                                <p className="font-bold text-gray-900 text-sm">{workDays}</p>
                              </div>
                              <div className="p-2 bg-gray-50 rounded">
                                <p className="text-xs text-gray-600">Gem./dag</p>
                                <p className="font-bold text-gray-900 text-sm">{avgPerDay}u</p>
                              </div>
                              <div className="p-2 bg-gray-50 rounded">
                                <p className="text-xs text-gray-600">Kilometer</p>
                                <p className="font-bold text-gray-900 text-sm">{timesheet.totalTravelKilometers}</p>
                              </div>
                            </div>

                            {/* CTA */}
                            <div className="flex items-center justify-between pt-2 border-t border-orange-100 text-primary-600 text-xs font-medium">
                              <span>Klik voor volledige details</span>
                              <ChevronRight className="h-4 w-4" />
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

      {/* DASHBOARD MODAL - ALLE WEKEN UIT FIREBASE */}
      <Modal
        isOpen={!!dashboardEmployeeId}
        onClose={() => {
          setDashboardEmployeeId(null);
        }}
        title={dashboardEmployeeId ? `Dashboard - ${employeeSummaries.find(e => e.employeeId === dashboardEmployeeId)?.firstName} ${employeeSummaries.find(e => e.employeeId === dashboardEmployeeId)?.lastName}` : 'Dashboard'}
      >
        {dashboardEmployeeId && (() => {
          const emp = employeeSummaries.find(e => e.employeeId === dashboardEmployeeId);
          if (!emp) return null;

          return (
            <div className="space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Header Info */}
              <div className="p-4 bg-gradient-to-r from-primary-50 to-indigo-50 rounded-lg border border-primary-200">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center">
                    <User className="h-6 w-6 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">{emp.firstName} {emp.lastName}</h3>
                    <p className="text-sm text-gray-600">Contract: {emp.contractHoursPerWeek}u/week</p>
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3">
                <Card className="p-3 bg-white">
                  <p className="text-xs text-gray-600">Totaal weken</p>
                  <p className="text-2xl font-bold text-primary-600">{emp.allTimesheets.length}</p>
                </Card>
                <Card className="p-3 bg-white">
                  <p className="text-xs text-gray-600">Totaal uren</p>
                  <p className="text-2xl font-bold text-green-600">{emp.totalAllHours || 0}u</p>
                </Card>
                <Card className="p-3 bg-white">
                  <p className="text-xs text-gray-600">Wachten</p>
                  <p className="text-2xl font-bold text-orange-600">{emp.pendingTimesheets.length}</p>
                </Card>
                <Card className="p-3 bg-white">
                  <p className="text-xs text-gray-600">Gemiddeld/week</p>
                  <p className="text-2xl font-bold text-indigo-600">
                    {emp.allTimesheets.length > 0 
                      ? (emp.totalAllHours! / emp.allTimesheets.length).toFixed(1)
                      : '0'}u
                  </p>
                </Card>
              </div>

              {/* Alle Weken uit Firebase */}
              <div>
                <h4 className="font-semibold text-sm mb-2">Alle Ingevoerde Weken</h4>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {emp.allTimesheets.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">Geen weken ingevoerd</p>
                  ) : (
                    emp.allTimesheets.map((timesheet) => {
                      const percentage = (timesheet.totalRegularHours / emp.contractHoursPerWeek) * 100;
                      const isPending = emp.pendingTimesheets.some(t => t.id === timesheet.id);
                      return (
                        <div key={timesheet.id} className={`p-3 rounded-lg border ${isPending ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'}`}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-medium text-sm">Week {timesheet.weekNumber} ({timesheet.year})</span>
                            <div className="flex items-center gap-2">
                              <span className={`font-bold text-sm ${percentage < 85 ? 'text-red-600' : 'text-green-600'}`}>
                                {timesheet.totalRegularHours}u
                              </span>
                              {timesheet.status === 'approved' && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-green-200 text-green-700 font-semibold flex items-center gap-1">
                                  <CheckCircle className="h-3 w-3" />
                                  Goedgekeurd
                                </span>
                              )}
                              {isPending && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-orange-200 text-orange-700 font-semibold">
                                  Wachten
                                </span>
                              )}
                              {timesheet.status === 'rejected' && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-red-200 text-red-700 font-semibold">
                                  Afgekeurd
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="w-full bg-gray-300 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className={`h-1.5 rounded-full ${percentage < 85 ? 'bg-red-500' : 'bg-green-500'}`}
                              style={{ width: `${Math.min(percentage, 100)}%` }}
                            />
                          </div>
                          <div className="text-xs text-gray-600 mt-1 flex justify-between">
                            <span>{percentage.toFixed(0)}% van contract ({emp.contractHoursPerWeek}u)</span>
                            <span>{timesheet.totalTravelKilometers}km</span>
                          </div>
                          {timesheet.lowHoursExplanation && (
                            <p className="text-xs text-red-600 mt-1 italic">⚠️ {timesheet.lowHoursExplanation}</p>
                          )}
                          {timesheet.approvedAt && (
                            <p className="text-xs text-green-600 mt-1 font-semibold">
                              ✓ Goedgekeurd op {
                                typeof timesheet.approvedAt === 'string' 
                                  ? new Date(timesheet.approvedAt).toLocaleDateString('nl-NL')
                                  : (timesheet.approvedAt instanceof Date)
                                    ? timesheet.approvedAt.toLocaleDateString('nl-NL')
                                    : typeof timesheet.approvedAt.toDate === 'function'
                                      ? timesheet.approvedAt.toDate().toLocaleDateString('nl-NL')
                                      : 'onbekende datum'
                              }
                            </p>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Details Modal */}
      <Modal
        isOpen={showDetailsModal}
        onClose={closeDetailsModal}
        title={selectedTimesheet ? `Week ${selectedTimesheet.weekNumber}, ${selectedTimesheet.year}` : 'Uren details'}
      >
        {selectedTimesheet && (
          <div className="space-y-4 max-h-[75vh] overflow-y-auto">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-3 p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg">
              <div className="text-center">
                <p className="text-xs text-gray-600 mb-1">Totaal uren</p>
                <p className="text-2xl font-bold text-gray-900">{selectedTimesheet.totalRegularHours}u</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-600 mb-1">Reiskilometers</p>
                <p className="text-2xl font-bold text-gray-900">{selectedTimesheet.totalTravelKilometers}km</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-600 mb-1">Werkdagen</p>
                <p className="text-2xl font-bold text-gray-900">
                  {selectedTimesheet.entries.filter(e => e.regularHours > 0).length}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-600 mb-1">Gemiddeld/dag</p>
                <p className="text-2xl font-bold text-gray-900">
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
                  <div className="p-4 bg-red-50 border-2 border-red-200 rounded-lg space-y-2">
                    <div className="flex gap-2">
                      <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-red-900">⚠️ Onder contract uren</h4>
                        <p className="text-sm text-red-700 mt-1">
                          {actual}u van {contractHours}u contract ({(actual / contractHours * 100).toFixed(0)}%)
                        </p>
                        {selectedTimesheet.lowHoursExplanation && (
                          <p className="text-xs text-red-600 mt-2">
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
              <h4 className="font-semibold text-sm mb-3">Dagelijkse details</h4>
              <div className="space-y-2">
                {selectedTimesheet.entries.map((entry, idx) => (
                  <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex justify-between items-baseline mb-2">
                      <span className="font-medium text-sm text-gray-900">
                        {
                          typeof entry.date === 'string'
                            ? new Date(entry.date).toLocaleDateString('nl-NL', { weekday: 'short', day: '2-digit', month: 'short' })
                            : (entry.date instanceof Date)
                              ? entry.date.toLocaleDateString('nl-NL', { weekday: 'short', day: '2-digit', month: 'short' })
                              : typeof entry.date.toDate === 'function'
                                ? entry.date.toDate().toLocaleDateString('nl-NL', { weekday: 'short', day: '2-digit', month: 'short' })
                                : 'onbekende datum'
                        }
                      </span>
                      <span className="text-lg font-bold text-gray-900">{entry.regularHours}u</span>
                    </div>
                    {entry.workActivities && entry.workActivities.length > 0 && (
                      <div className="space-y-1 mt-2 pl-3 border-l-2 border-gray-300">
                        {entry.workActivities.map((activity, actIdx) => (
                          <div key={actIdx} className="flex justify-between text-xs text-gray-600">
                            <span>{activity.description}</span>
                            <span className="font-semibold ml-2">{activity.hours}u</span>
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
              <div className="flex gap-3 pt-4 border-t">
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
              <div className="space-y-3 p-4 bg-red-50 border-2 border-red-200 rounded-lg">
                <h4 className="font-semibold text-red-900">Reden voor afkeuring</h4>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-red-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                  rows={4}
                  placeholder="Bijvoorbeeld: Ongeldige uren op donderdag..."
                />
                <div className="flex gap-3">
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