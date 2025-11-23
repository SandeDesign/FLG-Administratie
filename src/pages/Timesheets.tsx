import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Clock, Save, Send, Download, ChevronLeft, ChevronRight, User } from 'lucide-react';
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
  const { user, userRole } = useAuth();
  const { currentEmployeeId, selectedCompany, employees, queryUserId } = useApp(); // ✅ Gebruik queryUserId
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
  const [expandedDay, setExpandedDay] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    if (!user || !queryUserId || !selectedCompany) {
      setLoading(false);
      return;
    }

    // Voor admin: selecteerbare employee, voor manager/employee: eigen currentEmployeeId
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
        queryUserId,
        effectiveEmployeeId,
        selectedYear,
        selectedWeek
      );

      setTimesheets(sheets);

      if (sheets.length > 0) {
        setCurrentTimesheet(sheets[0]);
      } else {
        const weekDates = getWeekDates(selectedYear, selectedWeek);
        // ✅ FIX: Gebruik employee.companyId (employer/Buddy) ipv selectedCompany.id
        // Timesheets moeten altijd naar de employer gaan, niet naar het project
        const employerCompanyId = employee.companyId || employee.payrollCompanyId || selectedCompany.id;

        const emptyEntries: TimesheetEntry[] = weekDates.map(date => ({
          userId: queryUserId,
          employeeId: effectiveEmployeeId,
          companyId: employerCompanyId,
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
          userId: queryUserId,
          employeeId: effectiveEmployeeId,
          companyId: employerCompanyId,
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
  }, [user, queryUserId, userRole, currentEmployeeId, selectedEmployeeId, selectedCompany, selectedYear, selectedWeek, showError]);

  const handleImportFromITKnecht = async () => {
    if (!selectedCompany || !employeeData) {
      showError('Fout', 'Selecteer eerst een bedrijf en werknemer');
      return;
    }

    setImporting(true);
    try {
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
      
      if (itknechtData && Array.isArray(itknechtData) && itknechtData.length > 0) {
        await processITKnechtData(itknechtData);
        success('Import geslaagd', `${itknechtData.length} ITKnecht entries geïmporteerd`);
        await loadData();
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

  const processITKnechtData = async (itknechtEntries: any[]) => {
    if (!currentTimesheet || !employeeData) return;

    const normalizedEntries = itknechtEntries.map(record => {
      const data = record.data || record;
      return {
        dag: data.Dag || '',
        totaal_factuureerbare_uren: parseFloat(data['Totaal factureerbare uren'] || 0),
        gereden_kilometers: parseFloat(data['Gereden kilometers'] || 0)
      };
    });

    const entriesByDay: { [key: string]: any[] } = {};
    
    normalizedEntries.forEach(entry => {
      const day = entry.dag;
      if (!entriesByDay[day]) {
        entriesByDay[day] = [];
      }
      entriesByDay[day].push(entry);
    });

    const updatedEntries = [...currentTimesheet.entries];
    
    Object.keys(entriesByDay).forEach(day => {
      const dayEntries = entriesByDay[day];
      
      const dayTotalHours = dayEntries.reduce((sum, entry) => {
        return sum + entry.totaal_factuureerbare_uren;
      }, 0);
      
      const dayTotalKm = dayEntries.reduce((sum, entry) => {
        return sum + entry.gereden_kilometers;
      }, 0);

      const dayIndex = updatedEntries.findIndex(entry => {
        const dayName = getDayName(entry.date);
        return dayName.toLowerCase() === day.toLowerCase();
      });

      if (dayIndex !== -1) {
        updatedEntries[dayIndex] = {
          ...updatedEntries[dayIndex],
          regularHours: dayTotalHours,
          travelKilometers: dayTotalKm,
          overtimeHours: 0,
          eveningHours: 0,
          nightHours: 0,
          weekendHours: 0,
          notes: ` Riset`,
          updatedAt: new Date()
        };
      }
    });

    const totals = calculateWeekTotals(updatedEntries);

    const updatedTimesheet = {
      ...currentTimesheet,
      entries: updatedEntries,
      totalRegularHours: totals.regularHours,
      totalOvertimeHours: 0,
      totalEveningHours: 0,
      totalNightHours: 0,
      totalWeekendHours: 0,
      totalTravelKilometers: totals.travelKilometers,
      updatedAt: new Date()
    };

    setCurrentTimesheet(updatedTimesheet);

    if (updatedTimesheet.id) {
      await updateWeeklyTimesheet(updatedTimesheet.id, queryUserId!, updatedTimesheet);
    } else {
      const id = await createWeeklyTimesheet(queryUserId!, updatedTimesheet);
      setCurrentTimesheet({ ...updatedTimesheet, id });
    }
  };

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

  const addWorkActivity = (entryIndex: number) => {
    if (!currentTimesheet) return;

    const updatedEntries = [...currentTimesheet.entries];
    const entry = updatedEntries[entryIndex];
    
    const newActivity = {
      hours: 0,
      description: '',
      clientId: '',
      isITKnechtImport: false
    };

    updatedEntries[entryIndex] = {
      ...entry,
      workActivities: [...(entry.workActivities || []), newActivity],
      updatedAt: new Date()
    };

    setCurrentTimesheet({
      ...currentTimesheet,
      entries: updatedEntries,
      updatedAt: new Date()
    });
  };

  const updateWorkActivity = (entryIndex: number, activityIndex: number, field: string, value: any) => {
    if (!currentTimesheet) return;

    const updatedEntries = [...currentTimesheet.entries];
    const entry = updatedEntries[entryIndex];
    const activities = [...(entry.workActivities || [])];
    
    activities[activityIndex] = {
      ...activities[activityIndex],
      [field]: value
    };

    updatedEntries[entryIndex] = {
      ...entry,
      workActivities: activities,
      updatedAt: new Date()
    };

    // Recalculate totals INCLUDING workActivities
    let totalRegularHours = 0;
    let totalTravelKilometers = 0;

    updatedEntries.forEach(e => {
      totalRegularHours += e.regularHours || 0;
      
      if (e.workActivities && e.workActivities.length > 0) {
        e.workActivities.forEach(activity => {
          totalRegularHours += activity.hours || 0;
        });
      }

      totalTravelKilometers += e.travelKilometers || 0;
    });

    setCurrentTimesheet({
      ...currentTimesheet,
      entries: updatedEntries,
      totalRegularHours: totalRegularHours,
      totalTravelKilometers: totalTravelKilometers,
      updatedAt: new Date()
    });
  };

  const removeWorkActivity = (entryIndex: number, activityIndex: number) => {
    if (!currentTimesheet) return;

    const updatedEntries = [...currentTimesheet.entries];
    const entry = updatedEntries[entryIndex];
    const activities = [...(entry.workActivities || [])];
    
    activities.splice(activityIndex, 1);

    updatedEntries[entryIndex] = {
      ...entry,
      workActivities: activities,
      updatedAt: new Date()
    };

    setCurrentTimesheet({
      ...currentTimesheet,
      entries: updatedEntries,
      updatedAt: new Date()
    });
  };

  const handleSave = async () => {
    if (!currentTimesheet || !user || !queryUserId || !employeeData) return;

    setSaving(true);
    try {
      if (currentTimesheet.id) {
        await updateWeeklyTimesheet(
          currentTimesheet.id,
          queryUserId,
          currentTimesheet
        );
        success('Uren opgeslagen', 'Urenregistratie succesvol opgeslagen');
      } else {
        const id = await createWeeklyTimesheet(
          queryUserId,
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
    if (!currentTimesheet || !currentTimesheet.id || !user || !queryUserId || !employeeData) return;

    if (currentTimesheet.totalRegularHours === 0 && currentTimesheet.totalTravelKilometers === 0) {
      showError('Geen uren ingevoerd', 'Voer minimaal één uur of kilometer in om in te dienen');
      return;
    }

    const contractHoursPerWeek = employeeData.contractInfo?.hoursPerWeek || 40;
    const contractHoursPerDay = contractHoursPerWeek / 5;
    const workDays = currentTimesheet.entries.filter(e => e.regularHours > 0).length;
    const averageHoursPerDay = workDays > 0 ? currentTimesheet.totalRegularHours / workDays : 0;
    
    const expectedWeeklyHours = contractHoursPerWeek;
    const actualWeeklyHours = currentTimesheet.totalRegularHours;
    const underPerformanceThreshold = expectedWeeklyHours * 0.85;
    
    if (workDays > 0 && actualWeeklyHours < underPerformanceThreshold) {
      const explanation = prompt(
        `Volgens uw contract werkt u ${contractHoursPerWeek} uur per week (${contractHoursPerDay.toFixed(1)} uur per dag).\n` +
        `Deze week heeft u ${actualWeeklyHours} uur geregistreerd (${averageHoursPerDay.toFixed(1)} uur gemiddeld per werkdag).\n\n` +
        `Geef een verklaring voor de lagere uren (bijv. ziekte, verlof, training, deeltijd afspraak, etc.):`
      );
      
      if (explanation === null) {
        return;
      }
      
      if (!explanation.trim()) {
        showError('Verklaring vereist', 'Een verklaring is verplicht bij minder uren dan uw contract');
        return;
      }
      
      const updatedTimesheet = {
        ...currentTimesheet,
        lowHoursExplanation: explanation.trim(),
        contractHoursPerWeek: contractHoursPerWeek,
        actualHoursThisWeek: actualWeeklyHours,
        averageHoursPerDay: averageHoursPerDay,
        updatedAt: new Date()
      };
      
      setCurrentTimesheet(updatedTimesheet);
      
      try {
        await updateWeeklyTimesheet(updatedTimesheet.id, queryUserId, updatedTimesheet);
      } catch (error) {
        console.error('Error saving explanation:', error);
        showError('Fout bij opslaan', 'Kon verklaring niet opslaan');
        return;
      }
    }

    setSaving(true);
    try {
      await submitWeeklyTimesheet(
        currentTimesheet.id,
        queryUserId,
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

  if (!selectedCompany) {
    return (
      <div className="space-y-6 px-4 sm:px-0">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Urenregistratie</h1>
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
      <div className="space-y-6 px-4 sm:px-0">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Urenregistratie</h1>
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
  const contractHours = employeeData?.contractInfo?.hoursPerWeek || 40;
  const workDays = currentTimesheet.entries.filter(e => e.regularHours > 0).length;
  const avgHours = workDays > 0 ? currentTimesheet.totalRegularHours / workDays : 0;
  const isUnderContract = currentTimesheet.totalRegularHours < (contractHours * 0.85);

  return (
    <div className="space-y-3 sm:space-y-6 px-4 sm:px-0 pb-24 sm:pb-6">
      {/* Header */}
      <div className="space-y-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Urenregistratie</h1>
          {employeeData && (
            <p className="text-xs sm:text-sm text-gray-600 mt-2 flex items-center gap-2">
              <User className="h-4 w-4" />
              {employeeData.personalInfo.firstName} {employeeData.personalInfo.lastName}
            </p>
          )}
        </div>

        {/* Week Navigation + Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-gray-200">
            <button
              onClick={() => changeWeek(-1)}
              className="p-2 hover:bg-gray-100 rounded transition-colors"
              title="Vorige week"
            >
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div className="text-center px-4 min-w-[120px]">
              <p className="text-sm font-semibold text-gray-900">Week {selectedWeek}</p>
              <p className="text-xs text-gray-500">{selectedYear}</p>
            </div>
            <button
              onClick={() => changeWeek(1)}
              className="p-2 hover:bg-gray-100 rounded transition-colors"
              title="Volgende week"
            >
              <ChevronRight className="h-5 w-5 text-gray-600" />
            </button>
          </div>

          {/* Employee Selector (Admin only) */}
          {userRole === 'admin' && companyEmployees.length > 1 && (
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="flex-1 sm:flex-none px-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Selecteer werknemer</option>
              {companyEmployees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.personalInfo.firstName} {emp.personalInfo.lastName}
                </option>
              ))}
            </select>
          )}

          {/* Import Button */}
          {((userRole === 'admin' && selectedEmployeeId) || (userRole !== 'admin' && currentEmployeeId)) && 
           selectedCompany && (selectedCompany.name.toLowerCase().includes('itknecht') || selectedCompany.name.toLowerCase().includes('buddy')) && (
            <Button
              onClick={handleImportFromITKnecht}
              disabled={importing || saving}
              variant="secondary"
              size="sm"
              className="text-xs sm:text-sm"
            >
              {importing ? (
                <>
                  <LoadingSpinner className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                  Laden...
                </>
              ) : (
                <>
                  <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                  Ophalen
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Status Badge */}
      {currentTimesheet.status !== 'draft' && (
        <div className="p-3 rounded-lg flex items-center justify-between text-sm"
             style={{
               backgroundColor: currentTimesheet.status === 'approved' ? '#f0fdf4' : 
                              currentTimesheet.status === 'submitted' ? '#eff6ff' :
                              currentTimesheet.status === 'rejected' ? '#fef2f2' : '#f3f4f6',
               borderLeft: `4px solid ${
                 currentTimesheet.status === 'approved' ? '#22c55e' :
                 currentTimesheet.status === 'submitted' ? '#3b82f6' :
                 currentTimesheet.status === 'rejected' ? '#ef4444' : '#6b7280'
               }`
             }}>
          <span className="font-medium" style={{
            color: currentTimesheet.status === 'approved' ? '#15803d' :
                   currentTimesheet.status === 'submitted' ? '#1e40af' :
                   currentTimesheet.status === 'rejected' ? '#991b1b' : '#374151'
          }}>
            Status: {currentTimesheet.status === 'approved' ? 'Goedgekeurd' :
                     currentTimesheet.status === 'submitted' ? 'Ingediend' :
                     currentTimesheet.status === 'rejected' ? 'Afgekeurd' :
                     currentTimesheet.status === 'processed' ? 'Verwerkt' : 'Concept'}
          </span>
          {currentTimesheet.rejectionReason && (
            <span className="text-xs text-red-600">Reden: {currentTimesheet.rejectionReason}</span>
          )}
        </div>
      )}

      {/* Import Status */}
      {importing && (
        <div className="p-3 sm:p-4 bg-primary-50 border border-primary-200 rounded-lg flex items-center gap-3 text-primary-600 text-sm">
          <LoadingSpinner className="h-4 w-4 sm:h-5 sm:w-5" />
          <span>Bezig met ophalen van data...</span>
        </div>
      )}

      {/* Week Summary */}
      {currentTimesheet && (
        <Card className="bg-gradient-to-r from-primary-50 to-indigo-50 border-primary-200 p-4 sm:p-6">
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900">Week {selectedWeek} Overzicht</h3>
            
            {isUnderContract && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700 flex gap-2">
                <span>⚠️</span>
                <div>
                  <strong>Onder contract uren:</strong> {currentTimesheet.totalRegularHours}u van {contractHours}u
                  {currentTimesheet.lowHoursExplanation && (
                    <p className="mt-1 text-xs">Verklaring: {currentTimesheet.lowHoursExplanation}</p>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-2 sm:p-3 bg-white rounded-lg text-center">
                <p className="text-xs text-gray-600 mb-1">Totaal</p>
                <p className="text-xl sm:text-2xl font-bold text-primary-600">{currentTimesheet.totalRegularHours}u</p>
              </div>
              <div className="p-2 sm:p-3 bg-white rounded-lg text-center">
                <p className="text-xs text-gray-600 mb-1">Kilometers</p>
                <p className="text-xl sm:text-2xl font-bold text-green-600">{currentTimesheet.totalTravelKilometers}km</p>
              </div>
              <div className="p-2 sm:p-3 bg-white rounded-lg text-center">
                <p className="text-xs text-gray-600 mb-1">Werkdagen</p>
                <p className="text-xl sm:text-2xl font-bold text-purple-600">{workDays}d</p>
              </div>
              <div className="p-2 sm:p-3 bg-white rounded-lg text-center">
                <p className="text-xs text-gray-600 mb-1">Gem./dag</p>
                <p className={`text-xl sm:text-2xl font-bold ${avgHours < 7 ? 'text-yellow-600' : 'text-orange-600'}`}>
                  {avgHours.toFixed(1)}u
                </p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Days List - Collapsible */}
      <div className="space-y-2">
        {currentTimesheet.entries.map((entry, index) => {
          const isExpanded = expandedDay === index;
          const hasData = entry.regularHours > 0 || entry.travelKilometers > 0 || (entry.workActivities?.length || 0) > 0;
          const isImported = entry.notes?.includes('import');

          return (
            <div key={index}>
              {/* Day Card - Collapsible Header */}
              <button
                onClick={() => setExpandedDay(isExpanded ? null : index)}
                disabled={isReadOnly && !hasData}
                className={`w-full p-3 sm:p-4 rounded-lg border-2 transition-all text-left flex items-center justify-between ${
                  isExpanded 
                    ? 'border-primary-300 bg-primary-50' 
                    : hasData
                    ? `border-orange-300 bg-orange-50 hover:bg-orange-100`
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm sm:text-base text-gray-900">
                      {getDayName(entry.date)}
                    </p>
                    <p className="text-xs text-gray-600">
                      {entry.date.toLocaleDateString('nl-NL')}
                    </p>
                  </div>

                  {/* Quick Summary */}
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-medium">
                    {entry.regularHours > 0 && (
                      <span className="px-2 py-1 bg-primary-100 text-primary-700 rounded">
                        {entry.regularHours}u
                      </span>
                    )}
                    {entry.travelKilometers > 0 && (
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded">
                        {entry.travelKilometers}km
                      </span>
                    )}
                    {isImported && (
                      <Download className="h-4 w-4 text-primary-600" />
                    )}
                  </div>
                </div>

                <ChevronRight className={`h-5 w-5 text-gray-600 transition-transform flex-shrink-0 ml-2 ${isExpanded ? 'rotate-90' : ''}`} />
              </button>

              {/* Expanded Day Content */}
              {isExpanded && (
                <Card className={`mt-1 p-3 sm:p-4 space-y-3 sm:space-y-4 ${isImported ? 'bg-primary-50 border-primary-200' : ''}`}>
                  {/* Input Fields */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Uren</label>
                      <Input
                        type="number"
                        min="0"
                        max="24"
                        step="0.5"
                        value={entry.regularHours}
                        onChange={(e) => updateEntry(index, 'regularHours', parseFloat(e.target.value) || 0)}
                        disabled={isReadOnly}
                        className="text-center font-semibold text-lg"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Kilometers</label>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={entry.travelKilometers}
                        onChange={(e) => updateEntry(index, 'travelKilometers', parseFloat(e.target.value) || 0)}
                        disabled={isReadOnly}
                        className="text-center font-semibold text-lg"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Notities</label>
                    <Input
                      type="text"
                      value={entry.notes || ''}
                      onChange={(e) => updateEntry(index, 'notes', e.target.value)}
                      disabled={isReadOnly}
                      placeholder="Notities of opmerkingen..."
                      className="text-sm"
                    />
                  </div>

                  {/* Work Activities */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs sm:text-sm font-medium text-gray-700">Werkzaamheden</label>
                      {!isReadOnly && (
                        <Button
                          onClick={() => addWorkActivity(index)}
                          size="sm"
                          variant="secondary"
                          className="text-xs"
                        >
                          + Toevoegen
                        </Button>
                      )}
                    </div>

                    {(entry.workActivities || []).map((activity, actIdx) => (
                      <div key={actIdx} className={`p-2 rounded flex gap-2 items-center ${activity.isITKnechtImport ? 'bg-primary-100' : 'bg-gray-100'}`}>
                        <Input
                          type="number"
                          min="0"
                          max="24"
                          step="0.5"
                          value={activity.hours}
                          onChange={(e) => updateWorkActivity(index, actIdx, 'hours', parseFloat(e.target.value) || 0)}
                          disabled={isReadOnly || activity.isITKnechtImport}
                          className="w-16 text-center text-xs py-1"
                          placeholder="0u"
                        />
                        <Input
                          type="text"
                          value={activity.description}
                          onChange={(e) => updateWorkActivity(index, actIdx, 'description', e.target.value)}
                          disabled={isReadOnly || activity.isITKnechtImport}
                          placeholder="Beschrijving..."
                          className="flex-1 text-xs py-1"
                        />
                        {!isReadOnly && !activity.isITKnechtImport && (
                          <button
                            onClick={() => removeWorkActivity(index, actIdx)}
                            className="text-red-600 hover:text-red-800 font-bold text-lg"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          );
        })}
      </div>

      {/* Action Buttons */}
      {!isReadOnly && (
        <div className="flex gap-2 sm:gap-3">
          <Button
            onClick={handleSave}
            disabled={saving}
            variant="secondary"
            className="flex-1 sm:flex-none"
          >
            <Save className="h-4 w-4 mr-2" />
            Opslaan
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || !currentTimesheet.id}
            className="flex-1"
          >
            <Send className="h-4 w-4 mr-2" />
            Indienen
          </Button>
        </div>
      )}
    </div>
  );
}