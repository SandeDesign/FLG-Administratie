import React, { useState, useEffect, useCallback } from 'react';
import {
  Receipt,
  Download,
  Shield,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  FileText,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useToast } from '../hooks/useToast';
import { EmptyState } from '../components/ui/EmptyState';
import { usePageTitle } from '../contexts/PageTitleContext';
import PeriodSelector from '../components/ui/PeriodSelector';
import { bankImportService } from '../services/bankImportService';
import { supplierService } from '../services/supplierService';
import { dagboekExportService, ExportFormat } from '../services/dagboekExportService';
import { BankTransaction } from '../types/bankImport';
import { Grootboekrekening } from '../types/supplier';
import { getQuarterDateRange } from '../utils/dateFilters';
import { format as formatDate } from 'date-fns';

interface BtwRegel {
  code: string;
  naam: string;
  btwType: string;
  btwPercentage: number;
  nettoBedrag: number;
  btwBedrag: number;
  brutoBedrag: number;
  transactieCount: number;
}

const BTW_PERCENTAGES: Record<string, number> = {
  hoog: 21,
  laag: 9,
  geen: 0,
  verlegd: 0,
};

const BtwOverzicht: React.FC = () => {
  const { userRole } = useAuth();
  const { selectedCompany, selectedYear, selectedQuarter } = useApp();
  const { success, error: showError } = useToast();
  usePageTitle('BTW Overzicht');

  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [grootboekrekeningen, setGrootboekrekeningen] = useState<Grootboekrekening[]>([]);
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv');

  if (userRole !== 'admin') {
    return (
      <div className="p-6">
        <EmptyState icon={Shield} title="Geen toegang" description="Alleen administrators kunnen het BTW overzicht bekijken" />
      </div>
    );
  }

  const loadData = useCallback(async () => {
    if (!selectedCompany) return;
    try {
      setLoading(true);
      const [confirmed, gb] = await Promise.all([
        bankImportService.getTransactionsByStatus(selectedCompany.id, 'confirmed'),
        supplierService.getGrootboekrekeningen(selectedCompany.id),
      ]);
      setTransactions(confirmed);
      setGrootboekrekeningen(gb);
    } catch (e) {
      console.error('Error loading BTW data:', e);
    } finally {
      setLoading(false);
    }
  }, [selectedCompany]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const { start, end } = getQuarterDateRange(selectedYear, selectedQuarter);
  const gbMap = new Map(grootboekrekeningen.map(g => [g.code, g]));

  const periodTransactions = transactions.filter(t => {
    const d = t.date instanceof Date ? t.date : new Date(t.date);
    return d >= start && d <= end;
  });

  const btwRegels: BtwRegel[] = [];
  const regelMap = new Map<string, BtwRegel>();

  for (const t of periodTransactions) {
    const gbCode = t.grootboekrekening;
    if (!gbCode) continue;
    const gb = gbMap.get(gbCode);
    if (!gb) continue;
    const btwType = gb.btw || 'geen';
    const pct = BTW_PERCENTAGES[btwType] ?? 0;

    const key = `${gbCode}_${btwType}`;
    let regel = regelMap.get(key);
    if (!regel) {
      regel = {
        code: gbCode,
        naam: gb.name,
        btwType,
        btwPercentage: pct,
        nettoBedrag: 0,
        btwBedrag: 0,
        brutoBedrag: 0,
        transactieCount: 0,
      };
      regelMap.set(key, regel);
      btwRegels.push(regel);
    }

    const absAmount = Math.abs(t.amount);
    const netto = pct > 0 ? absAmount / (1 + pct / 100) : absAmount;
    const btw = absAmount - netto;

    if (t.amount < 0) {
      regel.nettoBedrag += netto;
      regel.btwBedrag += btw;
      regel.brutoBedrag += absAmount;
    } else {
      regel.nettoBedrag -= netto;
      regel.btwBedrag -= btw;
      regel.brutoBedrag -= absAmount;
    }
    regel.transactieCount++;
  }

  const totalVoorbelasting = btwRegels
    .filter(r => r.btwBedrag > 0)
    .reduce((sum, r) => sum + r.btwBedrag, 0);

  const totalAfdracht = btwRegels
    .filter(r => r.btwBedrag < 0)
    .reduce((sum, r) => sum + Math.abs(r.btwBedrag), 0);

  const saldo = totalAfdracht - totalVoorbelasting;

  const handleExportDagboek = async () => {
    if (!selectedCompany) return;
    try {
      setExporting(true);
      const regels = await dagboekExportService.buildDagboekRegels(
        selectedCompany.id,
        periodTransactions,
        grootboekrekeningen
      );
      const csv = dagboekExportService.generateCSV(regels, exportFormat);
      const periodLabel = selectedQuarter ? `Q${selectedQuarter}` : 'jaar';
      dagboekExportService.downloadCSV(csv, `Dagboek_${selectedCompany.name}_${selectedYear}_${periodLabel}.csv`);
      success('Geëxporteerd', `Dagboek export (${exportFormat}) gedownload`);
    } catch (e: any) {
      showError('Fout', e.message || 'Kon dagboek niet exporteren');
    } finally {
      setExporting(false);
    }
  };

  const fmt = (n: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n);

  if (!selectedCompany) {
    return (
      <div className="p-6">
        <EmptyState icon={Receipt} title="Geen bedrijf geselecteerd" description="Selecteer eerst een bedrijf" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="hidden lg:block">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">BTW Overzicht</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            BTW aangifte overzicht op basis van geboekte transacties
          </p>
        </div>
      </div>

      <PeriodSelector />

      {loading ? (
        <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="w-5 h-5 text-red-500" />
                  <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Af te dragen BTW</h3>
                </div>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">{fmt(totalAfdracht)}</div>
                <p className="text-xs text-gray-500 mt-1">BTW op verkopen/inkomsten</p>
              </div>
            </Card>
            <Card>
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                  <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Voorbelasting</h3>
                </div>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{fmt(totalVoorbelasting)}</div>
                <p className="text-xs text-gray-500 mt-1">BTW op inkopen/kosten</p>
              </div>
            </Card>
            <Card>
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowRight className="w-5 h-5 text-blue-500" />
                  <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {saldo >= 0 ? 'Te betalen' : 'Terug te ontvangen'}
                  </h3>
                </div>
                <div className={`text-2xl font-bold ${saldo >= 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                  {fmt(Math.abs(saldo))}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {periodTransactions.length} geboekte transacties in periode
                </p>
              </div>
            </Card>
          </div>

          {btwRegels.length > 0 ? (
            <Card>
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Specificatie per grootboekrekening</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400">
                        <th className="text-left py-2 px-3">Code</th>
                        <th className="text-left py-2 px-3">Rekening</th>
                        <th className="text-left py-2 px-3">BTW</th>
                        <th className="text-right py-2 px-3">Netto</th>
                        <th className="text-right py-2 px-3">BTW bedrag</th>
                        <th className="text-right py-2 px-3">Bruto</th>
                        <th className="text-right py-2 px-3">#</th>
                      </tr>
                    </thead>
                    <tbody>
                      {btwRegels.sort((a, b) => a.code.localeCompare(b.code)).map((r, i) => (
                        <tr key={i} className="border-b border-gray-50 dark:border-gray-800 last:border-0">
                          <td className="py-2 px-3 font-mono text-blue-600 dark:text-blue-400 font-bold">{r.code}</td>
                          <td className="py-2 px-3 text-gray-900 dark:text-white">{r.naam}</td>
                          <td className="py-2 px-3">
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              r.btwType === 'hoog' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                              r.btwType === 'laag' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                              r.btwType === 'verlegd' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
                              'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                            }`}>
                              {r.btwType} {r.btwPercentage > 0 ? `(${r.btwPercentage}%)` : ''}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right text-gray-900 dark:text-white">{fmt(r.nettoBedrag)}</td>
                          <td className={`py-2 px-3 text-right font-medium ${r.btwBedrag > 0 ? 'text-green-600' : r.btwBedrag < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                            {fmt(r.btwBedrag)}
                          </td>
                          <td className="py-2 px-3 text-right text-gray-900 dark:text-white">{fmt(r.brutoBedrag)}</td>
                          <td className="py-2 px-3 text-right text-gray-500">{r.transactieCount}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-300 dark:border-gray-600 font-semibold">
                        <td colSpan={3} className="py-2 px-3 text-gray-900 dark:text-white">Totaal</td>
                        <td className="py-2 px-3 text-right text-gray-900 dark:text-white">
                          {fmt(btwRegels.reduce((s, r) => s + r.nettoBedrag, 0))}
                        </td>
                        <td className="py-2 px-3 text-right text-gray-900 dark:text-white">
                          {fmt(btwRegels.reduce((s, r) => s + r.btwBedrag, 0))}
                        </td>
                        <td className="py-2 px-3 text-right text-gray-900 dark:text-white">
                          {fmt(btwRegels.reduce((s, r) => s + r.brutoBedrag, 0))}
                        </td>
                        <td className="py-2 px-3 text-right text-gray-500">
                          {btwRegels.reduce((s, r) => s + r.transactieCount, 0)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="p-8 text-center">
                <Receipt className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-600 dark:text-gray-400">
                  Geen geboekte transacties met grootboekrekening in deze periode.
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                  Importeer bankafschriften en wijs grootboekrekeningen toe.
                </p>
              </div>
            </Card>
          )}

          <Card>
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Dagboek Export
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Exporteer geboekte transacties voor je boekhoudpakket
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={exportFormat}
                    onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
                    className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    <option value="csv">Algemeen CSV</option>
                    <option value="exact_online">Exact Online</option>
                    <option value="snelstart">SnelStart</option>
                    <option value="twinfield">Twinfield</option>
                  </select>
                  <Button onClick={handleExportDagboek} disabled={exporting || periodTransactions.length === 0} variant="outline">
                    {exporting ? <LoadingSpinner size="sm" /> : <><Download className="w-4 h-4 mr-1" />Exporteer</>}
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
};

export default BtwOverzicht;
