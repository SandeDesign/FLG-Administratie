import React, { useState, useEffect } from 'react';
import { Calculator, FileText, Download, TrendingUp } from 'lucide-react';
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
  getHourlyRates
} from '../services/payrollService';
import { getWeeklyTimesheets } from '../services/timesheetService';
import { getEmployees } from '../services/firebase';
import { useToast } from '../hooks/useToast';

export default function PayrollProcessing() {
  const { user } = useAuth();
  const { selectedCompany } = useApp();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [payrollPeriods, setPayrollPeriods] = useState<PayrollPeriod[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<PayrollPeriod | null>(null);
  const [calculations, setCalculations] = useState<PayrollCalculation[]>([]);

  useEffect(() => {
    loadData();
  }, [user, selectedCompany]);

  const loadData = async () => {
    if (!user || !selectedCompany) return;

    try {
      setLoading(true);
      const periods = await getPayrollPeriods(user.uid, selectedCompany.id);
      setPayrollPeriods(periods);

      if (periods.length > 0) {
        setSelectedPeriod(periods[0]);
        const calcs = await getPayrollCalculations(user.uid, periods[0].id);
        setCalculations(calcs);
      }
    } catch (error) {
      console.error('Error loading payroll data:', error);
      showToast('Fout bij laden van loongegevens', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePeriod = async () => {
    if (!user || !selectedCompany) return;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const paymentDate = new Date(now.getFullYear(), now.getMonth() + 1, 25);

    try {
      setProcessing(true);
      const periodId = await createPayrollPeriod(user.uid, {
        userId: user.uid,
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
        createdAt: new Date(),
        updatedAt: new Date()
      });

      showToast('Loonperiode aangemaakt', 'success');
      await loadData();
    } catch (error) {
      console.error('Error creating payroll period:', error);
      showToast('Fout bij aanmaken periode', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleCalculatePayroll = async () => {
    if (!user || !selectedCompany || !selectedPeriod) return;

    try {
      setProcessing(true);

      const employees = await getEmployees(user.uid, selectedCompany.id);
      const hourlyRates = await getHourlyRates(user.uid, selectedCompany.id);
      const defaultRate = hourlyRates[0] || {
        baseRate: 15,
        overtimeMultiplier: 150,
        eveningMultiplier: 125,
        nightMultiplier: 150,
        weekendMultiplier: 150,
        holidayMultiplier: 200
      };

      let totalGross = 0;
      let totalNet = 0;
      let totalTax = 0;

      for (const employee of employees) {
        const timesheets = await getWeeklyTimesheets(user.uid, employee.id);
        const approvedTimesheets = timesheets.filter(
          ts => ts.status === 'approved' &&
          ts.entries[0]?.date >= selectedPeriod.startDate &&
          ts.entries[0]?.date <= selectedPeriod.endDate
        );

        if (approvedTimesheets.length === 0) continue;

        const calculation = await calculatePayroll(
          employee,
          approvedTimesheets,
          selectedPeriod.startDate,
          selectedPeriod.endDate,
          defaultRate as any
        );

        calculation.payrollPeriodId = selectedPeriod.id!;
        calculation.calculatedBy = user.uid;

        await createPayrollCalculation(user.uid, calculation);

        totalGross += calculation.grossPay;
        totalNet += calculation.netPay;
        totalTax += calculation.taxes.incomeTax;
      }

      showToast(`Loon berekend voor ${employees.length} werknemers`, 'success');
      await loadData();
    } catch (error) {
      console.error('Error calculating payroll:', error);
      showToast('Fout bij berekenen loon', 'error');
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Loonverwerking</h1>
          <p className="text-gray-600 mt-1">
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
          {selectedPeriod && selectedPeriod.status === 'draft' && (
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
              <p className="text-sm text-gray-600">Werknemers</p>
              <p className="text-2xl font-bold text-gray-900">
                {selectedPeriod?.employeeCount || 0}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-blue-500" />
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Bruto totaal</p>
              <p className="text-2xl font-bold text-gray-900">
                €{(selectedPeriod?.totalGross || 0).toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <Calculator className="h-8 w-8 text-green-500" />
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Loonheffing</p>
              <p className="text-2xl font-bold text-gray-900">
                €{(selectedPeriod?.totalTax || 0).toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <FileText className="h-8 w-8 text-orange-500" />
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Netto totaal</p>
              <p className="text-2xl font-bold text-gray-900">
                €{(selectedPeriod?.totalNet || 0).toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <Download className="h-8 w-8 text-purple-500" />
          </div>
        </Card>
      </div>

      <Card>
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Loonperiodes</h2>
          {payrollPeriods.length === 0 ? (
            <p className="text-gray-600 text-center py-8">
              Geen loonperiodes gevonden. Maak een nieuwe periode aan.
            </p>
          ) : (
            <div className="space-y-2">
              {payrollPeriods.map((period) => (
                <div
                  key={period.id}
                  onClick={() => setSelectedPeriod(period)}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                    selectedPeriod?.id === period.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {period.startDate.toLocaleDateString('nl-NL')} - {period.endDate.toLocaleDateString('nl-NL')}
                      </h3>
                      <p className="text-sm text-gray-600">
                        Uitbetaling: {period.paymentDate.toLocaleDateString('nl-NL')}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        period.status === 'paid' ? 'bg-green-100 text-green-800' :
                        period.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                        period.status === 'calculated' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
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
            <h2 className="text-lg font-semibold text-gray-900">Loonberekeningen</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Werknemer
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Normale uren
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Overuren
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Bruto loon
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Loonheffing
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Netto loon
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {calculations.map((calc) => (
                    <tr key={calc.id}>
                      <td className="px-4 py-3 text-sm text-gray-900">{calc.employeeId}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{calc.regularHours}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{calc.overtimeHours}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        €{calc.grossPay.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        €{calc.taxes.incomeTax.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        €{calc.netPay.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
