import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import { useToast } from '../../hooks/useToast';
import { createSickLeave, getEmployeeById } from '../../services/firebase';
import { User } from 'lucide-react';
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
  const { companies } = useApp();
  const { success, error: showError } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<SickLeaveFormData>({
    defaultValues: {
      startDate: new Date().toISOString().split('T')[0],
      workCapacityPercentage: 0,
    }
  });

  useEffect(() => {
    if (employeeId) {
      const loadEmployee = async () => {
        try {
          const employee = await getEmployeeById(employeeId);
          setCurrentEmployee(employee);
        } catch (err) {
          console.error('Error loading employee:', err);
        }
      };
      loadEmployee();
    }
  }, [employeeId]);

  const onSubmit = async (data: SickLeaveFormData) => {
    if (data.startDate > new Date().toISOString().split('T')[0]) {
      showError('Ongeldige datum', 'Startdatum kan niet in de toekomst liggen');
      return;
    }

    setSubmitting(true);
    try {
      await createSickLeave({
        employeeId,
        companyId: currentEmployee?.companyId || '',
        startDate: new Date(data.startDate),
        reportedAt: new Date(),
        reportedBy: user?.displayName || user?.email || 'Werknemer',
        reportedVia: 'app',
        workCapacityPercentage: data.workCapacityPercentage,
        status: 'active',
        notes: data.notes || '',
        arboServiceContacted: false,
        poortwachterActive: false,
        doctorVisits: [],
      });

      success('Ziekmelding aangemaakt', 'Je ziekmelding is succesvol aangemaakt');
      reset();
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error creating sick leave:', err);
      showError('Fout bij aanmaken ziekmelding', 'Er is een fout opgetreden bij het aanmaken van de ziekmelding');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    reset();
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

        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
          <div className="flex items-start">
            <User className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5 mr-3" />
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
          <Button type="submit" loading={submitting} disabled={submitting}>
            Ziek Melden
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default SickLeaveModal;
