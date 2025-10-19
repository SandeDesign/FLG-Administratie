import React, { useState } from 'react';
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
  ChevronDown,
  Zap,
  TrendingUp,
  Activity,
  DollarSign
} from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { NotificationCenter } from '../notifications/NotificationCenter';

export interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
  badge?: string;
  color?: string;
}

export const navigation: NavigationItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['admin'], color: 'text-purple-600' },
  { name: 'Bedrijven', href: '/companies', icon: Building2, roles: ['admin'], color: 'text-blue-600' },
  { name: 'Werknemers', href: '/employees', icon: Users, roles: ['admin'], color: 'text-green-600' },
  { name: 'Urenregistratie', href: '/timesheets', icon: Clock, roles: ['admin', 'employee'], color: 'text-orange-600' },
  { name: 'Uren Goedkeuren', href: '/timesheet-approvals', icon: Calendar, roles: ['admin'], color: 'text-indigo-600' },
  { name: 'Verlof Goedkeuren', href: '/admin/leave-approvals', icon: Calendar, roles: ['admin'], color: 'text-teal-600' },
  { name: 'Verzuim Beheren', href: '/admin/absence-management', icon: HeartPulse, roles: ['admin'], color: 'text-red-600' },
  { name: 'Declaraties', href: '/admin/expenses', icon: Receipt, roles: ['admin'], color: 'text-amber-600' },
  { name: 'Loonverwerking', href: '/payroll-processing', icon: Calculator, roles: ['admin'], color: 'text-emerald-600' },
  { name: 'Loonstroken', href: '/payslips', icon: FileText, roles: ['admin', 'employee'], color: 'text-cyan-600' },
  { name: 'Loonaangiftes', href: '/tax-returns', icon: BookOpen, roles: ['admin'], color: 'text-violet-600' },
  { name: 'Exports', href: '/exports', icon: Download, roles: ['admin'], color: 'text-pink-600' },
  { name: 'Audit Log', href: '/audit-log', icon: Shield, roles: ['admin'], color: 'text-slate-600' },
  { name: 'Instellingen', href: '/settings', icon: Settings, roles: ['admin', 'employee'], color: 'text-gray-600' },
];

