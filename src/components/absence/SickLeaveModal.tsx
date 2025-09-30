import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import { createSickLeave, getEmployeeById } from '../../services/firebase';
import { Employee } from '../../types';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';

interface SickLeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string;
}

interface SickLeaveFormData {
  startDate: string;
  workCapacityPercentage: number;
  notes: string;
}

const SickLeaveModal: React.FC<SickLeaveModalProps> = ({
  isOpen,
  onClose,
  employeeId,
}) => {
  const { user } = useAuth();
  const { success, error } = useToast();
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<SickLeaveFormData>({
    startDate: new Date().toISOString().split('T')[0],
    workCapacityPercentage: 0,
    notes: '',
  });

  useEffect(() => {
    const loadEmployee = async () => {
      if (employeeId) {
        try {
          const employee = await getEmployeeById(employeeId);
          setCurrentEmployee(employee);
        } catch (error) {
          console.error('Error loading employee:', error);
          error('Fout bij laden werknemersgegevens');
        }
      }
    };

    if (isOpen) {
      loadEmployee();
    }
  }, [isOpen, employeeId, error]);

  const handleInputChange = (field: keyof SickLeaveFormData, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleClose = () => {
    setFormData({
      startDate: new Date().toISOString().split('T')[0],
      workCapacityPercentage: 0,
      notes: '',
    });
    onClose();
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      error('Gebruiker niet ingelogd');
      return;
    }

    setSubmitting(true);
    try {
      await createSickLeave(currentEmployee.userId, {
        employeeId,
        companyId: currentEmployee?.companyId || '',
        startDate: new Date(formData.startDate),
        reportedAt: new Date(),
        reportedBy: user?.displayName || user?.email || 'Werknemer',
        reportedVia: 'app',
        workCapacityPercentage: formData.workCapacityPercentage,
        status: 'active',
        notes: formData.notes || '',
        arboServiceContacted: false,
        poortwachterActive: false,
        doctorVisits: [],
      });

      success('Ziekmelding succesvol ingediend');
      handleClose();
    } catch (error) {
      console.error('Error creating sick leave:', error);
      error('Fout bij indienen ziekmelding');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Ziekmelding">
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Startdatum"
          type="date"
          value={formData.startDate}
          onChange={(e) => handleInputChange('startDate', e.target.value)}
          required
        />

        <Input
          label="Arbeidsgeschiktheid (%)"
          type="number"
          min="0"
          max="100"
          value={formData.workCapacityPercentage}
          onChange={(e) => handleInputChange('workCapacityPercentage', parseInt(e.target.value) || 0)}
          required
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Opmerkingen
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => handleInputChange('notes', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Eventuele opmerkingen..."
          />
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Annuleren
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Bezig...' : 'Indienen'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default SickLeaveModal;