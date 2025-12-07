import React, { useEffect, useState, useCallback } from 'react';
import { Calendar, Check, X, User, Building2, ChevronDown, Clock, AlertCircle } from 'lucide-react';
import Button from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import { LeaveRequest } from '../types';
import * as firebaseService from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { useToast } from '../hooks/useToast';
import { formatLeaveType } from '../utils/leaveCalculations';

const AdminLeaveApprovals: React.FC = () => {
  const { user } = useAuth();
  const { companies, employees, selectedCompany } = useApp();
  const { success, error: showError } = useToast();
  const [loading, setLoading] = useState(true);
  const [pendingRequests, setPendingRequests] = useState<LeaveRequest[]>([]);
  const [filterCompany, setFilterCompany] = useState<string>('all');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadPendingRequests = useCallback(async () => {
    if (!user || !selectedCompany) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const allLeaveRequests = await firebaseService.getLeaveRequests(user.uid);
      const pending = allLeaveRequests.filter(request => 
        request.status === 'pending' && request.companyId === selectedCompany.id
      );
      setPendingRequests(pending);
    } catch (err) {
      console.error('Error loading pending requests:', err);
      showError('Fout bij laden', 'Kon verlofaanvragen niet laden');
    } finally {
      setLoading(false);
    }
  }, [user, selectedCompany, showError]);

  useEffect(() => {
    loadPendingRequests();
  }, [loadPendingRequests]);

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

  const formatDate = (dateInput: string | Date) => {
    try {
      const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
      if (isNaN(date.getTime())) return 'Ongeldig';
      return date.toLocaleDateString('nl-NL', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
      });
    } catch {
      return 'Ongeldig';
    }
  };

  const handleApprove = async (request: LeaveRequest) => {
    if (!user) return;
    setProcessingId(request.id);
    try {
      await firebaseService.approveLeaveRequest(
        request.id,
        user.uid,
        user.displayName || user.email || 'Admin'
      );
      success('Verlof goedgekeurd', `Verlofaanvraag van ${getEmployeeName(request.employeeId)} is goedgekeurd`);
      await loadPendingRequests();
    } catch (err) {
      console.error('Error approving request:', err);
      showError('Fout bij goedkeuren', 'Kon verlofaanvraag niet goedkeuren');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (request: LeaveRequest) => {
    if (!user) return;
    const reason = prompt('Reden voor afwijzing (optioneel):');
    if (reason === null) return;
    setProcessingId(request.id);
    try {
      await firebaseService.rejectLeaveRequest(
        request.id,
        user.uid,
        user.displayName || user.email || 'Admin',
        reason || 'Geen reden opgegeven'
      );
      success('Verlof afgewezen', `Verlofaanvraag van ${getEmployeeName(request.employeeId)} is afgewezen`);
      await loadPendingRequests();
    } catch (err) {
      console.error('Error rejecting request:', err);
      showError('Fout bij afwijzen', 'Kon verlofaanvraag niet afwijzen');
    } finally {
      setProcessingId(null);
    }
  };

  const filteredRequests = pendingRequests.filter(request => {
    if (filterCompany === 'all') return true;
    return request.companyId === filterCompany;
  });

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!selectedCompany) {
    return (
      <EmptyState
        icon={Building2}
        title="Geen bedrijf geselecteerd"
        description="Selecteer een bedrijf om verlofaanvragen te beheren."
      />
    );
  }

  return (
    <div className="space-y-5 px-4 sm:px-0 pb-6">
      {/* Header with Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Verlof Goedkeuren</h1>
          <p className="text-sm text-gray-600 mt-1">{filteredRequests.length} aanvraag{filteredRequests.length !== 1 ? 'en' : ''} wachten</p>
        </div>
        <select
          value={filterCompany}
          onChange={(e) => setFilterCompany(e.target.value)}
          className="px-4 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 font-medium hover:border-gray-400 transition-colors"
        >
          <option value="all">Alle bedrijven</option>
          {companies.map(company => (
            <option key={company.id} value={company.id}>{company.name}</option>
          ))}
        </select>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-orange-700">Te Behandelen</p>
              <p className="text-3xl font-bold text-orange-900 mt-1">{pendingRequests.length}</p>
            </div>
            <Clock className="h-10 w-10 text-orange-300" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-blue-700">Werknemers</p>
              <p className="text-3xl font-bold text-blue-900 mt-1">{employees.length}</p>
            </div>
            <User className="h-10 w-10 text-blue-300" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-green-700">Bedrijven</p>
              <p className="text-3xl font-bold text-green-900 mt-1">{companies.length}</p>
            </div>
            <Building2 className="h-10 w-10 text-green-300" />
          </div>
        </div>
      </div>

      {/* Requests List */}
      {filteredRequests.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-gray-100 rounded-full">
              <Calendar className="h-6 w-6 text-gray-400" />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Geen openstaande aanvragen</h3>
          <p className="text-sm text-gray-600 mt-2">Alle verlofaanvragen zijn afgehandeld!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map((request) => {
            const isExpanded = expandedId === request.id;
            const isProcessing = processingId === request.id;
            
            return (
              <div
                key={request.id}
                className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-all"
              >
                {/* Main Row */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : request.id)}
                  className="w-full"
                >
                  <div className="p-4 sm:p-5 flex items-center gap-4 hover:bg-gray-50 transition-colors">
                    {/* Status Icon */}
                    <div className="p-3 bg-gradient-to-br from-orange-100 to-amber-100 rounded-lg flex-shrink-0">
                      <Clock className="h-5 w-5 text-orange-600" />
                    </div>

                    {/* Info - Desktop & Mobile */}
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="text-sm sm:text-base font-semibold text-gray-900">
                          {getEmployeeName(request.employeeId)}
                        </h3>
                        <span className="px-2.5 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
                          {request.totalDays}d
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-xs sm:text-sm text-gray-600">
                        <span className="font-medium">{formatLeaveType(request.type)}</span>
                        <span className="hidden sm:inline text-gray-400">•</span>
                        <span>{formatDate(request.startDate)} → {formatDate(request.endDate)}</span>
                      </div>
                    </div>

                    {/* Chevron */}
                    <ChevronDown className={`h-5 w-5 text-gray-400 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-gray-200 bg-gradient-to-br from-gray-50 to-white p-4 sm:p-5 space-y-4">
                    {/* Company & Type */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-semibold text-gray-700 mb-1.5">Bedrijf</p>
                        <div className="flex items-center gap-2 text-sm text-gray-900">
                          <Building2 className="h-4 w-4 text-gray-400" />
                          {getCompanyName(request.companyId)}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-700 mb-1.5">Type Verlof</p>
                        <div className="text-sm font-medium text-gray-900">
                          {formatLeaveType(request.type)}
                        </div>
                      </div>
                    </div>

                    {/* Dates */}
                    <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium text-gray-600">Startdatum:</span>
                        <span className="text-sm font-semibold text-gray-900">{formatDate(request.startDate)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium text-gray-600">Einddatum:</span>
                        <span className="text-sm font-semibold text-gray-900">{formatDate(request.endDate)}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                        <span className="text-xs font-medium text-gray-600">Totaal:</span>
                        <span className="text-base font-bold text-orange-600">{request.totalDays} dagen</span>
                      </div>
                    </div>

                    {/* Reason */}
                    {request.reason && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-xs font-semibold text-blue-700 mb-1.5">Reden</p>
                        <p className="text-sm text-blue-900 leading-relaxed">{request.reason}</p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        onClick={() => handleApprove(request)}
                        disabled={isProcessing || processingId !== null}
                        size="sm"
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        icon={Check}
                      >
                        {isProcessing ? 'Verwerken...' : 'Goedkeuren'}
                      </Button>
                      <Button
                        onClick={() => handleReject(request)}
                        disabled={isProcessing || processingId !== null}
                        variant="danger"
                        size="sm"
                        className="flex-1"
                        icon={X}
                      >
                        {isProcessing ? 'Verwerken...' : 'Afwijzen'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminLeaveApprovals;