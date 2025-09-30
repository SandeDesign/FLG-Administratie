import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { Company, Employee, Branch, DashboardStats } from '../types';
import { getCompanies, getEmployees, getBranches } from '../services/firebase';

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
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('darkMode') === 'true' || 
             window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    activeEmployees: 0,
    totalGrossThisMonth: 0,
    companiesCount: 0,
    branchesCount: 0,
    pendingApprovals: 0,
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', darkMode.toString());
  }, [darkMode]);

  useEffect(() => {
    if (user && userRole === 'admin') {
      loadData();
    } else {
      setLoading(false);
    }
  }, [user, userRole]);

  const loadData = async () => {
    if (!user) return;

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
        setSelectedCompany(companiesData[0]);
      }

      await calculateDashboardStats(companiesData, employeesData, branchesData);
    } catch (error) {
      console.error('Error loading app data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateDashboardStats = async (
    companiesData: Company[],
    employeesData: Employee[],
    branchesData: Branch[]
  ) => {
    const activeEmployees = employeesData.filter(emp => emp.status === 'active').length;
    
    setDashboardStats({
      activeEmployees,
      totalGrossThisMonth: 0, // This would be calculated from payroll data
      companiesCount: companiesData.length,
      branchesCount: branchesData.length,
      pendingApprovals: 0, // This would be calculated from pending leave requests
    });
  };

  const refreshDashboardStats = async () => {
    if (user && userRole === 'admin') {
      await loadData();
    }
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
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