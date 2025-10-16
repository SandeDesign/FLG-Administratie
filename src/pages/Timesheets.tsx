import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Clock, Save, Send, Download } from 'lucide-react';
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
import { EmptyState } from '../components/ui/EmptyState';

export default function Timesheets() {
  const { user, adminUserId, userRole } = useAuth();
  const { currentEmployeeId, selectedCompany, employees } = useApp();
  const { success, error: showError } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [timesheets, setTimesheets] = useState<WeeklyTimesheet[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<number>(getWeekNumber(new Date()));
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [currentTimesheet, setCurrentTimesheet] = useState<WeeklyTimesheet | null>(null);
  const [employeeData, setEmployeeData] = useState<any>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');

  const loadData = useCallback(async () => {
    if (!user || !adminUserId || !selectedCompany) {
      setLoading(false);
      return;
    }

    const effectiveEmployeeId = userRole === 'admin' ? selectedEmployeeId : currentEmployeeId;

    if (!effectiveEmployeeId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const employee = await getEmployeeById(effectiveEmployeeId);
      if (!employee) {
        showError('Fout', 'Werknemergegevens niet gevonden.');
        setLoading(false);
        return;
      }
      setEmployeeData(employee);

      const sheets = await getWeeklyTimesheets(
        adminUserId,
        effectiveEmployeeId,
        selectedYear,
        selectedWeek
      );

      setTimesheets(sheets);

      if (sheets.length > 0) {
        setCurrentTimesheet(sheets[0]);
      } else {
        const weekDates = getWeekDates(selectedYear, selectedWeek);
        const emptyEntries: TimesheetEntry[] = weekDates.map(date => ({
          userId: adminUserId,
          employeeId: effectiveEmployeeId,
          companyId: selectedCompany.id,
          branchId: employee.branchId,
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
          userId: adminUserId,
          employeeId: effectiveEmployeeId,
          companyId: selectedCompany.id,
          branchId: employee.branchId,
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
      showError('Fout bij laden', 'Kan urenregistratie niet laden');
    } finally {
      setLoading(false);
    }
  }, [user, adminUserId, userRole, currentEmployeeId, selectedEmployeeId, selectedCompany, selectedYear, selectedWeek, showError]);

  // ITKnecht Import Function
  const handleImportFromITKnecht = async () => {
    if (!selectedCompany || !employeeData) {
      showError('Fout', 'Selecteer eerst een bedrijf en werknemer');
      return;
    }

    setImporting(true);
    try {
      // Trigger Make.com webhook to get ITKnecht data
      // TODO: Replace 'JOUW_MAKE_WEBHOOK_URL_HIER' with your actual webhook URL
      const response = await fetch('https://hook.eu2.make.com/wh18u8c7x989zoakqxqmomjoy2cpfd3b', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'get_hours_data',
          monteur: employeeData.personalInfo.firstName + ' ' + employeeData.personalInfo.lastName,
          week: selectedWeek,
          year: selectedYear,
          companyId: selectedCompany.id
        })
      });

      if (!response.ok) {
        throw new Error('Webhook call failed');
      }

      const itknechtData = await response.json();
      
      // Process the ITKnecht data and update timesheet
      if (itknechtData && Array.isArray(itknechtData) && itknechtData.length > 0) {
        await processITKnechtData(itknechtData);
        success('Import geslaagd', `${itknechtData.length} ITKnecht entries geïmporteerd`);
        await loadData(); // Reload to show updated data
      } else {
        showError('Geen data', 'Geen ITKnecht uren gevonden voor deze week/monteur');
      }

    } catch (error) {
      console.error('Error importing from ITKnecht:', error);
      showError('Import fout', 'Kon ITKnecht uren niet ophalen');
    } finally {
      setImporting(false);
    }
  };

  // Process ITKnecht data and map to timesheet entries
  const processITKnechtData = async (itknechtEntries: any[]) => {
    if (!currentTimesheet || !employeeData) return;

    // Normalize Make.com data format first
    const normalizedEntries = itknechtEntries.map(record => {
      const data = record.data || record;
      return {
        dag: data.Dag || '',
        totaal_factuureerbare_uren: parseFloat(data['Totaal factureerbare uren'] || 0),
        gereden_kilometers: parseFloat(data['Gereden kilometers'] || 0)
      };
    });

    // Group entries by day
    const entriesByDay: { [key: string]: any[] } = {};
    
    normalizedEntries.forEach(entry => {
      const day = entry.dag;
      if (!entriesByDay[day]) {
        entriesByDay[day] = [];
      }
      entriesByDay[day].push(entry);
    });

    // Update timesheet entries
    const updatedEntries = [...currentTimesheet.entries];
    
    Object.keys(entriesByDay).forEach(day => {
      const dayEntries = entriesByDay[day];
      
      // Calculate totals for this day
      const dayTotalHours = dayEntries.reduce((sum, entry) => {
        return sum + entry.totaal_factuureerbare_uren;
      }, 0);
      
      const dayTotalKm = dayEntries.reduce((sum, entry) => {
        return sum + entry.gereden_kilometers;
      }, 0);

      // Find the corresponding day in the timesheet (matching day name)
      const dayIndex = updatedEntries.findIndex(entry => {
        const dayName = getDayName(entry.date);
        return dayName.toLowerCase() === day.toLowerCase();
      });

      if (dayIndex !== -1) {
        updatedEntries[dayIndex] = {
          ...updatedEntries[dayIndex],
          regularHours: dayTotalHours,
          travelKilometers: dayTotalKm,
          notes: `ITKnecht import: ${dayEntries.length} entries`,
          updatedAt: new Date()
        };
      }
    });

    // Calculate new totals
    const totals = calculateWeekTotals(updatedEntries);

    // Update timesheet
    const updatedTimesheet = {
      ...currentTimesheet,
      entries: updatedEntries,
      totalRegularHours: totals.regularHours,
      totalOvertimeHours: totals.overtimeHours,
      totalEveningHours: totals.eveningHours,
      totalNightHours: totals.nightHours,
      totalWeekendHours: totals.weekendHours,
      totalTravelKilometers: totals.travelKilometers,
      updatedAt: new Date()
    };

    setCurrentTimesheet(updatedTimesheet);

    // Auto-save the imported data
    if (updatedTimesheet.id) {
      await updateWeeklyTimesheet(updatedTimesheet.id, adminUserId!, updatedTimesheet);
    } else {
      const id = await createWeeklyTimesheet(adminUserId!, updatedTimesheet);
      setCurrentTimesheet({ ...updatedTimesheet, id });
    }
  };

  // Auto-select first employee for admin users
  useEffect(() => {
    if (userRole === 'admin' && !selectedEmployeeId && selectedCompany) {
      const companyEmployees = employees.filter(emp => emp.companyId === selectedCompany.id);
      if (companyEmployees.length > 0) {
        setSelectedEmployeeId(companyEmployees[0].id);
      }
    }
  }, [userRole, selectedEmployeeId, selectedCompany, employees]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
      totalRegularHours: totals.regularHours,
      totalOvertimeHours: totals.overtimeHours,
      totalEveningHours: totals.eveningHours,
      totalNightHours: totals.nightHours,
      totalWeekendHours: totals.weekendHours,
      totalTravelKilometers: totals.travelKilometers,
      updatedAt: new Date()
    });
  };

  const handleSave = async () => {
    if (!currentTimesheet || !user || !adminUserId || !employeeData) return;

    setSaving(true);
    try {
      if (currentTimesheet.id) {
        await updateWeeklyTimesheet(
          currentTimesheet.id,
          adminUserId,
          currentTimesheet
        );
        success('Uren opgeslagen', 'Urenregistratie succesvol opgeslagen');
      } else {
        const id = await createWeeklyTimesheet(
          adminUserId,
          currentTimesheet
        );
        setCurrentTimesheet({ ...currentTimesheet, id });
        success('Uren aangemaakt', 'Urenregistratie succesvol aangemaakt');
      }
    } catch (error) {
      console.error('Error saving timesheet:', error);
      showError('Fout bij opslaan', 'Kon urenregistratie niet opslaan');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!currentTimesheet || !currentTimesheet.id || !user || !adminUserId || !employeeData) return;

    if (currentTimesheet.totalRegularHours === 0 && currentTimesheet.totalOvertimeHours === 0 && currentTimesheet.totalTravelKilometers === 0) {
      showError('Geen uren ingevoerd', 'Voer minimaal één uur of kilometer in om in te dienen');
      return;
    }

    setSaving(true);
    try {
      await submitWeeklyTimesheet(
        currentTimesheet.id,
        adminUserId,
        user.displayName || user.email || 'Werknemer'
      );
      success('Uren ingediend', 'Urenregistratie succesvol ingediend voor goedkeuring');
      await loadData();
    } catch (error) {
      console.error('Error submitting timesheet:', error);
      showError('Fout bij indienen', 'Kon urenregistratie niet indienen');
    } finally {
      setSaving(false);
    }
  };

  const changeWeek = (delta: number) => {
    let newWeek = selectedWeek + delta;
    let newYear = selectedYear;

    if (newWeek < 1) {
      newWeek = 52; // Assuming 52 weeks in a year for simplicity
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

  if (!selectedCompany) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Urenregistratie</h1>
        <EmptyState
          icon={Clock}
          title="Geen bedrijf geselecteerd"
          description="Selecteer een bedrijf uit de dropdown in de zijbalk om uren te registreren."
        />
      </div>
    );
  }

  const companyEmployees = employees.filter(emp => emp.companyId === selectedCompany.id);
  const effectiveEmployeeId = userRole === 'admin' ? selectedEmployeeId : currentEmployeeId;

  if (!effectiveEmployeeId) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Urenregistratie</h1>
        {userRole === 'admin' && companyEmployees.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="Geen werknemers gevonden"
            description="Er zijn geen werknemers voor dit bedrijf. Voeg eerst werknemers toe."
          />
        ) : (
          <EmptyState
            icon={Clock}
            title="Geen werknemer geselecteerd"
            description={userRole === 'admin' ? 'Selecteer een werknemer uit de dropdown hierboven om uren te registreren.' : 'Selecteer een werknemer om uren te registreren.'}
          />
        )}
      </div>
    );
  }

  if (!currentTimesheet) {
    return (
      <EmptyState
        icon={Clock}
        title="Geen urenregistratie gevonden"
        description="Er is een probleem opgetreden bij het laden of aanmaken van de urenregistratie."
      />
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
            {employeeData && <span> - {employeeData.personalInfo.firstName} {employeeData.personalInfo.lastName}</span>}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {((userRole === 'admin' && selectedEmployeeId) || (userRole !== 'admin' && currentEmployeeId)) && (
            <Button
              onClick={handleImportFromITKnecht}
              disabled={importing || saving}
              variant="primary"
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
            >
              {importing ? (
                <>
                  <LoadingSpinner className="h-4 w-4 mr-2" />
                  Importeren...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  ITKnecht Uren Ophalen
                </>
              )}
            </Button>
          )}
          {userRole === 'admin' && companyEmployees.length > 0 && (
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Selecteer werknemer</option>
              {companyEmployees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.personalInfo.firstName} {emp.personalInfo.lastName}
                </option>
              ))}
            </select>
          )}
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

      {importing && (
        <Card>
          <div className="flex items-center gap-3 text-blue-600 p-4">
            <LoadingSpinner className="h-5 w-5" />
            <span>Bezig met ophalen van ITKnecht uren data...</span>
          </div>
        </Card>
      )}

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
                <tr key={index} className={entry.notes?.includes('ITKnecht') ? 'bg-blue-50' : ''}>
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