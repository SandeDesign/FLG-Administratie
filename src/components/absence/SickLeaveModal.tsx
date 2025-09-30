import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import { useToast } from '../../hooks/useToast';
import { createSickLeave } from '../../services/firebase';
import { AlertCircle } from 'lucide-react';

interface SickLeaveFormData {
  startDate: string;
  workCapacityPercentage: number;
  notes?: string;
}

interface SickLeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const SickLeaveModal: React.FC<SickLeaveModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user } = useAuth();
  const { employees } = useApp();
  const { success, error: showError } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [employeeId, setEmployeeId] = useState<string>('');

  const { register, handleSubmit, reset, formState: { errors } } = useForm<SickLeaveFormData>({
    defaultValues: {
      startDate: new Date().toISOString().split('T')[0],
      workCapacityPercentage: 0,
    }
  });

  useEffect(() => {
    if (user && employees.length > 0) {
      const employee = employees[0];
      setEmployeeId(employee.id);
    }
  }, [user, employees]);

  const onSubmit = async (data: SickLeaveFormData) => {
    if (!user || !employeeId) {
      showError('Geen gebruiker', 'Je moet ingelogd zijn om ziek te melden');
      return;
    }

    setSubmitting(true);
    try {
      const employee = employees.find(e => e.id === employeeId);
      if (!employee) throw new Error('Employee not found');

      await createSickLeave(user.uid, {
        employeeId,
        companyId: employee.companyId,
        branchId: employee.branchId,
        startDate: new Date(data.startDate),
        workCapacityPercentage: data.workCapacityPercentage,
        status: 'active',
        notes: data.notes,
        poortwachterActive: false,
        poortwachterMilestones: [],
      });

      success('Ziekmelding geregistreerd', 'Je ziekmelding is verwerkt. Beterschap!');
      reset();
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error creating sick leave:', err);
      showError('Fout bij aanmelden', 'Kon ziekmelding niet registreren');
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
            {...register('workCapacityPercentage', {
              required: 'Arbeidsgeschiktheid is verplicht',
              valueAsNumber: true,
            })}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
          />
          <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mt-1">
            <span>0% (volledig arbeidsongeschikt)</span>
            <span>100% (volledig arbeidsgeschikt)</span>
          </div>
          {errors.workCapacityPercentage && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">
              {errors.workCapacityPercentage.message}
            </p>
          )}
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
          <Button type="submit" loading={submitting}>
            Ziek Melden
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default SickLeaveModal;
