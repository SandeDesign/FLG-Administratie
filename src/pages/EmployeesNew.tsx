import React, { useState, useEffect, useCallback } from 'react';
import { Users, Plus, CreditCard as Edit, Trash2, User, Mail, Phone, Building2, Key, Copy } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { Employee } from '../types';
import { getEmployees, deleteEmployee } from '../services/firebase';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
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
  const [copiedUserId, setCopiedUserId] = useState<string | null>(null);
  const [generatedPasswords, setGeneratedPasswords] = useState<{[key: string]: string}>({});

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
        success('Werknemer verwijderd', `${employee.personalInfo.firstName} ${employee.personalInfo.lastName} is verwijderd`);
        loadEmployees();
      } catch (error) {
        console.error('Error deleting employee:', error);
        showError('Fout bij verwijderen', 'Kon werknemer niet verwijderen');
      }
    }
  };

  const generatePassword = (): string => {
    const length = 12;
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  };

  const handleGeneratePassword = async (employeeId: string) => {
    const newPassword = generatePassword();
    setGeneratedPasswords({ ...generatedPasswords, [employeeId]: newPassword });

    try {
      const employeeRef = doc(db, 'employees', employeeId);
      await updateDoc(employeeRef, {
        password: newPassword,
        updatedAt: Timestamp.fromDate(new Date())
      });
      
      success('Wachtwoord gegenereerd', 'Het wachtwoord is succesvol gegenereerd');
    } catch (error) {
      console.error('Error updating password:', error);
      showError('Fout bij bijwerken', 'Kon wachtwoord niet wijzigen');
    }
  };

  const handleCopyPassword = (employeeId: string) => {
    const password = generatedPasswords[employeeId];
    if (password) {
      navigator.clipboard.writeText(password);
      setCopiedUserId(employeeId);
      setTimeout(() => setCopiedUserId(null), 2000);
    }
  };

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
        description="Selecteer een bedrijf om werknemers te beheren"
        actionLabel="Selecteer Bedrijf"
        onAction={() => window.location.href = '/companies'}
      />
    );
  }

  return (
    <div className="space-y-6 px-4 sm:px-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Werknemers</h1>
          <p className="text-gray-600 mt-1">
            Beheer werknemers voor {selectedCompany.name}
          </p>
        </div>
        <Button
          onClick={handleAddEmployee}
          icon={Plus}
        >
          Werknemer Toevoegen
        </Button>
      </div>

      {/* Employee Modal */}
      {isModalOpen && (
        <EmployeeModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedEmployee(null);
          }}
          employee={selectedEmployee}
          onSuccess={() => {
            loadEmployees();
            setIsModalOpen(false);
            setSelectedEmployee(null);
          }}
        />
      )}

      {/* Empty State */}
      {employees.length === 0 ? (
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
              {/* Header with name and status */}
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
              </div>

              {/* Employee Info */}
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
              </div>

              {/* Generated Password Display */}
              {generatedPasswords[employee.id] && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3 rounded-lg mb-4 text-xs space-y-1">
                  <p className="font-medium text-blue-900 dark:text-blue-200">Gegenereerd wachtwoord:</p>
                  <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-2 rounded border border-blue-100 dark:border-blue-800">
                    <code className="text-blue-600 dark:text-blue-400 font-mono flex-1 break-all">{generatedPasswords[employee.id]}</code>
                    <button
                      onClick={() => handleCopyPassword(employee.id)}
                      className={`flex-shrink-0 p-1 rounded transition-colors ${copiedUserId === employee.id ? 'bg-green-100 text-green-600' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'}`}
                      title={copiedUserId === employee.id ? 'Gekopieerd!' : 'Kopieer wachtwoord'}
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => handleGeneratePassword(employee.id)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/10 rounded-lg transition-colors"
                  title="Nieuw wachtwoord genereren"
                >
                  <Key className="h-4 w-4" />
                  Wachtwoord
                </button>
                <button
                  onClick={() => handleEditEmployee(employee)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <Edit className="h-4 w-4" />
                  Bewerken
                </button>
                <button
                  onClick={() => handleDeleteEmployee(employee)}
                  className="flex items-center justify-center px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmployeesNew;