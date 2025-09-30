import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Save, Send } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { WeeklyTimesheet, TimesheetEntry } from '../types/timesheet';
import {
  getWeeklyTimesheets,
  createWeeklyTimesheet,
  updateWeeklyTimesheet,
  submitWeeklyTimesheet,
  getWeekNumber,
  getWeekDates,
  calculateWeekTotals
} from '../services/timesheetService';
import { getEmployeeById } from '../services/firebase';
import { useToast } from '../hooks/useToast';

export default function Timesheets() {
  const { user } = useAuth();
  const { currentEmployeeId } = useApp();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [timesheets, setTimesheets] = useState<WeeklyTimesheet[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<number>(getWeekNumber(new Date()));
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [currentTimesheet, setCurrentTimesheet] = useState<WeeklyTimesheet | null>(null);
  const [employeeData, setEmployeeData] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, [user, currentEmployeeId, selectedWeek, selectedYear]);

  const loadData = async () => {
    if (!user || !currentEmployeeId) return;

    try {
      setLoading(true);
      const employee = await getEmployeeById(currentEmployeeId);
      setEmployeeData(employee);

      const sheets = await getWeeklyTimesheets(
        employee!.userId,
        currentEmployeeId,
        selectedYear,
        selectedWeek
      );

      setTimesheets(sheets);

      if (sheets.length > 0) {
        setCurrentTimesheet(sheets[0]);
      } else {
        const weekDates = getWeekDates(selectedYear, selectedWeek);
        const emptyEntries: TimesheetEntry[] = weekDates.map(date => ({
          userId: employee!.userId,
          employeeId: currentEmployeeId,
          companyId: employee!.companyId,
          branchId: employee!.branchId,
          date,
          regularHours: 0,
          overtimeHours: 0,
          eveningHours: 0,
          nightHours: 0,
          weekendHours: 0,
          travelKilometers: 0,
          notes: '',
          createdAt: new Date(),
          updatedAt: new Date()
        }));

        const newTimesheet: WeeklyTimesheet = {
          userId: employee!.userId,
          employeeId: currentEmployeeId,
          companyId: employee!.companyId,
          branchId: employee!.branchId,
          weekNumber: selectedWeek,
          year: selectedYear,
          entries: emptyEntries,
          totalRegularHours: 0,
          totalOvertimeHours: 0,
          totalEveningHours: 0,
          totalNightHours: 0,
          totalWeekendHours: 0,
          totalTravelKilometers: 0,
          status: 'draft',
          createdAt: new Date(),
          updatedAt: new Date()
        };

        setCurrentTimesheet(newTimesheet);
      }
    } catch (error) {
      console.error('Error loading timesheets:', error);
      showToast('Fout bij laden van urenregistratie', 'error');
    } finally {
      setLoading(false);
    }
  };

  const updateEntry = (index: number, field: keyof TimesheetEntry, value: number | string) => {
    if (!currentTimesheet) return;

    const updatedEntries = [...currentTimesheet.entries];
    updatedEntries[index] = {
      ...updatedEntries[index],
      [field]: value,
      updatedAt: new Date()
    };

    const totals = calculateWeekTotals(updatedEntries);

    setCurrentTimesheet({
      ...currentTimesheet,
      entries: updatedEntries,
      ...totals,
      updatedAt: new Date()
    });
  };

  const handleSave = async () => {
    if (!currentTimesheet || !user || !employeeData) return;

    try {
      setSaving(true);

      if (currentTimesheet.id) {
        await updateWeeklyTimesheet(
          currentTimesheet.id,
          employeeData.userId,
          currentTimesheet
        );
        showToast('Uren opgeslagen', 'success');
      } else {
        const id = await createWeeklyTimesheet(
          employeeData.userId,
          currentTimesheet
        );
        setCurrentTimesheet({ ...currentTimesheet, id });
        showToast('Uren aangemaakt', 'success');
      }
    } catch (error) {
      console.error('Error saving timesheet:', error);
      showToast('Fout bij opslaan', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!currentTimesheet || !currentTimesheet.id || !employeeData) return;

    if (currentTimesheet.totalRegularHours === 0) {
      showToast('Er zijn nog geen uren ingevoerd', 'error');
      return;
    }

    try {
      setSaving(true);
      await submitWeeklyTimesheet(
        currentTimesheet.id,
        employeeData.userId,
        currentEmployeeId
      );
      showToast('Uren ingediend voor goedkeuring', 'success');
      await loadData();
    } catch (error) {
      console.error('Error submitting timesheet:', error);
      showToast('Fout bij indienen', 'error');
    } finally {
      setSaving(false);
    }
  };

  const changeWeek = (delta: number) => {
    let newWeek = selectedWeek + delta;
    let newYear = selectedYear;

    if (newWeek < 1) {
      newWeek = 52;
      newYear--;
    } else if (newWeek > 52) {
      newWeek = 1;
      newYear++;
    }

    setSelectedWeek(newWeek);
    setSelectedYear(newYear);
  };

  const getDayName = (date: Date): string => {
    const days = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];
    return days[date.getDay()];
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (!currentTimesheet) {
    return (
      <div className="text-center py-12">
        <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">Geen urenregistratie gevonden</p>
      </div>
    );
  }

  const isReadOnly = currentTimesheet.status !== 'draft' && currentTimesheet.status !== 'rejected';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Urenregistratie</h1>
          <p className="text-gray-600 mt-1">
            Week {selectedWeek}, {selectedYear}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Button
              onClick={() => changeWeek(-1)}
              variant="secondary"
              size="sm"
            >
              ← Vorige week
            </Button>
            <Button
              onClick={() => changeWeek(1)}
              variant="secondary"
              size="sm"
            >
              Volgende week →
            </Button>
          </div>
        </div>
      </div>

      {currentTimesheet.status !== 'draft' && (
        <Card>
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">Status:</span>
            <span className={`px-2 py-1 rounded ${
              currentTimesheet.status === 'approved' ? 'bg-green-100 text-green-800' :
              currentTimesheet.status === 'submitted' ? 'bg-blue-100 text-blue-800' :
              currentTimesheet.status === 'rejected' ? 'bg-red-100 text-red-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {currentTimesheet.status === 'approved' ? 'Goedgekeurd' :
               currentTimesheet.status === 'submitted' ? 'Ingediend' :
               currentTimesheet.status === 'rejected' ? 'Afgekeurd' :
               currentTimesheet.status === 'processed' ? 'Verwerkt' :
               'Concept'}
            </span>
            {currentTimesheet.rejectionReason && (
              <span className="text-red-600 ml-4">
                Reden: {currentTimesheet.rejectionReason}
              </span>
            )}
          </div>
        </Card>
      )}

      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Datum
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Normale uren
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Overuren
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Avonduren
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Nachturen
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Weekenduren
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Reiskilometers
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Notities
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentTimesheet.entries.map((entry, index) => (
                <tr key={index}>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {getDayName(entry.date)}
                    </div>
                    <div className="text-sm text-gray-500">
                      {entry.date.toLocaleDateString('nl-NL')}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Input
                      type="number"
                      min="0"
                      max="24"
                      step="0.5"
                      value={entry.regularHours}
                      onChange={(e) => updateEntry(index, 'regularHours', parseFloat(e.target.value) || 0)}
                      disabled={isReadOnly}
                      className="w-20"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Input
                      type="number"
                      min="0"
                      max="24"
                      step="0.5"
                      value={entry.overtimeHours}
                      onChange={(e) => updateEntry(index, 'overtimeHours', parseFloat(e.target.value) || 0)}
                      disabled={isReadOnly}
                      className="w-20"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Input
                      type="number"
                      min="0"
                      max="24"
                      step="0.5"
                      value={entry.eveningHours}
                      onChange={(e) => updateEntry(index, 'eveningHours', parseFloat(e.target.value) || 0)}
                      disabled={isReadOnly}
                      className="w-20"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Input
                      type="number"
                      min="0"
                      max="24"
                      step="0.5"
                      value={entry.nightHours}
                      onChange={(e) => updateEntry(index, 'nightHours', parseFloat(e.target.value) || 0)}
                      disabled={isReadOnly}
                      className="w-20"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Input
                      type="number"
                      min="0"
                      max="24"
                      step="0.5"
                      value={entry.weekendHours}
                      onChange={(e) => updateEntry(index, 'weekendHours', parseFloat(e.target.value) || 0)}
                      disabled={isReadOnly}
                      className="w-20"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={entry.travelKilometers}
                      onChange={(e) => updateEntry(index, 'travelKilometers', parseFloat(e.target.value) || 0)}
                      disabled={isReadOnly}
                      className="w-20"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Input
                      type="text"
                      value={entry.notes || ''}
                      onChange={(e) => updateEntry(index, 'notes', e.target.value)}
                      disabled={isReadOnly}
                      className="w-32"
                      placeholder="Notities..."
                    />
                  </td>
                </tr>
              ))}
              <tr className="bg-gray-50 font-medium">
                <td className="px-4 py-3 text-sm text-gray-900">Totaal</td>
                <td className="px-4 py-3 text-sm text-gray-900">{currentTimesheet.totalRegularHours}</td>
                <td className="px-4 py-3 text-sm text-gray-900">{currentTimesheet.totalOvertimeHours}</td>
                <td className="px-4 py-3 text-sm text-gray-900">{currentTimesheet.totalEveningHours}</td>
                <td className="px-4 py-3 text-sm text-gray-900">{currentTimesheet.totalNightHours}</td>
                <td className="px-4 py-3 text-sm text-gray-900">{currentTimesheet.totalWeekendHours}</td>
                <td className="px-4 py-3 text-sm text-gray-900">{currentTimesheet.totalTravelKilometers} km</td>
                <td className="px-4 py-3"></td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {!isReadOnly && (
        <div className="flex justify-end gap-3">
          <Button
            onClick={handleSave}
            disabled={saving}
            variant="secondary"
          >
            <Save className="h-4 w-4 mr-2" />
            Opslaan
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || !currentTimesheet.id}
          >
            <Send className="h-4 w-4 mr-2" />
            Indienen voor goedkeuring
          </Button>
        </div>
      )}
    </div>
  );
}
