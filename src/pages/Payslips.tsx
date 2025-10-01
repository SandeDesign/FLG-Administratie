import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Download, Calendar, Building2, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Payslip } from '../types/payslip';
import { getPayslips, markPayslipAsDownloaded } from '../services/payslipService';
import { getEmployeeById } from '../services/firebase';
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

  const handleDownload = async (payslip: Payslip) => {
    if (!employeeData) {
      showError('Fout', 'Werknemergegevens ontbreken voor download.');
      return;
    }

    try {
      if (payslip.pdfUrl) {
        window.open(payslip.pdfUrl, '_blank');
        await markPayslipAsDownloaded(payslip.id!, user!.uid); // Use user.uid for ownership check
        success('Loonstrook gedownload', 'Loonstrook succesvol gedownload');
      } else {
        showError('Niet beschikbaar', 'Loonstrook PDF is nog niet beschikbaar');
      }
    } catch (error) {
      console.error('Error downloading payslip:', error);
      showError('Fout bij downloaden', 'Kon loonstrook niet downloaden');
    }
  };

  const getMonthName = (date: Date): string => {
    return date.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' });
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
          <h1 className="text-2xl font-bold text-gray-900">Loonstroken</h1>
        </div>
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
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Loonstroken</h1>
        </div>
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
          <h1 className="text-2xl font-bold text-gray-900">Loonstroken</h1>
          <p className="text-gray-600 mt-1">
            {userRole === 'admin' ? 'Bekijk en beheer loonstroken' : 'Bekijk en download uw loonstroken'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {userRole === 'admin' && companyEmployees.length > 0 && (
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
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
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
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
            <Card key={payslip.id} className="hover:shadow-lg transition-shadow">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <FileText className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {getMonthName(payslip.periodStartDate)}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {payslip.periodStartDate.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} - {payslip.periodEndDate.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Gegenereerd:</span>
                    <span className="text-gray-900 dark:text-white">
                      {payslip.generatedAt.toLocaleDateString('nl-NL')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Uitbetaling:</span>
                    <span className="text-gray-900 dark:text-white">
                      {payslip.paymentDate.toLocaleDateString('nl-NL')}
                    </span>
                  </div>
                  {payslip.downloadedAt && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500 dark:text-gray-500">Gedownload:</span>
                      <span className="text-gray-500 dark:text-gray-500">
                        {payslip.downloadedAt.toLocaleDateString('nl-NL')}
                      </span>
                    </div>
                  )}
                </div>

                <Button
                  onClick={() => handleDownload(payslip)}
                  className="w-full"
                  size="sm"
                  disabled={!payslip.pdfUrl}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card className="bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-100 rounded-lg dark:bg-blue-800">
            <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-1">Bewaartermijn</h3>
            <p className="text-sm text-blue-800 dark:text-blue-300">
              Loonstroken worden 7 jaar bewaard conform wettelijke vereisten. Download en bewaar uw loonstroken ook zelf voor uw administratie.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}