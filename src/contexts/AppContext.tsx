import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { Company, Employee, Branch, DashboardStats } from '../types';
import { getCompanies, getEmployees, getBranches, getUserSettings, getUserRole, getCompanyById, syncBoekhouderAssignments } from '../services/firebase';
import { applyThemeColor } from '../utils/themeColors';

interface AppContextType {
  companies: Company[];
  employees: Employee[];
  branches: Branch[];
  selectedCompany: Company | null;
  selectedYear: number;
  selectedQuarter: number | null; // null = heel jaar, 1-4 = Q1-Q4
  dashboardStats: DashboardStats;
  loading: boolean;
  currentEmployeeId: string | null;
  queryUserId: string | null;
  setSelectedCompany: (company: Company | null) => void;
  setSelectedYear: (year: number) => void;
  setSelectedQuarter: (quarter: number | null) => void;
  refreshDashboardStats: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, userRole, currentEmployeeId, adminUserId } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [selectedYear, setSelectedYearState] = useState<number>(new Date().getFullYear());
  const [selectedQuarter, setSelectedQuarterState] = useState<number | null>(null);
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

  // OPTIMALISATIE: vroeger deed dit 4 queries × N bedrijven (leave/timesheets/
  // expenses/payroll) bij elke login + bij elke refreshDashboardStats call.
  // dashboardStats wordt echter nergens uit de context gelezen (grep-check).
  // Dashboard.tsx heeft z'n eigen loadAdminData die deze info ophaalt voor
  // alleen de geselecteerde company — véél zuiniger.
  // Functie blijft als no-op voor backwards compat met refreshDashboardStats
  // callers in Employees/Companies pages.
  const calculateDashboardStats = useCallback(async (
    companiesData: Company[],
    employeesData: Employee[],
    _branchesData: Branch[],
    _userId: string
  ) => {
    setDashboardStats(prev => ({
      ...prev,
      activeEmployees: employeesData.filter(emp => emp.status === 'active').length,
      companiesCount: companiesData.length,
      branchesCount: _branchesData.length,
    }));
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
      } else if (userRole === 'boekhouder') {
        // ✅ BOEKHOUDER: Laad companies van ALLE toegewezen admins
        try {
          const assignedAdminIds = await syncBoekhouderAssignments(
            user.email || '',
            user.uid
          );
          console.log('Boekhouder assigned admins:', assignedAdminIds);

          if (assignedAdminIds.length === 0) {
            console.warn('Boekhouder has no assigned admins yet.');
            companiesData = [];
            employeesData = [];
            branchesData = [];
            setQueryUserId(null);
          } else {
            const companyResults = await Promise.all(
              assignedAdminIds.map(id => getCompanies(id).catch(() => []))
            );
            companiesData = companyResults.flat();

            // Employees en branches worden per geselecteerd bedrijf geladen in de pagina's
            // Boekhouder hoeft niet globaal alle medewerkers te zien
            employeesData = [];
            branchesData = [];

            // ✅ Start direct met eerste admin's UID als queryUserId zodat de initial
            // page render data laadt. Wisselt mee met selectedCompany via useEffect.
            setQueryUserId(companiesData[0]?.userId || assignedAdminIds[0]);
          }
        } catch (error) {
          console.error('Error loading boekhouder data:', error);
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

      // Filter companies based on user's visibleCompanyIds setting
      if ((userRole === 'admin' || userRole === 'co-admin') && user) {
        try {
          const userSettings = await getUserSettings(user.uid);
          const visibleIds = userSettings?.visibleCompanyIds;
          if (visibleIds && Array.isArray(visibleIds) && visibleIds.length > 0) {
            companiesData = companiesData.filter(c => visibleIds.includes(c.id));
            console.log('Filtered to visible companies:', companiesData.length);
          }
        } catch (error) {
          console.error('Error filtering visible companies:', error);
        }
      }

      setCompanies(companiesData);
      setEmployees(employeesData);
      setBranches(branchesData);

      // Set default company
      let defaultCompanyId: string | null = null;

      if ((userRole === 'admin' || userRole === 'co-admin') && user) {
        try {
          const userSettings = await getUserSettings(user.uid);
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

      const storedYear = localStorage.getItem(`selectedYear_${adminUserId}`);
      if (storedYear) {
        const year = parseInt(storedYear, 10);
        if (!isNaN(year) && year >= 2020 && year <= 2050) {
          setSelectedYearState(year);
        }
      }

      const storedQuarter = localStorage.getItem(`selectedQuarter_${adminUserId}`);
      if (storedQuarter) {
        const q = parseInt(storedQuarter, 10);
        if (q >= 1 && q <= 4) {
          setSelectedQuarterState(q);
        }
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

      if (userRole === 'admin' || userRole === 'co-admin') {
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
    if (user && adminUserId && (userRole === 'admin' || userRole === 'co-admin' || userRole === 'employee' || userRole === 'manager' || userRole === 'boekhouder')) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [user?.uid, adminUserId, userRole]);

  // Boekhouder: wanneer een bedrijf geselecteerd wordt, zet queryUserId op de eigenaar
  // van dat bedrijf zodat alle pagina's data laden uit de juiste admin namespace.
  useEffect(() => {
    if (userRole === 'boekhouder' && selectedCompany?.userId) {
      setQueryUserId(selectedCompany.userId);
    }
  }, [userRole, selectedCompany?.userId]);

  // ✅ REFRESH ONLY recalculates dashboard stats WITHOUT reloading data or changing company
  const refreshDashboardStats = useCallback(async () => {
    if ((userRole === 'admin' || userRole === 'co-admin') && companies.length > 0 && employees.length > 0 && branches.length > 0) {
      console.log('Refreshing dashboard stats only - NOT reloading data');
      await calculateDashboardStats(companies, employees, branches, adminUserId);
    }
  }, [userRole, companies, employees, branches, adminUserId, calculateDashboardStats]);

  const setSelectedYear = useCallback((year: number) => {
    setSelectedYearState(year);
    if (adminUserId) {
      localStorage.setItem(`selectedYear_${adminUserId}`, String(year));
    }
  }, [adminUserId]);

  const setSelectedQuarter = useCallback((quarter: number | null) => {
    setSelectedQuarterState(quarter);
    if (adminUserId) {
      if (quarter === null) {
        localStorage.removeItem(`selectedQuarter_${adminUserId}`);
      } else {
        localStorage.setItem(`selectedQuarter_${adminUserId}`, String(quarter));
      }
    }
  }, [adminUserId]);

  // Persist selectedCompany naar localStorage bij wijziging
  useEffect(() => {
    if (selectedCompany && adminUserId) {
      localStorage.setItem(`defaultCompany_${adminUserId}`, selectedCompany.id);
    }
  }, [selectedCompany?.id, adminUserId]);

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
        selectedYear,
        selectedQuarter,
        dashboardStats,
        loading,
        currentEmployeeId,
        queryUserId,
        setSelectedCompany,
        setSelectedYear,
        setSelectedQuarter,
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