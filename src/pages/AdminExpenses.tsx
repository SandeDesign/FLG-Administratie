import React, { useState, useEffect, useCallback } from 'react';
import { Receipt, Filter, Download, CheckCircle, XCircle, AlertCircle, Building2, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { Expense, Employee } from '../types';
import * as firebaseService from '../services/firebase';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../hooks/useToast';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import { formatExpenseType } from '../utils/leaveCalculations';

const AdminExpenses: React.FC = () => {
  const { user } = useAuth();
  const { selectedCompany } = useApp();
  const { success, error: showError } = useToast();
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterEmployee, setFilterEmployee] = useState<string>('all');
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectComment, setRejectComment] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!user || !selectedCompany) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [expensesData, employeesData] = await Promise.all([
        firebaseService.getExpenses(user.uid),
        firebaseService.getEmployees(user.uid)
      ]);

      const companyExpenses = expensesData.filter(e => e.companyId === selectedCompany.id);
      const companyEmployees = employeesData.filter(emp => emp.companyId === selectedCompany.id);

      setExpenses(companyExpenses);
      setEmployees(companyEmployees);
    } catch (err) {
      console.error('Error loading data:', err);
      showError('Fout bij laden', 'Kon declaraties niet laden');
    } finally {
      setLoading(false);
    }
  }, [user, selectedCompany, showError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getEmployee = (employeeId: string) => {
    return employees.find(emp => emp.id === employeeId);
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
        return 'bg-primary-100 text-primary-800 dark:bg-primary-900/20 dark:text-primary-300';
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const handleApprove = async (expense: Expense) => {
    if (!user || !expense.id) return;

    if (window.confirm(`Weet je zeker dat je deze declaratie van ${formatCurrency(expense.amount)} wilt goedkeuren?`)) {
      setActionLoading(true);
      try {
        await firebaseService.approveExpense(
          expense.id,
          expense.userId,
          user.displayName || user.email || 'Admin',
          user.uid
        );
        success('Declaratie goedgekeurd', 'De declaratie is goedgekeurd');
        await loadData();
      } catch (err) {
        console.error('Error approving expense:', err);
        showError('Fout bij goedkeuren', 'Kon declaratie niet goedkeuren');
      } finally {
        setActionLoading(false);
      }
    }
  };

  const openRejectModal = (expense: Expense) => {
    setSelectedExpense(expense);
    setRejectComment('');
    setRejectModalOpen(true);
  };

  const handleReject = async () => {
    if (!user || !selectedExpense || !selectedExpense.id) return;

    if (!rejectComment.trim()) {
      showError('Opmerking vereist', 'Geef een reden op voor afwijzing');
      return;
    }

    setActionLoading(true);
    try {
      await firebaseService.rejectExpense(
        selectedExpense.id,
        selectedExpense.userId,
        user.displayName || user.email || 'Admin',
        user.uid,
        rejectComment
      );
      success('Declaratie afgewezen', 'De declaratie is afgewezen');
      setRejectModalOpen(false);
      setSelectedExpense(null);
      setRejectComment('');
      await loadData();
    } catch (err) {
      console.error('Error rejecting expense:', err);
      showError('Fout bij afwijzen', 'Kon declaratie niet afwijzen');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredExpenses = expenses.filter(expense => {
    if (filterStatus !== 'all' && expense.status !== filterStatus) return false;
    if (filterEmployee !== 'all' && expense.employeeId !== filterEmployee) return false;
    return true;
  });

  const totalByStatus = {
    draft: expenses.filter(e => e.status === 'draft').reduce((sum, e) => sum + e.amount, 0),
    submitted: expenses.filter(e => e.status === 'submitted').reduce((sum, e) => sum + e.amount, 0),
    approved: expenses.filter(e => e.status === 'approved').reduce((sum, e) => sum + e.amount, 0),
    paid: expenses.filter(e => e.status === 'paid').reduce((sum, e) => sum + e.amount, 0),
  };

  const pendingCount = expenses.filter(e => e.status === 'submitted').length;

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Declaraties Goedkeuring</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Beheer en keur declaraties goed van werknemers
          </p>
        </div>
        {pendingCount > 0 && (
          <div className="flex items-center space-x-2 bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300 px-4 py-2 rounded-lg">
            <AlertCircle className="h-5 w-5" />
            <span className="font-medium">{pendingCount} wachtend op goedkeuring</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Concept</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(totalByStatus.draft)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Ingediend</p>
          <p className="text-2xl font-bold text-yellow-600">
            {formatCurrency(totalByStatus.submitted)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Goedgekeurd</p>
          <p className="text-2xl font-bold text-green-600">
            {formatCurrency(totalByStatus.approved)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Uitbetaald</p>
          <p className="text-2xl font-bold text-primary-600">
            {formatCurrency(totalByStatus.paid)}
          </p>
        </Card>
      </div>

      <Card>
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="all">Alle statussen</option>
                <option value="draft">Concept</option>
                <option value="submitted">Ingediend</option>
                <option value="approved">Goedgekeurd</option>
                <option value="rejected">Afgewezen</option>
                <option value="paid">Uitbetaald</option>
              </select>
            </div>
            <div className="flex items-center space-x-2">
              <User className="h-4 w-4 text-gray-500" />
              <select
                value={filterEmployee}
                onChange={(e) => setFilterEmployee(e.target.value)}
                className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="all">Alle werknemers</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.personalInfo.firstName} {emp.personalInfo.lastName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {filteredExpenses.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="Geen declaraties"
            description="Er zijn geen declaraties die voldoen aan de filters"
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Acties
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredExpenses.map((expense) => {
                  const employee = getEmployee(expense.employeeId);
                  return (
                    <tr key={expense.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {employee ? `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}` : 'Onbekend'}
                        </div>
                        {employee && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {employee.contractInfo.position}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {expense.status === 'submitted' && (
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              onClick={() => handleApprove(expense)}
                              disabled={actionLoading}
                              className="bg-green-600 hover:bg-green-700 text-white"
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Goedkeuren
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => openRejectModal(expense)}
                              disabled={actionLoading}
                              className="border-red-600 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Afwijzen
                            </Button>
                          </div>
                        )}
                        {expense.status === 'approved' && (
                          <span className="text-green-600 dark:text-green-400 text-xs">
                            Goedgekeurd
                          </span>
                        )}
                        {expense.status === 'rejected' && expense.approvals.length > 0 && (
                          <div className="text-xs text-red-600 dark:text-red-400">
                            <div>Afgewezen</div>
                            {expense.approvals[expense.approvals.length - 1].comment && (
                              <div className="text-gray-500 dark:text-gray-400 italic mt-1">
                                "{expense.approvals[expense.approvals.length - 1].comment}"
                              </div>
                            )}
                          </div>
                        )}
                        {expense.status === 'paid' && (
                          <span className="text-primary-600 dark:text-primary-400 text-xs">
                            Uitbetaald
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        isOpen={rejectModalOpen}
        onClose={() => {
          setRejectModalOpen(false);
          setSelectedExpense(null);
          setRejectComment('');
        }}
        title="Declaratie Afwijzen"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Geef een reden op waarom deze declaratie wordt afgewezen:
          </p>
          {selectedExpense && (
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
              <div className="text-sm">
                <div className="font-medium text-gray-900 dark:text-white mb-2">
                  {formatExpenseType(selectedExpense.type)} - {formatCurrency(selectedExpense.amount)}
                </div>
                <div className="text-gray-600 dark:text-gray-400">
                  {selectedExpense.description}
                </div>
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Reden voor afwijzing *
            </label>
            <textarea
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
              placeholder="Bijvoorbeeld: Ontbrekende bonnen, verkeerd bedrag, niet zakelijk..."
            />
          </div>
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              variant="secondary"
              onClick={() => {
                setRejectModalOpen(false);
                setSelectedExpense(null);
                setRejectComment('');
              }}
              disabled={actionLoading}
            >
              Annuleren
            </Button>
            <Button
              onClick={handleReject}
              loading={actionLoading}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Afwijzen
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminExpenses;
