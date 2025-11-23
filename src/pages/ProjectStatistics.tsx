import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import {
  BarChart3, Calendar, MapPin, Users, Zap, TrendingUp, TrendingDown,
  AlertCircle, CheckCircle2, Activity, DollarSign, Briefcase, Clock, Award,
  ArrowUp, ArrowDown, AlertTriangle, Eye, Target, Percent
} from 'lucide-react';
import { EmptyState } from '../components/ui/EmptyState';
import Card from '../components/ui/Card';
import { projectStatisticsService } from '../services/projectStatisticsService';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  Area, AreaChart, ComposedChart, ScatterChart, Scatter
} from 'recharts';

const ProjectStatistics: React.FC = () => {
  const { user } = useAuth();
  const { selectedCompany } = useApp();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [branchData, setBranchData] = useState<any[]>([]);
  const [branchDetailedData, setBranchDetailedData] = useState<any[]>([]);
  const [employeeData, setEmployeeData] = useState<any[]>([]);
  const [employeeLocationMatrix, setEmployeeLocationMatrix] = useState<any[]>([]);
  const [averagePerAddress, setAveragePerAddress] = useState<any[]>([]);
  const [insights, setInsights] = useState<any>(null);

  useEffect(() => {
    const loadData = async () => {
      if (!selectedCompany?.id || !user?.uid) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const companyId = selectedCompany.id;
        const userId = user.uid;
        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth(), 1);

        console.log(`📊 Loading statistics for: ${selectedCompany.name} (${companyId})`);

        const [weeks, days, monthly, branches, branchDetailed, employees, matrix, addresses, advInsights] = await Promise.all([
          projectStatisticsService.getWeeklyBreakdown(companyId, userId, now.getFullYear()),
          projectStatisticsService.getDailyBreakdown(companyId, userId, startDate, now),
          projectStatisticsService.getMonthlyBreakdown(companyId, userId, now.getFullYear()),
          projectStatisticsService.getBranchPerformance(companyId, userId),
          projectStatisticsService.getBranchDetailedStats(companyId, userId),
          projectStatisticsService.getEmployeeDetailedStats(companyId, userId),
          projectStatisticsService.getEmployeeLocationMatrix(companyId, userId),
          projectStatisticsService.getAverageEurPerAddress(companyId, userId),
          projectStatisticsService.getAdvancedInsights(companyId, userId),
        ]);

        console.log(`✅ All statistics loaded successfully`);

        setWeeklyData(weeks || []);
        setDailyData(days || []);
        setMonthlyData(monthly || []);
        setBranchData(branches || []);
        setBranchDetailedData(branchDetailed || []);
        setEmployeeData(employees || []);
        setEmployeeLocationMatrix(matrix || []);
        setAveragePerAddress(addresses || []);
        setInsights(advInsights || {});
      } catch (err) {
        console.error('❌ Error loading statistics:', err);
        setError('Kon statistieken niet laden');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [selectedCompany?.id, user?.uid]);

  // BEREKENDE METRIEKEN
  const computedStats = useMemo(() => {
    if (!insights?.summary || !weeklyData.length || !branchData.length) return null;

    const summary = insights.summary;
    const avgHoursPerEmployee = summary.totalEmployees > 0 ? summary.totalHours / summary.totalEmployees : 0;
    const overtimePercentage = summary.totalHours > 0 ? (summary.totalOvertime / summary.totalHours) * 100 : 0;
    const costPerHour = summary.totalHours > 0 ? summary.totalGrossPay / summary.totalHours : 0;
    const revenuePerHour = summary.totalHours > 0 ? summary.totalRevenue / summary.totalHours : 0;
    const profitPerHour = revenuePerHour - costPerHour;
    const costRatio = summary.totalRevenue > 0 ? (summary.totalGrossPay / summary.totalRevenue) * 100 : 0;
    const expenseRatio = summary.totalRevenue > 0 ? (summary.totalExpenses / summary.totalRevenue) * 100 : 0;
    const inactivePercentage = summary.totalEmployees > 0 ? (summary.inactiveEmployees / summary.totalEmployees) * 100 : 0;

    const totalSubmitted = weeklyData.reduce((sum, w) => sum + w.submittedCount, 0);
    const totalDraft = weeklyData.reduce((sum, w) => sum + w.draftCount, 0);
    const submissionRate = (totalSubmitted + totalDraft) > 0 ? (totalSubmitted / (totalSubmitted + totalDraft)) * 100 : 0;

    return {
      avgHoursPerEmployee,
      overtimePercentage,
      costPerHour,
      revenuePerHour,
      profitPerHour,
      costRatio,
      expenseRatio,
      inactivePercentage,
      totalSubmitted,
      totalDraft,
      submissionRate,
      topBranch: branchData[0],
      averageEmployeeCost: summary.totalEmployees > 0 ? summary.totalGrossPay / summary.totalEmployees : 0,
      averageEmployeeRevenue: summary.activeEmployees > 0 ? summary.totalRevenue / summary.activeEmployees : 0,
    };
  }, [insights, weeklyData, branchData]);

  if (!selectedCompany) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Geen bedrijf geselecteerd"
        description="Selecteer een bedrijf om statistieken te bekijken."
      />
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Fout bij laden"
        description={error}
      />
    );
  }

  return (
    <div className="space-y-8 pb-12 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 p-6 rounded-lg">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white">Volledige Analytics Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2 text-lg">Gedetailleerde analyse voor {selectedCompany.name}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Bijgewerkt: {new Date().toLocaleDateString('nl-NL')}</p>
        </div>
      </div>

      {/* HOOFD KPI KAARTEN */}
      {insights?.summary && computedStats && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-6 bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/30 dark:to-primary-800/30 border-l-4 border-l-primary-600 shadow-lg hover:shadow-xl transition">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 font-semibold">Totaal Medewerkers</p>
                  <p className="text-4xl font-bold text-gray-900 dark:text-white mt-2">{insights.summary.totalEmployees}</p>
                  <div className="flex items-center gap-2 mt-3">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <p className="text-sm text-green-700 font-medium">{insights.summary.activeEmployees} actief</p>
                  </div>
                </div>
                <Users className="w-16 h-16 text-primary-200 dark:text-primary-700" />
              </div>
            </Card>

            <Card className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 border-l-4 border-l-purple-600 shadow-lg hover:shadow-xl transition">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 font-semibold">Totale Uren</p>
                  <p className="text-4xl font-bold text-gray-900 dark:text-white mt-2">{insights.summary.totalHours.toFixed(0)}</p>
                  <div className="mt-3">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-red-600" />
                      <p className="text-sm text-red-700">Overwerk: {insights.summary.totalOvertime.toFixed(0)}h ({computedStats.overtimePercentage.toFixed(1)}%)</p>
                    </div>
                  </div>
                </div>
                <Clock className="w-16 h-16 text-purple-200 dark:text-purple-700" />
              </div>
            </Card>

            <Card className="p-6 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 border-l-4 border-l-green-600 shadow-lg hover:shadow-xl transition">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 font-semibold">Opbrengsten</p>
                  <p className="text-4xl font-bold text-gray-900 dark:text-white mt-2">€{(insights.summary.totalRevenue / 1000).toFixed(1)}k</p>
                  <div className="mt-3">
                    <p className="text-sm text-green-700">€{computedStats.revenuePerHour.toFixed(2)}/uur</p>
                  </div>
                </div>
                <DollarSign className="w-16 h-16 text-green-200 dark:text-green-700" />
              </div>
            </Card>

            <Card className="p-6 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/30 dark:to-orange-800/30 border-l-4 border-l-orange-600 shadow-lg hover:shadow-xl transition">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 font-semibold">Winstmarge</p>
                  <p className="text-4xl font-bold text-gray-900 dark:text-white mt-2">{insights.summary.profitMargin.toFixed(1)}%</p>
                  <div className="mt-3">
                    <p className="text-sm text-orange-700">Winst: €{(insights.summary.totalProfit / 1000).toFixed(1)}k</p>
                  </div>
                </div>
                <TrendingUp className="w-16 h-16 text-orange-200 dark:text-orange-700" />
              </div>
            </Card>
          </div>
        </>
      )}

      {/* WEEK ANALYSE */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Calendar className="w-6 h-6" />
          Weekanalyse (52 Weken)
        </h2>
        {weeklyData.length > 0 && (
          <Card className="p-6 bg-white dark:bg-gray-800 shadow-lg">
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={weeklyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRegular" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="week" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }} />
                <Legend />
                <Area type="monotone" dataKey="totalHours" stackId="1" stroke="#3b82f6" fill="url(#colorRegular)" name="Reguliere Uren" />
                <Area type="monotone" dataKey="totalOvertime" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} name="Overwerk" />
                <Area type="monotone" dataKey="totalEveningHours" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.4} name="Avonduren" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>

      {/* LAAD INDICATOR */}
      {loading && (
        <div className="text-center py-16">
          <div className="inline-block">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-4 border-gray-200 dark:border-gray-700"></div>
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary-500 border-r-primary-500 animate-spin"></div>
            </div>
          </div>
          <p className="text-gray-500 dark:text-gray-400 mt-4">Alle analytics laden...</p>
        </div>
      )}
    </div>
  );
};

export default ProjectStatistics;