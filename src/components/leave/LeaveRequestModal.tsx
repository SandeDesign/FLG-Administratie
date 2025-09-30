import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import { useToast } from '../../hooks/useToast';
import { createLeaveRequest, getLeaveBalance } from '../../services/firebase';
import { LeaveBalance, Employee } from '../../types';
import { User, AlertCircle } from 'lucide-react';

interface LeaveRequestFormData {
  type: 'vacation' | 'compensation' | 'unpaid' | 'special' | 'parental' | 'care';
  startDate: string;
  endDate: string;
  reason: string;
}

interface LeaveRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  employeeId: string;
}

const LeaveRequestModal: React.FC<LeaveRequestModalProps> = ({ isOpen, onClose, onSuccess, employeeId }) => {
  const { user } = useAuth();
  const { employees, companies } = useApp();
  const { success, error: showError } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [calculatedDays, setCalculatedDays] = useState(0);
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalance | null>(null);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [employeeError, setEmployeeError] = useState<string | null>(null);

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<LeaveRequestFormData>();

  const startDate = watch('startDate');
  const endDate = watch('endDate');

  useEffect(() => {
    console.log('LeaveRequestModal: useEffect called with employeeId:', employeeId, 'employees.length:', employees.length);
    
    if (!employeeId || employeeId === '') {
      console.log('LeaveRequestModal: No employeeId provided');
      setCurrentEmployee(null);
      setEmployeeError('Je werknemersprofiel is niet gekoppeld. Neem contact op met de beheerder.');
      return;
    }
    
    if (employeeId && employees.length > 0) {
      const employee = employees.find(e => e.id === employeeId);
      console.log('LeaveRequestModal: Employee found:', !!employee);
      if (employee) {
        setCurrentEmployee(employee);
        setEmployeeError(null);
      } else {
        setCurrentEmployee(null);
        setEmployeeError('Werknemersgegevens niet gevonden in de database. Probeer de pagina te vernieuwen.');
      }
    } else if (employeeId && employees.length === 0) {
      console.log('LeaveRequestModal: Employees list is empty, still loading');
      setCurrentEmployee(null);
      setEmployeeError('Werknemersgegevens worden geladen...');
    } else {
      setCurrentEmployee(null);
      setEmployeeError(null);
    }
  }, [employeeId, employees]);

  useEffect(() => {
    if (user && employeeId) {
      loadLeaveBalance(employeeId);
    }
  }, [user, employeeId]);

  const loadLeaveBalance = async (empId: string) => {
    if (!user) return;
    try {
      const currentYear = new Date().getFullYear();
      const balance = await getLeaveBalance(empId, user.uid, currentYear);
      setLeaveBalance(balance);
    } catch (err) {
      console.error('Error loading leave balance:', err);
    }
  };

  useEffect(() => {
    if (startDate && endDate) {
      const days = calculateWorkingDays(new Date(startDate), new Date(endDate));
      setCalculatedDays(days);
    } else {
      setCalculatedDays(0);
    }
  }, [startDate, endDate]);

  const calculateWorkingDays = (start: Date, end: Date): number => {
    let count = 0;
    const current = new Date(start);

    while (current <= end) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }

    return count;
  };

  const onSubmit = async (data: LeaveRequestFormData) => {
    if (!user || !employeeId) {
      showError('Geen gebruiker', 'Je moet ingelogd zijn om verlof aan te vragen');
      return;
    }

    if (calculatedDays <= 0) {
      showError('Ongeldige datums', 'Einddatum moet na startdatum liggen');
      return;
    }

    if (data.type === 'vacation' && leaveBalance) {
      const availableDays = leaveBalance.holidayDays.statutory + leaveBalance.holidayDays.extraStatutory + leaveBalance.holidayDays.accumulated - leaveBalance.holidayDays.taken;
      if (calculatedDays > availableDays) {
        showError('Onvoldoende saldo', `Je hebt maar ${availableDays} verlofdagen beschikbaar`);
        return;
      }
    }

    // Skip employee validation - allow submission even without employee data
    setSubmitting(true);
    try {
      await createLeaveRequest(user.uid, {
        employeeId,
        companyId: 'default-company', // Use default if no company found
        type: data.type,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        totalDays: calculatedDays,
        totalHours: calculatedDays * 8,
        reason: data.reason,
        status: 'pending',
      });

      success('Verlof aangevraagd', `Je aanvraag voor ${calculatedDays} dagen is ingediend`);
      reset();
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error creating leave request:', err);
      showError('Fout bij aanvragen', 'Kon verlofaanvraag niet aanmaken');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    reset();
    setCalculatedDays(0);
    setEmployeeError(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Verlof Aanvragen" size="md">
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

        {leaveBalance && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
              Beschikbaar Verlofsaldo
            </p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-blue-700 dark:text-blue-300">Wettelijk:</span>
                <span className="ml-2 font-semibold text-blue-900 dark:text-blue-100">
                  {leaveBalance.holidayDays.statutory} dagen
                </span>
              </div>
              <div>
                <span className="text-blue-700 dark:text-blue-300">Bovenwettelijk:</span>
                <span className="ml-2 font-semibold text-blue-900 dark:text-blue-100">
                  {leaveBalance.holidayDays.extraStatutory} dagen
                </span>
              </div>
              <div>
                <span className="text-blue-700 dark:text-blue-300">Opgebouwd:</span>
                <span className="ml-2 font-semibold text-blue-900 dark:text-blue-100">
                  {leaveBalance.holidayDays.accumulated} dagen
                </span>
              </div>
              <div>
                <span className="text-blue-700 dark:text-blue-300">Opgenomen:</span>
                <span className="ml-2 font-semibold text-blue-900 dark:text-blue-100">
                  {leaveBalance.holidayDays.taken} dagen
                </span>
              </div>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Type Verlof *
          </label>
          <select
            {...register('type', { required: 'Type is verplicht' })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
          >
            <option value="vacation">Vakantie</option>
            <option value="compensation">Compensatie</option>
            <option value="unpaid">Onbetaald</option>
            <option value="special">Bijzonder (huwelijk, verhuizing, etc.)</option>
            <option value="parental">Ouderschapsverlof</option>
            <option value="care">Zorgverlof</option>
          </select>
          {errors.type && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.type.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Startdatum *"
            type="date"
            {...register('startDate', { required: 'Startdatum is verplicht' })}
            error={errors.startDate?.message}
          />
          <Input
            label="Einddatum *"
            type="date"
            {...register('endDate', { required: 'Einddatum is verplicht' })}
            error={errors.endDate?.message}
          />
        </div>

        {calculatedDays > 0 && (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Aantal werkdagen: <span className="font-semibold text-gray-900 dark:text-white">{calculatedDays}</span>
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Reden *
          </label>
          <textarea
            {...register('reason', { required: 'Reden is verplicht' })}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
            placeholder="Geef een korte toelichting..."
          />
          {errors.reason && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.reason.message}</p>
          )}
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Annuleren
          </Button>
          <Button 
            type="submit" 
            loading={submitting}
            disabled={submitting}
          >
            Aanvragen
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default LeaveRequestModal;