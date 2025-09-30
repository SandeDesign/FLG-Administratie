import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import { useToast } from '../../hooks/useToast';
import { createSickLeave } from '../../services/firebase';
import { AlertCircle, User } from 'lucide-react';
import { Employee } from '../../types';

interface SickLeaveFormData {
  startDate: string;
  workCapacityPercentage: number;
  notes?: string;
}

interface SickLeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  employeeId: string;
}

const SickLeaveModal: React.FC<SickLeaveModalProps> = ({ isOpen, onClose, onSuccess, employeeId }) => {
  const { user } = useAuth();
  const { employees } = useApp();
  const { success, error: showError } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [employeeError, setEmployeeError] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<SickLeaveFormData>({
    defaultValues: {
      startDate: new Date().toISOString().split('T')[0],
      workCapacityPercentage: 0,
    }
  });

  useEffect(() => {
    console.log('SickLeaveModal: useEffect called with employeeId:', employeeId, 'employees.length:', employees.length);
    
    if (!employeeId || employeeId === '') {
      console.log('SickLeaveModal: No employeeId provided');
      setCurrentEmployee(null);
      setEmployeeError('Je werknemersprofiel is niet gekoppeld. Neem contact op met de beheerder.');
      return;
    }
    
    if (employeeId && employees.length > 0) {
      const employee = employees.find(e => e.id === employeeId);
      console.log('SickLeaveModal: Employee found:', !!employee);
      if (employee) {
        setCurrentEmployee(employee);
        setEmployeeError(null);
      } else {
        setCurrentEmployee(null);
        setEmployeeError('Werknemersgegevens niet gevonden in de database. Probeer de pagina te vernieuwen.');
      }
    } else if (employeeId && employees.length === 0) {
      console.log('SickLeaveModal: Employees list is empty, still loading');
      setCurrentEmployee(null);
      setEmployeeError('Werknemersgegevens worden geladen...');
    } else {
      setCurrentEmployee(null);
      setEmployeeError(null);
    }
  }, [employeeId, employees]);

  const onSubmit = async (data: SickLeaveFormData) => {
    console.log('SickLeaveModal: onSubmit called with data:', data);
    console.log('SickLeaveModal: currentEmployee:', currentEmployee);
    console.log('SickLeaveModal: employeeError:', employeeError);
    
    if (!user || !employeeId) {
      showError('Geen gebruiker', 'Je moet ingelogd zijn om ziek te melden');
      return;
    }

    setSubmitting(true);
    try {
      if (!currentEmployee) {
        showError('Werknemer niet gevonden', employeeError || 'Kon werknemersgegevens niet laden. Probeer de pagina te vernieuwen.');
        return;
      }

      console.log('SickLeaveModal: Creating sick leave for employee:', currentEmployee.id);
      await createSickLeave(user.uid, {
        employeeId,
        companyId: currentEmployee.companyId,
        startDate: new Date(data.startDate),
        reportedAt: new Date(),
        reportedBy: user.displayName || user.email || 'Werknemer',
        reportedVia: 'app',
        workCapacityPercentage: data.workCapacityPercentage,
        status: 'active',
        notes: data.notes,
        arboServiceContacted: false,
        poortwachterActive: false,
        doctorVisits: [],
      });

      console.log('SickLeaveModal: createSickLeave successful!');
      success('Ziekmelding geregistreerd', 'Je ziekmelding is verwerkt. Beterschap!');
      reset();
      onSuccess();
      onClose();
    } catch (err) {
      console.error('SickLeaveModal: Error creating sick leave:', err);
      showError('Fout bij aanmelden', 'Kon ziekmelding niet registreren');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    reset();
    setEmployeeError(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Ziek Melden" size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {currentEmployee && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start">
              <User className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 mr-3" />
              <div>
                <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  {currentEmployee.personalInfo.firstName} {currentEmployee.personalInfo.lastName}
                </h4>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  {currentEmployee.contractInfo.position}
                </p>
              </div>
            </div>
          </div>
        )}

        {employeeError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 mr-3" />
              <div>
                <h4 className="text-sm font-medium text-red-900 dark:text-red-100">
                  Fout
                </h4>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  {employeeError}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5 mr-3" />
            <div>
              <h4 className="text-sm font-medium text-orange-900 dark:text-orange-100">
                Belangrijk
              </h4>
              <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                Meld je ziekmelding ook telefonisch bij je leidinggevende. Deze melding is een aanvulling daarop.
              </p>
            </div>
          </div>
        </div>

        <Input
          label="Startdatum Ziekte *"
          type="date"
          {...register('startDate', { required: 'Startdatum is verplicht' })}
          error={errors.startDate?.message}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Arbeidsgeschiktheid (%) *
          </label>
          <input
            type="range"
            min="0"
            max="100"
            step="10"
            {...register('workCapacityPercentage', { valueAsNumber: true })}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
          />
          <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mt-1">
            <span>0% (volledig arbeidsongeschikt)</span>
            <span>100% (volledig arbeidsgeschikt)</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Notities (optioneel)
          </label>
          <textarea
            {...register('notes')}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
            placeholder="Eventuele aanvullende informatie..."
          />
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Annuleren
          </Button>
          <Button 
            type="submit" 
            loading={submitting}
            disabled={submitting || !currentEmployee || !!employeeError}
          >
            Ziek Melden
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default SickLeaveModal;
