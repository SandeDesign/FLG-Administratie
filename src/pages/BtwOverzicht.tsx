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
      <div className="p-4 sm:p-6">
        <EmptyState icon={Shield} title="Geen toegang" description="Alleen administrators kunnen het BTW overzicht bekijken" />
      </div>
    );
  }

  const loadData = useCallback(async () => {
    if (!selectedCompany) return;
    try {
      setLoading(true);
      const [confirmed, pending, gb] = await Promise.all([
        bankImportService.getTransactionsByStatus(selectedCompany.id, 'confirmed'),
        bankImportService.getTransactionsByStatus(selectedCompany.id, 'pending'),
        supplierService.getGrootboekrekeningen(selectedCompany.id),
      ]);
      setTransactions([...confirmed, ...pending]);
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
    if (!d || isNaN(d.getTime())) return true;
    return d >= start && d <= end;
  });

  const btwRegels: BtwRegel[] = [];
  const regelMap = new Map<string, BtwRegel>();
  let ongeclassificeerd = 0;
  let ongeclassificeerdIn = 0;
  let ongeclassificeerdUit = 0;

  for (const t of periodTransactions) {
    const gbCode = t.grootboekrekening;
    if (!gbCode) {
      ongeclassificeerd++;
      if (t.amount >= 0) ongeclassificeerdIn += t.amount;
      else ongeclassificeerdUit += Math.abs(t.amount);

      const uncatKey = t.amount < 0 ? '_ongeclass_uit' : '_ongeclass_in';
      let uncatRegel = regelMap.get(uncatKey);
      if (!uncatRegel) {
        uncatRegel = {
          code: '—',
          naam: t.amount < 0 ? 'Zonder grootboek (uitgaand)' : 'Zonder grootboek (inkomend)',
          btwType: '?',
          btwPercentage: 0,
          nettoBedrag: 0,
          btwBedrag: 0,
          brutoBedrag: 0,
          transactieCount: 0,
        };
        regelMap.set(uncatKey, uncatRegel);
        btwRegels.push(uncatRegel);
      }
      uncatRegel.brutoBedrag += Math.abs(t.amount);
      uncatRegel.nettoBedrag += Math.abs(t.amount);
      uncatRegel.transactieCount++;
      continue;
    }
    const gb = gbMap.get(gbCode);
    const btwType = gb?.btw || 'geen';
    const pct = BTW_PERCENTAGES[btwType] ?? 0;

    const key = `${gbCode}_${btwType}`;
    let regel = regelMap.get(key);
    if (!regel) {
      regel = {
        code: gbCode,
        naam: gb?.name || gbCode,
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
      <div className="p-4 sm:p-6">
        <EmptyState icon={Receipt} title="Geen bedrijf geselecteerd" description="Selecteer eerst een bedrijf" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
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
          {ongeclassificeerd > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-start gap-3 p-3 sm:p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                  <Receipt className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                    {ongeclassificeerd} van {periodTransactions.length} zonder grootboekrekening
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                    {fmt(ongeclassificeerdIn)} in / {fmt(ongeclassificeerdUit)} uit
                  </p>
                </div>
              </div>
              <span className="inline-flex self-start items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 flex-shrink-0">
                {Math.round(((periodTransactions.length - ongeclassificeerd) / periodTransactions.length) * 100)}%
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
            <Card>
              <div className="p-3 sm:p-4">
                <div className="flex items-center gap-2 mb-1 sm:mb-2">
                  <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />
                  <h3 className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Af te dragen BTW</h3>
                </div>
                <div className="text-xl sm:text-2xl font-bold text-red-600 dark:text-red-400">{fmt(totalAfdracht)}</div>
                <p className="text-[10px] sm:text-xs text-gray-500 mt-1">BTW op verkopen/inkomsten</p>
              </div>
            </Card>
            <Card>
              <div className="p-3 sm:p-4">
                <div className="flex items-center gap-2 mb-1 sm:mb-2">
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
                  <h3 className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Voorbelasting</h3>
                </div>
                <div className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400">{fmt(totalVoorbelasting)}</div>
                <p className="text-[10px] sm:text-xs text-gray-500 mt-1">BTW op inkopen/kosten</p>
              </div>
            </Card>
            <Card>
              <div className="p-3 sm:p-4">
                <div className="flex items-center gap-2 mb-1 sm:mb-2">
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
                  <h3 className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">
                    {saldo >= 0 ? 'Te betalen' : 'Terug te ontvangen'}
                  </h3>
                </div>
                <div className={`text-xl sm:text-2xl font-bold ${saldo >= 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                  {fmt(Math.abs(saldo))}
                </div>
                <p className="text-[10px] sm:text-xs text-gray-500 mt-1">
                  {periodTransactions.length} transacties in periode
                </p>
              </div>
            </Card>
          </div>

          {btwRegels.length > 0 ? (
            <Card>
              <div className="p-3 sm:p-4">
                <h2 className="text-sm sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">
                  Specificatie per grootboekrekening
                </h2>

                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
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
                      {btwRegels.sort((a, b) => a.code.localeCompare(b.code)).map((r, i) => {
                        const isUncat = r.btwType === '?';
                        return (
                          <tr key={i} className={`border-b last:border-0 ${isUncat ? 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30' : 'border-gray-50 dark:border-gray-800'}`}>
                            <td className={`py-2 px-3 font-mono font-bold ${isUncat ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'}`}>{r.code}</td>
                            <td className={`py-2 px-3 ${isUncat ? 'text-amber-700 dark:text-amber-300 italic' : 'text-gray-900 dark:text-white'}`}>{r.naam}</td>
                            <td className="py-2 px-3">
                              {isUncat ? (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                  onbekend
                                </span>
                              ) : (
                                <span className={`text-xs px-1.5 py-0.5 rounded ${
                                  r.btwType === 'hoog' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                                  r.btwType === 'laag' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                                  r.btwType === 'verlegd' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
                                  'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                }`}>
                                  {r.btwType} {r.btwPercentage > 0 ? `(${r.btwPercentage}%)` : ''}
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-right text-gray-900 dark:text-white">{fmt(r.nettoBedrag)}</td>
                            <td className={`py-2 px-3 text-right font-medium ${isUncat ? 'text-gray-400' : r.btwBedrag > 0 ? 'text-green-600' : r.btwBedrag < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                              {isUncat ? '—' : fmt(r.btwBedrag)}
                            </td>
                            <td className="py-2 px-3 text-right text-gray-900 dark:text-white">{fmt(r.brutoBedrag)}</td>
                            <td className="py-2 px-3 text-right text-gray-500">{r.transactieCount}</td>
                          </tr>
                        );
                      })}
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

                {/* Mobile card list */}
                <div className="md:hidden space-y-2">
                  {btwRegels.sort((a, b) => a.code.localeCompare(b.code)).map((r, i) => {
                    const isUncat = r.btwType === '?';
                    return (
                      <div key={i} className={`p-3 rounded-lg ${isUncat ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800' : 'bg-gray-50 dark:bg-gray-800/50'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`font-mono text-xs font-bold ${isUncat ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'}`}>{r.code}</span>
                            <span className={`text-xs truncate ${isUncat ? 'text-amber-700 dark:text-amber-300 italic' : 'text-gray-900 dark:text-white'}`}>{r.naam}</span>
                          </div>
                          {isUncat ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                              onbekend
                            </span>
                          ) : (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${
                              r.btwType === 'hoog' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                              r.btwType === 'laag' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                              r.btwType === 'verlegd' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
                              'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                            }`}>
                              {r.btwType}{r.btwPercentage > 0 ? ` ${r.btwPercentage}%` : ''}
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <span className="text-gray-500 block">Netto</span>
                            <span className="font-medium text-gray-900 dark:text-white">{fmt(r.nettoBedrag)}</span>
                          </div>
                          <div>
                            <span className="text-gray-500 block">BTW</span>
                            <span className={`font-medium ${isUncat ? 'text-gray-400' : r.btwBedrag > 0 ? 'text-green-600' : r.btwBedrag < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                              {isUncat ? '—' : fmt(r.btwBedrag)}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-gray-500 block">Bruto</span>
                            <span className="font-medium text-gray-900 dark:text-white">{fmt(r.brutoBedrag)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Mobile totaal */}
                  <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg border-t-2 border-gray-300 dark:border-gray-500">
                    <div className="text-xs font-semibold text-gray-900 dark:text-white mb-2">Totaal</div>
                    <div className="grid grid-cols-3 gap-2 text-xs font-semibold">
                      <div>
                        <span className="text-gray-500 block">Netto</span>
                        <span className="text-gray-900 dark:text-white">{fmt(btwRegels.reduce((s, r) => s + r.nettoBedrag, 0))}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block">BTW</span>
                        <span className="text-gray-900 dark:text-white">{fmt(btwRegels.reduce((s, r) => s + r.btwBedrag, 0))}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-gray-500 block">Bruto</span>
                        <span className="text-gray-900 dark:text-white">{fmt(btwRegels.reduce((s, r) => s + r.brutoBedrag, 0))}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="p-6 sm:p-8 text-center">
                <Receipt className="w-10 h-10 sm:w-12 sm:h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                {ongeclassificeerd > 0 ? (
                  <>
                    <p className="text-sm text-gray-900 dark:text-white font-medium">
                      {ongeclassificeerd} transacties zonder grootboekrekening
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Wijs grootboekrekeningen toe via Bankafschrift Import.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Geen geboekte transacties in deze periode.
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      Importeer bankafschriften en wijs grootboekrekeningen toe.
                    </p>
                  </>
                )}
              </div>
            </Card>
          )}

          {periodTransactions.length > 0 && (
            <Card>
              <div className="p-3 sm:p-4">
                <details>
                  <summary className="cursor-pointer flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
                    <h2 className="text-sm sm:text-lg font-semibold text-gray-900 dark:text-white">
                      Transacties ({periodTransactions.length})
                    </h2>
                    <div className="flex items-center gap-3 text-xs sm:text-sm">
                      <span className="text-green-600 dark:text-green-400 font-medium">
                        <TrendingUp className="w-3 h-3 sm:w-3.5 sm:h-3.5 inline mr-0.5" />
                        {fmt(ongeclassificeerdIn + btwRegels.filter(r => r.brutoBedrag < 0).reduce((s, r) => s + Math.abs(r.brutoBedrag), 0))} in
                      </span>
                      <span className="text-red-600 dark:text-red-400 font-medium">
                        <TrendingDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 inline mr-0.5" />
                        {fmt(ongeclassificeerdUit + btwRegels.filter(r => r.brutoBedrag > 0).reduce((s, r) => s + r.brutoBedrag, 0))} uit
                      </span>
                    </div>
                  </summary>

                  {/* Desktop table */}
                  <div className="mt-3 hidden sm:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                          <th className="text-left py-2 px-2">Datum</th>
                          <th className="text-left py-2 px-2">Begunstigde</th>
                          <th className="text-left py-2 px-2">Omschrijving</th>
                          <th className="text-left py-2 px-2">Grootboek</th>
                          <th className="text-right py-2 px-2">Bedrag</th>
                        </tr>
                      </thead>
                      <tbody>
                        {periodTransactions
                          .sort((a, b) => {
                            const da = a.date instanceof Date ? a.date.getTime() : a.date;
                            const dbb = b.date instanceof Date ? b.date.getTime() : b.date;
                            return (da as number) - (dbb as number);
                          })
                          .map((t, i) => {
                            const d = t.date instanceof Date ? t.date : new Date(t.date);
                            return (
                              <tr key={i} className="border-b border-gray-50 dark:border-gray-800 last:border-0">
                                <td className="py-1.5 px-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                  {formatDate(d, 'dd-MM-yyyy')}
                                </td>
                                <td className="py-1.5 px-2 text-gray-900 dark:text-white truncate max-w-[150px]">
                                  {t.beneficiary || '-'}
                                </td>
                                <td className="py-1.5 px-2 text-gray-600 dark:text-gray-400 truncate max-w-[250px]">
                                  {t.matchedInvoiceNumber || t.description?.substring(0, 60) || '-'}
                                </td>
                                <td className="py-1.5 px-2">
                                  {t.grootboekrekening ? (
                                    <span className="text-xs font-mono text-blue-600 dark:text-blue-400">{t.grootboekrekening}</span>
                                  ) : (
                                    <span className="text-xs text-amber-600 dark:text-amber-400">—</span>
                                  )}
                                </td>
                                <td className={`py-1.5 px-2 text-right font-medium whitespace-nowrap ${t.amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                  {t.amount >= 0 ? '+' : ''}{fmt(t.amount)}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile card list */}
                  <div className="mt-3 sm:hidden space-y-1">
                    {periodTransactions
                      .sort((a, b) => {
                        const da = a.date instanceof Date ? a.date.getTime() : a.date;
                        const dbb = b.date instanceof Date ? b.date.getTime() : b.date;
                        return (da as number) - (dbb as number);
                      })
                      .map((t, i) => {
                        const d = t.date instanceof Date ? t.date : new Date(t.date);
                        return (
                          <div key={i} className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 text-[10px] text-gray-500 mb-0.5">
                                  <span>{formatDate(d, 'dd-MM-yyyy')}</span>
                                  {t.grootboekrekening && (
                                    <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">{t.grootboekrekening}</span>
                                  )}
                                  {!t.grootboekrekening && (
                                    <span className="text-amber-500">geen GB</span>
                                  )}
                                </div>
                                <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                                  {t.beneficiary || '-'}
                                </p>
                                <p className="text-[10px] text-gray-500 truncate mt-0.5">
                                  {t.matchedInvoiceNumber || t.description?.substring(0, 50) || '-'}
                                </p>
                              </div>
                              <span className={`text-xs font-semibold flex-shrink-0 ${t.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {t.amount >= 0 ? '+' : ''}{fmt(t.amount)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </details>
              </div>
            </Card>
          )}

          <Card>
            <div className="p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Dagboek Export
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Exporteer voor je boekhoudpakket
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={exportFormat}
                    onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
                    className="flex-1 sm:flex-none px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    <option value="csv">Algemeen CSV</option>
                    <option value="exact_online">Exact Online</option>
                    <option value="snelstart">SnelStart</option>
                    <option value="twinfield">Twinfield</option>
                  </select>
                  <Button onClick={handleExportDagboek} disabled={exporting || periodTransactions.length === 0} variant="outline" className="flex-shrink-0">
                    {exporting ? <LoadingSpinner size="sm" /> : <><Download className="w-4 h-4 mr-1" />Export</>}
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
