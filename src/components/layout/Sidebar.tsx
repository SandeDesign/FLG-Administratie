import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Users,
  Calendar,
  HeartPulse,
  Receipt,
  Clock,
  Calculator,
  FileText,
  BookOpen,
  Download,
  Settings,
  LogOut,
  Shield,
} from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { NotificationCenter } from '../notifications/NotificationCenter';
import { CompanySelector } from '../ui/CompanySelector';
import { NavigationGroup } from './NavigationGroup';

export interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
}

export const navigation: NavigationItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['admin'] },
  { name: 'Bedrijven', href: '/companies', icon: Building2, roles: ['admin'] },
  { name: 'Werknemers', href: '/employees', icon: Users, roles: ['admin'] },
  { name: 'Urenregistratie', href: '/timesheets', icon: Clock, roles: ['admin', 'employee'] },
  { name: 'Uren Goedkeuren', href: '/timesheet-approvals', icon: Calendar, roles: ['admin'] },
  { name: 'Verlof Goedkeuren', href: '/admin/leave-approvals', icon: Calendar, roles: ['admin'] },
  { name: 'Verzuim Beheren', href: '/admin/absence-management', icon: HeartPulse, roles: ['admin'] },
  { name: 'Declaraties', href: '/admin/expenses', icon: Receipt, roles: ['admin'] },
  { name: 'Loonverwerking', href: '/payroll-processing', icon: Calculator, roles: ['admin'] },
  { name: 'Loonstroken', href: '/payslips', icon: FileText, roles: ['admin', 'employee'] },
  { name: 'Loonaangiftes', href: '/tax-returns', icon: BookOpen, roles: ['admin'] },
  { name: 'Exports', href: '/exports', icon: Download, roles: ['admin'] },
  { name: 'Audit Log', href: '/audit-log', icon: Shield, roles: ['admin'] },
  { name: 'Instellingen', href: '/settings', icon: Settings, roles: ['admin', 'employee'] },
];

const mainNavigation: NavigationItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['admin'] },
  { name: 'Bedrijven', href: '/companies', icon: Building2, roles: ['admin'] },
  { name: 'Werknemers', href: '/employees', icon: Users, roles: ['admin'] },
];

const timeAttendanceNavigation: NavigationItem[] = [
  { name: 'Urenregistratie', href: '/timesheets', icon: Clock, roles: ['admin', 'employee'] },
  { name: 'Uren Goedkeuren', href: '/timesheet-approvals', icon: Calendar, roles: ['admin'] },
  { name: 'Verlof Goedkeuren', href: '/admin/leave-approvals', icon: Calendar, roles: ['admin'] },
  { name: 'Verzuim Beheren', href: '/admin/absence-management', icon: HeartPulse, roles: ['admin'] },
];

const financialNavigation: NavigationItem[] = [
  { name: 'Declaraties', href: '/admin/expenses', icon: Receipt, roles: ['admin'] },
  { name: 'Loonverwerking', href: '/payroll-processing', icon: Calculator, roles: ['admin'] },
  { name: 'Loonstroken', href: '/payslips', icon: FileText, roles: ['admin', 'employee'] },
  { name: 'Loonaangiftes', href: '/tax-returns', icon: BookOpen, roles: ['admin'] },
];

const systemNavigation: NavigationItem[] = [
  { name: 'Exports', href: '/exports', icon: Download, roles: ['admin'] },
  { name: 'Audit Log', href: '/audit-log', icon: Shield, roles: ['admin'] },
  { name: 'Instellingen', href: '/settings', icon: Settings, roles: ['admin', 'employee'] },
];

export const Sidebar: React.FC = () => {
  const { user, signOut, userRole } = useAuth();

  const filteredMainNav = mainNavigation.filter(item => item.roles.includes(userRole || ''));
  const filteredTimeNav = timeAttendanceNavigation.filter(item => item.roles.includes(userRole || ''));
  const filteredFinancialNav = financialNavigation.filter(item => item.roles.includes(userRole || ''));
  const filteredSystemNav = systemNavigation.filter(item => item.roles.includes(userRole || ''));

  const isEmployee = userRole === 'employee';

  return (
    <div className="hidden lg:flex h-screen w-64 flex-col bg-white border-r border-gray-200 shadow-sm">
      {/* Logo */}
      <div className="flex h-20 items-center justify-between px-6 border-b border-gray-100">
        <div className="flex items-center space-x-2 flex-shrink-0 min-w-0">
          <img src="/Logo-groot.png" alt="AlloonApp Logo" className="h-40 w-auto object-contain" />
        </div>
        <NotificationCenter />
      </div>

      {/* Company Selector */}
      {userRole === 'admin' && (
        <div className="px-4 py-3 border-b border-gray-100">
          <CompanySelector />
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-4 px-3 py-4 overflow-y-auto">
        {!isEmployee && filteredMainNav.length > 0 && (
          <div className="space-y-1">
            {filteredMainNav.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  `flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`
                }
              >
                <item.icon className="mr-3 h-5 w-5" />
                {item.name}
              </NavLink>
            ))}
          </div>
        )}

        {filteredTimeNav.length > 0 && (
          isEmployee ? (
            <div className="space-y-1">
              {filteredTimeNav.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className={({ isActive }) =>
                    `flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`
                  }
                >
                  <item.icon className="mr-3 h-5 w-5" />
                  {item.name}
                </NavLink>
              ))}
            </div>
          ) : (
            <NavigationGroup
              title="Tijd & Aanwezigheid"
              items={filteredTimeNav}
              storageKey="nav-time-attendance"
              defaultOpen={false}
            />
          )
        )}

        {filteredFinancialNav.length > 0 && (
          isEmployee ? (
            <div className="space-y-1">
              {filteredFinancialNav.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className={({ isActive }) =>
                    `flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`
                  }
                >
                  <item.icon className="mr-3 h-5 w-5" />
                  {item.name}
                </NavLink>
              ))}
            </div>
          ) : (
            <NavigationGroup
              title="Financieel"
              items={filteredFinancialNav}
              storageKey="nav-financial"
              defaultOpen={false}
            />
          )
        )}

        {filteredSystemNav.length > 0 && (
          isEmployee ? (
            <div className="space-y-1">
              {filteredSystemNav.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className={({ isActive }) =>
                    `flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`
                  }
                >
                  <item.icon className="mr-3 h-5 w-5" />
                  {item.name}
                </NavLink>
              ))}
            </div>
          ) : (
            <NavigationGroup
              title="Systeem"
              items={filteredSystemNav}
              storageKey="nav-system"
              defaultOpen={false}
            />
          )
        )}
      </nav>

      {/* User actions */}
      <div className="border-t border-gray-100 p-3">
        <button
          onClick={signOut}
          className="flex w-full items-center px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
        >
          <LogOut className="mr-3 h-5 w-5" />
          Uitloggen
        </button>
      </div>
    </div>
  );
};

export default Sidebar;