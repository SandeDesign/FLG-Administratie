import {
  collection, query, where, getDocs, Timestamp, getFirestore,
} from 'firebase/firestore';
import { getApp } from 'firebase/app';
import type {
  Company, Employee, TimeEntry, WeeklyTimesheet, Branch,
  LeaveRequest, Expense, PayrollPeriod, HourlyRate
} from '../types';

const db = getFirestore(getApp());

export const advancedStatisticsService = {
  async getWeeklyBreakdown(companyId: string, userId: string, year: number) {
    try {
      const timesheetsSnap = await getDocs(
        query(
          collection(db, 'weeklyTimesheets'),
          where('companyId', '==', companyId),
          where('userId', '==', userId),
          where('year', '==', year)
        )
      );

      const timesheets = timesheetsSnap.docs.map(doc => doc.data());
      const weeklyData = new Map<number, any>();

      for (let week = 1; week <= 52; week++) {
        const weekTimesheets = timesheets.filter((ts: any) => ts.weekNumber === week);
        
        weeklyData.set(week, {
          week,
          totalHours: weekTimesheets.reduce((sum, ts: any) => sum + (ts.totalRegularHours || 0), 0),
          totalOvertime: weekTimesheets.reduce((sum, ts: any) => sum + (ts.totalOvertimeHours || 0), 0),
          totalEveningHours: weekTimesheets.reduce((sum, ts: any) => sum + (ts.totalEveningHours || 0), 0),
          totalNightHours: weekTimesheets.reduce((sum, ts: any) => sum + (ts.totalNightHours || 0), 0),
          totalWeekendHours: weekTimesheets.reduce((sum, ts: any) => sum + (ts.totalWeekendHours || 0), 0),
          travelKm: weekTimesheets.reduce((sum, ts: any) => sum + (ts.totalTravelKilometers || 0), 0),
          employeeCount: weekTimesheets.length,
          averageHoursPerEmployee: weekTimesheets.length > 0 ?
            weekTimesheets.reduce((sum, ts: any) => sum + (ts.totalRegularHours || 0), 0) / weekTimesheets.length : 0,
          submittedCount: weekTimesheets.filter((ts: any) => ts.status !== 'draft').length,
        });
      }

      return Array.from(weeklyData.values());
    } catch (error) {
      console.error('Error getting weekly breakdown:', error);
      throw error;
    }
  },

  async getDailyBreakdown(companyId: string, userId: string, startDate: Date, endDate: Date) {
    try {
      const timeEntriesSnap = await getDocs(
        query(
          collection(db, 'timeEntries'),
          where('companyId', '==', companyId),
          where('userId', '==', userId)
        )
      );

      const entries = timeEntriesSnap.docs.map(doc => doc.data());
      const filtered = entries.filter((e: any) => {
        const eDate = e.date?.toDate?.() || new Date(e.date);
        return eDate >= startDate && eDate <= endDate;
      });

      const dailyData = new Map<string, any>();

      filtered.forEach((entry: any) => {
        const date = (entry.date?.toDate?.() || new Date(entry.date)).toISOString().split('T')[0];
        
        if (!dailyData.has(date)) {
          dailyData.set(date, {
            date,
            totalHours: 0,
            totalOvertime: 0,
            entries: [],
            employeeCount: new Set(),
          });
        }

        const day = dailyData.get(date)!;
        day.totalHours += entry.regularHours || 0;
        day.totalOvertime += entry.overtimeHours || 0;
        day.entries.push(entry);
        day.employeeCount.add(entry.employeeId);
      });

      return Array.from(dailyData.values()).map(day => ({
        ...day,
        employeeCount: day.employeeCount.size,
        averageHoursPerEmployee: day.employeeCount.size > 0 ? 
          day.totalHours / day.employeeCount.size : 0,
      }));
    } catch (error) {
      console.error('Error getting daily breakdown:', error);
      throw error;
    }
  },

  async getBranchPerformance(companyId: string, userId: string) {
    try {
      const [branchesSnap, timeEntriesSnap, employeesSnap, invoicesSnap] = await Promise.all([
        getDocs(query(collection(db, 'branches'), where('companyId', '==', companyId))),
        getDocs(query(collection(db, 'timeEntries'), where('companyId', '==', companyId), where('userId', '==', userId))),
        getDocs(query(collection(db, 'employees'), where('companyId', '==', companyId), where('userId', '==', userId))),
        getDocs(query(collection(db, 'outgoingInvoices'), where('companyId', '==', companyId), where('userId', '==', userId))),
      ]);

      const branches = branchesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const timeEntries = timeEntriesSnap.docs.map(doc => doc.data());
      const employees = employeesSnap.docs.map(doc => doc.data());
      const invoices = invoicesSnap.docs.map(doc => doc.data());

      const branchMetrics = branches.map((branch: any) => {
        const branchEmployees = employees.filter((e: any) => e.branchId === branch.id);
        const branchEntries = timeEntries.filter((te: any) => te.branchId === branch.id);
        
        const totalHours = branchEntries.reduce((sum, te: any) => sum + (te.regularHours || 0), 0);
        const totalInvoiced = invoices
          .filter((inv: any) => branchEmployees.some((emp: any) => 
            inv.items?.some((item: any) => item.employeeIds?.includes(emp.id))
          ))
          .reduce((sum, inv: any) => sum + (inv.totalAmount || 0), 0);

        return {
          branchId: branch.id,
          branchName: branch.name,
          location: branch.location,
          costCenter: branch.costCenter,
          employeeCount: branchEmployees.length,
          totalHours,
          totalInvoiced,
          averageRevenue: totalHours > 0 ? totalInvoiced / totalHours : 0,
          entryCount: branchEntries.length,
          efficiency: (totalInvoiced / (totalHours * 50)) * 100,
        };
      });

      return branchMetrics.sort((a, b) => b.totalInvoiced - a.totalInvoiced);
    } catch (error) {
      console.error('Error getting branch performance:', error);
      throw error;
    }
  },

  async getEmployeeLocationMatrix(companyId: string, userId: string) {
    try {
      const [employeesSnap, timeEntriesSnap, branchesSnap, hourlyRatesSnap] = await Promise.all([
        getDocs(query(collection(db, 'employees'), where('companyId', '==', companyId))),
        getDocs(query(collection(db, 'timeEntries'), where('companyId', '==', companyId), where('userId', '==', userId))),
        getDocs(query(collection(db, 'branches'), where('companyId', '==', companyId))),
        getDocs(query(collection(db, 'hourlyRates'), where('companyId', '==', companyId))),
      ]);

      const employees = employeesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const timeEntries = timeEntriesSnap.docs.map(doc => doc.data());
      const branches = branchesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const matrix: any[] = [];

      for (const employee of employees) {
        for (const branch of branches) {
          const employeeBranchEntries = timeEntries.filter((te: any) =>
            te.employeeId === employee.id && te.branchId === branch.id
          );

          if (employeeBranchEntries.length === 0) continue;

          const totalHours = employeeBranchEntries.reduce((sum, te: any) => 
            sum + (te.regularHours || 0) + (te.overtimeHours || 0), 0);
          
          const employeeRate = employee.salaryInfo?.hourlyRate || 0;
          const totalCost = totalHours * employeeRate;

          matrix.push({
            employeeId: employee.id,
            employeeName: `${employee.personalInfo?.firstName} ${employee.personalInfo?.lastName}`,
            branchId: branch.id,
            branchName: branch.name,
            location: branch.location,
            totalHours,
            hourlyRate: employeeRate,
            totalCost,
            averagePerHour: employeeRate,
            entryCount: employeeBranchEntries.length,
            efficiency: (employeeRate / 50) * 100,
          });
        }
      }

      return matrix.sort((a, b) => b.totalHours - a.totalHours);
    } catch (error) {
      console.error('Error getting employee location matrix:', error);
      throw error;
    }
  },

  async getAverageEurPerAddress(companyId: string, userId: string) {
    try {
      const matrix = await this.getEmployeeLocationMatrix(companyId, userId);
      
      const locationMetrics = new Map<string, any>();

      matrix.forEach((item: any) => {
        if (!locationMetrics.has(item.location)) {
          locationMetrics.set(item.location, {
            location: item.location,
            branches: new Set(),
            totalHours: 0,
            totalCost: 0,
            employeeCount: new Set(),
          });
        }

        const loc = locationMetrics.get(item.location)!;
        loc.branches.add(item.branchName);
        loc.totalHours += item.totalHours;
        loc.totalCost += item.totalCost;
        loc.employeeCount.add(item.employeeId);
      });

      return Array.from(locationMetrics.values()).map((loc: any) => ({
        location: loc.location,
        branches: Array.from(loc.branches),
        totalHours: loc.totalHours,
        totalCost: loc.totalCost,
        averageEuroPerHour: loc.totalHours > 0 ? loc.totalCost / loc.totalHours : 0,
        employeeCount: loc.employeeCount.size,
        averageCostPerEmployee: loc.employeeCount.size > 0 ? loc.totalCost / loc.employeeCount.size : 0,
      })).sort((a, b) => b.averageEuroPerHour - a.averageEuroPerHour);
    } catch (error) {
      console.error('Error getting average EUR per address:', error);
      throw error;
    }
  },
};

