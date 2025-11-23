import React, { useState, useEffect, useCallback } from 'react';
import { Download, FileText, Calendar, Database } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ExportJob, ExportType } from '../types/export';
import { getExportJobs, createExportJob } from '../services/exportService';
import { useToast } from '../hooks/useToast';
import { EmptyState } from '../components/ui/EmptyState';

const exportTypes: Array<{ type: ExportType; label: string; description: string; icon: any }> = [
  {
    type: 'timesheet_csv',
    label: 'Uren (CSV)',
    description: 'Export urenregistraties naar CSV formaat',
    icon: FileText
  },
  {
    type: 'payroll_excel',
    label: 'Loonberekeningen (Excel)',
    description: 'Export loonberekeningen naar Excel',
    icon: Database
  },
  {
    type: 'payslips_pdf',
    label: 'Loonstroken (PDF)',
    description: 'Download alle loonstroken als ZIP',
    icon: Download
  },
  {
    type: 'accounting_xml',
    label: 'Boekhouding (XML)',
    description: 'Export naar boekhoudsoftware',
    icon: FileText
  },
  {
    type: 'sepa_payment',
    label: 'SEPA Betaalbestand',
    description: 'Genereer SEPA XML voor bankbetaling',
    icon: Download
  },
  {
    type: 'tax_return_xml',
    label: 'Loonaangifte (XML)',
    description: 'XML bestand voor Belastingdienst',
    icon: FileText
  }
];

export default function ExportsManagement() {
  const { user } = useAuth();
  const { selectedCompany } = useApp();
  const { success, error: showError } = useToast();

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [exportJobs, setExportJobs] = useState<ExportJob[]>([]);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const loadData = useCallback(async () => {
    if (!user || !selectedCompany) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const jobs = await getExportJobs(user.uid, selectedCompany.id);
      setExportJobs(jobs);
    } catch (error) {
      console.error('Error loading export jobs:', error);
      showError('Fout bij laden', 'Kon exports niet laden');
    } finally {
      setLoading(false);
    }
  }, [user, selectedCompany, showError]);

  useEffect(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    setStartDate(firstDay.toISOString().split('T'));
    setEndDate(lastDay.toISOString().split('T'));

    loadData();
  }, [loadData]);

  const handleCreateExport = async (exportType: ExportType) => {
    if (!user || !selectedCompany || !startDate || !endDate) {
      showError('Fout', 'Selecteer een periode en zorg dat een bedrijf is geselecteerd');
      return;
    }

    try {
      setCreating(true);

      await createExportJob(
        user.uid,
        selectedCompany.id,
        exportType,
        {
          startDate: new Date(startDate),
          endDate: new Date(endDate)
        },
        user.uid
      );

      success('Export gestart', 'Je export is gestart en wordt binnenkort verwerkt');
      await loadData();
    } catch (error) {
      console.error('Error creating export:', error);
      showError('Fout bij starten export', 'Kon export niet starten');
    } finally {
      setCreating(false);
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
      <EmptyState
        icon={Building2}
        title="Geen bedrijf geselecteerd"
        description="Selecteer een bedrijf om exports te beheren."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Exports</h1>
        <p className="text-gray-600 mt-1">
          Exporteer data naar verschillende formaten
        </p>
      </div>

      <Card>
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Export periode</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Startdatum
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Einddatum
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
              />
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {exportTypes.map((exportType) => {
          const Icon = exportType.icon;
          return (
            <Card key={exportType.type} className="hover:shadow-lg transition-shadow">
              <div className="p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-3 bg-primary-100 rounded-lg dark:bg-primary-900/20">
                    <Icon className="h-6 w-6 text-primary-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 dark:text-white">{exportType.label}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{exportType.description}</p>
                  </div>
                </div>
                <Button
                  onClick={() => handleCreateExport(exportType.type)}
                  disabled={creating}
                  className="w-full"
                  size="sm"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export maken
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {exportJobs.length > 0 && (
        <Card>
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recente exports</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Periode
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Aangemaakt
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Acties
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200 dark:divide-gray-700">
                  {exportJobs.slice(0, 10).map((job) => (
                    <tr key={job.id}>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{job.fileName}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {job.filters.startDate?.toLocaleDateString('nl-NL')} - {job.filters.endDate?.toLocaleDateString('nl-NL')}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {job.requestedAt.toLocaleDateString('nl-NL')}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          job.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' :
                          job.status === 'processing' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300' :
                          job.status === 'failed' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300' :
                          'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {job.status === 'completed' ? 'Voltooid' :
                           job.status === 'processing' ? 'Bezig' :
                           job.status === 'failed' ? 'Mislukt' :
                           'In wachtrij'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {job.status === 'completed' && job.fileUrl && (
                          <Button
                            onClick={() => window.open(job.fileUrl, '_blank')}
                            size="sm"
                            variant="secondary"
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Download
                          </Button>
                        )}
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