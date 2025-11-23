import React, { useEffect, useState, useCallback } from 'react';
import { Calendar, Check, X, Filter, User, Building2 } from 'lucide-react';
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

  const loadPendingRequests = useCallback(async () => {
    if (!user || !selectedCompany) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // Get ALL leave requests for this user and filter for pending
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
    if (reason === null) return; // User cancelled

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Verlof Goedkeuren
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Beheer en keur verlofaanvragen goed of af
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center">
            <Calendar className="h-8 w-8 text-orange-600 mr-3" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Te Behandelen</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {pendingRequests.length}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center">
            <Check className="h-8 w-8 text-green-600 mr-3" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Deze Week</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">0</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center">
            <User className="h-8 w-8 text-primary-600 mr-3" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Werknemers</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {employees.length}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Openstaande Verlofaanvragen
            </h2>
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <select
                value={filterCompany}
                onChange={(e) => setFilterCompany(e.target.value)}
                className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
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
        </div>

        {filteredRequests.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="Geen openstaande aanvragen"
            description="Er zijn momenteel geen verlofaanvragen die goedkeuring behoeven"
            actionLabel=""
            onAction={() => {}}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Werknemer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Bedrijf
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Periode
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Dagen
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Reden
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Acties
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredRequests.map((request) => (
                  <tr key={request.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <User className="h-5 w-5 text-gray-400 mr-2" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {getEmployeeName(request.employeeId)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {getCompanyName(request.companyId)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {formatLeaveType(request.type)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {new Date(request.startDate).toLocaleDateString('nl-NL')} -{' '}
                      {new Date(request.endDate).toLocaleDateString('nl-NL')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {request.totalDays}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">
                      {request.reason || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="success"
                          onClick={() => handleApprove(request)}
                          loading={processingId === request.id}
                          disabled={processingId !== null}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Goedkeuren
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleReject(request)}
                          loading={processingId === request.id}
                          disabled={processingId !== null}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Afwijzen
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default AdminLeaveApprovals;