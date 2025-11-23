import React, { useState, useEffect } from 'react';
import { User, LogOut, Calendar, HeartPulse, Receipt, Clock, Menu, X, Home } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import { getEmployeeById } from '../../services/firebase';
import Button from '../ui/Button';

interface EmployeeLayoutProps {
  children: React.ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/employee-dashboard', icon: Home },
  { name: 'Verlof', href: '/employee-dashboard/leave', icon: Calendar },
  { name: 'Verzuim', href: '/employee-dashboard/absence', icon: HeartPulse },
  { name: 'Declaraties', href: '/employee-dashboard/expenses', icon: Receipt },
  { name: 'Uren', href: '/employee-dashboard/timesheets', icon: Clock },
];

const EmployeeLayout: React.FC<EmployeeLayoutProps> = ({ children }) => {
  const { user, signOut, currentEmployeeId } = useAuth();
  const { selectedCompany } = useApp();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [employeeData, setEmployeeData] = useState<any>(null);

  // Load employee data
  useEffect(() => {
    const loadEmployee = async () => {
      if (currentEmployeeId) {
        try {
          const employee = await getEmployeeById(currentEmployeeId);
          setEmployeeData(employee);
        } catch (error) {
          console.error('Error loading employee:', error);
        }
      }
    };
    loadEmployee();
  }, [currentEmployeeId]);

  const getFirstName = () => {
    if (employeeData?.personalInfo?.firstName) {
      return employeeData.personalInfo.firstName;
    }
    return user?.displayName?.split(' ')[0] || 'Gebruiker';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 z-50">
        <img src="/Logo_1.png" alt="FLG-Administratie Logo" className="h-8 w-auto" />
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          {mobileMenuOpen ? (
            <X className="h-6 w-6 text-gray-600" />
          ) : (
            <Menu className="h-6 w-6 text-gray-600" />
          )}
        </button>
      </div>

      <div className="flex h-screen md:h-auto md:min-h-screen">
        {/* Sidebar */}
        <div
          className={`fixed md:fixed left-0 top-16 md:top-0 h-[calc(100vh-64px)] md:h-screen w-80 bg-white border-r border-gray-200 flex flex-col transition-all duration-300 z-50 md:z-0 overflow-hidden shadow-lg md:shadow-none ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          }`}
        >
          {/* Logo */}
          <div className="hidden md:flex items-center gap-3 px-6 py-6 border-b border-gray-200 flex-shrink-0">
            <img src="/Logo_1.png" alt="FLG-Administratie Logo" className="h-8 w-auto" />
            <div>
              <h1 className="text-lg font-bold text-gray-900">FLG-Administratie</h1>
              <p className="text-xs text-gray-500">{selectedCompany?.name || 'Dashboard'}</p>
            </div>
          </div>

          {/* Navigation - SCROLLABLE */}
          <nav className="flex-1 px-3 py-6 space-y-2 overflow-y-auto overflow-x-hidden">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3.5 rounded-xl font-semibold text-base transition-all duration-200 ${
                    isActive
                      ? 'bg-primary-50 text-primary-600 border-l-4 border-primary-600 shadow-sm'
                      : 'text-gray-700 hover:bg-gray-50 border-l-4 border-transparent hover:text-gray-900'
                  }`}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <span>{item.name}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* User Info & Logout - STICKY BOTTOM */}
          <div className="border-t border-gray-200 p-4 space-y-3 flex-shrink-0 bg-white">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center flex-shrink-0">
                <User className="h-6 w-6 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-gray-900 truncate">
                  {getFirstName()}
                </p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
            </div>
            <Button
              onClick={signOut}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2.5 rounded-lg transition-all"
              size="sm"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Uitloggen
            </Button>
          </div>
        </div>

        {/* Mobile Overlay */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/50 md:hidden z-40 top-16"
            onClick={() => setMobileMenuOpen(false)}
          ></div>
        )}

        {/* Main Content */}
        <main className="flex-1 w-full md:ml-80 mt-16 md:mt-0">
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default EmployeeLayout;