function getTopPerformers(employees: any[], timeEntries: any[], invoices: any[]) {
  return employees.map((emp: any) => {
    const empHours = timeEntries
      .filter((te: any) => te.employeeId === emp.id)
      .reduce((sum, te: any) => sum + (te.regularHours || 0), 0);
    
    const empInvoiced = invoices
      .filter((inv: any) => inv.items?.some((item: any) => item.employeeIds?.includes(emp.id)))
      .reduce((sum, inv: any) => sum + (inv.totalAmount || 0), 0);

    return {
      id: emp.id,
      name: `${emp.personalInfo?.firstName} ${emp.personalInfo?.lastName}`,
      hours: empHours,
      revenue: empInvoiced,
      efficiency: empHours > 0 ? empInvoiced / empHours : 0,
    };
  }).sort((a, b) => b.efficiency - a.efficiency).slice(0, 10);
}

function getLeaveCompliance(leave: any[], employees: any[]) {
  const compliant = employees.length > 0 ? (leave.filter((l: any) => l.status === 'approved').length / employees.length) * 100 : 0;
  return {
    totalRequests: leave.length,
    approved: leave.filter((l: any) => l.status === 'approved').length,
    pending: leave.filter((l: any) => l.status === 'pending').length,
    rejected: leave.filter((l: any) => l.status === 'rejected').length,
    complianceRate: compliant,
  };
}

function getOvertimeAnalysis(timeEntries: any[]) {
  const totalOvertime = timeEntries.reduce((sum, te: any) => sum + (te.overtimeHours || 0), 0);
  const employeesWithOvertime = new Set(timeEntries.filter((te: any) => te.overtimeHours > 0).map((te: any) => te.employeeId)).size;
  
  return {
    totalOvertimeHours: totalOvertime,
    employeesWithOvertime,
    averageOvertimePerEmployee: employeesWithOvertime > 0 ? totalOvertime / employeesWithOvertime : 0,
  };
}

function calculateProfitMargin(invoices: any[], expenses: any[]) {
  const revenue = invoices.reduce((sum, inv: any) => sum + (inv.totalAmount || 0), 0);
  const costs = expenses.reduce((sum, e: any) => sum + (e.amount || 0), 0);
  const profit = revenue - costs;

  return {
    revenue,
    costs,
    profit,
    margin: revenue > 0 ? (profit / revenue) * 100 : 0,
  };
}