import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Users,
  Clock,
  Calendar,
  HeartPulse,
  FileText,
  Upload,
  Download,
  Settings,
  LogOut,
  Shield,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Zap,
  TrendingUp,
  Activity,
  Receipt,
  Send,
  FolderOpen,
  UserPlus,
  Key
} from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';

export interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
  badge?: string;
  color?: string;
}

// Navigation items - ✅ UITGEBREID MET ADMIN ITEMS
export const navigation: NavigationItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['admin'], color: 'text-purple-600' },
  
  // ✅ ADMIN SECTIE
  { name: 'Admin Dashboard', href: '/admin', icon: Shield, roles: ['admin'], color: 'text-red-600' },
  { name: 'Gebruikersbeheer', href: '/admin/users', icon: UserPlus, roles: ['admin'], color: 'text-red-500' },
  { name: 'Rollen & Rechten', href: '/admin/roles', icon: Key, roles: ['admin'], color: 'text-red-400' },
  
  // ✅ BESTAANDE ITEMS
  { name: 'Bedrijven', href: '/companies', icon: Building2, roles: ['admin'], color: 'text-blue-600' },
  { name: 'Werknemers', href: '/employees', icon: Users, roles: ['admin'], color: 'text-green-600' },
  
  // Tijd & Urenregistratie
  { name: 'Urenregistratie', href: '/timesheets', icon: Clock, roles: ['admin', 'employee'], color: 'text-orange-600' },
  { name: 'Uren Goedkeuren', href: '/timesheet-approvals', icon: Clock, roles: ['admin'], color: 'text-indigo-600' },
  
  // Verlof & Verzuim
  { name: 'Verlof Goedkeuren', href: '/admin/leave-approvals', icon: Calendar, roles: ['admin'], color: 'text-teal-600' },
  { name: 'Verzuim Beheren', href: '/admin/absence-management', icon: HeartPulse, roles: ['admin'], color: 'text-red-600' },
  
  // Facturatie
  { name: 'Uitgaande Facturen', href: '/outgoing-invoices', icon: Send, roles: ['admin'], color: 'text-emerald-600' },
  { name: 'Inkomende Facturen', href: '/incoming-invoices', icon: Upload, roles: ['admin'], color: 'text-amber-600' },
  
  // Data & Exports
  { name: 'Uren Export', href: '/timesheet-export', icon: Download, roles: ['admin'], color: 'text-cyan-600' },
  { name: 'Drive Bestanden', href: '/drive-files', icon: FolderOpen, roles: ['admin'], color: 'text-violet-600' },
  
  // Systeem
  { name: 'Loonstroken', href: '/payslips', icon: FileText, roles: ['admin', 'employee'], color: 'text-cyan-600' },
  { name: 'Audit Log', href: '/audit-log', icon: Shield, roles: ['admin'], color: 'text-slate-600' },
  { name: 'Instellingen', href: '/settings', icon: Settings, roles: ['admin', 'employee'], color: 'text-gray-600' },
];

