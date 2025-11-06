import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { Company, Employee, Branch, DashboardStats } from '../types';
import { getCompanies, getEmployees, getBranches, getPendingLeaveApprovals, getUserSettings } from '../services/firebase'; // Assuming getPendingTimesheets is also in firebase.ts or a similar service
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
  currentEmployeeId: string | null;
  setSelectedCompany: (company: Company | null) => void;
  refreshDashboardStats: () => Promise<void>;
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

  // ✅ Use ref to track if we've already loaded to prevent duplicate calls
  const hasLoadedRef = useRef(false);

  const calculateDashboardStats = useCallback(async (
    companiesData: Company[],
    employeesData: Employee[],
    branchesData: Branch[],
    userId: string
  ) => {
    try {
      const activeEmployees = employeesData.filter(emp => emp.status === 'active').length;
      const companiesCount = companiesData.length;
      const branchesCount = branchesData.length;

      let totalPendingApprovals = 0;
      let totalGrossThisMonth = 0;

      if (companiesData.length > 0) {
        try {
          // Calculate pending leave approvals
          const pendingLeaveRequests = await Promise.all(
            companiesData.map(company => getPendingLeaveApprovals(company.id, userId).catch(() => []))
          );
          totalPendingApprovals += pendingLeaveRequests.flat().length;
        } catch (error) {
          console.error('Error calculating pending leaves:', error);
        }

        try {
          // Calculate pending timesheet approvals
          const pendingTimesheets = await Promise.all(
            companiesData.map(company => getPendingTimesheets(userId, company.id).catch(() => []))
          );
          totalPendingApprovals += pendingTimesheets.flat().length;
        } catch (error) {
          console.error('Error calculating pending timesheets:', error);
        }

        try {
          // Calculate pending expense approvals
          const pendingExpenses = await Promise.all(
            companiesData.map(company => getPendingExpenses(company.id, userId).catch(() => []))
          );
          totalPendingApprovals += pendingExpenses.flat().length;
        } catch (error) {
          console.error('Error calculating pending expenses:', error);
        }

        try {
          // Calculate total gross this month (simplified for now, would need more complex payroll logic)
          const currentMonth = new Date().getMonth();
          const currentYear = new Date().getFullYear();
          const payrollCalculations = await getPayrollCalculations(userId).catch(() => []);
          totalGrossThisMonth = payrollCalculations.reduce((sum, calc) => {
            if (calc.periodStartDate.getMonth() === currentMonth && calc.periodStartDate.getFullYear() === currentYear) {
              return sum + calc.grossPay;
            }
            return sum;
          }, 0);
        } catch (error) {
          console.error('Error calculating payroll:', error);
        }
      }

      setDashboardStats({
        activeEmployees,
        totalGrossThisMonth,
        companiesCount,
        branchesCount,
        pendingApprovals: totalPendingApprovals,
      });
    } catch (error) {
      console.error('Error in calculateDashboardStats:', error);
    }
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

      // ✅ NIEUW: Load default company from database
      let defaultCompanyId: string | null = null;

      if (userRole === 'admin') {
        const userSettings = await getUserSettings(adminUserId);
        defaultCompanyId = userSettings?.defaultCompanyId || null;
      }

      // Fallback: check localStorage
      if (!defaultCompanyId) {
        const storedDefault = localStorage.getItem(`defaultCompany_${adminUserId}`);
        defaultCompanyId = storedDefault || null;
      }

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
        const companyToSelect = defaultCompanyId 
          ? companiesData.find(c => c.id === defaultCompanyId) 
          : companiesData[0];
        
        setSelectedCompany(companyToSelect || companiesData[0]);
        
        // Save to localStorage as fallback
        if (companyToSelect) {
          localStorage.setItem(`defaultCompany_${adminUserId}`, companyToSelect.id);
        }
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

  // ✅ FIXED: Only load once when user/adminUserId changes - NOT on every render
  useEffect(() => {
    if (user && adminUserId && (userRole === 'admin' || userRole === 'employee')) {
      // Only load if we haven't loaded yet OR if the adminUserId changed
      if (!hasLoadedRef.current || hasLoadedRef.current !== adminUserId) {
        hasLoadedRef.current = adminUserId;
        loadData();
      }
    } else {
      setLoading(false);
    }
  }, [user?.uid, adminUserId, userRole]); // ✅ FIXED: Only depend on stable values

  const refreshDashboardStats = useCallback(async () => {
    if (user && adminUserId && userRole === 'admin') {
      await loadData();
    }
  }, [user, adminUserId, userRole, loadData]);

  return (
    <AppContext.Provider
      value={{
        companies,
        employees,
        branches,
        selectedCompany,
        dashboardStats,
        loading,
        currentEmployeeId,
        setSelectedCompany,
        refreshDashboardStats,
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