import React, { useState, useEffect } from 'react';
import { Plus, Building2, CreditCard as Edit, Trash2, MapPin, Phone, Mail } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Table from '../components/ui/Table';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useForm } from 'react-hook-form';
import { Company, Branch, DUTCH_CAOS } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { useToast } from '../hooks/useToast';
import { createCompany, updateCompany, deleteCompany, getBranches } from '../services/firebase';

interface CompanyFormData {
  name: string;
  kvk: string;
  taxNumber: string;
  street: string;
  city: string;
  zipCode: string;
  email: string;
  phone: string;
  website: string;
  defaultCAO: string;
  travelAllowancePerKm: number;
  standardWorkWeek: number;
  holidayAllowancePercentage: number;
  pensionContributionPercentage: number;
  mainBranchId: string;
}

const Companies: React.FC = () => {
  const { user } = useAuth();
  const { companies, refreshCompanies, loading } = useApp();
  const [companyBranches, setCompanyBranches] = useState<Branch[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { success, error } = useToast();

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<CompanyFormData>();

  const openModal = (company?: Company) => {
    if (company) {
      setEditingCompany(company);
      setValue('name', company.name);
      setValue('kvk', company.kvk);
      setValue('taxNumber', company.taxNumber);
      setValue('street', company.address.street);
      setValue('city', company.address.city);
      setValue('zipCode', company.address.zipCode);
      setValue('email', company.contactInfo.email);
      setValue('phone', company.contactInfo.phone);
      setValue('website', company.contactInfo.website || '');
      setValue('defaultCAO', company.settings.defaultCAO);
      setValue('travelAllowancePerKm', company.settings.travelAllowancePerKm);
      setValue('standardWorkWeek', company.settings.standardWorkWeek);
      setValue('holidayAllowancePercentage', company.settings.holidayAllowancePercentage);
      setValue('pensionContributionPercentage', company.settings.pensionContributionPercentage);
    } else {
      setEditingCompany(null);
      reset();
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCompany(null);
    setCompanyBranches([]);
    reset();
  };

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
          country: 'Nederland',
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
        mainBranchId: data.mainBranchId || undefined,
      };

      if (editingCompany) {
        await updateCompany(editingCompany.id, user.uid, companyData);
        success('Bedrijf bijgewerkt', `${data.name} is succesvol bijgewerkt`);
      } else {
        await createCompany(user.uid, companyData);
        success('Bedrijf aangemaakt', `${data.name} is succesvol toegevoegd`);
      }

      await refreshCompanies();
      closeModal();
    } catch (err) {
      console.error('Error saving company:', err);
      error('Er is een fout opgetreden', 'Probeer het opnieuw');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCompany = async (company: Company) => {
    if (!user) return;
    
    if (window.confirm(`Weet je zeker dat je ${company.name} wilt verwijderen?`)) {
      try {
        await deleteCompany(company.id, user.uid);
        await refreshCompanies();
        success('Bedrijf verwijderd', `${company.name} is succesvol verwijderd`);
      } catch (err) {
        console.error('Error deleting company:', err);
        error('Fout bij verwijderen', 'Kon bedrijf niet verwijderen');
      }
    }
  };

  const columns = [
    {
      key: 'name' as keyof Company,
      label: 'Bedrijfsnaam',
      render: (value: string) => (
        <div className="flex items-center">
          <Building2 className="h-5 w-5 text-gray-400 mr-2" />
          <span className="font-medium">{value}</span>
        </div>
      ),
    },
    {
      key: 'kvk' as keyof Company,
      label: 'KVK Nummer',
    },
    {
      key: 'address' as keyof Company,
      label: 'Locatie',
      render: (address: Company['address']) => (
        <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
          <MapPin className="h-4 w-4 mr-1" />
          {address.city}, {address.zipCode}
        </div>
      ),
    },
    {
      key: 'contactInfo' as keyof Company,
      label: 'Contact',
      render: (contact: Company['contactInfo']) => (
        <div className="space-y-1">
          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
            <Mail className="h-4 w-4 mr-1" />
            {contact.email}
          </div>
          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
            <Phone className="h-4 w-4 mr-1" />
            {contact.phone}
          </div>
        </div>
      ),
    },
    {
      key: 'actions' as keyof Company,
      label: 'Acties',
      render: (value: any, company: Company) => (
        <div className="flex space-x-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              openModal(company);
            }}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteCompany(company);
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
            Bedrijven
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Beheer uw bedrijven en hun instellingen
          </p>
        </div>
        <Button onClick={() => openModal()}>
          <Plus className="h-5 w-5 mr-2" />
          Nieuw Bedrijf
        </Button>
      </div>

      {/* Companies Table */}
      <Card>
        {companies.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="Geen bedrijven"
            description="Maak je eerste bedrijf aan om te beginnen met je loonadministratie"
            actionLabel="Bedrijf Toevoegen"
            onAction={() => openModal()}
          />
        ) : (
          <Table data={companies} columns={columns} />
        )}
      </Card>

      {/* Company Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingCompany ? 'Bedrijf Bewerken' : 'Nieuw Bedrijf'}
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Bedrijfsnaam *"
              {...register('name', { required: 'Bedrijfsnaam is verplicht' })}
              error={errors.name?.message}
            />
            <Input
              label="KVK Nummer *"
              {...register('kvk', { required: 'KVK nummer is verplicht' })}
              error={errors.kvk?.message}
            />
            <Input
              label="Fiscaal Nummer *"
              {...register('taxNumber', { required: 'Fiscaal nummer is verplicht' })}
              error={errors.taxNumber?.message}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Standaard CAO *
              </label>
              <select
                {...register('defaultCAO', { required: 'Standaard CAO is verplicht' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
              >
                <option value="">Selecteer CAO...</option>
                {DUTCH_CAOS.map(cao => (
                  <option key={cao.id} value={cao.name}>
                    {cao.name}
                  </option>
                ))}
              </select>
              {errors.defaultCAO && (
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                  {errors.defaultCAO.message}
                </p>
              )}
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
                label="Website"
                type="url"
                {...register('website')}
              />
            </div>
          </div>

          {/* Settings */}
          <div className="space-y-4">
            <h4 className="text-lg font-medium text-gray-900 dark:text-white">
              Loon Instellingen
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Reiskostenvergoeding per km (€)"
                type="number"
                step="0.01"
                {...register('travelAllowancePerKm', { 
                  required: 'Reiskostenvergoeding is verplicht',
                  valueAsNumber: true 
                })}
                error={errors.travelAllowancePerKm?.message}
              />
              <Input
                label="Standaard werkweek (uren)"
                type="number"
                {...register('standardWorkWeek', { 
                  required: 'Standaard werkweek is verplicht',
                  valueAsNumber: true 
                })}
                error={errors.standardWorkWeek?.message}
              />
              <Input
                label="Vakantietoeslag (%)"
                type="number"
                step="0.1"
                {...register('holidayAllowancePercentage', { 
                  required: 'Vakantietoeslag percentage is verplicht',
                  valueAsNumber: true 
                })}
                error={errors.holidayAllowancePercentage?.message}
              />
              <Input
                label="Pensioenpremie totaal (%)"
                type="number"
                step="0.1"
                {...register('pensionContributionPercentage', { 
                  required: 'Pensioenpremie percentage is verplicht',
                  valueAsNumber: true 
                })}
                error={errors.pensionContributionPercentage?.message}
              />
            </div>
            
            {/* Main Branch Selection - only show when editing existing company with branches */}
            {editingCompany && companyBranches.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Hoofd Vestiging
                </label>
                <select
                  {...register('mainBranchId')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                >
                  <option value="">Geen hoofd vestiging</option>
                  {companyBranches.map(branch => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name} - {branch.location}
                    </option>
                  ))}
                </select>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Optioneel: Selecteer de hoofd vestiging voor dit bedrijf
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200 dark:border-gray-700">
            <Button type="button" variant="secondary" onClick={closeModal}>
              Annuleren
            </Button>
            <Button type="submit" loading={submitting}>
              {editingCompany ? 'Bijwerken' : 'Aanmaken'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Companies;