import React, { useState, useEffect } from 'react';
import { FileText, Download, Calendar } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Payslip } from '../types/payslip';
import { getPayslips, markPayslipAsDownloaded } from '../services/payslipService';
import { getEmployeeById } from '../services/firebase';
import { useToast } from '../hooks/useToast';

export default function Payslips() {
  const { user } = useAuth();
  const { currentEmployeeId } = useApp();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [employeeData, setEmployeeData] = useState<any>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  useEffect(() => {
    loadData();
  }, [user, currentEmployeeId, selectedYear]);

  const loadData = async () => {
    if (!user || !currentEmployeeId) return;

    try {
      setLoading(true);
      const employee = await getEmployeeById(currentEmployeeId);
      setEmployeeData(employee);

      if (employee) {
        const allPayslips = await getPayslips(employee.userId, currentEmployeeId);
        const filtered = allPayslips.filter(
          p => p.periodStartDate.getFullYear() === selectedYear
        );
        setPayslips(filtered.sort((a, b) => b.periodStartDate.getTime() - a.periodStartDate.getTime()));
      }
    } catch (error) {
      console.error('Error loading payslips:', error);
      showToast('Fout bij laden van loonstroken', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (payslip: Payslip) => {
    if (!employeeData) return;

    try {
      if (payslip.pdfUrl) {
        window.open(payslip.pdfUrl, '_blank');
        await markPayslipAsDownloaded(payslip.id!, employeeData.userId);
        showToast('Loonstrook gedownload', 'success');
      } else {
        showToast('Loonstrook nog niet beschikbaar', 'error');
      }
    } catch (error) {
      console.error('Error downloading payslip:', error);
      showToast('Fout bij downloaden', 'error');
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Loonstroken</h1>
          <p className="text-gray-600 mt-1">
            Bekijk en download uw loonstroken
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-gray-400" />
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      </div>

      {payslips.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Geen loonstroken gevonden voor {selectedYear}</p>
          </div>
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
                      <h3 className="font-medium text-gray-900">
                        {getMonthName(payslip.periodStartDate)}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {payslip.periodStartDate.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} - {payslip.periodEndDate.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Gegenereerd:</span>
                    <span className="text-gray-900">
                      {payslip.generatedAt.toLocaleDateString('nl-NL')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Uitbetaling:</span>
                    <span className="text-gray-900">
                      {payslip.paymentDate.toLocaleDateString('nl-NL')}
                    </span>
                  </div>
                  {payslip.downloadedAt && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Gedownload:</span>
                      <span className="text-gray-500">
                        {payslip.downloadedAt.toLocaleDateString('nl-NL')}
                      </span>
                    </div>
                  )}
                </div>

                <Button
                  onClick={() => handleDownload(payslip)}
                  className="w-full"
                  size="sm"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card className="bg-blue-50 border-blue-200">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <FileText className="h-5 w-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-blue-900 mb-1">Bewaartermijn</h3>
            <p className="text-sm text-blue-800">
              Loonstroken worden 7 jaar bewaard conform wettelijke vereisten. Download en bewaar uw loonstroken ook zelf voor uw administratie.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
