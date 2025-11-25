import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { Company, Employee, Branch, DashboardStats } from '../types';
import { getCompanies, getEmployees, getBranches, getPendingLeaveApprovals, getUserSettings, getUserRole, getCompanyById } from '../services/firebase';
import { getPendingExpenses } from '../services/firebase';
import { getPayrollCalculations } from '../services/payrollService';
import { getPendingTimesheets } from '../services/timesheetService';
import { applyThemeColor } from '../utils/themeColors';

interface AppContextType {
  companies: Company[];
  employees: Employee[];
  branches: Branch[];
  selectedCompany: Company | null;
  dashboardStats: DashboardStats;
  loading: boolean;
  currentEmployeeId: string | null;
  queryUserId: string | null; // ✅ NIEUW: userId voor data queries (voor managers = company owner, voor admins = eigen uid)
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
  const [queryUserId, setQueryUserId] = useState<string | null>(null); // ✅ NIEUW: userId voor data queries
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    activeEmployees: 0,
    totalGrossThisMonth: 0,
    companiesCount: 0,
    branchesCount: 0,
    pendingApprovals: 0,
  });

  // Use ref to track if data is being loaded to prevent duplicate calls
  const isLoadingRef = useRef(false);

  // Calculate dashboard stats - PURE FUNCTION, no setState in dependencies
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
          const pendingLeaveRequests = await Promise.all(
            companiesData.map(company => getPendingLeaveApprovals(company.id, userId).catch(() => []))
          );
          totalPendingApprovals += pendingLeaveRequests.flat().length;
        } catch (error) {
          console.error('Error calculating pending leaves:', error);
        }

        try {
          const pendingTimesheets = await Promise.all(
            companiesData.map(company => getPendingTimesheets(userId, company.id).catch(() => []))
          );
          totalPendingApprovals += pendingTimesheets.flat().length;
        } catch (error) {
          console.error('Error calculating pending timesheets:', error);
        }

        try {
          const pendingExpenses = await Promise.all(
            companiesData.map(company => getPendingExpenses(company.id, userId).catch(() => []))
          );
          totalPendingApprovals += pendingExpenses.flat().length;
        } catch (error) {
          console.error('Error calculating pending expenses:', error);
        }

        try {
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

  // Main load function - loads all data AND sets default company
  const loadData = useCallback(async () => {
    if (!user || !adminUserId) {
      console.log('Cannot load data - missing user or adminUserId:', { user: !!user, adminUserId });
      setLoading(false);
      return;
    }

    if (isLoadingRef.current) {
      console.log('Already loading data, skipping duplicate call');
      return;
    }

    try {
      isLoadingRef.current = true;
      setLoading(true);
      console.log('Loading data for adminUserId:', adminUserId, 'userRole:', userRole);
      
      let companiesData: Company[] = [];
      let employeesData: Employee[] = [];
      let branchesData: Branch[] = [];

      // ✅ MANAGER: Load only assigned company (without userId check)
      if (userRole === 'manager') {
        try {
          const roleData = await getUserRole(user.uid);
          console.log('Manager role data:', roleData);

          if (roleData?.assignedCompanyId) {
            // Use getCompanyById instead of getCompany for managers
            // Managers access companies assigned to them, not owned by their userId
            const company = await getCompanyById(roleData.assignedCompanyId);
            if (company) {
              companiesData = [company];
              console.log('Loaded manager assigned company:', company);

              // ✅ FIX: Use the company owner's userId for loading employees/branches
              // Data is stored with the admin's userId, not the manager's userId
              const companyOwnerUserId = company.userId;
              console.log('Using company owner userId for queries:', companyOwnerUserId);

              // ✅ NIEUW: Set queryUserId for managers to use in other pages
              setQueryUserId(companyOwnerUserId);

              try {
                // ✅ FIX: Voor project companies, laad ALLE employees van de admin
                // Employees zijn gekoppeld aan Buddy (employer) maar werken voor project companies via workCompanies[]
                // De filtering op workCompanies.includes(companyId) gebeurt client-side in de pagina's
                // Note: companyType kan 'project' of 'work_company' zijn (legacy inconsistentie)
                const isProjectCompany = company.companyType === 'project' || company.companyType === 'work_company';

                if (isProjectCompany) {
                  // Load ALL employees - they'll be filtered by workCompanies/projectCompanies in the pages
                  employeesData = await getEmployees(companyOwnerUserId);
                  branchesData = await getBranches(companyOwnerUserId);
                  console.log('Loaded ALL employees for project company manager:', employeesData.length);
                } else {
                  // For employer/payroll companies, filter by companyId as before
                  employeesData = await getEmployees(companyOwnerUserId, company.id);
                  branchesData = await getBranches(companyOwnerUserId, company.id);
                }
                console.log('Loaded employees for manager:', employeesData.length);
                console.log('Loaded branches for manager:', branchesData.length);
              } catch (error) {
                console.error('Error loading manager data:', error);
              }
            }
          } else {
            console.warn('Manager has no assigned company!');
            companiesData = [];
          }
        } catch (error) {
          console.error('Error loading manager company:', error);
          companiesData = [];
        }
      } else {
        // ✅ ADMIN/EMPLOYEE: Load all companies
        const [companies, employees, branches] = await Promise.all([
          getCompanies(adminUserId),
          getEmployees(adminUserId),
          getBranches(adminUserId),
        ]);

        companiesData = companies;
        employeesData = employees;
        branchesData = branches;

        // ✅ NIEUW: Set queryUserId for admins/employees
        setQueryUserId(adminUserId);
      }

      console.log('Loaded companies:', companiesData.length);
      console.log('Loaded employees:', employeesData.length);
      console.log('Loaded branches:', branchesData.length);

      setCompanies(companiesData);
      setEmployees(employeesData);
      setBranches(branchesData);

      // Set default company
      let defaultCompanyId: string | null = null;

      if (userRole === 'admin') {
        try {
          const userSettings = await getUserSettings(adminUserId);
          defaultCompanyId = userSettings?.defaultCompanyId || null;
        } catch (error) {
          console.error('Error loading user settings:', error);
        }
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
      isLoadingRef.current = false;
      setLoading(false);
    }
  }, [user, adminUserId, userRole, currentEmployeeId, calculateDashboardStats]);

  // Main useEffect - ONLY depends on auth values - runs ONCE on login
  useEffect(() => {
    if (user && adminUserId && (userRole === 'admin' || userRole === 'employee' || userRole === 'manager')) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [user?.uid, adminUserId, userRole]);

  // ✅ REFRESH ONLY recalculates dashboard stats WITHOUT reloading data or changing company
  const refreshDashboardStats = useCallback(async () => {
    if (userRole === 'admin' && companies.length > 0 && employees.length > 0 && branches.length > 0) {
      console.log('Refreshing dashboard stats only - NOT reloading data');
      await calculateDashboardStats(companies, employees, branches, adminUserId);
    }
  }, [userRole, companies, employees, branches, adminUserId, calculateDashboardStats]);

  // Apply theme color when selected company changes
  useEffect(() => {
    if (selectedCompany?.themeColor) {
      applyThemeColor(selectedCompany.themeColor);
    } else {
      applyThemeColor('blue'); // Default theme
    }
  }, [selectedCompany?.id, selectedCompany?.themeColor]);

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
        queryUserId, // ✅ NIEUW: userId voor data queries
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