// Modern Company Selector
const ModernCompanySelector: React.FC = () => {
  const { companies, selectedCompany, setSelectedCompany } = useApp();
  const { userRole } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  if (userRole !== 'admin' || !companies || companies.length === 0) {
    return null;
  }

  return (
    <div className="px-6 py-4">
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-slate-50 to-gray-50 hover:from-slate-100 hover:to-gray-100 border border-gray-200 rounded-xl shadow-sm transition-all duration-200 hover:shadow-md group"
        >
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-500 rounded-lg shadow-sm group-hover:bg-blue-600 transition-colors">
              <Building2 className="h-4 w-4 text-white" />
            </div>
            <div className="text-left">
              <div className="text-sm font-semibold text-gray-900">
                {selectedCompany?.name || 'Selecteer bedrijf'}
              </div>
              <div className="text-xs text-gray-500">
                {selectedCompany ? `${companies.length} bedrijven` : 'Kies een bedrijf'}
              </div>
            </div>
          </div>
          <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
            <div className="absolute z-20 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
              <div className="p-2 space-y-1 max-h-60 overflow-y-auto">
                {companies.map((company) => (
                  <button
                    key={company.id}
                    onClick={() => {
                      setSelectedCompany(company);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-all duration-150 ${
                      selectedCompany?.id === company.id
                        ? 'bg-blue-50 border border-blue-200 text-blue-900'
                        : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <div className={`p-1.5 rounded-lg ${
                      selectedCompany?.id === company.id ? 'bg-blue-500' : 'bg-gray-400'
                    }`}>
                      <Building2 className="h-3 w-3 text-white" />
                    </div>
                    <div className="text-left flex-1">
                      <div className="text-sm font-medium">{company.name}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// Modern Navigation Item
const ModernNavItem: React.FC<{ item: NavigationItem }> = ({ item }) => (
  <NavLink
    to={item.href}
    className={({ isActive }) =>
      `group flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${
        isActive
          ? 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 shadow-sm border border-blue-200'
          : 'text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-slate-50 hover:text-gray-900'
      }`
    }
  >
    <div className={`p-2 rounded-lg mr-3 transition-all duration-200 ${
      ({ isActive }: { isActive: boolean }) => isActive 
        ? 'bg-blue-500 shadow-sm' 
        : 'bg-gray-100 group-hover:bg-gray-200'
    }`}>
      <item.icon className={`h-4 w-4 ${
        ({ isActive }: { isActive: boolean }) => isActive ? 'text-white' : item.color || 'text-gray-600'
      }`} />
    </div>
    <span className="flex-1">{item.name}</span>
    {item.badge && (
      <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-semibold">
        {item.badge}
      </span>
    )}
  </NavLink>
);

// Modern Section Header
const ModernSectionHeader: React.FC<{ title: string; icon: React.ComponentType<{ className?: string }> }> = ({ title, icon: Icon }) => (
  <div className="flex items-center space-x-2 px-4 py-2 mb-2">
    <Icon className="h-4 w-4 text-gray-400" />
    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</span>
    <div className="flex-1 h-px bg-gradient-to-r from-gray-200 to-transparent"></div>
  </div>
);

const Sidebar: React.FC = () => {
  const { signOut, userRole } = useAuth();

  // Filter navigation items based on user role
  const mainItems = navigation.slice(0, 3).filter(item => userRole && item.roles.includes(userRole));
  const timeItems = navigation.slice(3, 8).filter(item => userRole && item.roles.includes(userRole));
  const financialItems = navigation.slice(8, 12).filter(item => userRole && item.roles.includes(userRole));
  const systemItems = navigation.slice(12).filter(item => userRole && item.roles.includes(userRole));

  const isEmployee = userRole === 'employee';

  return (
    <div className="hidden lg:flex lg:w-72 lg:flex-col lg:bg-white lg:border-r lg:border-gray-200 lg:shadow-sm">
      {/* Header */}
      <div className="flex h-16 items-center justify-center border-b border-gray-100 px-6 bg-gradient-to-r from-slate-50 to-gray-50">
        <img src="/Logo-groot.png" alt="AlloonApp Logo" className="h-10 w-auto" />
      </div>

      {/* Company Selector */}
      <ModernCompanySelector />

      {/* Quick Stats */}
      <div className="px-6 py-2">
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg text-center">
            <div className="text-lg font-bold text-blue-700">12</div>
            <div className="text-xs text-blue-600">Actief</div>
          </div>
          <div className="p-2 bg-gradient-to-br from-green-50 to-green-100 rounded-lg text-center">
            <div className="text-lg font-bold text-green-700">€45k</div>
            <div className="text-xs text-green-600">Maand</div>
          </div>
          <div className="p-2 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg text-center">
            <div className="text-lg font-bold text-purple-700">98%</div>
            <div className="text-xs text-purple-600">Uptime</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-6 px-4 py-6 overflow-y-auto">
        
        {/* Main */}
        {mainItems.length > 0 && (
          <div className="space-y-1">
            <ModernSectionHeader title="Hoofdmenu" icon={Zap} />
            {mainItems.map((item) => (
              <ModernNavItem key={item.name} item={item} />
            ))}
          </div>
        )}

        {/* Time & Attendance */}
        {timeItems.length > 0 && (
          <div className="space-y-1">
            <ModernSectionHeader title="Tijd & Aanwezigheid" icon={Activity} />
            {timeItems.map((item) => (
              <ModernNavItem key={item.name} item={item} />
            ))}
          </div>
        )}

        {/* Financial */}
        {financialItems.length > 0 && (
          <div className="space-y-1">
            <ModernSectionHeader title="Financieel" icon={TrendingUp} />
            {financialItems.map((item) => (
              <ModernNavItem key={item.name} item={item} />
            ))}
          </div>
        )}

        {/* System */}
        {systemItems.length > 0 && (
          <div className="space-y-1">
            <ModernSectionHeader title="Systeem" icon={Settings} />
            {systemItems.map((item) => (
              <ModernNavItem key={item.name} item={item} />
            ))}
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-100 p-4 bg-gradient-to-r from-slate-50 to-gray-50">
        <button
          onClick={signOut}
          className="flex w-full items-center px-4 py-3 text-sm font-medium text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200 group"
        >
          <div className="p-2 rounded-lg mr-3 bg-gray-100 group-hover:bg-red-100 transition-colors">
            <LogOut className="h-4 w-4 text-gray-600 group-hover:text-red-600" />
          </div>
          <span>Uitloggen</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;