import React, { useState, useEffect } from 'react';
import { Plus, User, CreditCard as Edit, Trash2, Mail, Phone, Building2, MapPin } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Table from '../components/ui/Table';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useForm } from 'react-hook-form';
import { Employee, Company, Branch } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { useToast } from '../hooks/useToast';
import { createEmployee, updateEmployee, deleteEmployee, getBranches } from '../services/firebase';

interface EmployeeFormData {
  firstName: string;
  lastName: string;
  bsn: string;
  dateOfBirth: string;
  street: string;
  city: string;
  zipCode: string;
  email: string;
  phone: string;
  bankAccount: string;
  companyId: string;
  branchId: string;
  contractType: 'permanent' | 'temporary' | 'zero-hours' | 'on-call' | 'freelance';
  startDate: string;
  endDate: string;
  hoursPerWeek: number;
  position: string;
  salaryScale: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  hourlyRate: number;
  monthlySalary: number;
  pensionContribution: number;
}

const Employees: React.FC = () => {
  const { user } = useAuth();
  const { employees, companies, refreshEmployees, loading } = useApp();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [submitting, setSubmitting] = useState(false);
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
      setValue('bsn', employee.personalInfo.bsn);
      setValue('dateOfBirth', employee.personalInfo.dateOfBirth.toISOString().split('T')[0]);
      setValue('street', employee.personalInfo.address.street);
      setValue('city', employee.personalInfo.address.city);
      setValue('zipCode', employee.personalInfo.address.zipCode);
      setValue('email', employee.personalInfo.contactInfo.email);
      setValue('phone', employee.personalInfo.contactInfo.phone);
      setValue('bankAccount', employee.personalInfo.bankAccount);
      setValue('companyId', employee.companyId);
      setValue('branchId', employee.branchId);
      setValue('contractType', employee.contractInfo.type);
      setValue('startDate', employee.contractInfo.startDate.toISOString().split('T')[0]);
      setValue('endDate', employee.contractInfo.endDate ? employee.contractInfo.endDate.toISOString().split('T')[0] : '');
      setValue('hoursPerWeek', employee.contractInfo.hoursPerWeek || 0);
      setValue('position', employee.contractInfo.position);
      setValue('salaryScale', employee.salaryInfo.salaryScale);
      setValue('hourlyRate', employee.salaryInfo.hourlyRate || 0);
      setValue('monthlySalary', employee.salaryInfo.monthlySalary || 0);
      setValue('pensionContribution', employee.salaryInfo.pensionContribution);
    } else {
      setEditingEmployee(null);
      reset();
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
          bsn: data.bsn,
          dateOfBirth: new Date(data.dateOfBirth),
          address: {
            street: data.street,
            city: data.city,
            zipCode: data.zipCode,
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
          endDate: data.endDate ? new Date(data.endDate) : undefined,
          hoursPerWeek: data.hoursPerWeek || undefined,
          position: data.position,
        },
        salaryInfo: {
          salaryScale: data.salaryScale,
          hourlyRate: data.hourlyRate || undefined,
          monthlySalary: data.monthlySalary || undefined,
          allowances: {
            overtime: 150,
            irregular: 130,
            shift: 120,
            weekend: 150,
          },
          holidayAllowancePercentage: 8,
          travelAllowancePerKm: 0.23,
          pensionContribution: data.pensionContribution,
        },
        status: 'active',
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

  const getCompanyName = (companyId: string) => {
    return companies.find(c => c.id === companyId)?.name || 'Onbekend';
  };

  const getBranchName = (branchId: string) => {
    return branches.find(b => b.id === branchId)?.name || 'Onbekend';
  };

  const getAvailableBranches = () => {
    return branches.filter(b => b.companyId === selectedCompanyId);
  };

  const contractTypeLabels = {
    permanent: 'Vast',
    temporary: 'Tijdelijk',
    'zero-hours': '0-uren',
    'on-call': 'Oproep',
    freelance: 'ZZP',
  };

  const columns = [
    {
      key: 'personalInfo' as keyof Employee,
      label: 'Naam',
      render: (personalInfo: Employee['personalInfo']) => (
        <div className="flex items-center">
          <User className="h-5 w-5 text-gray-400 mr-2" />
          <div>
            <div className="font-medium">
              {personalInfo.firstName} {personalInfo.lastName}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              BSN: {personalInfo.bsn}
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
            {contractTypeLabels[contractInfo.type]}
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
      key: 'salaryInfo' as keyof Employee,
      label: 'Loon',
      render: (salaryInfo: Employee['salaryInfo']) => (
        <div>
          <div className="text-sm font-medium">
            Schaal {salaryInfo.salaryScale}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {salaryInfo.hourlyRate ? `€${salaryInfo.hourlyRate}/uur` : `€${salaryInfo.monthlySalary}/maand`}
          </div>
        </div>
      ),
    },
    {
      key: 'status' as keyof Employee,
      label: 'Status',
      render: (status: Employee['status']) => (
        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
          status === 'active' 
            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
            : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
        }`}>
          {status === 'active' ? 'Actief' : 'Inactief'}
        </span>
      ),
    },
    {
      key: 'actions' as keyof Employee,
      label: 'Acties',
      render: (value: any, employee: Employee) => (
        <div className="flex space-x-2">
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
      {/* Header */}
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

      {/* Employees Table */}
      <Card>
        {employees.length === 0 ? (
          companies.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="Geen bedrijven"
              description="Maak eerst een bedrijf aan voordat je werknemers kunt toevoegen"
              actionLabel="Bedrijf Toevoegen"
              onAction={() => window.location.href = '/companies'}
            />
          ) : (
            <EmptyState
              icon={User}
              title="Geen werknemers"
              description="Voeg je eerste werknemer toe om te beginnen met loonadministratie"
              actionLabel="Werknemer Toevoegen"
              onAction={() => openModal()}
            />
          )
        ) : (
          <Table data={employees} columns={columns} />
        )}
      </Card>

      {/* Employee Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingEmployee ? 'Werknemer Bewerken' : 'Nieuwe Werknemer'}
        size="xl"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Personal Info */}
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
            </div>
          </div>

          {/* Address */}
          <div className="space-y-4">
            <h4 className="text-lg font-medium text-gray-900 dark:text-white">
              Adresgegevens
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <Input
                  label="Straat en Huisnummer *"
                  {...register('street', { required: 'Adres is verplicht' })}
                  error={errors.street?.message}
                />
              </div>
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
            </div>
          </div>

          {/* Contact Info */}
          <div className="space-y-4">
            <h4 className="text-lg font-medium text-gray-900 dark:text-white">
              Contactgegevens
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                label="Bankrekeningnummer *"
                {...register('bankAccount', { required: 'Bankrekeningnummer is verplicht' })}
                error={errors.bankAccount?.message}
                helperText="IBAN formaat (bijv. NL91 ABNA 0417 1643 00)"
              />
            </div>
          </div>

          {/* Company & Branch */}
          <div className="space-y-4">
            <h4 className="text-lg font-medium text-gray-900 dark:text-white">
              Bedrijf & Vestiging
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
                  disabled={!selectedCompanyId}
                >
                  <option value="">Selecteer vestiging...</option>
                  {getAvailableBranches().map(branch => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
                {errors.branchId && (
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                    {errors.branchId.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Contract Info */}
          <div className="space-y-4">
            <h4 className="text-lg font-medium text-gray-900 dark:text-white">
              Contractgegevens
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Contracttype *
                </label>
                <select
                  {...register('contractType', { required: 'Contracttype is verplicht' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                >
                  <option value="">Selecteer type...</option>
                  {Object.entries(contractTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                {errors.contractType && (
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                    {errors.contractType.message}
                  </p>
                )}
              </div>
              <Input
                label="Functie *"
                {...register('position', { required: 'Functie is verplicht' })}
                error={errors.position?.message}
              />
              <Input
                label="Startdatum *"
                type="date"
                {...register('startDate', { required: 'Startdatum is verplicht' })}
                error={errors.startDate?.message}
              />
              <Input
                label="Einddatum"
                type="date"
                {...register('endDate')}
                helperText="Alleen bij tijdelijke contracten"
              />
              <Input
                label="Uren per week"
                type="number"
                {...register('hoursPerWeek', { valueAsNumber: true })}
                helperText="Bij vaste contracten"
              />
            </div>
          </div>

          {/* Salary Info */}
          <div className="space-y-4">
            <h4 className="text-lg font-medium text-gray-900 dark:text-white">
              Loongegevens
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Loonschaal *
                </label>
                <select
                  {...register('salaryScale', { required: 'Loonschaal is verplicht' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                >
                  <option value="">Selecteer schaal...</option>
                  {['A', 'B', 'C', 'D', 'E', 'F'].map(scale => (
                    <option key={scale} value={scale}>
                      Schaal {scale}
                    </option>
                  ))}
                </select>
                {errors.salaryScale && (
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                    {errors.salaryScale.message}
                  </p>
                )}
              </div>
              <Input
                label="Uurloon (€)"
                type="number"
                step="0.01"
                {...register('hourlyRate', { valueAsNumber: true })}
                helperText="Voor uurloon contracten"
              />
              <Input
                label="Maandsalaris (€)"
                type="number"
                step="0.01"
                {...register('monthlySalary', { valueAsNumber: true })}
                helperText="Voor salaris contracten"
              />
              <Input
                label="Eigen pensioenbijdrage (%)"
                type="number"
                step="0.1"
                {...register('pensionContribution', { 
                  required: 'Pensioenbijdrage is verplicht',
                  valueAsNumber: true 
                })}
                error={errors.pensionContribution?.message}
              />
            </div>
          </div>

          {/* Actions */}
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
    </div>
  );
};

export default Employees;