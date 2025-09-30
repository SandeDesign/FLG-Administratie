import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import { createCompany, updateCompany } from '../../services/firebase';
import { Company } from '../../types';

interface CompanyFormData {
  name: string;
  kvk: string;
  taxNumber: string;
  street: string;
  city: string;
  zipCode: string;
  country: string;
  email: string;
  phone: string;
  website?: string;
  defaultCAO: string;
  travelAllowancePerKm: number;
  standardWorkWeek: number;
  holidayAllowancePercentage: number;
  pensionContributionPercentage: number;
}

interface CompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  company?: Company | null;
}

const CompanyModal: React.FC<CompanyModalProps> = ({ isOpen, onClose, onSuccess, company }) => {
  const { user } = useAuth();
  const { success, error: showError } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CompanyFormData>({
    defaultValues: {
      country: 'Nederland',
      defaultCAO: 'cao-algemeen',
      travelAllowancePerKm: 0.23,
      standardWorkWeek: 40,
      holidayAllowancePercentage: 8,
      pensionContributionPercentage: 6,
    }
  });

  useEffect(() => {
    if (company) {
      reset({
        name: company.name,
        kvk: company.kvk,
        taxNumber: company.taxNumber,
        street: company.address.street,
        city: company.address.city,
        zipCode: company.address.zipCode,
        country: company.address.country,
        email: company.contactInfo.email,
        phone: company.contactInfo.phone,
        website: company.contactInfo.website,
        defaultCAO: company.settings.defaultCAO,
        travelAllowancePerKm: company.settings.travelAllowancePerKm,
        standardWorkWeek: company.settings.standardWorkWeek,
        holidayAllowancePercentage: company.settings.holidayAllowancePercentage,
        pensionContributionPercentage: company.settings.pensionContributionPercentage,
      });
    } else {
      reset({
        country: 'Nederland',
        defaultCAO: 'cao-algemeen',
        travelAllowancePerKm: 0.23,
        standardWorkWeek: 40,
        holidayAllowancePercentage: 8,
        pensionContributionPercentage: 6,
      });
    }
  }, [company, reset]);

  const onSubmit = async (data: CompanyFormData) => {
    if (!user) return;

    setSubmitting(true);
    try {
      const companyData = {
        name: data.name,
        kvk: data.kvk,
        taxNumber: data.taxNumber,
        address: {
          street: data.street,
          city: data.city,
          zipCode: data.zipCode,
          country: data.country,
        },
        contactInfo: {
          email: data.email,
          phone: data.phone,
          website: data.website,
        },
        settings: {
          defaultCAO: data.defaultCAO,
          travelAllowancePerKm: data.travelAllowancePerKm,
          standardWorkWeek: data.standardWorkWeek,
          holidayAllowancePercentage: data.holidayAllowancePercentage,
          pensionContributionPercentage: data.pensionContributionPercentage,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (company) {
        await updateCompany(company.id, user.uid, companyData);
        success('Bedrijf bijgewerkt', `${data.name} is succesvol bijgewerkt`);
      } else {
        await createCompany(user.uid, companyData);
        success('Bedrijf aangemaakt', `${data.name} is succesvol aangemaakt`);
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving company:', error);
      showError('Fout bij opslaan', 'Kon bedrijf niet opslaan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={company ? 'Bedrijf Bewerken' : 'Nieuw Bedrijf'} size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Bedrijfsnaam *"
            {...register('name', { required: 'Bedrijfsnaam is verplicht' })}
            error={errors.name?.message}
          />
          <Input
            label="KvK Nummer *"
            {...register('kvk', { required: 'KvK nummer is verplicht' })}
            error={errors.kvk?.message}
          />
        </div>

        <Input
          label="BTW Nummer *"
          {...register('taxNumber', { required: 'BTW nummer is verplicht' })}
          error={errors.taxNumber?.message}
        />

        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Adresgegevens</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          <Input
            label="Website"
            {...register('website')}
          />
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Instellingen</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Standaard CAO *
              </label>
              <select
                {...register('defaultCAO', { required: 'CAO is verplicht' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
              >
                <option value="cao-algemeen">Algemeen (geen specifieke CAO)</option>
                <option value="cao-bouw">Bouw & Infra</option>
                <option value="cao-horeca">Horeca & Catering</option>
                <option value="cao-zorg">Zorg & Welzijn</option>
                <option value="cao-metaal">Metaal & Techniek</option>
              </select>
            </div>
            <Input
              label="Reiskostenvergoeding (€/km) *"
              type="number"
              step="0.01"
              {...register('travelAllowancePerKm', { 
                required: 'Reiskostenvergoeding is verplicht',
                valueAsNumber: true 
              })}
              error={errors.travelAllowancePerKm?.message}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Standaard werkweek (uren) *"
              type="number"
              {...register('standardWorkWeek', { 
                required: 'Standaard werkweek is verplicht',
                valueAsNumber: true 
              })}
              error={errors.standardWorkWeek?.message}
            />
            <Input
              label="Vakantietoeslag (%) *"
              type="number"
              step="0.1"
              {...register('holidayAllowancePercentage', { 
                required: 'Vakantietoeslag is verplicht',
                valueAsNumber: true 
              })}
              error={errors.holidayAllowancePercentage?.message}
            />
            <Input
              label="Pensioenpremie (%) *"
              type="number"
              step="0.1"
              {...register('pensionContributionPercentage', { 
                required: 'Pensioenpremie is verplicht',
                valueAsNumber: true 
              })}
              error={errors.pensionContributionPercentage?.message}
            />
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Annuleren
          </Button>
          <Button type="submit" loading={submitting}>
            {company ? 'Bijwerken' : 'Aanmaken'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default CompanyModal;