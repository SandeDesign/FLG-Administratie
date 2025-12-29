import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Clock,
  CheckCircle,
  Zap,
  Factory,
  Upload,
  TrendingUp,
  Euro,
  FileText,
  Package,
} from 'lucide-react';
import Card from '../components/ui/Card';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';

interface ProductionWeek {
  id: string;
  weekNumber: number;
  year: number;
  totalProduced: number;
  totalValue: number;
  status: string;
  createdAt: any;
}

interface IncomingInvoice {
  id: string;
  supplierName: string;
  invoiceNumber: string;
  totalAmount: number;
  status: string;
  createdAt: any;
}

const ManagerDashboard: React.FC = () => {
  const { user } = useAuth();
  const { selectedCompany, queryUserId, employees } = useApp();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [productionWeeks, setProductionWeeks] = useState<ProductionWeek[]>([]);
  const [incomingInvoices, setIncomingInvoices] = useState<IncomingInvoice[]>([]);
  const [stats, setStats] = useState({
    totalTeam: 0,
    activeMembers: 0,
    totalProduction: 0,
    totalProductionValue: 0,
    totalInvoices: 0,
    totalInvoiceAmount: 0,
  });

  const isProjectCompany = selectedCompany?.companyType === 'project' || selectedCompany?.companyType === 'work_company';

  const loadData = useCallback(async () => {
    if (!user || !selectedCompany || !queryUserId) return;

    try {
      setLoading(true);

      // Filter employees
      let filteredEmployees = employees;
      if (isProjectCompany) {
        filteredEmployees = employees.filter(emp =>
          emp.workCompanies?.includes(selectedCompany.id) ||
          emp.projectCompanies?.includes(selectedCompany.id)
        );
      } else {
        filteredEmployees = employees.filter(emp => emp.companyId === selectedCompany.id);
      }
      setTeamMembers(filteredEmployees.slice(0, 8));

      // Load production weeks
      let productionData: ProductionWeek[] = [];
      let totalProduction = 0;
      let totalProductionValue = 0;

      if (isProjectCompany) {
        try {
          const productionQuery = query(
            collection(db, 'productionWeeks'),
            where('companyId', '==', selectedCompany.id),
            orderBy('createdAt', 'desc'),
            limit(5)
          );
          const productionSnap = await getDocs(productionQuery);
          productionData = productionSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductionWeek));
          productionData.forEach(pw => {
            totalProduction += pw.totalProduced || 0;
            totalProductionValue += pw.totalValue || 0;
          });
        } catch (e) {
          console.log('Could not load production data:', e);
        }
      }

      // Load incoming invoices
      let invoiceData: IncomingInvoice[] = [];
      let totalInvoiceAmount = 0;

      try {
        const invoiceQuery = query(
          collection(db, 'incomingInvoices'),
          where('companyId', '==', selectedCompany.id),
          orderBy('createdAt', 'desc'),
          limit(5)
        );
        const invoiceSnap = await getDocs(invoiceQuery);
        invoiceData = invoiceSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as IncomingInvoice));
        invoiceData.forEach(inv => { totalInvoiceAmount += inv.totalAmount || 0; });
      } catch (e) {
        console.log('Could not load invoice data:', e);
      }

      setProductionWeeks(productionData);
      setIncomingInvoices(invoiceData);
      setStats({
        totalTeam: filteredEmployees.length,
        activeMembers: filteredEmployees.filter(e => e.status === 'active').length,
        totalProduction,
        totalProductionValue,
        totalInvoices: invoiceData.length,
        totalInvoiceAmount,
      });
    } catch (error) {
      console.error('Error loading manager data:', error);
    } finally {
      setLoading(false);
    }
  }, [user, selectedCompany, queryUserId, employees, isProjectCompany]);

  useEffect(() => { loadData(); }, [loadData]);

  if (!selectedCompany) {
    return <div className="text-center py-12"><p className="text-gray-600 dark:text-gray-400">Selecteer een bedrijf</p></div>;
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><LoadingSpinner /></div>;
  }

  return (
    <div className="space-y-8 pb-24 sm:pb-0">
      {/* Header */}
      <div className={`bg-gradient-to-r ${isProjectCompany ? 'from-emerald-600 to-emerald-700' : 'from-indigo-600 to-indigo-700'} rounded-2xl p-8 text-white shadow-lg`}>
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold mb-2">{isProjectCompany ? 'Project Dashboard' : 'Manager Dashboard'}</h1>
            <p className={`${isProjectCompany ? 'text-emerald-100' : 'text-indigo-100'} flex items-center gap-2`}>
              {isProjectCompany ? <Factory className="h-4 w-4" /> : <Users className="h-4 w-4" />}
              {selectedCompany?.name || 'Bedrijf'}
            </p>
          </div>
          <div className="h-16 w-16 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center">
            {isProjectCompany ? <Factory className="h-8 w-8 text-white" /> : <Users className="h-8 w-8 text-white" />}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 backdrop-blur-sm rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-white/80" />
              <p className="text-xs text-white/80">Team</p>
            </div>
            <p className="text-2xl font-bold text-white">{stats.totalTeam}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 backdrop-blur-sm rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-white/80" />
              <p className="text-xs text-white/80">Actief</p>
            </div>
            <p className="text-2xl font-bold text-white">{stats.activeMembers}</p>
          </div>
          {isProjectCompany && (
            <>
              <div className="bg-white dark:bg-gray-800 backdrop-blur-sm rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="h-4 w-4 text-white/80" />
                  <p className="text-xs text-white/80">Productie</p>
                </div>
                <p className="text-2xl font-bold text-white">{stats.totalProduction}</p>
              </div>
              <div className="bg-white dark:bg-gray-800 backdrop-blur-sm rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Euro className="h-4 w-4 text-white/80" />
                  <p className="text-xs text-white/80">Waarde</p>
                </div>
                <p className="text-2xl font-bold text-white">€{stats.totalProductionValue.toLocaleString()}</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <Zap className="h-6 w-6 text-amber-500" />
          Snelle Acties
        </h2>
        <div className="grid grid-cols-2 gap-4">
          {isProjectCompany ? (
            <>
              <button onClick={() => navigate('/project-production')} className="group">
                <div className="rounded-xl p-6 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95">
                  <div className="flex flex-col items-center text-center">
                    <div className="p-4 bg-emerald-100 rounded-xl mb-3 group-hover:scale-110 transition-transform">
                      <Factory className="h-6 w-6 text-emerald-600" />
                    </div>
                    <h3 className="font-bold text-sm mb-1">Productie</h3>
                    <p className="text-xs text-white/80">Overzicht</p>
                  </div>
                </div>
              </button>
              <button onClick={() => navigate('/incoming-invoices')} className="group">
                <div className="rounded-xl p-6 bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95">
                  <div className="flex flex-col items-center text-center">
                    <div className="p-4 bg-primary-100 rounded-xl mb-3 group-hover:scale-110 transition-transform">
                      <Upload className="h-6 w-6 text-primary-600" />
                    </div>
                    <h3 className="font-bold text-sm mb-1">Inkoop</h3>
                    <p className="text-xs text-white/80">Facturen</p>
                  </div>
                </div>
              </button>
            </>
          ) : (
            <>
              <button onClick={() => navigate('/timesheet-approvals')} className="group">
                <div className="rounded-xl p-6 bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95">
                  <div className="flex flex-col items-center text-center">
                    <div className="p-4 bg-primary-100 rounded-xl mb-3 group-hover:scale-110 transition-transform">
                      <Clock className="h-6 w-6 text-primary-600" />
                    </div>
                    <h3 className="font-bold text-sm mb-1">Uren</h3>
                    <p className="text-xs text-white/80">Goedkeuren</p>
                  </div>
                </div>
              </button>
              <button onClick={() => navigate('/employees')} className="group">
                <div className="rounded-xl p-6 bg-gradient-to-br from-green-500 to-green-600 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95">
                  <div className="flex flex-col items-center text-center">
                    <div className="p-4 bg-green-100 rounded-xl mb-3 group-hover:scale-110 transition-transform">
                      <Users className="h-6 w-6 text-green-600" />
                    </div>
                    <h3 className="font-bold text-sm mb-1">Team</h3>
                    <p className="text-xs text-white/80">Beheren</p>
                  </div>
                </div>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Production Overview */}
      {isProjectCompany && productionWeeks.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-emerald-600" />
              Recente Productie
            </h2>
            <button onClick={() => navigate('/project-production')} className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">
              Alles bekijken →
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {productionWeeks.map((week) => (
              <Card key={week.id} className="p-4 hover:shadow-lg transition">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-emerald-100 rounded-lg">
                      <Factory className="h-4 w-4 text-emerald-600" />
                    </div>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">Week {week.weekNumber}</span>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${week.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {week.status === 'completed' ? 'Afgerond' : 'Open'}
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Geproduceerd:</span>
                    <span className="font-medium">{week.totalProduced || 0} stuks</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Waarde:</span>
                    <span className="font-medium text-emerald-600">€{(week.totalValue || 0).toLocaleString()}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Incoming Invoices */}
      {incomingInvoices.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary-600" />
              Recente Inkoopbonnen
            </h2>
            <button onClick={() => navigate('/incoming-invoices')} className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              Alles bekijken →
            </button>
          </div>
          <Card className="divide-y divide-gray-100 dark:divide-gray-700">
            {incomingInvoices.map((invoice) => (
              <div key={invoice.id} className="p-4 hover:bg-gray-50 dark:bg-gray-900 transition flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary-100 rounded-lg">
                    <Upload className="h-4 w-4 text-primary-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{invoice.supplierName || 'Onbekend'}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{invoice.invoiceNumber}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900 dark:text-gray-100">€{(invoice.totalAmount || 0).toFixed(2)}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${ invoice.status === 'approved' ? 'bg-green-100 text-green-700' : invoice.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700' }`}>
                    {invoice.status === 'approved' ? 'Goedgekeurd' : invoice.status === 'rejected' ? 'Afgewezen' : 'In behandeling'}
                  </span>
                </div>
              </div>
            ))}
          </Card>
          <Card className="mt-4 p-4 bg-gradient-to-r from-primary-50 to-primary-100 border-l-4 border-primary-500">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Euro className="h-6 w-6 text-primary-600" />
                <div>
                  <p className="text-sm text-primary-700">Totaal Inkoop (laatste 5)</p>
                  <p className="text-2xl font-bold text-primary-900">€{stats.totalInvoiceAmount.toFixed(2)}</p>
                </div>
              </div>
              <p className="text-sm text-primary-700">{stats.totalInvoices} facturen</p>
            </div>
          </Card>
        </div>
      )}

      {/* Team Members */}
      {teamMembers.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <Users className={`h-6 w-6 ${isProjectCompany ? 'text-emerald-600' : 'text-green-600'}`} />
            {isProjectCompany ? 'Werknemers' : 'Team'} ({teamMembers.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {teamMembers.map((member) => (
              <Card key={member.id} className="p-4 hover:shadow-lg transition">
                <div className="flex items-start gap-3">
                  <div className={`h-12 w-12 rounded-full bg-gradient-to-br ${isProjectCompany ? 'from-emerald-400 to-emerald-600' : 'from-indigo-400 to-indigo-600'} flex items-center justify-center text-white font-bold flex-shrink-0`}>
                    {member.personalInfo?.firstName?.[0]?.toUpperCase() || 'E'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {member.personalInfo?.firstName} {member.personalInfo?.lastName}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{member.status === 'active' ? '✓ Actief' : 'Inactief'}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && productionWeeks.length === 0 && incomingInvoices.length === 0 && teamMembers.length === 0 && (
        <Card className="p-8 text-center">
          <FileText className="h-12 w-12 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Nog geen data</h3>
          <p className="text-gray-500 dark:text-gray-400">Begin met het uploaden van facturen of het registreren van productie.</p>
        </Card>
      )}
    </div>
  );
};

export default ManagerDashboard;
