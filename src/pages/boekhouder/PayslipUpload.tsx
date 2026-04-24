import React, { useState, useEffect, useMemo } from 'react';
import { FileText, Upload, Calendar, User, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import { usePageTitle } from '../../contexts/PageTitleContext';
import { useToast } from '../../hooks/useToast';
import { getEmployees } from '../../services/firebase';
import { uploadPayslipForEmployee, getPayslips } from '../../services/payslipService';
import { Employee } from '../../types';
import { Payslip } from '../../types/payslip';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';

const MONTHS = [
  'januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december',
];

const PayslipUpload: React.FC = () => {
  const { user } = useAuth();
  const { selectedCompany } = useApp();
  const { success, error: showError } = useToast();
  usePageTitle('Loonstroken uploaden');

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [month, setMonth] = useState<number>(new Date().getMonth()); // 0-11
  const [paymentDate, setPaymentDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Recente uploads voor de geselecteerde medewerker — kort lijstje ter
  // bevestiging dat er al iets staat.
  const [recent, setRecent] = useState<Payslip[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!selectedCompany) {
        setEmployees([]);
        setLoadingEmployees(false);
        return;
      }
      try {
        setLoadingEmployees(true);
        // Boekhouder: laad employees onder de admin-UID van het bedrijf
        const list = await getEmployees(selectedCompany.userId, selectedCompany.id);
        setEmployees(list.filter((e) => e.status === 'active' || !e.status));
      } catch (err) {
        console.error('[PayslipUpload] employees load error:', err);
        showError('Kon werknemers niet laden');
      } finally {
        setLoadingEmployees(false);
      }
    };
    load();
    setSelectedEmployeeId('');
  }, [selectedCompany, showError]);

  // Haal recente uploads op zodra er een werknemer gekozen is.
  useEffect(() => {
    const load = async () => {
      if (!selectedCompany || !selectedEmployeeId) {
        setRecent([]);
        return;
      }
      try {
        setLoadingRecent(true);
        const all = await getPayslips(selectedCompany.userId, selectedEmployeeId);
        setRecent(all.sort((a, b) => b.periodStartDate.getTime() - a.periodStartDate.getTime()).slice(0, 6));
      } catch (err) {
        console.warn('[PayslipUpload] recent load error:', err);
      } finally {
        setLoadingRecent(false);
      }
    };
    load();
  }, [selectedCompany, selectedEmployeeId]);

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === selectedEmployeeId) || null,
    [employees, selectedEmployeeId]
  );

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.type !== 'application/pdf') {
      showError('Alleen PDF-bestanden toegestaan');
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      showError('Bestand te groot (max 5 MB)');
      return;
    }
    setFile(f);
  };

  const handleUpload = async () => {
    if (!user || !selectedCompany || !selectedEmployeeId || !file) return;
    const periodStart = new Date(year, month, 1);
    const periodEnd = new Date(year, month + 1, 0); // laatste dag van de maand
    const payDate = paymentDate ? new Date(paymentDate) : periodEnd;

    try {
      setUploading(true);
      await uploadPayslipForEmployee({
        adminUserId: selectedCompany.userId,
        employeeId: selectedEmployeeId,
        companyId: selectedCompany.id,
        companyName: selectedCompany.name,
        employeeCode: selectedEmployee
          ? `${selectedEmployee.personalInfo.firstName}-${selectedEmployee.personalInfo.lastName}`
          : undefined,
        file,
        periodStartDate: periodStart,
        periodEndDate: periodEnd,
        paymentDate: payDate,
        generatedBy: user.uid,
      });
      success('Loonstrook geüpload', `${MONTHS[month]} ${year} opgeslagen voor ${selectedEmployee?.personalInfo.firstName || 'medewerker'}`);
      setFile(null);
      // Reload recente lijst
      const all = await getPayslips(selectedCompany.userId, selectedEmployeeId);
      setRecent(all.sort((a, b) => b.periodStartDate.getTime() - a.periodStartDate.getTime()).slice(0, 6));
    } catch (err) {
      console.error('[PayslipUpload] upload failed:', err);
      showError('Uploaden mislukt');
    } finally {
      setUploading(false);
    }
  };

  if (!selectedCompany) {
    return (
      <EmptyState
        icon={FileText}
        title="Geen bedrijf geselecteerd"
        description="Selecteer eerst een bedrijf waarvoor je loonstroken wil uploaden."
      />
    );
  }

  // Alleen zinnig voor een loonmaatschappij (employer). Toon duidelijke melding
  // als er een ander bedrijfstype actief is.
  if (selectedCompany.companyType !== 'employer') {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Geen loonmaatschappij"
        description="Loonstroken uploaden is alleen beschikbaar voor loonmaatschappijen (employer)."
      />
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="hidden lg:block">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary-600" />
          Loonstroken uploaden
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Voor {selectedCompany.name} — kies een medewerker en upload de maandlooncheck als PDF.
        </p>
      </div>

      <Card>
        <div className="p-4 sm:p-6 space-y-4">
          {/* Werknemer */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Medewerker
            </label>
            {loadingEmployees ? (
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Laden…
              </div>
            ) : employees.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Geen actieve medewerkers gevonden voor dit bedrijf.
              </p>
            ) : (
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                <option value="">— Kies medewerker —</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.personalInfo.firstName} {emp.personalInfo.lastName}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Periode */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Maand
              </label>
              <select
                value={month}
                onChange={(e) => setMonth(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                {MONTHS.map((m, i) => (
                  <option key={i} value={i}>
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Jaar
              </label>
              <select
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                {Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - 3 + i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Uitbetaaldatum
              </label>
              <div className="relative">
                <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
          </div>

          {/* Bestand */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Loonstrook PDF
            </label>
            <label className="flex items-center gap-3 p-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-primary-400 transition-colors bg-gray-50 dark:bg-gray-900/40">
              <Upload className="h-5 w-5 text-primary-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {file ? file.name : 'Klik om een PDF te kiezen'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Max 5 MB, alleen PDF</p>
              </div>
              <input type="file" accept="application/pdf" className="hidden" onChange={handleFile} />
            </label>
          </div>

          {/* Upload knop */}
          <div className="flex justify-end gap-2">
            <Button
              onClick={handleUpload}
              disabled={!selectedEmployeeId || !file || uploading}
              loading={uploading}
              icon={Upload}
            >
              {uploading ? 'Uploaden…' : 'Uploaden'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Recente uploads voor deze werknemer */}
      {selectedEmployeeId && (
        <Card>
          <div className="p-4 sm:p-6">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
              <User className="h-4 w-4 text-primary-600" />
              Recente loonstroken van {selectedEmployee ? `${selectedEmployee.personalInfo.firstName} ${selectedEmployee.personalInfo.lastName}` : 'deze medewerker'}
            </h2>
            {loadingRecent ? (
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Laden…
              </div>
            ) : recent.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Nog geen loonstroken geüpload.</p>
            ) : (
              <div className="space-y-2">
                {recent.map((p) => (
                  <a
                    key={p.id}
                    href={p.pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary-400 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors text-sm"
                  >
                    <FileText className="h-4 w-4 text-primary-600 flex-shrink-0" />
                    <span className="flex-1 min-w-0 truncate text-gray-900 dark:text-gray-100">
                      {MONTHS[p.periodStartDate.getMonth()].charAt(0).toUpperCase() + MONTHS[p.periodStartDate.getMonth()].slice(1)} {p.periodStartDate.getFullYear()}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> {p.pdfUrl ? 'Beschikbaar' : 'Zonder PDF'}
                    </span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};

export default PayslipUpload;
