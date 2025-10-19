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
  DollarSign,
  Factory,
  FileCheck
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
  { name: 'Loonmaatschappij', href: '/payroll-company', icon: DollarSign, roles: ['admin', 'management'] },
  { name: 'Werkmaatschappijen', href: '/companies', icon: Factory, roles: ['admin', 'management'] },
  { name: 'Werknemers', href: '/employees', icon: Users, roles: ['admin', 'management'] },
  { name: 'Urenregistratie', href: '/timesheets', icon: Clock, roles: ['admin', 'management', 'employee'] },
  { name: 'Uren Goedkeuren', href: '/timesheet-approvals', icon: Calendar, roles: ['admin', 'management'] },
  { name: 'Verlof Goedkeuren', href: '/admin/leave-approvals', icon: Calendar, roles: ['admin', 'management'] },
  { name: 'Verzuim Beheren', href: '/admin/absence-management', icon: HeartPulse, roles: ['admin'] },
  { name: 'Declaraties', href: '/admin/expenses', icon: Receipt, roles: ['admin'] },
  { name: 'Loonverwerking', href: '/payroll-processing', icon: Calculator, roles: ['admin'] },
  { name: 'Loonstroken', href: '/payslips', icon: FileText, roles: ['admin', 'employee'] },
  { name: 'Loonaangiftes', href: '/tax-returns', icon: BookOpen, roles: ['admin'] },
  { name: 'Facturatie', href: '/invoicing', icon: FileCheck, roles: ['admin', 'management'] },
  { name: 'Exports', href: '/exports', icon: Download, roles: ['admin'] },
  { name: 'Audit Log', href: '/audit-log', icon: Shield, roles: ['admin'] },
  { name: 'Instellingen', href: '/settings', icon: Settings, roles: ['admin', 'management', 'employee'] },
];

const mainNavigation: NavigationItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['admin'] },
  { name: 'Loonmaatschappij', href: '/payroll-company', icon: DollarSign, roles: ['admin', 'management'] },
  { name: 'Werkmaatschappijen', href: '/companies', icon: Factory, roles: ['admin', 'management'] },
  { name: 'Werknemers', href: '/employees', icon: Users, roles: ['admin', 'management'] },
];

const timeAttendanceNavigation: NavigationItem[] = [
  { name: 'Urenregistratie', href: '/timesheets', icon: Clock, roles: ['admin', 'management', 'employee'] },
  { name: 'Uren Goedkeuren', href: '/timesheet-approvals', icon: Calendar, roles: ['admin', 'management'] },
  { name: 'Verlof Goedkeuren', href: '/admin/leave-approvals', icon: Calendar, roles: ['admin', 'management'] },
  { name: 'Verzuim Beheren', href: '/admin/absence-management', icon: HeartPulse, roles: ['admin'] },
];

const financialNavigation: NavigationItem[] = [
  { name: 'Declaraties', href: '/admin/expenses', icon: Receipt, roles: ['admin'] },
  { name: 'Loonverwerking', href: '/payroll-processing', icon: Calculator, roles: ['admin'] },
  { name: 'Loonstroken', href: '/payslips', icon: FileText, roles: ['admin', 'employee'] },
  { name: 'Loonaangiftes', href: '/tax-returns', icon: BookOpen, roles: ['admin'] },
  { name: 'Facturatie', href: '/invoicing', icon: FileCheck, roles: ['admin', 'management'] },
];

const systemNavigation: NavigationItem[] = [
  { name: 'Exports', href: '/exports', icon: Download, roles: ['admin'] },
  { name: 'Audit Log', href: '/audit-log', icon: Shield, roles: ['admin'] },
  { name: 'Instellingen', href: '/settings', icon: Settings, roles: ['admin', 'management', 'employee'] },
];

export const Sidebar: React.FC = () => {
  const { user, signOut, userRole } = useAuth();

  const filteredMainNav = mainNavigation.filter(item => item.roles.includes(userRole || ''));
  const filteredTimeNav = timeAttendanceNavigation.filter(item => item.roles.includes(userRole || ''));
  const filteredFinancialNav = financialNavigation.filter(item => item.roles.includes(userRole || ''));
  const filteredSystemNav = systemNavigation.filter(item => item.roles.includes(userRole || ''));

  const isEmployee = userRole === 'employee';

  return (
    <div className="hidden lg:flex h-screen w-72 flex-col bg-white border-r border-gray-200 shadow-lg">
      {/* Logo */}
      <div className="flex h-20 items-center justify-between px-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center space-x-3 flex-shrink-0 min-w-0">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
            <DollarSign className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">AlloonApp</h1>
            <p className="text-xs text-gray-500">Loonadministratie</p>
          </div>
        </div>
        <NotificationCenter />
      </div>

      {/* Company Selector */}
      {(userRole === 'admin' || userRole === 'management') && (
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <CompanySelector />
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-4 px-4 py-6 overflow-y-auto">
        {!isEmployee && filteredMainNav.length > 0 && (
          <div className="space-y-1">
            {filteredMainNav.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  `flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border border-blue-200 shadow-sm'
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
                    `flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${
                      isActive
                        ? 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border border-blue-200 shadow-sm'
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
                    `flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${
                      isActive
                        ? 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border border-blue-200 shadow-sm'
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
                    `flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${
                      isActive
                        ? 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border border-blue-200 shadow-sm'
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
      <div className="border-t border-gray-200 p-4 bg-gray-50">
        <div className="space-y-2">
          <div className="flex items-center px-3 py-2 text-sm text-gray-600">
            <div className="w-8 h-8 bg-gradient-to-br from-gray-400 to-gray-600 rounded-full flex items-center justify-center text-white text-sm font-medium mr-3">
              {user?.email?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.email}
              </p>
              <p className="text-xs text-gray-500 capitalize">
                {userRole === 'admin' ? 'Beheerder' : userRole === 'management' ? 'Management' : 'Werknemer'}
              </p>
            </div>
          </div>
          
          <button
            onClick={signOut}
            className="flex w-full items-center px-3 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all duration-200"
          >
            <LogOut className="mr-3 h-5 w-5" />
            Uitloggen
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;