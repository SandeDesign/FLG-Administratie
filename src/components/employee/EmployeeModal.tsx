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
import { validateBSN, validateIBAN, validatePostalCode, validatePhone } from '../../utils/validation';

interface EmployeeFormData {
  firstName: string;
  lastName: string;
  initials: string;
  bsn: string;
  dateOfBirth: string;
  placeOfBirth: string;
  nationality: string;
  street: string;
  houseNumber: string;
  houseNumberAddition?: string;
  postalCode: string;
  city: string;
  country: string;
  email: string;
  phone: string;
  bankAccount: string;
  maritalStatus: 'single' | 'married' | 'registered_partnership' | 'divorced' | 'widowed';
  contractType: 'permanent' | 'temporary' | 'zero_hours' | 'on_call' | 'intern';
  startDate: string;
  endDate?: string;
  hoursPerWeek: number;
  position: string;
  department?: string;
  cao: string;
  paymentType: 'hourly' | 'monthly' | 'annual';
  hourlyRate?: number;
  monthlySalary?: number;
  annualSalary?: number;
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

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<EmployeeFormData>({
    defaultValues: {
      nationality: 'Nederlandse',
      country: 'Nederland',
      maritalStatus: 'single',
      contractType: 'permanent',
      cao: 'cao-algemeen',
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
        initials: employee.personalInfo.initials,
        bsn: employee.personalInfo.bsn,
        dateOfBirth: employee.personalInfo.dateOfBirth.toISOString().split('T')[0],
        placeOfBirth: employee.personalInfo.placeOfBirth,
        nationality: employee.personalInfo.nationality,
        street: employee.personalInfo.address.street,
        houseNumber: employee.personalInfo.address.houseNumber,
        houseNumberAddition: employee.personalInfo.address.houseNumberAddition,
        postalCode: employee.personalInfo.address.postalCode,
        city: employee.personalInfo.address.city,
        country: employee.personalInfo.address.country,
        email: employee.personalInfo.contactInfo.email,
        phone: employee.personalInfo.contactInfo.phone,
        bankAccount: employee.personalInfo.bankAccount,
        maritalStatus: employee.personalInfo.maritalStatus,
        contractType: employee.contractInfo.type,
        startDate: employee.contractInfo.startDate.toISOString().split('T')[0],
        endDate: employee.contractInfo.endDate?.toISOString().split('T')[0],
        hoursPerWeek: employee.contractInfo.hoursPerWeek,
        position: employee.contractInfo.position,
        department: employee.contractInfo.department,
        cao: employee.contractInfo.cao,
        paymentType: employee.salaryInfo.paymentType,
        hourlyRate: employee.salaryInfo.hourlyRate,
        monthlySalary: employee.salaryInfo.monthlySalary,
        annualSalary: employee.salaryInfo.annualSalary,
        companyId: employee.companyId,
        branchId: employee.branchId,
      });
    } else if (companies.length > 0) {
      reset({
        nationality: 'Nederlandse',
        country: 'Nederland',
        maritalStatus: 'single',
        contractType: 'permanent',
        cao: 'cao-algemeen',
        paymentType: 'hourly',
        companyId: companies[0].id,
        branchId: branches.find(b => b.companyId === companies[0].id)?.id || '',
      });
    }
  }, [employee, companies, branches, reset]);

  const onSubmit = async (data: EmployeeFormData) => {
    if (!user) return;

    // Validation
    if (!validateBSN(data.bsn)) {
      showError('Ongeldig BSN', 'Het ingevoerde BSN nummer is niet geldig');
      return;
    }

    if (!validateIBAN(data.bankAccount)) {
      showError('Ongeldig IBAN', 'Het ingevoerde IBAN nummer is niet geldig');
      return;
    }

    if (!validatePostalCode(data.postalCode)) {
      showError('Ongeldige postcode', 'Postcode moet in het formaat 1234 AB zijn');
      return;
    }

    if (!validatePhone(data.phone)) {
      showError('Ongeldig telefoonnummer', 'Voer een geldig Nederlands telefoonnummer in');
      return;
    }

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
          placeOfBirth: data.placeOfBirth,
          nationality: data.nationality,
          address: {
            street: data.street,
            houseNumber: data.houseNumber,
            houseNumberAddition: data.houseNumberAddition,
            postalCode: data.postalCode,
            city: data.city,
            country: data.country,
          },
          contactInfo: {
            email: data.email,
            phone: data.phone,
          },
          bankAccount: data.bankAccount,
          maritalStatus: data.maritalStatus,
        },
        contractInfo: {
          type: data.contractType,
          startDate: new Date(data.startDate),
          endDate: data.endDate ? new Date(data.endDate) : undefined,
          hoursPerWeek: data.hoursPerWeek,
          position: data.position,
          department: data.department,
          cao: data.cao,
          contractStatus: 'active' as const,
        },
        salaryInfo: {
          salaryScale: 'A',
          paymentType: data.paymentType,
          paymentFrequency: 'monthly' as const,
          hourlyRate: data.hourlyRate,
          monthlySalary: data.monthlySalary,
          annualSalary: data.annualSalary,
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

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving employee:', error);
      showError('Fout bij opslaan', 'Kon werknemer niet opslaan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={employee ? 'Werknemer Bewerken' : 'Nieuwe Werknemer'} size="xl">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
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

        {/* Personal Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Persoonlijke Gegevens</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Geboorteplaats *"
              {...register('placeOfBirth', { required: 'Geboorteplaats is verplicht' })}
              error={errors.placeOfBirth?.message}
            />
            <Input
              label="Nationaliteit *"
              {...register('nationality', { required: 'Nationaliteit is verplicht' })}
              error={errors.nationality?.message}
            />
          </div>
        </div>

        {/* Address */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Adresgegevens</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Straat *"
              {...register('street', { required: 'Straat is verplicht' })}
              error={errors.street?.message}
            />
            <Input
              label="Huisnummer *"
              {...register('houseNumber', { required: 'Huisnummer is verplicht' })}
              error={errors.houseNumber?.message}
            />
            <Input
              label="Toevoeging"
              {...register('houseNumberAddition')}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Postcode *"
              {...register('postalCode', { required: 'Postcode is verplicht' })}
              error={errors.postalCode?.message}
            />
            <Input
              label="Plaats *"
              {...register('city', { required: 'Plaats is verplicht' })}
              error={errors.city?.message}
            />
            <Input
              label="Land *"
              {...register('country', { required: 'Land is verplicht' })}
              error={errors.country?.message}
            />
          </div>
        </div>

        {/* Contact Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Contactgegevens</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="E-mail *"
              type="email"
              {...register('email', { required: 'E-mail is verplicht' })}
              error={errors.email?.message}
            />
            <Input
              label="Telefoon *"
              {...register('phone', { required: 'Telefoon is verplicht' })}
              error={errors.phone?.message}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="IBAN *"
              {...register('bankAccount', { required: 'IBAN is verplicht' })}
              error={errors.bankAccount?.message}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Burgerlijke staat *
              </label>
              <select
                {...register('maritalStatus', { required: 'Burgerlijke staat is verplicht' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
              >
                <option value="single">Ongehuwd</option>
                <option value="married">Gehuwd</option>
                <option value="registered_partnership">Geregistreerd partnerschap</option>
                <option value="divorced">Gescheiden</option>
                <option value="widowed">Weduwe/weduwnaar</option>
              </select>
            </div>
          </div>
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
                valueAsNumber: true 
              })}
              error={errors.hoursPerWeek?.message}
            />
          </div>
          <Input
            label="Afdeling"
            {...register('department')}
          />
        </div>

        {/* Salary Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Salaris Informatie</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                CAO *
              </label>
              <select
                {...register('cao', { required: 'CAO is verplicht' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
              >
                <option value="cao-algemeen">Algemeen (geen specifieke CAO)</option>
                <option value="cao-bouw">Bouw & Infra</option>
                <option value="cao-horeca">Horeca & Catering</option>
                <option value="cao-zorg">Zorg & Welzijn</option>
                <option value="cao-metaal">Metaal & Techniek</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Betalingstype *
              </label>
              <select
                {...register('paymentType', { required: 'Betalingstype is verplicht' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
              >
                <option value="hourly">Uurtarief</option>
                <option value="monthly">Maandsalaris</option>
                <option value="annual">Jaarsalaris</option>
              </select>
            </div>
          </div>

          {paymentType === 'hourly' && (
            <Input
              label="Uurtarief (€) *"
              type="number"
              step="0.01"
              {...register('hourlyRate', { 
                required: 'Uurtarief is verplicht',
                valueAsNumber: true 
              })}
              error={errors.hourlyRate?.message}
            />
          )}

          {paymentType === 'monthly' && (
            <Input
              label="Maandsalaris (€) *"
              type="number"
              step="0.01"
              {...register('monthlySalary', { 
                required: 'Maandsalaris is verplicht',
                valueAsNumber: true 
              })}
              error={errors.monthlySalary?.message}
            />
          )}

          {paymentType === 'annual' && (
            <Input
              label="Jaarsalaris (€) *"
              type="number"
              step="0.01"
              {...register('annualSalary', { 
                required: 'Jaarsalaris is verplicht',
                valueAsNumber: true 
              })}
              error={errors.annualSalary?.message}
            />
          )}
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