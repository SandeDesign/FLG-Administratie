import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import { createCompany, updateCompany, getCompanies } from '../../services/firebase';
import { Company } from '../../types';
import { THEME_COLOR_PRESETS } from '../../utils/themeColors';

interface CompanyFormData {
  name: string;
  kvk: string;
  taxNumber: string;
  bankAccount?: string; // ✅ NIEUW: Bankrekening voor facturen
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

  // ✅ NIEUW: Bedrijfstype fields
  companyType: 'employer' | 'project';
  primaryEmployerId?: string;
  themeColor?: string; // Theme color for this company
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
  
  // ✅ NIEUW: State voor employer companies
  const [employerCompanies, setEmployerCompanies] = useState<Company[]>([]);

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<CompanyFormData>({
    defaultValues: {
      country: 'Nederland',
      defaultCAO: 'cao-algemeen',
      travelAllowancePerKm: 0.23,
      standardWorkWeek: 40,
      holidayAllowancePercentage: 8,
      pensionContributionPercentage: 6,
      companyType: 'employer', // Default naar employer
    }
  });

  // ✅ NIEUW: Watch companyType om UI aan te passen
  const companyType = watch('companyType');

  // ✅ NIEUW: Load employer companies voor project company selector
  useEffect(() => {
    const loadEmployerCompanies = async () => {
      if (user) {
        try {
          const companies = await getCompanies(user.uid);
          const employers = companies.filter(c => c.companyType === 'employer');
          setEmployerCompanies(employers);
        } catch (error) {
          console.error('Error loading employer companies:', error);
        }
      }
    };

    if (isOpen) {
      loadEmployerCompanies();
    }
  }, [isOpen, user]);

  useEffect(() => {
    if (company) {
      reset({
        name: company.name,
        kvk: company.kvk,
        taxNumber: company.taxNumber,
        bankAccount: company.bankAccount, // ✅ NIEUW: Load bankAccount
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

        // ✅ NIEUW: Set company type fields
        companyType: company.companyType || 'employer',
        primaryEmployerId: company.primaryEmployerId,
        themeColor: company.themeColor || 'blue',
      });
    } else {
      reset({
        country: 'Nederland',
        defaultCAO: 'cao-algemeen',
        travelAllowancePerKm: 0.23,
        standardWorkWeek: 40,
        holidayAllowancePercentage: 8,
        pensionContributionPercentage: 6,
        companyType: 'employer',
        themeColor: 'blue',
      });
    }
  }, [company, reset]);

