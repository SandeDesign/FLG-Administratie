import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Send,
  Upload,
  Receipt,
  BookOpen,
  FileInput,
  Handshake,
  Wallet,
} from 'lucide-react';
import Card from '../../components/ui/Card';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import { usePageTitle } from '../../contexts/PageTitleContext';
import { outgoingInvoiceService } from '../../services/outgoingInvoiceService';
import { incomingInvoiceService } from '../../services/incomingInvoiceService';
import { isInQuarter } from '../../utils/dateFilters';

interface CompanyKpi {
  companyId: string;
  companyName: string;
  ownerUserId: string;
  outgoingTotal: number;
  incomingTotal: number;
  btwSaldo: number;
}

const formatEuro = (value: number) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value || 0);

const BoekhouderDashboard: React.FC = () => {
  const { user } = useAuth();
  const { companies, selectedCompany, setSelectedCompany, selectedYear, selectedQuarter } = useApp();
  const navigate = useNavigate();
  usePageTitle('Boekhouder Dashboard');

  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<CompanyKpi[]>([]);

  const adminGroups = useMemo(() => {
    const map = new Map<string, { ownerUserId: string; companies: typeof companies }>();
    companies.forEach((c) => {
      const existing = map.get(c.userId) || { ownerUserId: c.userId, companies: [] as typeof companies };
      existing.companies = [...existing.companies, c];
      map.set(c.userId, existing);
    });
    return Array.from(map.values());
  }, [companies]);

  const loadKpis = useCallback(async () => {
    if (!user || companies.length === 0) {
      setKpis([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const results = await Promise.all(
        companies.map(async (company) => {
          try {
            const [outInv, inInv] = await Promise.all([
              outgoingInvoiceService.getInvoices(company.userId, company.id).catch(() => []),
              incomingInvoiceService.getInvoices(company.userId, company.id).catch(() => []),
            ]);

            const filteredOut = outInv.filter((inv: any) => {
              const d = inv.invoiceDate?.toDate ? inv.invoiceDate.toDate() : new Date(inv.invoiceDate);
              if (!d || isNaN(d.getTime())) return false;
              return isInQuarter(d, selectedYear, selectedQuarter);
            });

            const filteredIn = inInv.filter((inv: any) => {
              const d = inv.invoiceDate?.toDate ? inv.invoiceDate.toDate() : inv.invoiceDate ? new Date(inv.invoiceDate) : null;
              if (!d || isNaN(d.getTime())) return false;
              return isInQuarter(d, selectedYear, selectedQuarter);
            });

            const outgoingTotal = filteredOut.reduce((sum: number, inv: any) => sum + Number(inv.totalAmount || 0), 0);
            const incomingTotal = filteredIn.reduce((sum: number, inv: any) => sum + Number(inv.totalAmount || 0), 0);
            const outgoingVat = filteredOut.reduce((sum: number, inv: any) => sum + Number(inv.vatAmount || 0), 0);
            const incomingVat = filteredIn.reduce((sum: number, inv: any) => sum + Number(inv.vatAmount || 0), 0);
            const btwSaldo = outgoingVat - incomingVat;

            const kpi: CompanyKpi = {
              companyId: company.id,
              companyName: company.name,
              ownerUserId: company.userId,
              outgoingTotal,
              incomingTotal,
              btwSaldo,
            };
            return kpi;
          } catch (error) {
            console.error('Error loading KPIs for company', company.id, error);
            return {
              companyId: company.id,
              companyName: company.name,
              ownerUserId: company.userId,
              outgoingTotal: 0,
              incomingTotal: 0,
              btwSaldo: 0,
            } as CompanyKpi;
          }
        })
      );

      setKpis(results);
    } catch (error) {
      console.error('Error loading boekhouder KPIs:', error);
    } finally {
      setLoading(false);
    }
  }, [user, companies, selectedYear, selectedQuarter]);

  useEffect(() => {
    loadKpis();
  }, [loadKpis]);

  const totals = useMemo(() => {
    return kpis.reduce(
      (acc, k) => ({
        outgoing: acc.outgoing + k.outgoingTotal,
        incoming: acc.incoming + k.incomingTotal,
        btwSaldo: acc.btwSaldo + k.btwSaldo,
      }),
      { outgoing: 0, incoming: 0, btwSaldo: 0 }
    );
  }, [kpis]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <EmptyState
        icon={Building2}
        title="Nog geen toegang"
        description="Je bent nog niet toegewezen aan een admin. Vraag de admin om jouw e-mailadres toe te voegen bij Instellingen → Boekhouders."
      />
    );
  }

  const resultaat = totals.outgoing - totals.incoming;

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-primary-600 to-primary-700 dark:from-primary-700 dark:to-primary-900 p-6 text-white shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Boekhouder Dashboard</h1>
            <p className="mt-1 text-sm text-white/80">
              Je beheert {companies.length} bedrijf{companies.length === 1 ? '' : 'ven'} verdeeld over {adminGroups.length} administratie{adminGroups.length === 1 ? '' : 's'}
              {selectedQuarter ? ` — Q${selectedQuarter} ${selectedYear}` : ` — heel ${selectedYear}`}
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full sm:w-auto">
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3 border border-white/30 text-center">
              <p className="text-xs text-white/80">Verkoop</p>
              <p className="text-lg font-bold">{formatEuro(totals.outgoing)}</p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3 border border-white/30 text-center">
              <p className="text-xs text-white/80">Inkoop</p>
              <p className="text-lg font-bold">{formatEuro(totals.incoming)}</p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3 border border-white/30 text-center">
              <p className="text-xs text-white/80">Resultaat</p>
              <p className={`text-lg font-bold ${resultaat < 0 ? 'text-red-200' : ''}`}>{formatEuro(resultaat)}</p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3 border border-white/30 text-center">
              <p className="text-xs text-white/80">{totals.btwSaldo >= 0 ? 'BTW af te dragen' : 'BTW te ontvangen'}</p>
              <p className={`text-lg font-bold ${totals.btwSaldo < 0 ? 'text-emerald-200' : 'text-amber-200'}`}>
                {formatEuro(Math.abs(totals.btwSaldo))}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Snelle acties */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3">Snelle acties</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Verkoop', icon: Send, path: '/boekhouder/outgoing-invoices', gradient: 'from-emerald-500 to-emerald-600' },
            { label: 'Inkoop', icon: Upload, path: '/boekhouder/incoming-invoices-stats', gradient: 'from-blue-500 to-blue-600' },
            { label: 'Grootboek', icon: BookOpen, path: '/boekhouder/grootboekrekeningen', gradient: 'from-purple-500 to-purple-600' },
            { label: 'BTW', icon: Receipt, path: '/boekhouder/btw-overzicht', gradient: 'from-amber-500 to-amber-600' },
            { label: 'Bank', icon: FileInput, path: '/boekhouder/bank-statement-import', gradient: 'from-cyan-500 to-cyan-600' },
            { label: 'Uploads', icon: Upload, path: '/boekhouder/upload', gradient: 'from-primary-500 to-primary-600' },
          ].map((action) => (
            <button
              key={action.path}
              onClick={() => navigate(action.path)}
              className="group"
            >
              <div
                className={`rounded-xl p-4 bg-gradient-to-br ${action.gradient} text-white shadow-md hover:shadow-xl transition-all hover:scale-105 active:scale-95 flex flex-col items-center gap-2`}
              >
                <action.icon className="h-6 w-6" />
                <span className="text-sm font-semibold">{action.label}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Bedrijven per admin */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
          <Handshake className="h-5 w-5 text-primary-600" />
          Bedrijven die je beheert
        </h2>
        <div className="space-y-4">
          {adminGroups.map((group) => (
            <Card key={group.ownerUserId}>
              <div className="p-4">
                <div className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
                  Administratie · {group.companies.length} bedrij{group.companies.length === 1 ? 'f' : 'ven'}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {group.companies.map((company) => {
                    const kpi = kpis.find((k) => k.companyId === company.id);
                    const isSelected = selectedCompany?.id === company.id;
                    return (
                      <button
                        key={company.id}
                        onClick={() => setSelectedCompany(company)}
                        className={`text-left p-4 rounded-xl border transition-all ${
                          isSelected
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-primary-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {company.logoUrl ? (
                            <img
                              src={company.logoUrl}
                              alt={company.name}
                              className="h-10 w-10 rounded-lg object-contain bg-white border border-gray-200"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                              <Building2 className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{company.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {company.companyType}
                            </p>
                          </div>
                          {isSelected && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-primary-600 text-white font-medium">
                              Actief
                            </span>
                          )}
                        </div>
                        {kpi && (
                          <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">Verkoop</p>
                              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formatEuro(kpi.outgoingTotal)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">Inkoop</p>
                              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formatEuro(kpi.incomingTotal)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                BTW {kpi.btwSaldo >= 0 ? 'afdragen' : 'ontvangen'}
                              </p>
                              <p className={`text-sm font-semibold ${kpi.btwSaldo < 0 ? 'text-emerald-600 dark:text-emerald-400' : kpi.btwSaldo > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-gray-100'}`}>
                                {formatEuro(Math.abs(kpi.btwSaldo))}
                              </p>
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Informatie */}
      <Card>
        <div className="p-4 flex items-start gap-3">
          <Wallet className="h-5 w-5 text-primary-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <p className="font-medium text-gray-900 dark:text-gray-100 mb-1">Jouw rechten</p>
            <ul className="space-y-0.5 list-disc list-inside">
              <li>Verkoop en inkoop: inzien (read-only)</li>
              <li>Grootboek, BTW overzicht en bankafschriften: volledige toegang</li>
              <li>Uploads: facturen en post uploaden voor alle toegewezen bedrijven</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default BoekhouderDashboard;
