import {
  collection, query, where, getDocs, Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  ProjectStatistics, InvoiceMetrics, ProductionMetrics,
  EmployeeMetrics, MonthlyData
} from '../types/statistics';

export const projectStatisticsService = {
  async getProjectStatistics(
    companyId: string,
    userId: string
  ): Promise<ProjectStatistics> {
    try {
      const invoicesSnap = await getDocs(
        query(
          collection(db, 'outgoingInvoices'),
          where('companyId', '==', companyId),
          where('userId', '==', userId)
        )
      );

      const productionSnap = await getDocs(
        query(
          collection(db, 'productionWeeks'),
          where('companyId', '==', companyId),
          where('userId', '==', userId)
        )
      );

      const employeesSnap = await getDocs(
        query(
          collection(db, 'employees'),
          where('companyId', '==', companyId),
          where('userId', '==', userId)
        )
      );

      const invoices = invoicesSnap.docs.map(doc => doc.data());
      const productions = productionSnap.docs.map(doc => doc.data());
      const employees = employeesSnap.docs.map(doc => doc.data());

      const totalInvoiceValue = invoices.reduce((sum, inv: any) => sum + (inv.totalAmount || 0), 0);
      const totalProductionHours = productions.reduce((sum, prod: any) => sum + (prod.totalHours || 0), 0);
      const activeEmployees = employees.filter((emp: any) => emp.status === 'active').length;

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const invoicesThisMonth = invoices.filter((inv: any) => {
        const invDate = inv.invoiceDate?.toDate?.() || new Date(inv.invoiceDate);
        return invDate >= monthStart && invDate <= monthEnd;
      });

      const productionsThisMonth = productions.filter((prod: any) => {
        const prodDate = prod.createdAt?.toDate?.() || new Date(prod.createdAt);
        return prodDate >= monthStart && prodDate <= monthEnd;
      });

      const valueThisMonth = invoicesThisMonth.reduce((sum, inv: any) => sum + (inv.totalAmount || 0), 0);

      return {
        totalInvoices: invoices.length,
        totalInvoiceValue,
        totalProductionHours,
        totalEmployees: employees.length,
        activeEmployees,
        averageHoursPerEmployee: totalProductionHours / (activeEmployees || 1),
        projectCount: 1,
        productionsThisMonth: productionsThisMonth.length,
        invoicesThisMonth: invoicesThisMonth.length,
        valueThisMonth,
        invoiceProcessingSpeed: calculateProcessingSpeed(invoices),
      };
    } catch (error) {
      console.error('Error getting project statistics:', error);
      throw error;
    }
  },

  async getInvoiceMetrics(
    companyId: string,
    userId: string
  ): Promise<InvoiceMetrics> {
    try {
      const invoicesSnap = await getDocs(
        query(
          collection(db, 'outgoingInvoices'),
          where('companyId', '==', companyId),
          where('userId', '==', userId)
        )
      );

      const invoices: any[] = invoicesSnap.docs.map(doc => doc.data());

      const statusBreakdown = {
        draft: invoices.filter((inv: any) => inv.status === 'draft').length,
        approved: invoices.filter((inv: any) => inv.status === 'approved').length,
        paid: invoices.filter((inv: any) => inv.status === 'paid').length,
        rejected: invoices.filter((inv: any) => inv.status === 'rejected').length,
      };

      const monthlyData = groupInvoicesByMonth(invoices);
      const monthlyTrend = convertToMonthlyTrend(monthlyData);

      const customerMap = new Map();
      invoices.forEach((inv: any) => {
        const customerName = inv.customer?.name || 'Onbekend';
        const current = customerMap.get(customerName) || 0;
        customerMap.set(customerName, current + (inv.totalAmount || 0));
      });

      const topCustomers = Array.from(customerMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10)
        .map(item => ({
          name: item.name,
          value: item.value
        }));

      const totalValue = invoices.reduce((sum, inv: any) => sum + (inv.totalAmount || 0), 0);
      const conversionRate = invoices.length > 0 ? 85 : 0;
      const averageValuePerHour = calculateAverageValuePerHour(invoices);
      const averageDaysToInvoice = calculateAverageDaysToInvoice(invoices);

      return {
        statusBreakdown,
        monthlyTrend,
        topCustomers,
        totalValue,
        conversionRate,
        averageValuePerHour,
        averageDaysToInvoice,
      };
    } catch (error) {
      console.error('Error getting invoice metrics:', error);
      throw error;
    }
  },

  async getProductionMetrics(
    companyId: string,
    userId: string
  ): Promise<ProductionMetrics> {
    try {
      const productionSnap = await getDocs(
        query(
          collection(db, 'productionWeeks'),
          where('companyId', '==', companyId),
          where('userId', '==', userId)
        )
      );

      const productions: any[] = productionSnap.docs.map(doc => doc.data());

      const statusBreakdown = {
        draft: productions.filter((p: any) => p.status === 'draft').length,
        ready: productions.filter((p: any) => p.status === 'ready').length,
        invoiced: productions.filter((p: any) => p.status === 'invoiced').length,
      };

      const hoursByType = calculateHoursByType(productions);
      const weeklyTrend = calculateWeeklyTrend(productions);

      const totalHours = productions.reduce((sum, p: any) => sum + (p.totalHours || 0), 0);
      const averageHoursPerWeek = totalHours / (productions.length || 1);

      return {
        statusBreakdown,
        hoursByType,
        weeklyTrend,
        totalHours,
        averageHoursPerWeek,
        totalProductions: productions.length,
      };
    } catch (error) {
      console.error('Error getting production metrics:', error);
      throw error;
    }
  },

  async getEmployeeMetrics(
    companyId: string,
    userId: string
  ): Promise<EmployeeMetrics> {
    try {
      const employeesSnap = await getDocs(
        query(
          collection(db, 'employees'),
          where('companyId', '==', companyId),
          where('userId', '==', userId)
        )
      );

      const timeEntriesSnap = await getDocs(
        query(
          collection(db, 'timeEntries'),
          where('companyId', '==', companyId),
          where('userId', '==', userId)
        )
      );

      const invoicesSnap = await getDocs(
        query(
          collection(db, 'outgoingInvoices'),
          where('companyId', '==', companyId),
          where('userId', '==', userId)
        )
      );

      const employees = employeesSnap.docs.map(doc => doc.data());
      const timeEntries = timeEntriesSnap.docs.map(doc => doc.data());
      const invoices = invoicesSnap.docs.map(doc => doc.data());

      const employeeStats = employees.map((emp: any) => {
        const empTimeEntries = timeEntries.filter((te: any) => te.employeeId === emp.id);
        const totalHours = empTimeEntries.reduce((sum, te: any) => sum + (te.regularHours || 0) + (te.overtimeHours || 0), 0);
        
        const totalInvoiced = invoices.reduce((sum, inv: any) => {
          const itemsForEmp = (inv.items || []).filter((item: any) => 
            item.employeeIds?.includes(emp.id)
          );
          return sum + itemsForEmp.reduce((itemSum, item: any) => itemSum + (item.amount || 0), 0);
        }, 0);

        return {
          id: emp.id,
          name: `${emp.personalInfo?.firstName || ''} ${emp.personalInfo?.lastName || ''}`.trim(),
          totalHours,
          totalInvoiced,
          hourlyRate: emp.salaryInfo?.hourlyRate || 0,
          contractType: emp.contractInfo?.type,
          status: emp.status,
        };
      });

      const topPerformers = employeeStats
        .sort((a, b) => b.totalHours - a.totalHours)
        .slice(0, 10);

      const totalHours = employeeStats.reduce((sum, emp) => sum + emp.totalHours, 0);
      const totalInvoiced = employeeStats.reduce((sum, emp) => sum + emp.totalInvoiced, 0);
      const averageHoursPerEmployee = totalHours / (employeeStats.length || 1);

      return {
        topPerformers,
        totalEmployees: employees.length,
        totalHours,
        totalInvoiced,
        averageHoursPerEmployee,
        employeeStats,
      };
    } catch (error) {
      console.error('Error getting employee metrics:', error);
      throw error;
    }
  },
};