  const onSubmit = async (data: CompanyFormData) => {
    if (!user) return;

    // ✅ NIEUW: Validatie voor project companies
    if (data.companyType === 'project' && !data.primaryEmployerId) {
      showError('Primaire werkgever vereist', 'Selecteer een primaire werkgever voor dit projectbedrijf');
      return;
    }

    setSubmitting(true);
    try {
      // ✅ FIX: Build company data object without undefined values
      const companyData: any = {
        name: data.name,
        kvk: data.kvk,
        taxNumber: data.taxNumber,
        bankAccount: data.bankAccount, // ✅ NIEUW: Save bankAccount
        companyType: data.companyType,
        themeColor: data.themeColor || 'blue', // ✅ NIEUW: Save theme color
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

      // ✅ FIX: Only add primaryEmployerId if it has a value
      if (data.companyType === 'project' && data.primaryEmployerId) {
        companyData.primaryEmployerId = data.primaryEmployerId;
      }

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
    <Modal isOpen={isOpen} onClose={handleClose} title={company ? 'Bedrijf bewerken' : 'Nieuw bedrijf'} size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        
        {/* ✅ NIEUW: Bedrijfstype selector */}
        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Bedrijfstype *
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700">
              <input
                type="radio"
                value="employer"
                {...register('companyType', { required: 'Selecteer een bedrijfstype' })}
                className="mr-3"
              />
              <div>
                <div className="font-medium text-gray-900 dark:text-gray-100">Werkgever</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Primaire werkgever (bijv. Buddy BV)
                </div>
              </div>
            </label>
            
            <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700">
              <input
                type="radio"
                value="project"
                {...register('companyType', { required: 'Selecteer een bedrijfstype' })}
                className="mr-3"
              />
              <div>
                <div className="font-medium text-gray-900 dark:text-gray-100">Projectbedrijf</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Voor specifieke projecten/klanten
                </div>
              </div>
            </label>
          </div>
          {errors.companyType && (
            <p className="text-red-500 text-sm mt-1">{errors.companyType.message}</p>
          )}
        </div>

        {/* ✅ NIEUW: Primary employer selector voor project companies */}
        {companyType === 'project' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Primaire werkgever *
            </label>
            <select
              {...register('primaryEmployerId', { 
                required: companyType === 'project' ? 'Selecteer een primaire werkgever' : false 
              })}
              className="w-full px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 border rounded-lg border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="">Selecteer werkgever...</option>
              {employerCompanies.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
            {errors.primaryEmployerId && (
              <p className="text-red-500 text-sm mt-1">{errors.primaryEmployerId.message}</p>
            )}
            {employerCompanies.length === 0 && (
              <p className="text-yellow-600 text-sm mt-1">
                Maak eerst een werkgever-bedrijf aan voordat je een projectbedrijf kunt maken.
              </p>
            )}
          </div>
        )}

        {/* Bestaande bedrijfsinformatie velden */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Bedrijfsnaam *"
            {...register('name', { required: 'Bedrijfsnaam is verplicht' })}
            error={errors.name?.message}
          />
          <Input
            label="KvK nummer *"
            {...register('kvk', { required: 'KvK nummer is verplicht' })}
            error={errors.kvk?.message}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Belastingnummer"
            {...register('taxNumber')}
            error={errors.taxNumber?.message}
          />
          <Input
            label="Bankrekening voor facturen"
            placeholder="NL91 ABNA 0417 1643 00"
            {...register('bankAccount')}
            error={errors.bankAccount?.message}
          />
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Adresgegevens</h3>
          <Input
            label="Straat en huisnummer *"
            {...register('street', { required: 'Straat is verplicht' })}
            error={errors.street?.message}
          />
          <div className="grid grid-cols-2 gap-4">
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
          <Input
            label="Land *"
            {...register('country', { required: 'Land is verplicht' })}
            error={errors.country?.message}
          />
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Contactgegevens</h3>
          <Input
            label="E-mailadres *"
            type="email"
            {...register('email', { 
              required: 'E-mailadres is verplicht',
              pattern: {
                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                message: 'Ongeldig e-mailadres'
              }
            })}
            error={errors.email?.message}
          />
          <Input
            label="Telefoonnummer *"
            {...register('phone', { required: 'Telefoonnummer is verplicht' })}
            error={errors.phone?.message}
          />
          <Input
            label="Website"
            {...register('website')}
            error={errors.website?.message}
          />
        </div>

        {/* ✅ Instellingen alleen voor employer companies */}
        {companyType === 'employer' && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Standaardinstellingen</h3>
            <Input
              label="Standaard CAO"
              {...register('defaultCAO')}
              error={errors.defaultCAO?.message}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Reiskosten per km (€)"
                type="number"
                step="0.01"
                {...register('travelAllowancePerKm', { 
                  required: 'Reiskosten per km is verplicht',
                  min: { value: 0, message: 'Reiskosten kan niet negatief zijn' }
                })}
                error={errors.travelAllowancePerKm?.message}
              />
              <Input
                label="Standaard werkweek (uren)"
                type="number"
                {...register('standardWorkWeek', { 
                  required: 'Standaard werkweek is verplicht',
                  min: { value: 1, message: 'Werkweek moet minimaal 1 uur zijn' },
                  max: { value: 60, message: 'Werkweek kan maximaal 60 uur zijn' }
                })}
                error={errors.standardWorkWeek?.message}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Vakantietoeslag (%)"
                type="number"
                step="0.1"
                {...register('holidayAllowancePercentage', { 
                  required: 'Vakantietoeslag is verplicht',
                  min: { value: 0, message: 'Vakantietoeslag kan niet negatief zijn' }
                })}
                error={errors.holidayAllowancePercentage?.message}
              />
              <Input
                label="Pensioenbijdrage (%)"
                type="number"
                step="0.1"
                {...register('pensionContributionPercentage', { 
                  required: 'Pensioenbijdrage is verplicht',
                  min: { value: 0, message: 'Pensioenbijdrage kan niet negatief zijn' }
                })}
                error={errors.pensionContributionPercentage?.message}
              />
            </div>
          </div>
        )}

        {/* Theme Color Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Kleurthema
          </label>
          <div className="grid grid-cols-5 gap-3">
            {THEME_COLOR_PRESETS.map((preset) => {
              const isSelected = watch('themeColor') === preset.id;
              return (
                <label
                  key={preset.id}
                  className={`relative cursor-pointer group`}
                  title={preset.name}
                >
                  <input
                    type="radio"
                    value={preset.id}
                    {...register('themeColor')}
                    className="sr-only"
                  />
                  <div
                    className={`w-full h-12 rounded-lg transition-all ${
                      isSelected
                        ? 'ring-2 ring-offset-2 ring-gray-900 scale-110'
                        : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: preset.primaryHex }}
                  >
                    {isSelected && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center">
                          <svg
                            className="w-3 h-3 text-gray-900"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-center mt-1 text-gray-600">{preset.name}</p>
                </label>
              );
            })}
          </div>
        </div>

        <div className="flex gap-4">
          <Button type="button" variant="outline" onClick={handleClose} isFullWidth>
            Annuleren
          </Button>
          <Button type="submit" isLoading={submitting} isFullWidth>
            {company ? 'Bijwerken' : 'Aanmaken'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default CompanyModal;