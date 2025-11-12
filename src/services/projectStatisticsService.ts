import {
  collection, query, where, getDocs, getFirestore,
} from 'firebase/firestore';
import { getApp } from 'firebase/app';

const db = getFirestore(getApp());

export const projectStatisticsService = {
  // WEEK-BY-WEEK ANALYTICS - ALLE DATA LADEN
  async getWeeklyBreakdown(companyId: string, userId: string, year: number) {
    try {
      console.log(`📊 Loading weekly data for company: ${companyId}, year: ${year}`);
      
      const timesheetsSnap = await getDocs(
        query(
          collection(db, 'weeklyTimesheets'),
          where('companyId', '==', companyId),
          where('year', '==', year)
          // REMOVED: userId filter - dit was het probleem!
        )
      );

      console.log(`✓ Loaded ${timesheetsSnap.docs.length} weekly timesheets`);

      const timesheets = timesheetsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const weeklyData = new Map<number, any>();

      for (let week = 1; week <= 52; week++) {
        const weekTimesheets = timesheets.filter((ts: any) => ts.weekNumber === week);
        
        const totalHours = weekTimesheets.reduce((sum, ts: any) => sum + (ts.totalRegularHours || 0), 0);
        const totalOvertime = weekTimesheets.reduce((sum, ts: any) => sum + (ts.totalOvertimeHours || 0), 0);
        const totalEveningHours = weekTimesheets.reduce((sum, ts: any) => sum + (ts.totalEveningHours || 0), 0);
        const totalNightHours = weekTimesheets.reduce((sum, ts: any) => sum + (ts.totalNightHours || 0), 0);
        const totalWeekendHours = weekTimesheets.reduce((sum, ts: any) => sum + (ts.totalWeekendHours || 0), 0);
        const totalTravelKm = weekTimesheets.reduce((sum, ts: any) => sum + (ts.totalTravelKilometers || 0), 0);
        
        weeklyData.set(week, {
          week,
          totalHours,
          totalOvertime,
          totalEveningHours,
          totalNightHours,
          totalWeekendHours,
          travelKm: totalTravelKm,
          employeeCount: weekTimesheets.length,
          averageHoursPerEmployee: weekTimesheets.length > 0 ? totalHours / weekTimesheets.length : 0,
          submittedCount: weekTimesheets.filter((ts: any) => ts.status !== 'draft').length,
          draftCount: weekTimesheets.filter((ts: any) => ts.status === 'draft').length,
          approvedCount: weekTimesheets.filter((ts: any) => ts.status === 'approved').length,
          processedCount: weekTimesheets.filter((ts: any) => ts.status === 'processed').length,
        });
      }

      return Array.from(weeklyData.values());
    } catch (error) {
      console.error('❌ Error getting weekly breakdown:', error);
      throw error;
    }
  },

  // DAY-BY-DAY ANALYTICS
  async getDailyBreakdown(companyId: string, userId: string, startDate: Date, endDate: Date) {
    try {
      console.log(`📅 Loading daily data for company: ${companyId}`);
      
      const timeEntriesSnap = await getDocs(
        query(
          collection(db, 'timeEntries'),
          where('companyId', '==', companyId)
          // REMOVED: userId filter
        )
      );

      console.log(`✓ Loaded ${timeEntriesSnap.docs.length} time entries`);

      const entries = timeEntriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
            totalEveningHours: 0,
            totalNightHours: 0,
            totalWeekendHours: 0,
            totalTravelKm: 0,
            entries: [],
            employeeCount: new Set(),
            branchCount: new Set(),
          });
        }

        const day = dailyData.get(date)!;
        day.totalHours += entry.regularHours || 0;
        day.totalOvertime += entry.overtimeHours || 0;
        day.totalEveningHours += entry.eveningHours || 0;
        day.totalNightHours += entry.nightHours || 0;
        day.totalWeekendHours += entry.weekendHours || 0;
        day.totalTravelKm += entry.travelKilometers || 0;
        day.entries.push(entry);
        day.employeeCount.add(entry.employeeId);
        day.branchCount.add(entry.branchId);
      });

      return Array.from(dailyData.values()).map(day => ({
        date: day.date,
        totalHours: day.totalHours,
        totalOvertime: day.totalOvertime,
        totalEveningHours: day.totalEveningHours,
        totalNightHours: day.totalNightHours,
        totalWeekendHours: day.totalWeekendHours,
        totalTravelKm: day.totalTravelKm,
        employeeCount: day.employeeCount.size,
        branchCount: day.branchCount.size,
        averageHoursPerEmployee: day.employeeCount.size > 0 ? 
          day.totalHours / day.employeeCount.size : 0,
        entryCount: day.entries.length,
      }));
    } catch (error) {
      console.error('❌ Error getting daily breakdown:', error);
      throw error;
    }
  },

  // LOCATION/BRANCH ANALYTICS
  async getBranchPerformance(companyId: string, userId: string) {
    try {
      console.log(`🏢 Loading branch performance for company: ${companyId}`);
      
      const [branchesSnap, timeEntriesSnap, employeesSnap, invoicesSnap, expensesSnap] = await Promise.all([
        getDocs(query(collection(db, 'branches'), where('companyId', '==', companyId))),
        getDocs(query(collection(db, 'timeEntries'), where('companyId', '==', companyId))),
        getDocs(query(collection(db, 'employees'), where('companyId', '==', companyId))),
        getDocs(query(collection(db, 'outgoingInvoices'), where('companyId', '==', companyId))),
        getDocs(query(collection(db, 'expenses'), where('companyId', '==', companyId))),
      ]);

      console.log(`✓ Loaded branches: ${branchesSnap.docs.length}, timeEntries: ${timeEntriesSnap.docs.length}, employees: ${employeesSnap.docs.length}, invoices: ${invoicesSnap.docs.length}`);

      const branches = branchesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const timeEntries = timeEntriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const employees = employeesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const invoices = invoicesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const expenses = expensesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const branchMetrics = branches.map((branch: any) => {
        const branchEmployees = employees.filter((e: any) => e.branchId === branch.id);
        const branchEntries = timeEntries.filter((te: any) => te.branchId === branch.id);
        const branchExpenses = expenses.filter((ex: any) => branchEmployees.some((emp: any) => ex.employeeId === emp.id));
        
        const totalHours = branchEntries.reduce((sum, te: any) => sum + (te.regularHours || 0), 0);
        const totalOvertime = branchEntries.reduce((sum, te: any) => sum + (te.overtimeHours || 0), 0);
        const totalTravelKm = branchEntries.reduce((sum, te: any) => sum + (te.travelKilometers || 0), 0);
        
        const totalInvoiced = invoices
          .filter((inv: any) => branchEmployees.some((emp: any) => 
            inv.items?.some((item: any) => item.employeeIds?.includes(emp.id))
          ))
          .reduce((sum, inv: any) => sum + (inv.totalAmount || 0), 0);

        const totalBranchExpenses = branchExpenses.reduce((sum, ex: any) => sum + (ex.amount || 0), 0);
        const branchProfit = totalInvoiced - totalBranchExpenses;

        return {
          branchId: branch.id,
          branchName: branch.name,
          location: branch.location,
          costCenter: branch.costCenter,
          employeeCount: branchEmployees.length,
          activeEmployees: branchEmployees.filter((e: any) => e.status === 'active').length,
          totalHours,
          totalOvertime,
          totalTravelKm,
          totalInvoiced,
          totalExpenses: totalBranchExpenses,
          profit: branchProfit,
          profitMargin: totalInvoiced > 0 ? (branchProfit / totalInvoiced) * 100 : 0,
          averageRevenue: totalHours > 0 ? totalInvoiced / totalHours : 0,
          averageCost: totalHours > 0 ? totalBranchExpenses / totalHours : 0,
          entryCount: branchEntries.length,
          efficiency: totalHours > 0 ? (totalInvoiced / (totalHours * 50)) * 100 : 0,
        };
      });

      return branchMetrics.sort((a, b) => b.totalInvoiced - a.totalInvoiced);
    } catch (error) {
      console.error('❌ Error getting branch performance:', error);
      throw error;
    }
  },

  // EMPLOYEE × LOCATION MATRIX
  async getEmployeeLocationMatrix(companyId: string, userId: string) {
    try {
      console.log(`👥 Loading employee location matrix for company: ${companyId}`);
      
      const [employeesSnap, timeEntriesSnap, branchesSnap, payrollSnap] = await Promise.all([
        getDocs(query(collection(db, 'employees'), where('companyId', '==', companyId))),
        getDocs(query(collection(db, 'timeEntries'), where('companyId', '==', companyId))),
        getDocs(query(collection(db, 'branches'), where('companyId', '==', companyId))),
        getDocs(query(collection(db, 'payrollCalculations')))
      ]);

      console.log(`✓ Loaded for matrix: employees: ${employeesSnap.docs.length}, timeEntries: ${timeEntriesSnap.docs.length}`);

      const employees = employeesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const timeEntries = timeEntriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const branches = branchesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const payroll = payrollSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const matrix: any[] = [];

      for (const employee of employees) {
        for (const branch of branches) {
          const employeeBranchEntries = timeEntries.filter((te: any) =>
            te.employeeId === employee.id && te.branchId === branch.id
          );

          if (employeeBranchEntries.length === 0) continue;

          const totalHours = employeeBranchEntries.reduce((sum, te: any) => 
            sum + (te.regularHours || 0) + (te.overtimeHours || 0), 0);
          
          const totalOvertime = employeeBranchEntries.reduce((sum, te: any) => sum + (te.overtimeHours || 0), 0);
          const totalTravelKm = employeeBranchEntries.reduce((sum, te: any) => sum + (te.travelKilometers || 0), 0);

          const employeeRate = employee.salaryInfo?.hourlyRate || 0;
          const employeePayroll = payroll.filter((p: any) => p.employeeId === employee.id);
          const totalGrossPay = employeePayroll.reduce((sum, p: any) => sum + (p.grossPay || 0), 0);

          const totalCost = totalHours * employeeRate;

          matrix.push({
            employeeId: employee.id,
            employeeName: `${employee.personalInfo?.firstName} ${employee.personalInfo?.lastName}`,
            employeeStatus: employee.status,
            employeeType: employee.contractInfo?.type,
            branchId: branch.id,
            branchName: branch.name,
            location: branch.location,
            costCenter: branch.costCenter,
            totalHours,
            totalOvertime,
            totalTravelKm,
            hourlyRate: employeeRate,
            totalCost,
            totalGrossPay,
            averagePerHour: employeeRate,
            entryCount: employeeBranchEntries.length,
            efficiency: (employeeRate / 50) * 100,
            profitPerHour: totalHours > 0 ? (totalGrossPay - employeeRate) / totalHours : 0,
          });
        }
      }

      return matrix.sort((a, b) => b.totalHours - a.totalHours);
    } catch (error) {
      console.error('❌ Error getting employee location matrix:', error);
      throw error;
    }
  },

  // AVERAGE EUR PER ADDRESS
  async getAverageEurPerAddress(companyId: string, userId: string) {
    try {
      console.log(`💰 Loading average EUR per address for company: ${companyId}`);
      
      const matrix = await this.getEmployeeLocationMatrix(companyId, userId);
      
      const locationMetrics = new Map<string, any>();

      matrix.forEach((item: any) => {
        if (!locationMetrics.has(item.location)) {
          locationMetrics.set(item.location, {
            location: item.location,
            branches: new Set(),
            totalHours: 0,
            totalOvertime: 0,
            totalTravelKm: 0,
            totalCost: 0,
            totalGrossPay: 0,
            employeeCount: new Set(),
            entryCount: 0,
          });
        }

        const loc = locationMetrics.get(item.location)!;
        loc.branches.add(item.branchName);
        loc.totalHours += item.totalHours;
        loc.totalOvertime += item.totalOvertime;
        loc.totalTravelKm += item.totalTravelKm;
        loc.totalCost += item.totalCost;
        loc.totalGrossPay += item.totalGrossPay;
        loc.employeeCount.add(item.employeeId);
        loc.entryCount += item.entryCount;
      });

      return Array.from(locationMetrics.values()).map((loc: any) => ({
        location: loc.location,
        branches: Array.from(loc.branches),
        totalHours: loc.totalHours,
        totalOvertime: loc.totalOvertime,
        totalTravelKm: loc.totalTravelKm,
        totalCost: loc.totalCost,
        totalGrossPay: loc.totalGrossPay,
        averageEuroPerHour: loc.totalHours > 0 ? loc.totalCost / loc.totalHours : 0,
        averageGrossPayPerHour: loc.totalHours > 0 ? loc.totalGrossPay / loc.totalHours : 0,
        employeeCount: loc.employeeCount.size,
        averageCostPerEmployee: loc.employeeCount.size > 0 ? loc.totalCost / loc.employeeCount.size : 0,
        entryCount: loc.entryCount,
      })).sort((a, b) => b.averageEuroPerHour - a.averageEuroPerHour);
    } catch (error) {
      console.error('❌ Error getting average EUR per address:', error);
      throw error;
    }
  },

  // ADVANCED INSIGHTS
  async getAdvancedInsights(companyId: string, userId: string) {
    try {
      console.log(`🔍 Loading advanced insights for company: ${companyId}`);
      
      const [employeesSnap, timeEntriesSnap, leaveSnap, expensesSnap, timesheetsSnap, invoicesSnap, payrollSnap, payslipsSnap] = await Promise.all([
        getDocs(query(collection(db, 'employees'), where('companyId', '==', companyId))),
        getDocs(query(collection(db, 'timeEntries'), where('companyId', '==', companyId))),
        getDocs(query(collection(db, 'leaveRequests'), where('companyId', '==', companyId))),
        getDocs(query(collection(db, 'expenses'), where('companyId', '==', companyId))),
        getDocs(query(collection(db, 'weeklyTimesheets'), where('companyId', '==', companyId))),
        getDocs(query(collection(db, 'outgoingInvoices'), where('companyId', '==', companyId))),
        getDocs(query(collection(db, 'payrollCalculations'))),
        getDocs(query(collection(db, 'payslips'))),
      ]);

      console.log(`✓ All insights data loaded successfully`);

      const employees = employeesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const timeEntries = timeEntriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const leave = leaveSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const expenses = expensesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const timesheets = timesheetsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const invoices = invoicesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const payroll = payrollSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const payslips = payslipsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Top Performers
      const topPerformers = employees.map((emp: any) => {
        const empHours = timeEntries
          .filter((te: any) => te.employeeId === emp.id)
          .reduce((sum, te: any) => sum + (te.regularHours || 0), 0);
        
        const empInvoiced = invoices
          .filter((inv: any) => inv.items?.some((item: any) => item.employeeIds?.includes(emp.id)))
          .reduce((sum, inv: any) => sum + (inv.totalAmount || 0), 0);

        const empGross = payroll
          .filter((p: any) => p.employeeId === emp.id)
          .reduce((sum, p: any) => sum + (p.grossPay || 0), 0);

        return {
          id: emp.id,
          name: `${emp.personalInfo?.firstName} ${emp.personalInfo?.lastName}`,
          hours: empHours,
          revenue: empInvoiced,
          grossPay: empGross,
          efficiency: empHours > 0 ? empInvoiced / empHours : 0,
        };
      }).filter(e => e.hours > 0).sort((a, b) => b.efficiency - a.efficiency).slice(0, 10);

      // Leave Compliance
      const leaveApproved = leave.filter((l: any) => l.status === 'approved').length;
      const leavePending = leave.filter((l: any) => l.status === 'pending').length;
      const leaveRejected = leave.filter((l: any) => l.status === 'rejected').length;
      const leaveCompliance = employees.length > 0 ? (leaveApproved / employees.length) * 100 : 0;

      // Overtime Analysis
      const totalOvertime = timeEntries.reduce((sum, te: any) => sum + (te.overtimeHours || 0), 0);
      const employeesWithOvertime = new Set(timeEntries.filter((te: any) => te.overtimeHours > 0).map((te: any) => te.employeeId)).size;
      const totalTravelKm = timeEntries.reduce((sum, te: any) => sum + (te.travelKilometers || 0), 0);

      // Profit Analysis
      const totalRevenue = invoices.reduce((sum, inv: any) => sum + (inv.totalAmount || 0), 0);
      const totalExpenses = expenses.reduce((sum, e: any) => sum + (e.amount || 0), 0);
      const totalGrossPay = payroll.reduce((sum, p: any) => sum + (p.grossPay || 0), 0);
      const totalProfit = totalRevenue - totalExpenses - totalGrossPay;
      const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

      // Peak Days
      const dayData = new Map<number, number>();
      timeEntries.forEach((te: any) => {
        const date = te.date?.toDate?.() || new Date(te.date);
        const dayOfWeek = date.getDay();
        const hours = dayData.get(dayOfWeek) || 0;
        dayData.set(dayOfWeek, hours + (te.regularHours || 0));
      });

      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const peakDaysOfWeek = Array.from(dayData.entries())
        .map(([day, hours]) => ({ day: days[day], hours }))
        .sort((a, b) => b.hours - a.hours);

      // Employee Stats
      const activeEmployees = employees.filter((e: any) => e.status === 'active').length;
      const inactiveEmployees = employees.filter((e: any) => e.status === 'inactive').length;

      // Timesheet Stats
      const submittedTimesheets = timesheets.filter((ts: any) => ts.status !== 'draft').length;
      const draftTimesheets = timesheets.filter((ts: any) => ts.status === 'draft').length;
      const processedTimesheets = timesheets.filter((ts: any) => ts.status === 'processed').length;

      // Average Metrics
      const totalHours = timeEntries.reduce((sum, te: any) => sum + (te.regularHours || 0), 0);
      const avgHoursPerEmployee = employees.length > 0 ? totalHours / employees.length : 0;
      const avgRevenuePerEmployee = activeEmployees > 0 ? totalRevenue / activeEmployees : 0;
      const avgCostPerEmployee = activeEmployees > 0 ? totalGrossPay / activeEmployees : 0;

      return {
        summary: {
          totalEmployees: employees.length,
          activeEmployees,
          inactiveEmployees,
          totalHours,
          totalOvertime,
          totalTravelKm,
          totalRevenue,
          totalExpenses,
          totalGrossPay,
          totalProfit,
          profitMargin,
          avgHoursPerEmployee,
          avgRevenuePerEmployee,
          avgCostPerEmployee,
        },
        topPerformers,
        leaveCompliance: {
          complianceRate: leaveCompliance,
          totalRequests: leave.length,
          approved: leaveApproved,
          pending: leavePending,
          rejected: leaveRejected,
        },
        overtimeAnalysis: {
          totalOvertimeHours: totalOvertime,
          employeesWithOvertime,
          averageOvertimePerEmployee: employeesWithOvertime > 0 ? totalOvertime / employeesWithOvertime : 0,
        },
        travelAnalysis: {
          totalKilometers: totalTravelKm,
          averageKmPerEmployee: activeEmployees > 0 ? totalTravelKm / activeEmployees : 0,
        },
        profitAnalysis: {
          revenue: totalRevenue,
          expenses: totalExpenses,
          grossPay: totalGrossPay,
          profit: totalProfit,
          margin: profitMargin,
          revenuePerHour: timeEntries.length > 0 ? totalRevenue / timeEntries.length : 0,
          costPerHour: timeEntries.length > 0 ? totalGrossPay / timeEntries.length : 0,
        },
        timesheetStats: {
          total: timesheets.length,
          submitted: submittedTimesheets,
          draft: draftTimesheets,
          processed: processedTimesheets,
          submissionRate: timesheets.length > 0 ? (submittedTimesheets / timesheets.length) * 100 : 0,
        },
        payrollStats: {
          totalPayrollRecords: payroll.length,
          totalPayslips: payslips.length,
          totalGrossPayroll: totalGrossPay,
          averageGrossPerRecord: payroll.length > 0 ? totalGrossPay / payroll.length : 0,
        },
        peakDaysOfWeek,
      };
    } catch (error) {
      console.error('❌ Error getting advanced insights:', error);
      throw error;
    }
  },

  // EMPLOYEE DETAILED STATS
  async getEmployeeDetailedStats(companyId: string, userId: string, employeeId?: string) {
    try {
      const [employeesSnap, timeEntriesSnap, payrollSnap, leaveSnap] = await Promise.all([
        getDocs(query(collection(db, 'employees'), where('companyId', '==', companyId))),
        getDocs(query(collection(db, 'timeEntries'), where('companyId', '==', companyId))),
        getDocs(query(collection(db, 'payrollCalculations'))),
        getDocs(query(collection(db, 'leaveRequests'), where('companyId', '==', companyId))),
      ]);

      let employees = employeesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (employeeId) {
        employees = employees.filter(e => e.id === employeeId);
      }

      const timeEntries = timeEntriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const payroll = payrollSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const leave = leaveSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const employeeStats = employees.map((emp: any) => {
        const empEntries = timeEntries.filter((te: any) => te.employeeId === emp.id);
        const empPayroll = payroll.filter((p: any) => p.employeeId === emp.id);
        const empLeave = leave.filter((l: any) => l.employeeId === emp.id);

        const totalHours = empEntries.reduce((sum, te: any) => sum + (te.regularHours || 0), 0);
        const totalOvertime = empEntries.reduce((sum, te: any) => sum + (te.overtimeHours || 0), 0);
        const totalGross = empPayroll.reduce((sum, p: any) => sum + (p.grossPay || 0), 0);
        const totalNet = empPayroll.reduce((sum, p: any) => sum + (p.netPay || 0), 0);
        const totalTax = empPayroll.reduce((sum, p: any) => 
          sum + (p.taxes?.incomeTax || 0) + (p.taxes?.socialSecurityEmployee || 0), 0);

        return {
          employeeId: emp.id,
          name: `${emp.personalInfo?.firstName} ${emp.personalInfo?.lastName}`,
          status: emp.status,
          contractType: emp.contractInfo?.type,
          hoursPerWeek: emp.contractInfo?.hoursPerWeek,
          hourlyRate: emp.salaryInfo?.hourlyRate,
          totalHours,
          totalOvertime,
          averageHoursPerWeek: empEntries.length > 0 ? totalHours / Math.ceil(empEntries.length / 5) : 0,
          totalGross,
          totalNet,
          totalTax,
          averageGrossPerMonth: empPayroll.length > 0 ? totalGross / empPayroll.length : 0,
          totalLeave: empLeave.length,
          approvedLeave: empLeave.filter((l: any) => l.status === 'approved').length,
          payrollRecords: empPayroll.length,
        };
      });

      return employeeStats;
    } catch (error) {
      console.error('❌ Error getting employee detailed stats:', error);
      throw error;
    }
  },

  // BRANCH DETAILED STATS
  async getBranchDetailedStats(companyId: string, userId: string, branchId?: string) {
    try {
      const [branchesSnap, employeesSnap, timeEntriesSnap, invoicesSnap, expensesSnap, payrollSnap] = await Promise.all([
        getDocs(query(collection(db, 'branches'), where('companyId', '==', companyId))),
        getDocs(query(collection(db, 'employees'), where('companyId', '==', companyId))),
        getDocs(query(collection(db, 'timeEntries'), where('companyId', '==', companyId))),
        getDocs(query(collection(db, 'outgoingInvoices'), where('companyId', '==', companyId))),
        getDocs(query(collection(db, 'expenses'), where('companyId', '==', companyId))),
        getDocs(query(collection(db, 'payrollCalculations'))),
      ]);

      let branches = branchesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (branchId) {
        branches = branches.filter(b => b.id === branchId);
      }

      const employees = employeesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const timeEntries = timeEntriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const invoices = invoicesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const expenses = expensesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const payroll = payrollSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const branchStats = branches.map((branch: any) => {
        const branchEmployees = employees.filter((e: any) => e.branchId === branch.id);
        const branchEntries = timeEntries.filter((te: any) => te.branchId === branch.id);
        const branchPayroll = payroll.filter((p: any) => 
          branchEmployees.some((e: any) => e.id === p.employeeId)
        );
        const branchExpenses = expenses.filter((ex: any) => 
          branchEmployees.some((e: any) => e.id === ex.employeeId)
        );

        const totalHours = branchEntries.reduce((sum, te: any) => sum + (te.regularHours || 0), 0);
        const totalOvertime = branchEntries.reduce((sum, te: any) => sum + (te.overtimeHours || 0), 0);
        const totalInvoiced = invoices.reduce((sum, inv: any) => sum + (inv.totalAmount || 0), 0);
        const totalExpenses = branchExpenses.reduce((sum, ex: any) => sum + (ex.amount || 0), 0);
        const totalGross = branchPayroll.reduce((sum, p: any) => sum + (p.grossPay || 0), 0);

        return {
          branchId: branch.id,
          branchName: branch.name,
          location: branch.location,
          costCenter: branch.costCenter,
          employeeCount: branchEmployees.length,
          activeEmployees: branchEmployees.filter((e: any) => e.status === 'active').length,
          totalHours,
          totalOvertime,
          totalInvoiced,
          totalExpenses,
          totalGross,
          profit: totalInvoiced - totalExpenses,
          profitMargin: totalInvoiced > 0 ? ((totalInvoiced - totalExpenses) / totalInvoiced) * 100 : 0,
          timeEntryCount: branchEntries.length,
          invoiceCount: invoices.length,
          expenseCount: branchExpenses.length,
          payrollRecords: branchPayroll.length,
        };
      });

      return branchStats;
    } catch (error) {
      console.error('❌ Error getting branch detailed stats:', error);
      throw error;
    }
  },

  // MONTHLY BREAKDOWN
  async getMonthlyBreakdown(companyId: string, userId: string, year: number) {
    try {
      const timeEntriesSnap = await getDocs(
        query(
          collection(db, 'timeEntries'),
          where('companyId', '==', companyId)
        )
      );

      const invoicesSnap = await getDocs(
        query(
          collection(db, 'outgoingInvoices'),
          where('companyId', '==', companyId)
        )
      );

      const payrollSnap = await getDocs(
        query(
          collection(db, 'payrollCalculations')
        )
      );

      const entries = timeEntriesSnap.docs.map(doc => doc.data());
      const invoices = invoicesSnap.docs.map(doc => doc.data());
      const payroll = payrollSnap.docs.map(doc => doc.data());

      const monthlyData = new Map<number, any>();

      for (let month = 1; month <= 12; month++) {
        const monthEntries = entries.filter((e: any) => {
          const date = e.date?.toDate?.() || new Date(e.date);
          return date.getFullYear() === year && (date.getMonth() + 1) === month;
        });

        const monthInvoices = invoices.filter((inv: any) => {
          const date = inv.invoiceDate?.toDate?.() || new Date(inv.invoiceDate);
          return date.getFullYear() === year && (date.getMonth() + 1) === month;
        });

        const monthPayroll = payroll.filter((p: any) => {
          const date = p.periodStartDate?.toDate?.() || new Date(p.periodStartDate);
          return date.getFullYear() === year && (date.getMonth() + 1) === month;
        });

        const totalHours = monthEntries.reduce((sum, e: any) => sum + (e.regularHours || 0), 0);
        const totalOvertime = monthEntries.reduce((sum, e: any) => sum + (e.overtimeHours || 0), 0);
        const totalInvoiced = monthInvoices.reduce((sum, inv: any) => sum + (inv.totalAmount || 0), 0);
        const totalGross = monthPayroll.reduce((sum, p: any) => sum + (p.grossPay || 0), 0);

        monthlyData.set(month, {
          month,
          monthName: new Date(year, month - 1).toLocaleString('en-US', { month: 'long' }),
          totalHours,
          totalOvertime,
          totalInvoiced,
          totalGross,
          averageRevenue: totalHours > 0 ? totalInvoiced / totalHours : 0,
          invoiceCount: monthInvoices.length,
          entryCount: monthEntries.length,
          payrollRecords: monthPayroll.length,
        });
      }

      return Array.from(monthlyData.values());
    } catch (error) {
      console.error('❌ Error getting monthly breakdown:', error);
      throw error;
    }
  },
};