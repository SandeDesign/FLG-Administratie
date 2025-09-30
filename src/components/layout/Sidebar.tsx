import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Users,
  Clock,
  Calculator,
  FileText,
  BookOpen,
  Download,
  Settings,
  Moon,
  Sun,
  LogOut,
} from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../ui/Button';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Bedrijven', href: '/companies', icon: Building2 },
  { name: 'Werknemers', href: '/employees', icon: Users },
  { name: 'Uren', href: '/hours', icon: Clock },
  { name: 'Loonberekening', href: '/payroll', icon: Calculator },
  { name: 'Loonstroken', href: '/payslips', icon: FileText },
  { name: 'Regelgeving', href: '/regulations', icon: BookOpen },
  { name: 'Export', href: '/export', icon: Download },
  { name: 'Instellingen', href: '/settings', icon: Settings },
];

const Sidebar: React.FC = () => {
  const { darkMode, toggleDarkMode } = useApp();
  const { user, signOut } = useAuth();

  return (
    <div className="flex h-screen w-64 flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700">
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          <Calculator className="h-8 w-8 text-blue-600" />
          <span className="text-xl font-bold text-gray-900 dark:text-white">
            AlloonApp
          </span>
        </div>
      </div>

      {/* User Info */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold">
            {user?.displayName?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 dark:text-white truncate">
              {user?.displayName || 'Gebruiker'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
              {user?.email}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive }) =>
              `flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-800'
              }`
            }
          >
            <item.icon className="mr-3 h-5 w-5" />
            {item.name}
          </NavLink>
        ))}
      </nav>

      {/* Dark mode toggle */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-3">
        <button
          onClick={toggleDarkMode}
          className="flex w-full items-center px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          {darkMode ? (
            <Sun className="mr-3 h-5 w-5" />
          ) : (
            <Moon className="mr-3 h-5 w-5" />
          )}
          {darkMode ? 'Lichte modus' : 'Donkere modus'}
        </button>
        
        <button
          onClick={signOut}
          className="flex w-full items-center px-3 py-2 mt-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <LogOut className="mr-3 h-5 w-5" />
          Uitloggen
        </button>
      </div>
    </div>
  );
};

export default Sidebar;