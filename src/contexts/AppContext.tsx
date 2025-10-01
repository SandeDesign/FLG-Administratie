import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { Company, Employee, Branch, DashboardStats } from '../types';
import { getCompanies, getEmployees, getBranches, getPendingLeaveApprovals } from '../services/firebase'; // Assuming getPendingTimesheets is also in firebase.ts or a similar service
import { getPendingExpenses } from '../services/firebase'; // Assuming getPendingExpenses is also in firebase.ts or a similar service
import { getPayrollCalculations } from '../services/payrollService'; // Assuming this service exists
import { getPendingTimesheets } from '../services/timesheetService'; // Import getPendingTimesheets

interface AppContextType {
  companies: Company[];
  employees: Employee[];
  branches: Branch[];
  selectedCompany: Company | null;
  dashboardStats: DashboardStats;
  loading: boolean;
  darkMode: boolean;
  currentEmployeeId: string | null;
  setSelectedCompany: (company: Company | null) => void;
  refreshDashboardStats: () => Promise<void>;
  toggleDarkMode: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, userRole, currentEmployeeId } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    activeEmployees: 0,
    totalGrossThisMonth: 0,
    companiesCount: 0,
    branchesCount: 0,
    pendingApprovals: 0,
  });
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('darkMode') === 'true' || 
             window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', darkMode.toString());
  }, [darkMode]);

  const calculateDashboardStats = useCallback(async (
    companiesData: Company[],
    employeesData: Employee[],
    branchesData: Branch[],
    userId: string
  ) => {
    const activeEmployees = employeesData.filter(emp => emp.status === 'active').length;
    const companiesCount = companiesData.length;
    const branchesCount = branchesData.length;

    let totalPendingApprovals = 0;
    let totalGrossThisMonth = 0;

    if (companiesData.length > 0) {
      // Calculate pending leave approvals
      const pendingLeaveRequests = await Promise.all(
        companiesData.map(company => getPendingLeaveApprovals(company.id, userId))
      );
      totalPendingApprovals += pendingLeaveRequests.flat().length;

      // Calculate pending timesheet approvals
      const pendingTimesheets = await Promise.all(
        companiesData.map(company => getPendingTimesheets(userId, company.id))
      );
      totalPendingApprovals += pendingTimesheets.flat().length;

      // Calculate pending expense approvals
      const pendingExpenses = await Promise.all(
        companiesData.map(company => getPendingExpenses(company.id, userId))
      );
      totalPendingApprovals += pendingExpenses.flat().length;

      // Calculate total gross this month (simplified for now, would need more complex payroll logic)
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const payrollCalculations = await getPayrollCalculations(userId);
      totalGrossThisMonth = payrollCalculations.reduce((sum, calc) => {
        if (calc.periodStartDate.getMonth() === currentMonth && calc.periodStartDate.getFullYear() === currentYear) {
          return sum + calc.grossPay;
        }
        return sum;
      }, 0);
    }

    setDashboardStats({
      activeEmployees,
      totalGrossThisMonth,
      companiesCount,
      branchesCount,
      pendingApprovals: totalPendingApprovals,
    });
  }, []);

  const loadData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [companiesData, employeesData, branchesData] = await Promise.all([
        getCompanies(user.uid),
        getEmployees(user.uid),
        getBranches(user.uid),
      ]);

      setCompanies(companiesData);
      setEmployees(employeesData);
      setBranches(branchesData);

      if (companiesData.length > 0 && !selectedCompany) {
        setSelectedCompany(companiesData); // Select the first company if none is selected
      }

      if (userRole === 'admin') {
        await calculateDashboardStats(companiesData, employeesData, branchesData, user.uid);
      }
    } catch (error) {
      console.error('Error loading app data:', error);
      // Optionally show a toast notification for the error
    } finally {
      setLoading(false);
    }
  }, [user, userRole, selectedCompany, calculateDashboardStats]);

  useEffect(() => {
    if (user && userRole === 'admin') {
      loadData();
    } else if (user && userRole === 'employee') {
      // For employees, we might only need their specific data, not all companies/employees
      // This part can be optimized if employee dashboard needs less global data
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, [user, userRole, loadData]);

  const refreshDashboardStats = useCallback(async () => {
    if (user && userRole === 'admin') {
      await loadData();
    }
  }, [user, userRole, loadData]);

  const toggleDarkMode = () => {
    setDarkMode(prevMode => !prevMode);
  };

  return (
    <AppContext.Provider
      value={{
        companies,
        employees,
        branches,
        selectedCompany,
        dashboardStats,
        loading,
        darkMode,
        currentEmployeeId,
        setSelectedCompany,
        refreshDashboardStats,
        toggleDarkMode,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};