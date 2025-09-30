import React, { useState, useEffect } from 'react';
import { Plus, User, CreditCard as Edit, Trash2, Mail, Phone, Building2, MapPin, UserPlus, CheckCircle, Copy, RefreshCw } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Table from '../components/ui/Table';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useForm } from 'react-hook-form';
import { Employee, Company, Branch, DUTCH_CAOS } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { useToast } from '../hooks/useToast';
import { createEmployee, updateEmployee, deleteEmployee, getBranches, createEmployeeAuthAccount, generateSecurePassword } from '../services/firebase';

interface EmployeeFormData {
  firstName: string;
  lastName: string;
  initials: string;
  bsn: string;
  dateOfBirth: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  zipCode: string;
  bankAccount: string;
  companyId: string;
  branchId: string;
  contractType: 'permanent' | 'temporary' | 'zero_hours' | 'on_call';
  startDate: string;
  position: string;
  hoursPerWeek: number;
  cao: string;
  salaryScale: string;
  monthlySalary: number;
}

const EmployeesNew: React.FC = () => {
  const { user } = useAuth();
  const { employees, companies, refreshEmployees, loading } = useApp();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const { success, error } = useToast();

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<EmployeeFormData>();

  const selectedCompanyId = watch('companyId');

  useEffect(() => {
    if (user) {
      loadBranches();
    }
  }, [user]);

  const loadBranches = async () => {
    if (!user) return;

    try {
      const data = await getBranches(user.uid);
      setBranches(data);
    } catch (err) {
      console.error('Error loading branches:', err);
    }
  };

  const openModal = (employee?: Employee) => {
    if (employee) {
      setEditingEmployee(employee);
      setValue('firstName', employee.personalInfo.firstName);
      setValue('lastName', employee.personalInfo.lastName);
      setValue('initials', employee.personalInfo.initials || '');
      setValue('bsn', employee.personalInfo.bsn);
      setValue('dateOfBirth', employee.personalInfo.dateOfBirth?.toISOString()?.split('T')[0] || '');
      setValue('email', employee.personalInfo.contactInfo.email);
      setValue('phone', employee.personalInfo.contactInfo.phone);
      setValue('street', employee.personalInfo.address.street);
      setValue('city', employee.personalInfo.address.city);
      setValue('zipCode', employee.personalInfo.address.postalCode || employee.personalInfo.address.zipCode || '');
      setValue('bankAccount', employee.personalInfo.bankAccount);
      setValue('companyId', employee.companyId);
      setValue('branchId', employee.branchId);
      setValue('contractType', employee.contractInfo.type);
      setValue('startDate', employee.contractInfo.startDate?.toISOString()?.split('T')[0] || '');
      setValue('position', employee.contractInfo.position);
      setValue('hoursPerWeek', employee.contractInfo.hoursPerWeek || 40);
      setValue('cao', employee.contractInfo.cao || '');
      setValue('salaryScale', employee.salaryInfo.salaryScale);
      setValue('monthlySalary', employee.salaryInfo.monthlySalary || 0);
    } else {
      setEditingEmployee(null);
      reset();

      if (companies.length > 0) {
        setValue('companyId', companies[0].id);
        const availableBranches = branches.filter(b => b.companyId === companies[0].id);
        if (availableBranches.length > 0) {
          setValue('branchId', availableBranches[0].id);
        }
      }

      setValue('contractType', 'permanent');
      setValue('hoursPerWeek', 40);
      setValue('monthlySalary', 0);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingEmployee(null);
    reset();
  };

  const onSubmit = async (data: EmployeeFormData) => {
    if (!user) return;

    setSubmitting(true);
    try {
      const employeeData = {
        companyId: data.companyId,
        branchId: data.branchId,
        personalInfo: {
          firstName: data.firstName,
          lastName: data.lastName,
          initials: data.initials,
          bsn: data.bsn,
          dateOfBirth: new Date(data.dateOfBirth),
          nationality: 'Nederlandse',
          maritalStatus: 'single' as const,
          address: {
            street: data.street,
            city: data.city,
            postalCode: data.zipCode,
            country: 'Nederland',
          },
          contactInfo: {
            email: data.email,
            phone: data.phone,
          },
          bankAccount: data.bankAccount,
        },
        contractInfo: {
          type: data.contractType,
          startDate: new Date(data.startDate),
          hoursPerWeek: data.hoursPerWeek,
          position: data.position,
          cao: data.cao,
          contractStatus: 'active' as const,
        },
        salaryInfo: {
          salaryScale: data.salaryScale,
          paymentType: 'monthly' as const,
          paymentFrequency: 'monthly' as const,
          monthlySalary: data.monthlySalary,
          allowances: {
            overtime: 150,
            irregular: 130,
            shift: 120,
            weekend: 150,
            evening: 115,
            night: 130,
            sunday: 170,
            callDuty: 125,
          },
          holidayAllowancePercentage: 8,
          travelAllowance: {
            type: 'per_km' as const,
            amountPerKm: 0.23,
          },
          pensionContribution: 0,
          pensionEmployerContribution: 0,
          taxCredit: true,
          taxTable: 'white' as const,
        },
        leaveInfo: {
          holidayDays: {
            statutory: 0,
            extraStatutory: 0,
            accumulated: 0,
            taken: 0,
          },
        },
        status: 'active',
        salaryHistory: [],
      };

      if (editingEmployee) {
        await updateEmployee(editingEmployee.id, user.uid, employeeData);
        success('Werknemer bijgewerkt', `${data.firstName} ${data.lastName} is succesvol bijgewerkt`);
      } else {
        await createEmployee(user.uid, employeeData);
        success('Werknemer aangemaakt', `${data.firstName} ${data.lastName} is succesvol toegevoegd`);
      }

      await refreshEmployees();
      closeModal();
    } catch (err) {
      console.error('Error saving employee:', err);
      error('Er is een fout opgetreden', 'Probeer het opnieuw');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEmployee = async (employee: Employee) => {
    if (!user) return;

    const fullName = `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`;
    if (window.confirm(`Weet je zeker dat je ${fullName} wilt verwijderen?`)) {
      try {
        await deleteEmployee(employee.id, user.uid);
        await refreshEmployees();
        success('Werknemer verwijderd', `${fullName} is succesvol verwijderd`);
      } catch (err) {
        console.error('Error deleting employee:', err);
        error('Fout bij verwijderen', 'Kon werknemer niet verwijderen');
      }
    }
  };

  const openAccountModal = (employee: Employee) => {
    setSelectedEmployee(employee);
    const password = generateSecurePassword();
    setGeneratedPassword(password);
    setPasswordCopied(false);
    setIsAccountModalOpen(true);
  };

  const closeAccountModal = () => {
    setIsAccountModalOpen(false);
    setSelectedEmployee(null);
    setGeneratedPassword('');
    setPasswordCopied(false);
  };

  const handleGenerateNewPassword = () => {
    const password = generateSecurePassword();
    setGeneratedPassword(password);
    setPasswordCopied(false);
  };

  const handleCopyPassword = async () => {
    try {
      await navigator.clipboard.writeText(generatedPassword);
      setPasswordCopied(true);
      success('Gekopieerd', 'Wachtwoord is naar klembord gekopieerd');
      setTimeout(() => setPasswordCopied(false), 3000);
    } catch (err) {
      console.error('Error copying password:', err);
      error('Kopiëren mislukt', 'Kon wachtwoord niet kopiëren');
    }
  };

  const handleCreateAccount = async () => {
    if (!user || !selectedEmployee) return;

    setCreatingAccount(true);
    try {
      await createEmployeeAuthAccount(
        selectedEmployee.id,
        user.uid,
        selectedEmployee.personalInfo.contactInfo.email,
        generatedPassword
      );

      await refreshEmployees();
      const fullName = `${selectedEmployee.personalInfo.firstName} ${selectedEmployee.personalInfo.lastName}`;
      success('Account aangemaakt', `Account voor ${fullName} is succesvol aangemaakt`);
      closeAccountModal();
    } catch (err: any) {
      console.error('Error creating account:', err);
      let errorMessage = 'Er is een fout opgetreden bij het aanmaken van het account';

      if (err.code === 'auth/email-already-in-use') {
        errorMessage = 'Er bestaat al een account met dit e-mailadres';
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = 'Ongeldig e-mailadres';
      }

      error('Account aanmaken mislukt', errorMessage);
    } finally {
      setCreatingAccount(false);
    }
  };

  const getCompanyName = (companyId: string) => {
    return companies.find(c => c.id === companyId)?.name || 'Onbekend';
  };

  const getBranchName = (branchId: string) => {
    return branches.find(b => b.id === branchId)?.name || 'Onbekend';
  };

  const getAvailableBranches = () => {
    return branches.filter(b => b.companyId === selectedCompanyId);
  };

  const maskBSN = (bsn: string) => {
    if (bsn.length !== 9) return bsn;
    return `***-**-${bsn.slice(-3)}`;
  };

  const contractTypeLabels = {
    permanent: 'Vast',
    temporary: 'Tijdelijk',
    zero_hours: '0-uren',
    on_call: 'Oproep',
  };

  const columns = [
    {
      key: 'personalInfo' as keyof Employee,
      label: 'Naam',
      render: (personalInfo: Employee['personalInfo'], employee: Employee) => (
        <div className="flex items-center">
          <User className="h-5 w-5 text-gray-400 mr-2" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">
                {personalInfo.firstName} {personalInfo.lastName}
              </span>
              {employee.hasAccount && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Account
                </span>
              )}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              BSN: {maskBSN(personalInfo.bsn)}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'companyId' as keyof Employee,
      label: 'Bedrijf',
      render: (companyId: string, employee: Employee) => (
        <div>
          <div className="flex items-center text-sm">
            <Building2 className="h-4 w-4 text-gray-400 mr-1" />
            {getCompanyName(companyId)}
          </div>
          <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
            <MapPin className="h-4 w-4 mr-1" />
            {getBranchName(employee.branchId)}
          </div>
        </div>
      ),
    },
    {
      key: 'contractInfo' as keyof Employee,
      label: 'Contract',
      render: (contractInfo: Employee['contractInfo']) => (
        <div>
          <div className="text-sm font-medium">
            {contractTypeLabels[contractInfo.type as keyof typeof contractTypeLabels] || contractInfo.type}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {contractInfo.position}
          </div>
        </div>
      ),
    },
    {
      key: 'personalInfo' as keyof Employee,
      label: 'Contact',
      render: (personalInfo: Employee['personalInfo']) => (
        <div className="space-y-1">
          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
            <Mail className="h-4 w-4 mr-1" />
            {personalInfo.contactInfo.email}
          </div>
          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
            <Phone className="h-4 w-4 mr-1" />
            {personalInfo.contactInfo.phone}
          </div>
        </div>
      ),
    },
    {
      key: 'actions' as keyof Employee,
      label: 'Acties',
      render: (value: any, employee: Employee) => (
        <div className="flex space-x-2">
          {!employee.hasAccount && (
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                openAccountModal(employee);
              }}
              title="Account aanmaken"
            >
              <UserPlus className="h-4 w-4" />
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              openModal(employee);
            }}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteEmployee(employee);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Werknemers
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Beheer uw werknemers en hun contractgegevens
          </p>
        </div>
        <Button onClick={() => openModal()}>
          <Plus className="h-5 w-5 mr-2" />
          Nieuwe Werknemer
        </Button>
      </div>

      <Card>
        {employees.length === 0 ? (
          <EmptyState
            icon={User}
            title="Geen werknemers"
            description="Voeg je eerste werknemer toe om te beginnen met loonadministratie"
            actionLabel="Werknemer Toevoegen"
            onAction={() => openModal()}
          />
        ) : (
          <Table data={employees} columns={columns} />
        )}
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingEmployee ? 'Werknemer Bewerken' : 'Nieuwe Werknemer'}
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-4">
            <h4 className="text-lg font-medium text-gray-900 dark:text-white">
              Persoonlijke Gegevens
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Voornaam *"
                {...register('firstName', { required: 'Voornaam is verplicht' })}
                error={errors.firstName?.message}
              />
              <Input
                label="Achternaam *"
                {...register('lastName', { required: 'Achternaam is verplicht' })}
                error={errors.lastName?.message}
              />
              <Input
                label="Initialen *"
                {...register('initials', { required: 'Initialen zijn verplicht' })}
                error={errors.initials?.message}
              />
              <Input
                label="BSN *"
                {...register('bsn', { required: 'BSN is verplicht' })}
                error={errors.bsn?.message}
              />
              <Input
                label="Geboortedatum *"
                type="date"
                {...register('dateOfBirth', { required: 'Geboortedatum is verplicht' })}
                error={errors.dateOfBirth?.message}
              />
              <Input
                label="E-mailadres *"
                type="email"
                {...register('email', { required: 'E-mailadres is verplicht' })}
                error={errors.email?.message}
              />
              <Input
                label="Telefoonnummer *"
                {...register('phone', { required: 'Telefoonnummer is verplicht' })}
                error={errors.phone?.message}
              />
              <Input
                label="Straat *"
                {...register('street', { required: 'Straat is verplicht' })}
                error={errors.street?.message}
              />
              <Input
                label="Postcode *"
                {...register('zipCode', { required: 'Postcode is verplicht' })}
                error={errors.zipCode?.message}
              />
              <Input
                label="Plaats *"
                {...register('city', { required: 'Plaats is verplicht' })}
                error={errors.city?.message}
              />
              <Input
                label="IBAN *"
                {...register('bankAccount', { required: 'IBAN is verplicht' })}
                error={errors.bankAccount?.message}
              />
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-lg font-medium text-gray-900 dark:text-white">
              Contract Informatie
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Bedrijf *
                </label>
                <select
                  {...register('companyId', { required: 'Bedrijf is verplicht' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                >
                  <option value="">Selecteer bedrijf...</option>
                  {companies.map(company => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
                {errors.companyId && (
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                    {errors.companyId.message}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Vestiging *
                </label>
                <select
                  {...register('branchId', { required: 'Vestiging is verplicht' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                >
                  <option value="">Selecteer vestiging...</option>
                  {getAvailableBranches().map(branch => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name} - {branch.location}
                    </option>
                  ))}
                </select>
                {errors.branchId && (
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                    {errors.branchId.message}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Contracttype *
                </label>
                <select
                  {...register('contractType', { required: 'Contracttype is verplicht' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                >
                  <option value="permanent">Vast</option>
                  <option value="temporary">Tijdelijk</option>
                  <option value="zero_hours">0-uren</option>
                  <option value="on_call">Oproep</option>
                </select>
                {errors.contractType && (
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                    {errors.contractType.message}
                  </p>
                )}
              </div>
              <Input
                label="Startdatum *"
                type="date"
                {...register('startDate', { required: 'Startdatum is verplicht' })}
                error={errors.startDate?.message}
              />
              <Input
                label="Functie *"
                {...register('position', { required: 'Functie is verplicht' })}
                error={errors.position?.message}
              />
              <Input
                label="Uren per week *"
                type="number"
                {...register('hoursPerWeek', { required: 'Uren per week is verplicht', valueAsNumber: true })}
                error={errors.hoursPerWeek?.message}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  CAO *
                </label>
                <select
                  {...register('cao', { required: 'CAO is verplicht' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                >
                  <option value="">Selecteer CAO...</option>
                  {DUTCH_CAOS.map(cao => (
                    <option key={cao.id} value={cao.name}>
                      {cao.name}
                    </option>
                  ))}
                </select>
                {errors.cao && (
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                    {errors.cao.message}
                  </p>
                )}
              </div>
              <Input
                label="Loonschaal *"
                {...register('salaryScale', { required: 'Loonschaal is verplicht' })}
                error={errors.salaryScale?.message}
              />
              <Input
                label="Maandsalaris (€) *"
                type="number"
                step="0.01"
                {...register('monthlySalary', { required: 'Maandsalaris is verplicht', valueAsNumber: true })}
                error={errors.monthlySalary?.message}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200 dark:border-gray-700">
            <Button type="button" variant="secondary" onClick={closeModal}>
              Annuleren
            </Button>
            <Button type="submit" loading={submitting}>
              {editingEmployee ? 'Bijwerken' : 'Aanmaken'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isAccountModalOpen}
        onClose={closeAccountModal}
        title="Account Aanmaken voor Werknemer"
        size="md"
      >
        {selectedEmployee && (
          <div className="space-y-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start">
                <User className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 mr-3" />
                <div>
                  <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    {selectedEmployee.personalInfo.firstName} {selectedEmployee.personalInfo.lastName}
                  </h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    {selectedEmployee.personalInfo.contactInfo.email}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  E-mailadres
                </label>
                <Input
                  value={selectedEmployee.personalInfo.contactInfo.email}
                  disabled
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Wachtwoord
                </label>
                <div className="flex gap-2">
                  <Input
                    value={generatedPassword}
                    readOnly
                    className="font-mono"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleCopyPassword}
                    title="Kopieer wachtwoord"
                  >
                    {passwordCopied ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleGenerateNewPassword}
                    title="Genereer nieuw wachtwoord"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Let op:</strong> Bewaar dit wachtwoord veilig en deel het op een veilige manier met de werknemer.
                Het wachtwoord wordt na het sluiten van dit venster niet meer getoond.
              </p>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button type="button" variant="secondary" onClick={closeAccountModal}>
                Annuleren
              </Button>
              <Button
                type="button"
                onClick={handleCreateAccount}
                loading={creatingAccount}
              >
                Account Aanmaken
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default EmployeesNew;
