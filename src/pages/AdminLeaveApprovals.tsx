import React, { useEffect, useState, useCallback } from 'react';
import { Calendar, Check, X, Filter, User, Building2, ChevronDown } from 'lucide-react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import { LeaveRequest, Employee } from '../types';
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
    <div className="space-y-4 px-4 sm:px-0 pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Verlof Goedkeuren</h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">
            {filteredRequests.length} aanvraag{filteredRequests.length !== 1 ? 'en' : ''} wachten op goedkeuring
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterCompany}
            onChange={(e) => setFilterCompany(e.target.value)}
            className="text-xs sm:text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white text-gray-900"
          >
            <option value="all">Alle bedrijven</option>
            {companies.map(company => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats - Compact */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <p className="text-xs text-gray-600">Te Behandelen</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{pendingRequests.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <p className="text-xs text-gray-600">Werknemers</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{employees.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <p className="text-xs text-gray-600">Bedrijven</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{companies.length}</p>
        </div>
      </div>

      {/* Requests List */}
      {filteredRequests.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Geen openstaande aanvragen</h3>
          <p className="text-xs text-gray-600">Er zijn momenteel geen verlofaanvragen die goedkeuring behoeven</p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-700 text-xs">Werknemer</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-700 text-xs">Type</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-700 text-xs">Periode</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-700 text-xs">Dagen</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-700 text-xs">Reden</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-700 text-xs">Acties</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredRequests.map((request) => (
                    <tr key={request.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5">
                        <div className="text-sm font-medium text-gray-900">
                          {getEmployeeName(request.employeeId)}
                        </div>
                        <div className="text-xs text-gray-600">{getCompanyName(request.companyId)}</div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-xs font-medium text-gray-900">{formatLeaveType(request.type)}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="text-xs text-gray-900">
                          {formatDate(request.startDate)} → {formatDate(request.endDate)}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-xs font-semibold text-gray-900">{request.totalDays}d</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <p className="text-xs text-gray-600 max-w-xs truncate">{request.reason || '-'}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleApprove(request)}
                            disabled={processingId !== null}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
                            title="Goedkeuren"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleReject(request)}
                            disabled={processingId !== null}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                            title="Afwijzen"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-2">
            {filteredRequests.map((request) => {
              const isExpanded = expandedId === request.id;
              return (
                <div key={request.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : request.id)}
                    className="w-full p-3 text-left hover:bg-gray-50 flex items-center justify-between gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-900">
                        {getEmployeeName(request.employeeId)}
                      </div>
                      <div className="text-xs text-gray-600 mt-0.5">
                        {formatLeaveType(request.type)} • {request.totalDays}d
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {formatDate(request.startDate)} → {formatDate(request.endDate)}
                      </div>
                    </div>
                    <ChevronDown className={`h-4 w-4 text-gray-400 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>

                  {isExpanded && (
                    <div className="border-t border-gray-200 p-3 space-y-3 bg-gray-50">
                      <div>
                        <p className="text-xs font-semibold text-gray-700 mb-1">Bedrijf</p>
                        <p className="text-xs text-gray-900">{getCompanyName(request.companyId)}</p>
                      </div>

                      {request.reason && (
                        <div>
                          <p className="text-xs font-semibold text-gray-700 mb-1">Reden</p>
                          <p className="text-xs text-gray-900">{request.reason}</p>
                        </div>
                      )}

                      <div className="flex gap-2 pt-2">
                        <Button
                          onClick={() => handleApprove(request)}
                          disabled={processingId !== null}
                          size="sm"
                          className="flex-1 text-xs"
                          icon={Check}
                        >
                          Goedkeuren
                        </Button>
                        <Button
                          onClick={() => handleReject(request)}
                          disabled={processingId !== null}
                          variant="danger"
                          size="sm"
                          className="flex-1 text-xs"
                          icon={X}
                        >
                          Afwijzen
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default AdminLeaveApprovals;