// Company Selector
const CompanySelector: React.FC<{ collapsed: boolean }> = ({ collapsed }) => {
  const { companies, selectedCompany, setSelectedCompany } = useApp();
  const { userRole } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  if (userRole !== 'admin' || !companies || companies.length === 0) {
    return null;
  }

  if (collapsed) {
    return (
      <div className="px-3 py-4">
        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
          <Building2 className="h-4 w-4 text-blue-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 py-4 border-b border-gray-200">
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between p-2 text-sm font-medium text-gray-900 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center">
            <Building2 className="h-4 w-4 text-gray-500 mr-2" />
            <span className="truncate">
              {selectedCompany ? selectedCompany.name : 'Selecteer bedrijf'}
            </span>
          </div>
          <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
            {companies.map((company) => (
              <button
                key={company.id}
                onClick={() => {
                  setSelectedCompany(company);
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg transition-colors ${
                  selectedCompany?.id === company.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                }`}
              >
                {company.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Main Sidebar Component
interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
  const { userRole, signOut } = useAuth();
  const { selectedCompany } = useApp();

  const filteredNavigation = navigation.filter(item => 
    item.roles.includes(userRole || '')
  );

  // Group navigation items by category for better organization
  const groupedNavigation = {
    main: filteredNavigation.filter(item => 
      ['Dashboard', 'Bedrijven', 'Werknemers'].includes(item.name)
    ),
    admin: filteredNavigation.filter(item => 
      item.href.startsWith('/admin')
    ),
    time: filteredNavigation.filter(item => 
      ['Urenregistratie', 'Uren Goedkeuren', 'Verlof Goedkeuren', 'Verzuim Beheren'].includes(item.name)
    ),
    finance: filteredNavigation.filter(item => 
      ['Uitgaande Facturen', 'Inkomende Facturen'].includes(item.name)
    ),
    data: filteredNavigation.filter(item => 
      ['Uren Export', 'Drive Bestanden'].includes(item.name)
    ),
    system: filteredNavigation.filter(item => 
      ['Loonstroken', 'Audit Log', 'Instellingen'].includes(item.name)
    )
  };

  return (
    <div className={`bg-white border-r border-gray-200 transition-all duration-300 ${
      collapsed ? 'w-16' : 'w-64'
    } hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        {!collapsed && (
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Buddy</h1>
              <p className="text-xs text-gray-500">Loonadministratie</p>
            </div>
          </div>
        )}
        
        <button
          onClick={onToggle}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Company Selector */}
      <CompanySelector collapsed={collapsed} />

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        <div className="space-y-6">
          {/* Main Section */}
          {groupedNavigation.main.length > 0 && (
            <div className="px-3">
              {!collapsed && (
                <h3 className="px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Hoofdmenu
                </h3>
              )}
              <div className="space-y-1">
                {groupedNavigation.main.map((item) => (
                  <SidebarLink key={item.href} item={item} collapsed={collapsed} />
                ))}
              </div>
            </div>
          )}

          {/* Admin Section */}
          {groupedNavigation.admin.length > 0 && userRole === 'admin' && (
            <div className="px-3">
              {!collapsed && (
                <h3 className="px-2 text-xs font-semibold text-red-500 uppercase tracking-wider mb-2">
                  Admin Beheer
                </h3>
              )}
              <div className="space-y-1">
                {groupedNavigation.admin.map((item) => (
                  <SidebarLink key={item.href} item={item} collapsed={collapsed} />
                ))}
              </div>
            </div>
          )}

          {/* Time & Attendance */}
          {groupedNavigation.time.length > 0 && (
            <div className="px-3">
              {!collapsed && (
                <h3 className="px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Tijd & Aanwezigheid
                </h3>
              )}
              <div className="space-y-1">
                {groupedNavigation.time.map((item) => (
                  <SidebarLink key={item.href} item={item} collapsed={collapsed} />
                ))}
              </div>
            </div>
          )}

          {/* Finance */}
          {groupedNavigation.finance.length > 0 && (
            <div className="px-3">
              {!collapsed && (
                <h3 className="px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Facturatie
                </h3>
              )}
              <div className="space-y-1">
                {groupedNavigation.finance.map((item) => (
                  <SidebarLink key={item.href} item={item} collapsed={collapsed} />
                ))}
              </div>
            </div>
          )}

          {/* Data & Files */}
          {groupedNavigation.data.length > 0 && (
            <div className="px-3">
              {!collapsed && (
                <h3 className="px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Data & Bestanden
                </h3>
              )}
              <div className="space-y-1">
                {groupedNavigation.data.map((item) => (
                  <SidebarLink key={item.href} item={item} collapsed={collapsed} />
                ))}
              </div>
            </div>
          )}

          {/* System */}
          {groupedNavigation.system.length > 0 && (
            <div className="px-3">
              {!collapsed && (
                <h3 className="px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Systeem
                </h3>
              )}
              <div className="space-y-1">
                {groupedNavigation.system.map((item) => (
                  <SidebarLink key={item.href} item={item} collapsed={collapsed} />
                ))}
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-200 p-4">
        <button
          onClick={signOut}
          className={`w-full flex items-center ${
            collapsed ? 'justify-center' : 'justify-start space-x-2'
          } px-2 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100 transition-colors`}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span>Uitloggen</span>}
        </button>
      </div>
    </div>
  );
};

// Sidebar Link Component
interface SidebarLinkProps {
  item: NavigationItem;
  collapsed: boolean;
}

const SidebarLink: React.FC<SidebarLinkProps> = ({ item, collapsed }) => {
  return (
    <NavLink
      to={item.href}
      className={({ isActive }) =>
        `group flex items-center px-2 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
          isActive
            ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600'
            : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
        } ${collapsed ? 'justify-center' : 'justify-start'}`
      }
    >
      {({ isActive }) => (
        <>
          <div className={`flex-shrink-0 p-1 rounded-md transition-colors ${
            isActive ? 'bg-blue-100' : 'group-hover:bg-gray-100'
          }`}>
            <item.icon className={`h-4 w-4 ${item.color || (isActive ? 'text-blue-600' : 'text-gray-500')}`} />
          </div>
          
          {!collapsed && (
            <div className="ml-3 flex items-center justify-between flex-1">
              <span className="truncate">{item.name}</span>
              {item.badge && (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                  {item.badge}
                </span>
              )}
            </div>
          )}
          
          {collapsed && item.badge && (
            <div className="absolute left-full ml-2 px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
              {item.badge}
            </div>
          )}
        </>
      )}
    </NavLink>
  );
};

export default Sidebar;