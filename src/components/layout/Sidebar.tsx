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
} from 'lucide-react';
import { useApp } from '../../contexts/AppContext';

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
      </div>
    </div>
  );
};

export default Sidebar;