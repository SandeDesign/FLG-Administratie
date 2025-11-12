import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import {
  BarChart3, Calendar, MapPin, Users, Zap, TrendingUp,
  AlertCircle, CheckCircle2, Activity, DollarSign, TrendingDown, Briefcase, Clock, Award
} from 'lucide-react';
import { EmptyState } from '../components/ui/EmptyState';
import Card from '../components/ui/Card';
import { projectStatisticsService } from '../services/projectStatisticsService';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  Area, AreaChart, ComposedChart
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

        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth(), 1);

        const [weeks, days, monthly, branches, branchDetailed, employees, matrix, addresses, advInsights] = await Promise.all([
          projectStatisticsService.getWeeklyBreakdown(selectedCompany.id, user.uid, now.getFullYear()),
          projectStatisticsService.getDailyBreakdown(selectedCompany.id, user.uid, startDate, now),
          projectStatisticsService.getMonthlyBreakdown(selectedCompany.id, user.uid, now.getFullYear()),
          projectStatisticsService.getBranchPerformance(selectedCompany.id, user.uid),
          projectStatisticsService.getBranchDetailedStats(selectedCompany.id, user.uid),
          projectStatisticsService.getEmployeeDetailedStats(selectedCompany.id, user.uid),
          projectStatisticsService.getEmployeeLocationMatrix(selectedCompany.id, user.uid),
          projectStatisticsService.getAverageEurPerAddress(selectedCompany.id, user.uid),
          projectStatisticsService.getAdvancedInsights(selectedCompany.id, user.uid),
        ]);

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
        console.error('Error loading statistics:', err);
        setError('Could not load statistics');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [selectedCompany, user]);

  if (!selectedCompany) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No company selected"
        description="Select a company to view statistics."
      />
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Error loading"
        description={error}
      />
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Complete Statistics & Analytics</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Full data analysis for {selectedCompany.name}</p>
      </div>

      {insights?.summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Employees</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{insights.summary.totalEmployees}</p>
                <p className="text-xs text-green-600 mt-1">{insights.summary.activeEmployees} active</p>
              </div>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Hours</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{insights.summary.totalHours.toFixed(0)}</p>
                <p className="text-xs text-purple-600 mt-1">{insights.summary.totalOvertime.toFixed(0)}h OT</p>
              </div>
              <Clock className="w-8 h-8 text-purple-600" />
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Revenue</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">€{(insights.summary.totalRevenue / 1000).toFixed(0)}k</p>
                <p className="text-xs text-green-600 mt-1">{(insights.summary.avgRevenuePerEmployee).toFixed(0)}€ per emp</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Profit Margin</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{insights.summary.profitMargin.toFixed(1)}%</p>
                <p className="text-xs text-orange-600 mt-1">€{(insights.summary.totalProfit / 1000).toFixed(0)}k</p>
              </div>
              <TrendingUp className="w-8 h-8 text-orange-600" />
            </div>
          </Card>
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Calendar className="w-6 h-6" />
          Weekly Analysis
        </h2>
        {weeklyData.length > 0 && (
          <Card className="p-6">
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="totalHours" stackId="1" stroke="#3b82f6" fill="#3b82f6" name="Regular" />
                <Area type="monotone" dataKey="totalOvertime" stackId="1" stroke="#ef4444" fill="#ef4444" name="OT" />
                <Area type="monotone" dataKey="totalEveningHours" stackId="1" stroke="#f59e0b" fill="#f59e0b" name="Evening" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <TrendingUp className="w-6 h-6" />
          Monthly Breakdown
        </h2>
        {monthlyData.length > 0 && (
          <Card className="p-6">
            <ResponsiveContainer width="100%" height={350}>
              <ComposedChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="monthName" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="totalHours" fill="#3b82f6" name="Hours" />
                <Line yAxisId="right" type="monotone" dataKey="totalInvoiced" stroke="#10b981" name="Revenue" />
              </ComposedChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Activity className="w-6 h-6" />
          Daily Overview
        </h2>
        {dailyData.length > 0 && (
          <Card className="p-6">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailyData.slice(-31)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="totalHours" fill="#3b82f6" name="Hours" />
                <Bar dataKey="employeeCount" fill="#10b981" name="Employees" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <MapPin className="w-6 h-6" />
          Location Performance
        </h2>
        {branchData.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {branchData.slice(0, 6).map((b, i) => (
                <Card key={i} className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
                  <p className="font-bold">{b.branchName}</p>
                  <p className="text-sm text-gray-600">{b.location}</p>
                  <p className="text-2xl font-bold text-blue-600 mt-2">€{(b.totalInvoiced / 1000).toFixed(0)}k</p>
                  <p className="text-xs mt-1">{b.totalHours}h • {b.employeeCount} emp • Margin: {b.profitMargin.toFixed(1)}%</p>
                </Card>
              ))}
            </div>

            <Card className="p-6">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={branchData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="branchName" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="efficiency" fill="#10b981" name="Efficiency %" />
                  <Bar dataKey="averageRevenue" fill="#3b82f6" name="Avg Rev/h" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold">Branch Detailed</h2>
        {branchDetailedData.length > 0 && (
          <Card className="p-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Branch</th>
                  <th className="text-right">Hours</th>
                  <th className="text-right">Revenue</th>
                  <th className="text-right">Profit</th>
                  <th className="text-right">Margin</th>
                </tr>
              </thead>
              <tbody>
                {branchDetailedData.map((b, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-2">{b.branchName}</td>
                    <td className="text-right">{b.totalHours}h</td>
                    <td className="text-right">€{(b.totalInvoiced/1000).toFixed(0)}k</td>
                    <td className="text-right font-bold text-green-600">€{(b.profit/1000).toFixed(0)}k</td>
                    <td className="text-right">{b.profitMargin.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold">Employee × Location (Top 20)</h2>
        {employeeLocationMatrix.length > 0 && (
          <Card className="p-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Employee</th>
                  <th className="text-left">Location</th>
                  <th className="text-right">Hours</th>
                  <th className="text-right">€/h</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {employeeLocationMatrix.slice(0, 20).map((e, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-2">{e.employeeName}</td>
                    <td>{e.location}</td>
                    <td className="text-right">{e.totalHours}h</td>
                    <td className="text-right font-bold">€{e.averagePerHour.toFixed(2)}</td>
                    <td className="text-right">€{(e.totalCost/1000).toFixed(0)}k</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold">Employee Analysis (Top 15)</h2>
        {employeeData.length > 0 && (
          <Card className="p-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Employee</th>
                  <th className="text-right">Hours</th>
                  <th className="text-right">OT</th>
                  <th className="text-right">Gross</th>
                  <th className="text-right">Net</th>
                  <th className="text-right">Leave</th>
                </tr>
              </thead>
              <tbody>
                {employeeData.slice(0, 15).map((e, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-2">{e.name}</td>
                    <td className="text-right">{e.totalHours}</td>
                    <td className="text-right">{e.totalOvertime}</td>
                    <td className="text-right">€{(e.totalGross/1000).toFixed(0)}k</td>
                    <td className="text-right">€{(e.totalNet/1000).toFixed(0)}k</td>
                    <td className="text-right">{e.totalLeave}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <DollarSign className="w-6 h-6" />
          Average € per Location
        </h2>
        {averagePerAddress.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {averagePerAddress.map((a, i) => (
                <Card key={i} className="p-4 border-l-4 border-l-blue-500">
                  <p className="font-bold text-lg">{a.location}</p>
                  <p className="text-2xl font-bold text-blue-600 mt-2">€{a.averageEuroPerHour.toFixed(2)}/h</p>
                  <p className="text-xs mt-2">{a.totalHours}h • {a.employeeCount} emp • €{(a.averageCostPerEmployee/1000).toFixed(0)}k/emp</p>
                </Card>
              ))}
            </div>

            <Card className="p-6">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={averagePerAddress}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="location" />
                  <YAxis />
                  <Tooltip formatter={(v) => `€${v.toFixed(2)}`} />
                  <Bar dataKey="averageEuroPerHour" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </>
        )}
      </div>

      {insights && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="w-6 h-6" />
            Advanced Insights
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {insights.topPerformers?.length > 0 && (
              <Card className="p-4 bg-green-50 dark:bg-green-900/20">
                <p className="font-bold mb-3">Top Performers</p>
                {insights.topPerformers.slice(0, 3).map((e: any, i: number) => (
                  <div key={i} className="flex justify-between text-sm mb-1">
                    <span>{e.name}</span>
                    <span className="font-bold text-green-600">€{e.efficiency.toFixed(0)}/h</span>
                  </div>
                ))}
              </Card>
            )}

            {insights.leaveCompliance && (
              <Card className="p-4 bg-blue-50 dark:bg-blue-900/20">
                <p className="font-bold mb-3">Leave Compliance</p>
                <p className="text-2xl font-bold text-blue-600">{insights.leaveCompliance.complianceRate.toFixed(0)}%</p>
                <p className="text-xs mt-2">{insights.leaveCompliance.approved} approved</p>
              </Card>
            )}

            {insights.overtimeAnalysis && (
              <Card className="p-4 bg-orange-50 dark:bg-orange-900/20">
                <p className="font-bold mb-3">Overtime</p>
                <p className="text-2xl font-bold text-orange-600">{insights.overtimeAnalysis.totalOvertimeHours.toFixed(0)}h</p>
                <p className="text-xs mt-2">{insights.overtimeAnalysis.employeesWithOvertime} employees</p>
              </Card>
            )}

            {insights.profitAnalysis && (
              <Card className="p-4 bg-purple-50 dark:bg-purple-900/20">
                <p className="font-bold mb-3">Profit Margin</p>
                <p className="text-2xl font-bold text-purple-600">{insights.profitAnalysis.margin.toFixed(1)}%</p>
                <p className="text-xs mt-2">€{(insights.profitAnalysis.profit/1000).toFixed(0)}k profit</p>
              </Card>
            )}

            {insights.travelAnalysis && (
              <Card className="p-4 bg-pink-50 dark:bg-pink-900/20">
                <p className="font-bold mb-3">Travel</p>
                <p className="text-2xl font-bold text-pink-600">{insights.travelAnalysis.totalKilometers.toFixed(0)}km</p>
                <p className="text-xs mt-2">{insights.travelAnalysis.averageKmPerEmployee.toFixed(0)}km avg</p>
              </Card>
            )}

            {insights.timesheetStats && (
              <Card className="p-4 bg-cyan-50 dark:bg-cyan-900/20">
                <p className="font-bold mb-3">Timesheets</p>
                <p className="text-2xl font-bold text-cyan-600">{insights.timesheetStats.submissionRate.toFixed(0)}%</p>
                <p className="text-xs mt-2">{insights.timesheetStats.submitted}/{insights.timesheetStats.total}</p>
              </Card>
            )}
          </div>
        </div>
      )}

      {insights?.peakDaysOfWeek && (
        <Card className="p-6">
          <h3 className="font-bold mb-4">Peak Days of Week</h3>
          <div className="grid grid-cols-7 gap-2">
            {insights.peakDaysOfWeek.map((d: any, i: number) => (
              <div key={i} className="bg-blue-50 p-3 rounded text-center">
                <p className="text-xs font-bold">{d.day}</p>
                <p className="font-bold text-blue-600">{d.hours.toFixed(0)}h</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {loading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-gray-500 mt-4">Loading analytics...</p>
        </div>
      )}
    </div>
  );
};

export default ProjectStatistics;