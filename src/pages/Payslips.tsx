import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Download, Calendar, Building2, User, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Payslip } from '../types/payslip';
import { getPayslips, markPayslipAsDownloaded, regeneratePayslipPdf } from '../services/payslipService';
import { getEmployeeById, getCompany } from '../services/firebase';
import { getPayrollCalculations } from '../services/payrollService';
import { useToast } from '../hooks/useToast';
import { EmptyState } from '../components/ui/EmptyState';

export default function Payslips() {
  const { user, userRole } = useAuth();
  const { currentEmployeeId, selectedCompany, employees } = useApp();
  const { success, error: showError } = useToast();

  const [loading, setLoading] = useState(true);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [employeeData, setEmployeeData] = useState<any>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [downloading, setDownloading] = useState<string | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user || !selectedCompany) {
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

      const allPayslips = await getPayslips(user.uid, effectiveEmployeeId);
      const filtered = allPayslips.filter(
        p => p.periodStartDate.getFullYear() === selectedYear
      );
      setPayslips(filtered.sort((a, b) => b.periodStartDate.getTime() - a.periodStartDate.getTime()));
    } catch (error) {
      console.error('Error loading payslips:', error);
      showError('Fout bij laden', 'Kon loonstroken niet laden');
    } finally {
      setLoading(false);
    }
  }, [user, userRole, currentEmployeeId, selectedEmployeeId, selectedCompany, selectedYear, showError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getMonthName = (date: Date): string => {
    return date.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' });
  };

  const handleGeneratePdf = async (payslip: Payslip) => {
    if (!employeeData || !user || !selectedCompany) {
      showError('Fout', 'Benodigde gegevens ontbreken voor PDF generatie.');
      return;
    }

    if (!payslip.id) {
      showError('Fout', 'Loonstrook ID ontbreekt.');
      return;
    }

    setGenerating(payslip.id);

    try {
      const company = await getCompany(selectedCompany.id, user.uid);
      if (!company) {
        throw new Error('Bedrijf niet gevonden');
      }

      const month = payslip.periodStartDate.getMonth() + 1;
      const year = payslip.periodStartDate.getFullYear();

      console.log(`Searching for payroll calculation for employee ${payslip.employeeId}, month: ${month}, year: ${year}`);

      const calculations = await getPayrollCalculations(
        user.uid,
        payslip.employeeId,
        month,
        year
      );

      console.log(`Found ${calculations.length} calculation(s):`, calculations);

      if (!calculations || calculations.length === 0) {
        showError('Geen salarisberekening', `Er is geen salarisberekening gevonden voor ${getMonthName(payslip.periodStartDate)}. Zorg dat er eerst een salarisberekening is uitgevoerd in Payroll Processing.`);
        return;
      }

      const calculation = calculations[0];

      await regeneratePayslipPdf(
        payslip.id,
        user.uid,
        employeeData,
        company,
        calculation
      );

      success('PDF gegenereerd', 'Loonstrook PDF is succesvol gegenereerd');
      await loadData();
    } catch (error) {
      console.error('Error generating PDF:', error);
      showError('Fout bij genereren', 'Kon loonstrook PDF niet genereren');
    } finally {
      setGenerating(null);
    }
  };

  const handleDownload = async (payslip: Payslip) => {
    if (!employeeData || !user) {
      showError('Fout', 'Werknemergegevens ontbreken voor download.');
      return;
    }

    if (!payslip.pdfUrl || payslip.pdfUrl.trim() === '') {
      showError('Niet beschikbaar', 'Loonstrook PDF is nog niet beschikbaar');
      return;
    }

    setDownloading(payslip.id || null);

    try {
      const response = await fetch(payslip.pdfUrl);
      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `loonstrook-${getMonthName(payslip.periodStartDate)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      if (payslip.id) {
        await markPayslipAsDownloaded(payslip.id, user.uid);
      }

      success('Loonstrook gedownload', 'Loonstrook succesvol gedownload');
      await loadData();
    } catch (error) {
      console.error('Error downloading payslip:', error);
      showError('Fout bij downloaden', 'Kon loonstrook niet downloaden');
    } finally {
      setDownloading(null);
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
        <h1 className="text-3xl font-bold text-gray-900">Loonstroken</h1>
        <EmptyState
          icon={Building2}
          title="Geen bedrijf geselecteerd"
          description="Selecteer een bedrijf uit de dropdown in de zijbalk om loonstroken te bekijken."
        />
      </div>
    );
  }

  const companyEmployees = employees.filter(emp => emp.companyId === selectedCompany.id);

  if (userRole === 'admin' && !selectedEmployeeId && companyEmployees.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Loonstroken</h1>
        <EmptyState
          icon={FileText}
          title="Geen werknemers gevonden"
          description="Er zijn geen werknemers voor dit bedrijf. Voeg eerst werknemers toe."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Loonstroken</h1>
          <p className="text-gray-600 mt-2">
            {userRole === 'admin' ? 'Bekijk en beheer loonstroken' : 'Bekijk en download uw loonstroken'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {userRole === 'admin' && companyEmployees.length > 0 && (
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white shadow-sm"
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
            <Calendar className="h-5 w-5 text-gray-400" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white shadow-sm"
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {userRole === 'admin' && !selectedEmployeeId ? (
        <Card>
          <EmptyState
            icon={User}
            title="Geen werknemer geselecteerd"
            description="Selecteer een werknemer uit de dropdown hierboven om loonstroken te bekijken."
          />
        </Card>
      ) : payslips.length === 0 ? (
        <Card>
          <EmptyState
            icon={FileText}
            title="Geen loonstroken gevonden"
            description={`Geen loonstroken gevonden voor ${selectedYear} voor deze werknemer.`}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {payslips.map((payslip) => (
            <Card key={payslip.id} className="p-6">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-primary-50 rounded-xl">
                      <FileText className="h-6 w-6 text-primary-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {getMonthName(payslip.periodStartDate)}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {payslip.periodStartDate.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} - {payslip.periodEndDate.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Gegenereerd:</span>
                    <span className="text-gray-900 font-medium">
                      {payslip.generatedAt.toLocaleDateString('nl-NL')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Uitbetaling:</span>
                    <span className="text-gray-900 font-medium">
                      {payslip.paymentDate.toLocaleDateString('nl-NL')}
                    </span>
                  </div>
                  {payslip.downloadedAt && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Gedownload:</span>
                      <span className="text-gray-400">
                        {payslip.downloadedAt.toLocaleDateString('nl-NL')}
                      </span>
                    </div>
                  )}
                </div>

                {!payslip.pdfUrl || payslip.pdfUrl.trim() === '' ? (
                  <Button
                    onClick={() => handleGeneratePdf(payslip)}
                    className="w-full"
                    size="sm"
                    variant="success"
                    loading={generating === payslip.id}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {generating === payslip.id ? 'Genereren...' : 'Genereer PDF'}
                  </Button>
                ) : (
                  <Button
                    onClick={() => handleDownload(payslip)}
                    className="w-full"
                    size="sm"
                    loading={downloading === payslip.id}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {downloading === payslip.id ? 'Downloaden...' : 'Download PDF'}
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card className="bg-primary-50 border-primary-200">
        <div className="flex items-start gap-3">
          <div className="p-3 bg-primary-100 rounded-xl">
            <FileText className="h-5 w-5 text-primary-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-primary-900 mb-2">Bewaartermijn</h3>
            <p className="text-sm text-primary-800">
              Loonstroken worden 7 jaar bewaard conform wettelijke vereisten. Download en bewaar uw loonstroken ook zelf voor uw administratie.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
