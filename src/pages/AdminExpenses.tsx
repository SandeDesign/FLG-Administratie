import React, { useEffect, useState, useCallback } from 'react';
import { Receipt, Check, X, Filter, User, Euro, Building2 } from 'lucide-react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import { Expense, Employee } from '../types';
import * as firebaseService from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { useToast } from '../hooks/useToast';
import { formatExpenseType } from '../utils/leaveCalculations';

const AdminExpenses: React.FC = () => {
  const { user } = useAuth();
  const { companies, employees, selectedCompany } = useApp();
  const { success, error: showError } = useToast();
  const [loading, setLoading] = useState(true);
  const [pendingExpenses, setPendingExpenses] = useState<Expense[]>([]);
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [filterCompany, setFilterCompany] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('submitted'); // Default to submitted
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadExpenses = useCallback(async () => {
    if (!user || !selectedCompany) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Get ALL expenses for this user
      const allExpenseRecords = await firebaseService.getExpenses(user.uid);
      setAllExpenses(allExpenseRecords);
      
      // Filter for submitted expenses that need approval
      const pendingExpenseRecords = allExpenseRecords.filter(expense => 
        expense.status === 'submitted' && expense.companyId === selectedCompany.id
      );
      setPendingExpenses(pendingExpenseRecords);
    } catch (err) {
      console.error('Error loading expenses:', err);
      showError('Fout bij laden', 'Kon declaraties niet laden');
    } finally {
      setLoading(false);
    }
  }, [user, selectedCompany, showError]);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const handleApprove = async (expense: Expense) => {
    if (!user) return;

    setProcessingId(expense.id);
    try {
      await firebaseService.approveExpense(
        expense.id,
        user.uid,
        user.displayName || user.email || 'Admin',
        user.uid,
        'Goedgekeurd door admin'
      );

      success('Declaratie goedgekeurd', `Declaratie van ${getEmployeeName(expense.employeeId)} is goedgekeurd`);
      await loadExpenses();
    } catch (err) {
      console.error('Error approving expense:', err);
      showError('Fout bij goedkeuren', 'Kon declaratie niet goedkeuren');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (expense: Expense) => {
    if (!user) return;

    const reason = prompt('Reden voor afwijzing (optioneel):');
    if (reason === null) return; // User cancelled

    setProcessingId(expense.id);
    try {
      await firebaseService.rejectExpense(
        expense.id,
        user.uid,
        user.displayName || user.email || 'Admin',
        user.uid,
        reason || 'Geen reden opgegeven'
      );

      success('Declaratie afgewezen', `Declaratie van ${getEmployeeName(expense.employeeId)} is afgewezen`);
      await loadExpenses();
    } catch (err) {
      console.error('Error rejecting expense:', err);
      showError('Fout bij afwijzen', 'Kon declaratie niet afwijzen');
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      case 'submitted':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
      case 'paid':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      draft: 'Concept',
      submitted: 'Ingediend',
      approved: 'Goedgekeurd',
      rejected: 'Afgewezen',
      paid: 'Uitbetaald',
    };
    return statusMap[status] || status;
  };

  const filteredExpenses = (filterStatus === 'submitted' ? pendingExpenses : allExpenses).filter(expense => {
    if (filterStatus !== 'all' && filterStatus !== 'submitted') {
      if (expense.status !== filterStatus) return false;
    }
    if (filterCompany === 'all') return true;
    return expense.companyId === filterCompany;
  });

  const totalPendingAmount = pendingExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const totalApprovedAmount = allExpenses.filter(e => e.status === 'approved').reduce((sum, expense) => sum + e.amount, 0);
  const totalPaidAmount = allExpenses.filter(e => e.status === 'paid').reduce((sum, expense) => sum + e.amount, 0);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!selectedCompany) {
    return (
      <EmptyState
        icon={Building2}
        title="Geen bedrijf geselecteerd"
        description="Selecteer een bedrijf om declaraties te beheren."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Declaraties Beheren
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Beheer en keur declaraties goed of af
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center">
            <Receipt className="h-8 w-8 text-orange-600 mr-3" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Te Behandelen</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {pendingExpenses.length}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {formatCurrency(totalPendingAmount)}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center">
            <Check className="h-8 w-8 text-green-600 mr-3" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Goedgekeurd</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {allExpenses.filter(e => e.status === 'approved').length}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {formatCurrency(totalApprovedAmount)}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center">
            <Euro className="h-8 w-8 text-blue-600 mr-3" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Uitbetaald</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {allExpenses.filter(e => e.status === 'paid').length}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {formatCurrency(totalPaidAmount)}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center">
            <User className="h-8 w-8 text-purple-600 mr-3" />
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
              Declaraties Overzicht
            </h2>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="submitted">Te behandelen</option>
                  <option value="all">Alle statussen</option>
                  <option value="approved">Goedgekeurd</option>
                  <option value="rejected">Afgewezen</option>
                  <option value="paid">Uitbetaald</option>
                </select>
              </div>
              <div className="flex items-center space-x-2">
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
        </div>

        {filteredExpenses.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="Geen declaraties"
            description={
              filterStatus === 'submitted' 
                ? "Er zijn momenteel geen declaraties die goedkeuring behoeven"
                : "Er zijn geen declaraties gevonden met de huidige filters"
            }
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
                    Datum
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Beschrijving
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Bedrag
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  {filterStatus === 'submitted' && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Acties
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredExpenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <User className="h-5 w-5 text-gray-400 mr-2" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {getEmployeeName(expense.employeeId)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {getCompanyName(expense.companyId)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {new Date(expense.date).toLocaleDateString('nl-NL')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {formatExpenseType(expense.type)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">
                      {expense.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {formatCurrency(expense.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(expense.status)}`}>
                        {getStatusText(expense.status)}
                      </span>
                    </td>
                    {filterStatus === 'submitted' && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="success"
                            onClick={() => handleApprove(expense)}
                            loading={processingId === expense.id}
                            disabled={processingId !== null}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Goedkeuren
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleReject(expense)}
                            loading={processingId === expense.id}
                            disabled={processingId !== null}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Afwijzen
                          </Button>
                        </div>
                      </td>
                    )}
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

export default AdminExpenses;