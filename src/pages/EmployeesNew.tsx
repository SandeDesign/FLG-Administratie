import React, { useState, useEffect, useCallback } from 'react';
import { Users, Plus, CreditCard as Edit, Trash2, User, Mail, Phone, Building2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { Employee } from '../types';
import { getEmployees, deleteEmployee } from '../services/firebase';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import EmployeeModal from '../components/employee/EmployeeModal';
import { useToast } from '../hooks/useToast';

const EmployeesNew: React.FC = () => {
  const { user } = useAuth();
  const { companies, selectedCompany, refreshDashboardStats } = useApp();
  const { success, error: showError } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  const loadEmployees = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const employeesData = await getEmployees(user.uid);

      const filteredEmployees = selectedCompany
        ? employeesData.filter(emp => emp.companyId === selectedCompany.id)
        : employeesData;

      setEmployees(filteredEmployees);
      await refreshDashboardStats();
    } catch (error) {
      console.error('Error loading employees:', error);
      showError('Fout bij laden', 'Kon werknemers niet laden');
    } finally {
      setLoading(false);
    }
  }, [user, selectedCompany, showError, refreshDashboardStats]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const handleAddEmployee = () => {
    setSelectedEmployee(null);
    setIsModalOpen(true);
  };

  const handleEditEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    setIsModalOpen(true);
  };

  const handleDeleteEmployee = async (employee: Employee) => {
    if (!user) return;

    if (window.confirm(`Weet je zeker dat je ${employee.personalInfo.firstName} ${employee.personalInfo.lastName} wilt verwijderen?`)) {
      try {
        await deleteEmployee(employee.id, user.uid);
        success('Werknemer verwijderd', `${employee.personalInfo.firstName} ${employee.personalInfo.lastName} is succesvol verwijderd`);
        await loadEmployees();
      } catch (error) {
        console.error('Error deleting employee:', error);
        showError('Fout bij verwijderen', 'Kon werknemer niet verwijderen');
      }
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedEmployee(null);
  };

  const handleModalSuccess = async () => {
    await loadEmployees();
    handleModalClose();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      case 'inactive':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      case 'on_leave':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
      case 'sick':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      active: 'Actief',
      inactive: 'Inactief',
      on_leave: 'Met verlof',
      sick: 'Ziek',
    };
    return statusMap[status] || status;
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Werknemers</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Beheer je werknemers en hun gegevens
          </p>
        </div>
        <Button
          onClick={handleAddEmployee}
          disabled={companies.length === 0}
        >
          <Plus className="h-4 w-4 mr-2" />
          Nieuwe Werknemer
        </Button>
      </div>

      {companies.length === 0 ? (
        <Card className="p-8">
          <div className="text-center">
            <Building2 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Geen bedrijven gevonden
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Je moet eerst een bedrijf aanmaken voordat je werknemers kunt toevoegen.
            </p>
            <Button onClick={() => window.location.href = '/companies'}>
              Bedrijf Toevoegen
            </Button>
          </div>
        </Card>
      ) : employees.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Geen werknemers gevonden"
          description={`Voeg je eerste werknemer toe voor ${selectedCompany?.name || 'het geselecteerde bedrijf'}`}
          actionLabel="Eerste Werknemer Toevoegen"
          onAction={handleAddEmployee}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {employees.map((employee) => (
            <Card key={employee.id} className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                    <User className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {employee.personalInfo.firstName} {employee.personalInfo.lastName}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {employee.contractInfo.position}
                    </p>
                  </div>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(employee.status)}`}>
                  {getStatusText(employee.status)}
                </span>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                  <Mail className="h-4 w-4" />
                  <span>{employee.personalInfo.contactInfo.email}</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                  <Phone className="h-4 w-4" />
                  <span>{employee.personalInfo.contactInfo.phone || 'Niet ingevuld'}</span>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium">Contract:</span> {employee.contractInfo.type}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium">Uren/week:</span> {employee.contractInfo.hoursPerWeek}
                </div>
              </div>

              <div className="flex space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleEditEmployee(employee)}
                  className="flex-1"
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Bewerken
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => handleDeleteEmployee(employee)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <EmployeeModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
        employee={selectedEmployee}
      />
    </div>
  );
};

export default EmployeesNew;