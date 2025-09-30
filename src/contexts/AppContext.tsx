import React, { createContext, useContext, useState, useEffect } from 'react';
import { Company, Employee, DashboardStats } from '../types';

interface AppContextType {
  currentCompany: Company | null;
  setCurrentCompany: (company: Company | null) => void;
  employees: Employee[];
  setEmployees: (employees: Employee[]) => void;
  dashboardStats: DashboardStats;
  setDashboardStats: (stats: DashboardStats) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    activeEmployees: 0,
    totalGrossThisMonth: 0,
    companiesCount: 0,
    branchesCount: 0,
    pendingApprovals: 0,
  });
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(false);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

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
        employees,
        setEmployees,
        dashboardStats,
        setDashboardStats,
        darkMode,
        toggleDarkMode,
        loading,
        setLoading,
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