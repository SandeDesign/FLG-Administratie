import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Trash2, 
  Mail, 
  Phone,
  Lock,
  AlertCircle,
  CheckCircle,
  Edit
} from 'lucide-react';
import Card from '../components/ui/Card';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import EmployeeModal from '../components/employee/EmployeeModal';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { useToast } from '../hooks/useToast';
import { 
  getEmployees, 
  deleteEmployee,
  generateSecurePassword,
  createEmployeeAuthAccount,
  saveTemporaryCredentials
} from '../services/firebase';
import { Employee } from '../types';

const EmployeesNew: React.FC = () => {
  const { user } = useAuth();
  const { selectedCompany } = useApp();
  const { success, error: showError } = useToast();
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [creatingAccount, setCreatingAccount] = useState<string | null>(null);
  const [showCredentials, setShowCredentials] = useState<{ [key: string]: { email: string; password: string } }>({});

  const loadEmployees = async () => {
    if (!user || !selectedCompany) return;

    try {
      setLoading(true);
      const employeesData = await getEmployees(user.uid, selectedCompany.id);
      setEmployees(employeesData);
    } catch (error) {
      console.error('Error loading employees:', error);
      showError('Fout bij laden', 'Kon werknemers niet laden');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, [user, selectedCompany]);

  const handleAddEmployee = () => {
    setSelectedEmployee(null);
    setIsModalOpen(true);
  };

  const handleEditEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    setIsModalOpen(true);
  };

  const handleDeleteEmployee = async (employeeId: string, employeeName: string) => {
    if (!confirm(`Weet je zeker dat je ${employeeName} wilt verwijderen?`)) {
      return;
    }

    if (!user) return;

    try {
      await deleteEmployee(employeeId, user.uid);
      success('Werknemer verwijderd', `${employeeName} is verwijderd`);
      loadEmployees();
    } catch (error) {
      console.error('Error deleting employee:', error);
      showError('Fout bij verwijderen', 'Kon werknemer niet verwijderen');
    }
  };

  // ✅ Account aanmaken functie
  const handleCreateAccount = async (employee: Employee) => {
    if (!user) return;

    try {
      setCreatingAccount(employee.id);
      
      // Genereer veilig wachtwoord
      const password = generateSecurePassword();
      
      // Maak account aan in Firebase Auth
      const newUserId = await createEmployeeAuthAccount(
        employee.id,
        user.uid,
        employee.personalInfo.contactInfo.email,
        password
      );

      // Sla tijdelijke credentials op (optioneel, voor notificatie)
      await saveTemporaryCredentials(
        employee.id,
        employee.personalInfo.contactInfo.email,
        password
      );

      // Toon credentials aan beheerder
      setShowCredentials({
        ...showCredentials,
        [employee.id]: {
          email: employee.personalInfo.contactInfo.email,
          password
        }
      });

      success(
        'Account aangemaakt',
        `Account voor ${employee.personalInfo.firstName} is aangemaakt. Wachtwoord: ${password}`
      );

      loadEmployees();
    } catch (error) {
      console.error('Error creating account:', error);
      showError('Fout bij aanmaken', 'Kon account niet aanmaken');
    } finally {
      setCreatingAccount(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'archived': return 'bg-red-100 text-red-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Actief';
      case 'inactive': return 'Inactief';
      case 'archived': return 'Gearchiveerd';
      default: return status;
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
      <Card>
        <div className="p-6">
          <div className="flex items-center space-x-3 text-amber-600">
            <AlertCircle className="h-5 w-5" />
            <p>Selecteer eerst een bedrijf om werknemers te beheren</p>
          </div>
          <button
            onClick={() => window.location.href = '/companies'}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Bedrijf Toevoegen
          </button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Werknemers</h1>
          <p className="mt-1 text-sm text-gray-500">
            Beheer werknemers voor {selectedCompany.name}
          </p>
        </div>
        <button
          onClick={handleAddEmployee}
          className="mt-4 sm:mt-0 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          <Plus className="h-5 w-5" />
          Werknemer Toevoegen
        </button>
      </div>

      {/* Employee Modal */}
      <EmployeeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={loadEmployees}
        employee={selectedEmployee}
      />

      {/* Empty State */}
      {employees.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Geen werknemers gevonden"
          description={`Voeg je eerste werknemer toe voor ${selectedCompany.name}`}
          actionLabel="Eerste Werknemer Toevoegen"
          onAction={handleAddEmployee}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {employees.map((employee) => (
            <div key={employee.id}>
              <Card className="p-6 hover:shadow-lg transition-shadow h-full flex flex-col">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                      <Users className="h-6 w-6 text-blue-600" />
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

                {/* Info */}
                <div className="space-y-2 mb-4 flex-grow">
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

                {/* Account Status Info */}
                {showCredentials[employee.id] && (
                  <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <div className="flex items-start space-x-2">
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-green-800 dark:text-green-200">Account aangemaakt</p>
                        <p className="text-green-700 dark:text-green-300 text-xs mt-1">
                          <strong>Email:</strong> {showCredentials[employee.id].email}
                        </p>
                        <p className="text-green-700 dark:text-green-300 text-xs">
                          <strong>Wachtwoord:</strong> {showCredentials[employee.id].password}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  {!employee.hasAccount ? (
                    <button
                      onClick={() => handleCreateAccount(employee)}
                      disabled={creatingAccount === employee.id}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium text-sm transition-colors"
                    >
                      {creatingAccount === employee.id ? (
                        <>
                          <div className="animate-spin">
                            <Lock className="h-4 w-4" />
                          </div>
                          Account...
                        </>
                      ) : (
                        <>
                          <Lock className="h-4 w-4" />
                          Account
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="flex-1 flex items-center justify-center px-3 py-2 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg font-medium text-sm border border-green-200 dark:border-green-800">
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Account Actief
                    </div>
                  )}
                  
                  <button
                    onClick={() => handleEditEmployee(employee)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium text-sm transition-colors"
                  >
                    <Edit className="h-4 w-4" />
                    Bewerken
                  </button>
                  
                  <button
                    onClick={() => handleDeleteEmployee(employee.id, `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`)}
                    className="px-3 py-2 border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 font-medium text-sm transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmployeesNew;