import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import { useToast } from '../../hooks/useToast';
import { createEmployee, updateEmployee } from '../../services/firebase';
import { Employee } from '../../types';

interface SimplifiedEmployeeFormData {
  // Basic Info
  firstName: string;
  lastName: string;
  email: string;
  
  // Contract Info
  contractType: 'permanent' | 'temporary' | 'zero_hours' | 'on_call' | 'intern';
  startDate: string;
  endDate?: string;
  hoursPerWeek: number;
  position: string;
  
  // Payment Info
  paymentType: 'hourly' | 'monthly';
  hourlyRate?: number;
  monthlySalary?: number;
  
  // Company Assignment
  companyId: string;
  branchId: string;
}

interface EmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  employee?: Employee | null;
}

const EmployeeModal: React.FC<EmployeeModalProps> = ({ isOpen, onClose, onSuccess, employee }) => {
  const { user } = useAuth();
  const { companies, branches } = useApp();
  const { success, error: showError } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<SimplifiedEmployeeFormData>({
    defaultValues: {
      contractType: 'permanent',
      paymentType: 'hourly',
    }
  });

  const contractType = watch('contractType');
  const paymentType = watch('paymentType');
  const selectedCompanyId = watch('companyId');

  const availableBranches = branches.filter(branch => branch.companyId === selectedCompanyId);

  useEffect(() => {
    if (employee) {
      reset({
        firstName: employee.personalInfo.firstName,
        lastName: employee.personalInfo.lastName,
        email: employee.personalInfo.contactInfo.email,
        contractType: employee.contractInfo.type,
        startDate: employee.contractInfo.startDate.toISOString().split('T')[0],
        endDate: employee.contractInfo.endDate?.toISOString().split('T')[0],
        hoursPerWeek: employee.contractInfo.hoursPerWeek,
        position: employee.contractInfo.position,
        paymentType: employee.salaryInfo.paymentType,
        hourlyRate: employee.salaryInfo.hourlyRate,
        monthlySalary: employee.salaryInfo.monthlySalary,
        companyId: employee.companyId,
        branchId: employee.branchId,
      });
    } else if (companies.length > 0) {
      const defaultCompanyId = companies[0].id;
      const defaultBranchId = branches.find(b => b.companyId === defaultCompanyId)?.id || '';
      reset({
        contractType: 'permanent',
        paymentType: 'hourly',
        companyId: defaultCompanyId,
        branchId: defaultBranchId,
      });
    }
  }, [employee, companies, branches, reset, isOpen]);

  const onSubmit = async (data: SimplifiedEmployeeFormData) => {
    if (!user) {
      showError('Niet ingelogd', 'Je moet ingelogd zijn om een werknemer toe te voegen');
      return;
    }

    if (!data.companyId || !data.branchId) {
      showError('Incomplete data', 'Selecteer een bedrijf en vestiging');
      return;
    }

    // Basic validation
    if (contractType === 'temporary' && !data.endDate) {
      showError('Einddatum vereist', 'Einddatum is verplicht voor tijdelijk contract');
      return;
    }

    if (paymentType === 'hourly' && !data.hourlyRate) {
      showError('Uurtarief vereist', 'Uurtarief is verplicht voor uurloon');
      return;
    }

    if (paymentType === 'monthly' && !data.monthlySalary) {
      showError('Maandsalaris vereist', 'Maandsalaris is verplicht voor maandloon');
      return;
    }

    setSubmitting(true);
    try {
      const employeeData = {
        companyId: data.companyId,
        branchId: data.branchId,
        
        // Minimal personal info - user fills their own details later
        personalInfo: {
          firstName: data.firstName,
          lastName: data.lastName,
          initials: data.firstName.charAt(0) + data.lastName.charAt(0), // Auto-generate
          bsn: '', // To be filled by employee
          dateOfBirth: new Date(), // Default - to be updated
          placeOfBirth: '', // To be filled by employee
          nationality: 'Nederlandse', // Default
          address: {
            street: '',
            houseNumber: '',
            houseNumberAddition: '',
            postalCode: '',
            city: '',
            country: 'Nederland',
          },
          contactInfo: {
            email: data.email,
            phone: '', // To be filled by employee
          },
          bankAccount: '', // To be filled by employee
          maritalStatus: 'single' as const, // Default
        },
        
        contractInfo: {
          type: data.contractType,
          startDate: new Date(data.startDate),
          endDate: data.endDate ? new Date(data.endDate) : null,
          hoursPerWeek: data.hoursPerWeek,
          position: data.position,
          department: '',
          cao: 'cao-algemeen', // Default
          contractStatus: 'active' as const,
        },
        
        salaryInfo: {
          salaryScale: 'A', // Default
          hourlyRate: data.paymentType === 'hourly' ? data.hourlyRate : null,
          monthlySalary: data.paymentType === 'monthly' ? data.monthlySalary : null,
          paymentType: data.paymentType,
          paymentFrequency: 'monthly' as const,
          allowances: {
            overtime: 150,
            irregular: 125,
            shift: 115,
            weekend: 150,
          },
          holidayAllowancePercentage: 8,
          thirteenthMonth: false,
          travelAllowance: {
            type: 'per_km' as const,
            amountPerKm: 0.23,
          },
          pensionContribution: 6,
          pensionEmployerContribution: 14,
          taxCredit: true,
          taxTable: 'white' as const,
        },
        
        leaveInfo: {
          holidayDays: {
            statutory: data.hoursPerWeek * 4,
            extraStatutory: 0,
            accumulated: 0,
            taken: 0,
            remaining: data.hoursPerWeek * 4,
            expiryDate: new Date(new Date().getFullYear() + 5, 11, 31),
          },
          seniorDays: 0,
          snipperDays: 0,
        },
        
        status: 'active' as const,
        hasAccount: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (employee) {
        await updateEmployee(employee.id, user.uid, employeeData);
        success('Werknemer bijgewerkt', `${data.firstName} ${data.lastName} is succesvol bijgewerkt`);
      } else {
        await createEmployee(user.uid, employeeData);
        success('Werknemer aangemaakt', `${data.firstName} ${data.lastName} is succesvol aangemaakt`);
      }
      
      await onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving employee:', error);
      const errorMessage = error instanceof Error ? error.message : 'Onbekende fout';
      showError('Fout bij opslaan', `Kon werknemer niet opslaan: ${errorMessage}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={employee ? 'Werknemer Bewerken' : 'Nieuwe Werknemer'} size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        
        {/* Company and Branch Selection */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Bedrijf & Vestiging</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Bedrijf *
              </label>
              <select
                {...register('companyId', { required: 'Bedrijf is verplicht' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
              >
                <option value="">Selecteer bedrijf</option>
                {companies.map(company => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
              {errors.companyId && (
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.companyId.message}</p>
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
                <option value="">Selecteer vestiging</option>
                {availableBranches.map(branch => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
              {errors.branchId && (
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.branchId.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Basic Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Basis Gegevens</h3>
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
          </div>
          <Input
            label="E-mail *"
            type="email"
            {...register('email', { 
              required: 'E-mail is verplicht',
              pattern: {
                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                message: 'Ongeldig e-mailadres'
              }
            })}
            error={errors.email?.message}
          />
        </div>

        {/* Contract Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Contract Informatie</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Contract type *
              </label>
              <select
                {...register('contractType', { required: 'Contract type is verplicht' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
              >
                <option value="permanent">Vast contract</option>
                <option value="temporary">Tijdelijk contract</option>
                <option value="zero_hours">Nul-urencontract</option>
                <option value="on_call">Oproepcontract</option>
                <option value="intern">Stagiair</option>
              </select>
            </div>
            <Input
              label="Functie *"
              {...register('position', { required: 'Functie is verplicht' })}
              error={errors.position?.message}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Startdatum *"
              type="date"
              {...register('startDate', { required: 'Startdatum is verplicht' })}
              error={errors.startDate?.message}
            />
            {contractType === 'temporary' && (
              <Input
                label="Einddatum *"
                type="date"
                {...register('endDate', { required: 'Einddatum is verplicht voor tijdelijk contract' })}
                error={errors.endDate?.message}
              />
            )}
            <Input
              label="Uren per week *"
              type="number"
              {...register('hoursPerWeek', { 
                required: 'Uren per week is verplicht',
                valueAsNumber: true,
                min: { value: 1, message: 'Minimaal 1 uur per week' },
                max: { value: 60, message: 'Maximaal 60 uur per week' }
              })}
              error={errors.hoursPerWeek?.message}
            />
          </div>
        </div>

        {/* Salary Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Salaris Informatie</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Betalingstype *
              </label>
              <select
                {...register('paymentType', { required: 'Betalingstype is verplicht' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
              >
                <option value="hourly">Uurloon</option>
                <option value="monthly">Maandloon</option>
              </select>
            </div>
            {paymentType === 'hourly' && (
              <Input
                label="Uurtarief *"
                type="number"
                step="0.01"
                {...register('hourlyRate', { 
                  required: paymentType === 'hourly' ? 'Uurtarief is verplicht' : false,
                  valueAsNumber: true,
                  min: { value: 0.01, message: 'Uurtarief moet positief zijn' }
                })}
                error={errors.hourlyRate?.message}
              />
            )}
            {paymentType === 'monthly' && (
              <Input
                label="Maandsalaris *"
                type="number"
                step="0.01"
                {...register('monthlySalary', { 
                  required: paymentType === 'monthly' ? 'Maandsalaris is verplicht' : false,
                  valueAsNumber: true,
                  min: { value: 0.01, message: 'Maandsalaris moet positief zijn' }
                })}
                error={errors.monthlySalary?.message}
              />
            )}
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <strong>Opmerking:</strong> Andere persoonlijke gegevens (BSN, adres, bankrekening, telefoon, etc.) kunnen later door de werknemer zelf worden ingevuld via hun profiel.
          </p>
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Annuleren
          </Button>
          <Button type="submit" loading={submitting}>
            {employee ? 'Bijwerken' : 'Aanmaken'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default EmployeeModal;