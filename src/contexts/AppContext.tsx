import React, { createContext, useContext, useState, useEffect } from 'react';
import { Company, Employee, Branch, DashboardStats } from '../types';
import { useAuth } from './AuthContext';
import { getCompanies, getBranches, getEmployees, getTimeEntries } from '../services/firebase';

interface AppContextType {
  currentCompany: Company | null;
  setCurrentCompany: (company: Company | null) => void;
  companies: Company[];
  refreshCompanies: () => Promise<void>;
  branches: Branch[];
  refreshBranches: () => Promise<void>;
  employees: Employee[];
  refreshEmployees: () => Promise<void>;
  dashboardStats: DashboardStats;
  refreshDashboardStats: () => Promise<void>;
  darkMode: boolean;
  toggleDarkMode: () => void;
  loading: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    activeEmployees: 0,
    totalGrossThisMonth: 0,
    companiesCount: 0,
    branchesCount: 0,
    pendingApprovals: 0,
  });
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('darkMode') === 'true';
    }
    return false;
  });
  const [loading, setLoading] = useState(false);

  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('darkMode', newDarkMode.toString());
    }
  };

  const refreshCompanies = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const data = await getCompanies(user.uid);
      setCompanies(data);
    } catch (error) {
      console.error('Error fetching companies:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshBranches = async () => {
    if (!user) return;
    
    try {
      const data = await getBranches(user.uid);
      setBranches(data);
    } catch (error) {
      console.error('Error fetching branches:', error);
    }
  };

  const refreshEmployees = async () => {
    if (!user) return;
    
    try {
      const data = await getEmployees(user.uid);
      setEmployees(data);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const refreshDashboardStats = async () => {
    if (!user) return;
    
    try {
      const [companiesData, employeesData, branchesData, timeEntriesData] = await Promise.all([
        getCompanies(user.uid),
        getEmployees(user.uid),
        getBranches(user.uid),
        getTimeEntries(user.uid)
      ]);

      const activeEmployees = employeesData.filter(emp => emp.status === 'active').length;
      const pendingApprovals = timeEntriesData.filter(entry => entry.status === 'draft').length;
      
      // Calculate total gross for this month (simplified calculation)
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const thisMonthEntries = timeEntriesData.filter(entry => {
        const entryDate = new Date(entry.date);
        return entryDate.getMonth() === currentMonth && entryDate.getFullYear() === currentYear;
      });
      
      let totalGrossThisMonth = 0;
      thisMonthEntries.forEach(entry => {
        const employee = employeesData.find(emp => emp.id === entry.employeeId);
        if (employee && employee.salaryInfo.hourlyRate) {
          totalGrossThisMonth += (entry.regularHours + entry.overtimeHours * 1.5) * employee.salaryInfo.hourlyRate;
        }
      });

      setDashboardStats({
        activeEmployees,
        totalGrossThisMonth,
        companiesCount: companiesData.length,
        branchesCount: branchesData.length,
        pendingApprovals,
      });
    } catch (error) {
      console.error('Error calculating dashboard stats:', error);
    }
  };

  // Load initial data when user changes
  useEffect(() => {
    if (user) {
      refreshCompanies();
      refreshBranches();
      refreshEmployees();
      refreshDashboardStats();
    } else {
      // Clear data when user logs out
      setCompanies([]);
      setBranches([]);
      setEmployees([]);
      setCurrentCompany(null);
      setDashboardStats({
        activeEmployees: 0,
        totalGrossThisMonth: 0,
        companiesCount: 0,
        branchesCount: 0,
        pendingApprovals: 0,
      });
    }
  }, [user]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  return (
    <AppContext.Provider
      value={{
        currentCompany,
        setCurrentCompany,
        companies,
        refreshCompanies,
        branches,
        refreshBranches,
        employees,
        refreshEmployees,
        dashboardStats,
        refreshDashboardStats,
        darkMode,
        toggleDarkMode,
        loading,
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