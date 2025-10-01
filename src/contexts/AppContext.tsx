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
  const { user, userRole, currentEmployeeId, adminUserId } = useAuth();
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
    if (!user || !adminUserId) {
      console.log('Cannot load data - missing user or adminUserId:', { user: !!user, adminUserId });
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('Loading data for adminUserId:', adminUserId);
      const [companiesData, employeesData, branchesData] = await Promise.all([
        getCompanies(adminUserId),
        getEmployees(adminUserId),
        getBranches(adminUserId),
      ]);

      console.log('Loaded companies:', companiesData.length, companiesData);
      console.log('Loaded employees:', employeesData.length, employeesData);
      console.log('Loaded branches:', branchesData.length, branchesData);

      setCompanies(companiesData);
      setEmployees(employeesData);
      setBranches(branchesData);

      if (userRole === 'employee' && currentEmployeeId) {
        const currentEmployee = employeesData.find(e => e.id === currentEmployeeId);
        if (currentEmployee) {
          const employeeCompany = companiesData.find(c => c.id === currentEmployee.companyId);
          if (employeeCompany) {
            setSelectedCompany(prev => {
              if (prev?.id !== employeeCompany.id) {
                return employeeCompany;
              }
              return prev;
            });
          }
        }
      } else if (companiesData.length > 0) {
        setSelectedCompany(prev => {
          if (!prev && companiesData.length > 0) {
            return companiesData[0];
          }
          return prev;
        });
      }

      if (userRole === 'admin') {
        await calculateDashboardStats(companiesData, employeesData, branchesData, adminUserId);
      }
    } catch (error) {
      console.error('Error loading app data:', error);
      console.error('Error details:', error);
    } finally {
      setLoading(false);
    }
  }, [user, adminUserId, userRole, currentEmployeeId, calculateDashboardStats]);

  useEffect(() => {
    if (user && adminUserId && (userRole === 'admin' || userRole === 'employee')) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [user, adminUserId, userRole, currentEmployeeId]);

  const refreshDashboardStats = useCallback(async () => {
    if (user && adminUserId && userRole === 'admin') {
      await loadData();
    }
  }, [user, adminUserId, userRole, loadData]);

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