import React, { useState, useEffect, useCallback } from 'react';
import { Calculator, FileText, Download, TrendingUp, Users, Building2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { PayrollPeriod, PayrollCalculation } from '../types/payroll';
import { WeeklyTimesheet } from '../types/timesheet';
import {
  getPayrollPeriods,
  createPayrollPeriod,
  getPayrollCalculations,
  createPayrollCalculation,
  calculatePayroll,
  getHourlyRates,
  updatePayrollPeriod
} from '../services/payrollService';
import { createPayslipFromCalculation } from '../services/payslipService';
import { getCompany } from '../services/firebase';
import { getWeeklyTimesheets } from '../services/timesheetService';
import { useToast } from '../hooks/useToast';
import { EmptyState } from '../components/ui/EmptyState';

export default function PayrollProcessing() {
  const { user, adminUserId } = useAuth();
  const { selectedCompany, employees } = useApp();
  const { success, error: showError } = useToast();

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [payrollPeriods, setPayrollPeriods] = useState<PayrollPeriod[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<PayrollPeriod | null>(null);
  const [calculations, setCalculations] = useState<PayrollCalculation[]>([]);

  const loadData = useCallback(async () => {
    if (!user || !adminUserId || !selectedCompany) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const periods = await getPayrollPeriods(adminUserId, selectedCompany.id);
      setPayrollPeriods(periods);

      if (periods.length > 0) {
        const latestPeriod = periods[0];
        setSelectedPeriod(latestPeriod);
        const calcs = await getPayrollCalculations(adminUserId);
        setCalculations(calcs);
      } else {
        setSelectedPeriod(null);
        setCalculations([]);
      }
    } catch (error) {
      console.error('Error loading payroll data:', error);
      showError('Fout bij laden', 'Kon loongegevens niet laden');
    } finally {
      setLoading(false);
    }
  }, [user, selectedCompany, showError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreatePeriod = async () => {
    if (!user || !adminUserId || !selectedCompany) {
      showError('Fout', 'Gebruiker of bedrijf niet geselecteerd.');
      return;
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const paymentDate = new Date(now.getFullYear(), now.getMonth() + 1, 25); // Example: 25th of next month

    try {
      setProcessing(true);
      const periodId = await createPayrollPeriod(adminUserId, {
        userId: adminUserId,
        companyId: selectedCompany.id,
        periodType: 'monthly',
        startDate: startOfMonth,
        endDate: endOfMonth,
        paymentDate,
        status: 'draft',
        employeeCount: 0,
        totalGross: 0,
        totalNet: 0,
        totalTax: 0,
      });

      success('Loonperiode aangemaakt', 'Nieuwe loonperiode succesvol aangemaakt');
      await loadData(); // Reload all data to show the new period
    } catch (error) {
      console.error('Error creating payroll period:', error);
      showError('Fout bij aanmaken periode', 'Kon loonperiode niet aanmaken');
    } finally {
      setProcessing(false);
    }
  };

  const handleCalculatePayroll = async () => {
    if (!user || !adminUserId || !selectedCompany || !selectedPeriod) {
      showError('Fout', 'Geen gebruiker, bedrijf of geselecteerde periode.');
      return;
    }

    if (selectedPeriod.status !== 'draft' && selectedPeriod.status !== 'calculated') {
      showError('Fout', 'Loonberekening kan alleen worden uitgevoerd voor concept- of berekende periodes.');
      return;
    }

    setProcessing(true);
    try {
      // Filter employees for selected company (same as TimesheetApprovals does)
      const companyEmployees = employees.filter(emp => emp.companyId === selectedCompany.id);

      const hourlyRates = await getHourlyRates(adminUserId, selectedCompany.id);
      const defaultRate = hourlyRates.length > 0 ? hourlyRates : {
        baseRate: 15, // Default if no rates are set
        overtimeMultiplier: 150,
        eveningMultiplier: 125,
        nightMultiplier: 150,
        weekendMultiplier: 150,
        holidayMultiplier: 200
      };

      let totalGross = 0;
      let totalNet = 0;
      let totalTax = 0;
      let processedEmployeeCount = 0;

      const company = await getCompany(selectedCompany.id, adminUserId);
      if (!company) {
        throw new Error('Company not found');
      }

      console.log(`\n${'='.repeat(80)}`);
      console.log(`🔍 PAYROLL DIAGNOSTIC - Processing ${companyEmployees.length} employees for period ${selectedPeriod.id}`);
      console.log(`📅 Period: ${selectedPeriod.startDate.toLocaleDateString()} - ${selectedPeriod.endDate.toLocaleDateString()}`);
      console.log(`🏢 Company: ${selectedCompany.name} (${selectedCompany.id})`);
      console.log(`${'='.repeat(80)}\n`);

      // First, log all employees and their key attributes
      companyEmployees.forEach((emp, idx) => {
        const name = `${emp.personalInfo.firstName} ${emp.personalInfo.lastName}`;
        console.log(`📋 Employee ${idx + 1}/${companyEmployees.length}: ${name}`);
        console.log(`   • ID: ${emp.id}`);
        console.log(`   • Status: ${emp.status}`);
        console.log(`   • Payment Type: ${emp.salaryInfo?.paymentType || 'NOT SET'}`);
        console.log(`   • Monthly Salary: €${emp.salaryInfo?.monthlySalary || 0}`);
        console.log(`   • Annual Salary: €${emp.salaryInfo?.annualSalary || 0}`);
        console.log(`   • Hourly Rate: €${emp.salaryInfo?.hourlyRate || 0}`);
        console.log('');
      });

      console.log(`\n${'─'.repeat(80)}`);
      console.log('🔄 Now processing each employee...\n');

      for (const employee of companyEmployees) {
        const employeeName = `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`;

        // Skip inactive employees
        if (employee.status !== 'active') {
          console.log(`⏭️  ${employeeName}: SKIPPED - Status is '${employee.status}' (not 'active')`);
          continue;
        }

        // Fetch timesheets for the specific employee within the payroll period
        const employeeTimesheets = await getWeeklyTimesheets(adminUserId, employee.id);
        const approvedTimesheetsInPeriod = employeeTimesheets.filter(
          ts => ts.status === 'approved' &&
          ts.entries.some(entry => entry.date >= selectedPeriod.startDate && entry.date <= selectedPeriod.endDate)
        );

        const paymentType = employee.salaryInfo?.paymentType;

        if (!paymentType) {
          console.log(`⏭️  ${employeeName}: SKIPPED - No paymentType set in salaryInfo`);
          console.log(`     salaryInfo structure:`, JSON.stringify(employee.salaryInfo, null, 2));
          continue;
        }

        console.log(`✅ ${employeeName}: Processing | Type: ${paymentType} | Timesheets: ${approvedTimesheetsInPeriod.length}`);

        // For hourly employees, skip if no approved timesheets
        if (paymentType === 'hourly' && approvedTimesheetsInPeriod.length === 0) {
          console.log(`   ⏭️  SKIPPED - Hourly employee with no approved timesheets in period`);
          continue;
        }

        // For monthly/annual employees, process even without timesheets (they get paid anyway)
        const calculation = await calculatePayroll(
          employee,
          approvedTimesheetsInPeriod,
          selectedPeriod.startDate,
          selectedPeriod.endDate,
          defaultRate as any // Cast to any if types don't perfectly align
        );

        calculation.payrollPeriodId = selectedPeriod.id!;
        calculation.calculatedBy = user.uid;
        calculation.status = 'calculated';

        // Always create new calculation (old calculations remain in database for audit trail)
        const calculationId = await createPayrollCalculation(adminUserId, calculation);

        // Create payslip for this calculation
        calculation.id = calculationId;
        await createPayslipFromCalculation(adminUserId, calculation, employee, company);

        totalGross += Number(calculation.grossPay);
        totalNet += Number(calculation.netPay);
        totalTax += Number(calculation.taxes.incomeTax);
        processedEmployeeCount++;

        console.log(`   ✅ PROCESSED - Gross: €${Number(calculation.grossPay).toFixed(2)} | Net: €${Number(calculation.netPay).toFixed(2)}`);
      }

      console.log(`\n${'='.repeat(80)}`);
      console.log(`📊 PAYROLL SUMMARY`);
      console.log(`${'='.repeat(80)}`);
      console.log(`Total Employees Found: ${companyEmployees.length}`);
      console.log(`Successfully Processed: ${processedEmployeeCount}`);
      console.log(`Skipped: ${companyEmployees.length - processedEmployeeCount}`);
      console.log(`Total Gross Pay: €${totalGross.toFixed(2)}`);
      console.log(`Total Net Pay: €${totalNet.toFixed(2)}`);
      console.log(`Total Tax: €${totalTax.toFixed(2)}`);
      console.log(`${'='.repeat(80)}\n`);

      // Update the payroll period summary
      await updatePayrollPeriod(selectedPeriod.id!, adminUserId, {
        employeeCount: processedEmployeeCount,
        totalGross: totalGross,
        totalNet: totalNet,
        totalTax: totalTax,
        status: 'calculated',
      });

      success('Loonberekening voltooid', `Loon berekend voor ${processedEmployeeCount} werknemers`);
      await loadData(); // Reload all data to show updated calculations
    } catch (error) {
      console.error('Error calculating payroll:', error);
      showError('Fout bij berekenen loon', 'Kon loon niet berekenen');
    } finally {
      setProcessing(false);
    }
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
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Loonverwerking</h1>
        </div>
        <EmptyState
          icon={Building2}
          title="Geen bedrijf geselecteerd"
          description="Selecteer een bedrijf uit de dropdown in de zijbalk om loonverwerking te beheren."
        />
      </div>
    );
  }

  // Only allow payroll processing for employer companies
  if (selectedCompany.companyType !== 'employer') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Loonverwerking</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Bereken en verwerk salarissen
          </p>
        </div>
        <EmptyState
          icon={Building2}
          title="Niet beschikbaar voor dit bedrijfstype"
          description={`Loonverwerking is alleen beschikbaar voor werkgever bedrijven (employer). Het geselecteerde bedrijf "${selectedCompany.name}" is van het type "${selectedCompany.companyType}".`}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Loonverwerking</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Bereken en verwerk salarissen
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={handleCreatePeriod}
            disabled={processing}
            variant="secondary"
          >
            <FileText className="h-4 w-4 mr-2" />
            Nieuwe periode
          </Button>
          {selectedPeriod && (selectedPeriod.status === 'draft' || selectedPeriod.status === 'calculated') && (
            <Button
              onClick={handleCalculatePayroll}
              disabled={processing}
            >
              <Calculator className="h-4 w-4 mr-2" />
              Bereken loon
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Werknemers</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {selectedPeriod?.employeeCount || 0}
              </p>
            </div>
            <Users className="h-8 w-8 text-primary-500" />
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Bruto totaal</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                €{(selectedPeriod?.totalGross || 0).toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <Calculator className="h-8 w-8 text-green-500" />
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Loonheffing</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                €{(selectedPeriod?.totalTax || 0).toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <FileText className="h-8 w-8 text-orange-500" />
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Netto totaal</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                €{(selectedPeriod?.totalNet || 0).toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-purple-500" />
          </div>
        </Card>
      </div>

      <Card>
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Loonperiodes</h2>
          {payrollPeriods.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400 text-center py-8">
              Geen loonperiodes gevonden. Maak een nieuwe periode aan.
            </p>
          ) : (
            <div className="space-y-2">
              {payrollPeriods.map((period) => (
                <div
                  key={period.id}
                  onClick={() => setSelectedPeriod(period)}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${ selectedPeriod?.id === period.id ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600' }`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-gray-100">
                        {period.startDate.toLocaleDateString('nl-NL')} - {period.endDate.toLocaleDateString('nl-NL')}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Uitbetaling: {period.paymentDate.toLocaleDateString('nl-NL')}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${ period.status === 'paid' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' : period.status === 'approved' ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/20 dark:text-primary-300' : period.status === 'calculated' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:bg-gray-700 dark:text-gray-300' }`}>
                        {period.status === 'paid' ? 'Betaald' :
                         period.status === 'approved' ? 'Goedgekeurd' :
                         period.status === 'calculated' ? 'Berekend' :
                         'Concept'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {calculations.length > 0 && (
        <Card>
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Loonberekeningen ({calculations.length})</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Werknemer
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Normale uren
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Overuren
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Bruto loon
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Loonheffing
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Netto loon
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {calculations.map((calc) => {
                    const employee = employees?.find((e: any) => e.id === calc.employeeId);
                    const employeeName = employee
                      ? `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`
                      : calc.employeeId;
                    const paymentType = employee?.salaryInfo?.paymentType || 'unknown';
                    const paymentTypeLabel = paymentType === 'hourly' ? 'Uurloon' : paymentType === 'monthly' ? 'Maand' : paymentType === 'annual' ? 'Jaar' : '?';

                    return (
                      <tr key={calc.id}>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{employeeName}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            paymentType === 'hourly' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300' :
                            paymentType === 'monthly' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' :
                            'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300'
                          }`}>
                            {paymentTypeLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{calc.regularHours}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{calc.overtimeHours}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                          €{calc.grossPay.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                          €{calc.taxes.incomeTax.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                          €{calc.netPay.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}