// HELPER FUNCTIONS (OUTSIDE OBJECT)

function calculateProcessingSpeed(invoices: any[]): number {
  if (invoices.length === 0) return 0;
  
  const approved = invoices.filter((inv: any) => inv.status === 'approved' || inv.status === 'paid');
  return Math.round((approved.length / invoices.length) * 100);
}

function groupInvoicesByMonth(invoices: any[]): Map<string, any[]> {
  const map = new Map();
  
  invoices.forEach((inv: any) => {
    const date = inv.invoiceDate?.toDate?.() || new Date(inv.invoiceDate);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(inv);
  });

  return map;
}

function convertToMonthlyTrend(monthlyData: Map<string, any[]>): MonthlyData[] {
  return Array.from(monthlyData.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([month, invoices]) => ({
      month,
      total: invoices.reduce((sum, inv: any) => sum + (inv.totalAmount || 0), 0),
      count: invoices.length,
    }));
}

function calculateAverageValuePerHour(invoices: any[]): number {
  if (invoices.length === 0) return 0;
  
  const totalValue = invoices.reduce((sum, inv: any) => sum + (inv.totalAmount || 0), 0);
  const totalEstimatedHours = invoices.reduce((sum, inv: any) => {
    return sum + (inv.items || []).reduce((itemSum, item: any) => itemSum + (item.quantity || 1), 0);
  }, 0);

  return totalEstimatedHours > 0 ? totalValue / totalEstimatedHours : 0;
}

function calculateAverageDaysToInvoice(invoices: any[]): number {
  if (invoices.length === 0) return 0;

  const days = invoices
    .filter((inv: any) => inv.invoiceDate && inv.createdAt)
    .map((inv: any) => {
      const createdDate = inv.createdAt?.toDate?.() || new Date(inv.createdAt);
      const invoiceDate = inv.invoiceDate?.toDate?.() || new Date(inv.invoiceDate);
      return Math.round((invoiceDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
    });

  return days.length > 0 ? days.reduce((a, b) => a + b, 0) / days.length : 0;
}

function calculateHoursByType(productions: any[]): any[] {
  const hoursByType: { [key: string]: number } = {
    'Reguliere Uren': 0,
    'Overuren': 0,
    'Onregelmatige Uren': 0,
  };

  productions.forEach((prod: any) => {
    hoursByType['Reguliere Uren'] += prod.regularHours || 0;
    hoursByType['Overuren'] += prod.overtimeHours || 0;
    hoursByType['Onregelmatige Uren'] += prod.irregularHours || 0;
  });

  return Object.entries(hoursByType)
    .map(([name, value]) => ({
      name,
      value,
    }))
    .filter(item => item.value > 0);
}

function calculateWeeklyTrend(productions: any[]): MonthlyData[] {
  const weekMap = new Map<number, number>();

  productions.forEach((prod: any) => {
    const week = prod.week || 0;
    const current = weekMap.get(week) || 0;
    weekMap.set(week, current + (prod.totalHours || 0));
  });

  return Array.from(weekMap.entries())
    .sort((a, b) => a[0] - b[0])
    .slice(-13)
    .map(([week, hours]) => ({
      month: `Week ${week}`,
      total: 0,
      count: 0,
      hours,
    }));
}