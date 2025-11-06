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
  UserCog,
  Link
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

// ✅ FIXED: Navigation items met manager role support
export const navigation: NavigationItem[] = [
  { name: 'Dashboardd', href: '/', icon: LayoutDashboard, roles: ['admin'], color: 'text-purple-600' },
  { name: 'Bedrijven', href: '/companies', icon: Building2, roles: ['admin'], color: 'text-blue-600' },
  { name: 'Werknemers', href: '/employees', icon: Users, roles: ['admin', 'manager'], color: 'text-green-600' },
  
  // ADMIN BEHEER - NIEUWE SECTIE
  { name: 'Admin Dashboard', href: '/admin/dashboard', icon: UserCog, roles: ['admin'], color: 'text-red-600' },
  { name: 'Gebruikersbeheer', href: '/admin/users', icon: UserCog, roles: ['admin'], color: 'text-red-600' },
  { name: 'Rollen & Rechten', href: '/admin/roles', icon: Link, roles: ['admin'], color: 'text-red-600' },
  { name: 'Verlof Goedkeuren', href: '/admin/leave-approvals', icon: Calendar, roles: ['admin', 'manager'], color: 'text-teal-600' },
  { name: 'Verzuim Beheren', href: '/admin/absence-management', icon: HeartPulse, roles: ['admin', 'manager'], color: 'text-red-600' },
  
  // TIJD & AANWEZIGHEID
  { name: 'Urenregistratie', href: '/timesheets', icon: Clock, roles: ['admin', 'employee', 'manager'], color: 'text-orange-600' },
  { name: 'Uren Goedkeuren', href: '/timesheet-approvals', icon: Clock, roles: ['admin', 'manager'], color: 'text-indigo-600' },
  
  // FACTURATIE
  { name: 'Uitgaande Facturen', href: '/outgoing-invoices', icon: Send, roles: ['admin'], color: 'text-emerald-600' },
  { name: 'Inkomende Facturen', href: '/incoming-invoices', icon: Upload, roles: ['admin'], color: 'text-amber-600' },
  
  // DATA & BESTANDEN
  { name: 'Uren Export', href: '/timesheet-export', icon: Download, roles: ['admin', 'manager'], color: 'text-cyan-600' },
  { name: 'Drive Bestanden', href: '/drive-files', icon: FolderOpen, roles: ['admin'], color: 'text-violet-600' },
  
  // SYSTEEM
  { name: 'Loonstroken', href: '/payslips', icon: FileText, roles: ['admin', 'employee', 'manager'], color: 'text-cyan-600' },
  { name: 'Audit Log', href: '/audit-log', icon: Shield, roles: ['admin'], color: 'text-slate-600' },
  { name: 'Instellingen', href: '/settings', icon: Settings, roles: ['admin', 'employee', 'manager'], color: 'text-gray-600' },
];

// Company Selector
const CompanySelector: React.FC<{ collapsed: boolean }> = ({ collapsed }) => {
  const { companies, selectedCompany, setSelectedCompany } = useApp();
  const { userRole } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  // ✅ FIXED: Only admin sees company selector
  if (userRole !== 'admin' || !companies || companies.length === 0) {
    return null;
  }

  if (collapsed) {
    return (
      <div className="px-3 py-4">
        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
          <Building2 className="h-6 w-6 text-blue-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 border-b border-gray-100">
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between p-3 text-left bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <div className="flex items-center space-x-3">
            <div className="p-1.5 bg-blue-500 rounded-lg">
              <Building2 className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">
                {selectedCompany?.name || 'Selecteer bedrijf'}
              </div>
              <div className="text-xs text-gray-500">
                {companies.length} bedrijven
              </div>
            </div>
          </div>
          <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto">
              <div className="p-2 space-y-1">
                {companies.map((company) => (
                  <button
                    key={company.id}
                    onClick={() => {
                      setSelectedCompany(company);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center space-x-3 p-2 rounded-lg transition-colors ${
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

// Navigation Item
const NavItem: React.FC<{ item: NavigationItem; collapsed: boolean }> = ({ item, collapsed }) => (
  <NavLink
    to={item.href}
    className={({ isActive }) =>
      `group flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${
        isActive
          ? 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 shadow-sm border border-blue-200'
          : 'text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-slate-50 hover:text-gray-900'
      } ${collapsed ? 'justify-center' : ''}`
    }
    title={collapsed ? item.name : undefined}
  >
    {({ isActive }) => (
      <>
        <div className={`p-2 rounded-lg ${collapsed ? '' : 'mr-3'} transition-all duration-200 ${
          isActive 
            ? 'bg-blue-500 shadow-sm' 
            : 'bg-gray-100 group-hover:bg-gray-200'
        }`}>
          <item.icon className={`h-4 w-4 ${
            isActive ? 'text-white' : item.color || 'text-gray-600'
          }`} />
        </div>
        {!collapsed && (
          <>
            <span className="flex-1">{item.name}</span>
            {item.badge && (
              <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-semibold">
                {item.badge}
              </span>
            )}
          </>
        )}
      </>
    )}
  </NavLink>
);

// Section Header
const SectionHeader: React.FC<{ 
  title: string; 
  icon: React.ComponentType<{ className?: string }>; 
  collapsed: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}> = ({ title, icon: Icon, collapsed, isExpanded, onToggle }) => {
  if (collapsed) {
    return (
      <div className="flex justify-center py-2">
        <div className="w-8 h-px bg-gray-300"></div>
      </div>
    );
  }

  return (
    <button
      onClick={onToggle}
      className="flex items-center space-x-2 px-4 py-2 mb-2 w-full hover:bg-gray-50 rounded-lg transition-colors"
    >
      <Icon className="h-4 w-4 text-gray-400" />
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex-1 text-left">{title}</span>
      <ChevronRight className={`h-3 w-3 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
    </button>
  );
};

const Sidebar: React.FC = () => {
  const { signOut, userRole } = useAuth();
  const [collapsed, setCollapsed] = useState(true);
  const [expandedSections, setExpandedSections] = useState<string[]>(['Hoofdmenu']);

  const toggleSection = (sectionTitle: string) => {
    setExpandedSections(prev =>
      prev.includes(sectionTitle)
        ? prev.filter(s => s !== sectionTitle)
        : [...prev, sectionTitle]
    );
  };

  // Filter navigation items based on user role
  const filteredNavigation = navigation.filter(item => userRole && item.roles.includes(userRole));

  // ✅ FIXED: Correcte categorisering volgens screenshots
  const mainItems = filteredNavigation.slice(0, 3); // Dashboard, Bedrijven, Werknemers
  const adminItems = filteredNavigation.slice(3, 8); // Admin Dashboard tot Verzuim Beheren
  const timeItems = filteredNavigation.slice(8, 10); // Urenregistratie, Uren Goedkeuren
  const invoiceItems = filteredNavigation.slice(10, 12); // Facturen
  const dataItems = filteredNavigation.slice(12, 14); // Export, Drive
  const systemItems = filteredNavigation.slice(14); // Loonstroken, Audit, Settings

  const sections = [
    { title: 'Hoofdmenu', icon: Zap, items: mainItems },
    { title: 'Admin Beheer', icon: UserCog, items: adminItems },
    { title: 'Tijd & Aanwezigheid', icon: Activity, items: timeItems },
    { title: 'Facturatie', icon: Receipt, items: invoiceItems },
    { title: 'Data & Bestanden', icon: TrendingUp, items: dataItems },
    { title: 'Systeem', icon: Settings, items: systemItems },
  ].filter(section => section.items.length > 0);

  return (
    <div className={`hidden lg:flex lg:flex-col lg:bg-white lg:border-r lg:border-gray-200 lg:shadow-sm transition-all duration-300 ${
      collapsed ? 'lg:w-20' : 'lg:w-72'
    }`}>
      {/* Header */}
      <div className="flex h-20 items-center justify-center border-b border-gray-100 px-6 bg-gradient-to-r from-slate-50 to-gray-50 relative">
        {!collapsed && (
          <img src="/Logo-groot.png" alt="AlloonApp Logo" className="h-16 w-auto" />
        )}
        {collapsed && (
          <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xl">A</span>
          </div>
        )}
        
        {/* Toggle Button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-1/2 transform -translate-y-1/2 w-6 h-6 bg-white border border-gray-300 rounded-full flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm"
        >
          <ChevronLeft className={`h-3 w-3 text-gray-600 transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Company Selector */}
      <CompanySelector collapsed={collapsed} />

      {/* Navigation */}
      <nav className="flex-1 space-y-2 px-4 py-6 overflow-y-auto">
        {sections.map((section) => (
          <div key={section.title} className="space-y-1">
            <SectionHeader
              title={section.title}
              icon={section.icon}
              collapsed={collapsed}
              isExpanded={expandedSections.includes(section.title)}
              onToggle={() => toggleSection(section.title)}
            />
            
            {(collapsed || expandedSections.includes(section.title)) && (
              <div className="space-y-1">
                {section.items.map((item) => (
                  <NavItem key={item.name} item={item} collapsed={collapsed} />
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-100 p-4 bg-gradient-to-r from-slate-50 to-gray-50">
        <button
          onClick={signOut}
          className={`flex w-full items-center px-4 py-3 text-sm font-medium text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200 group ${
            collapsed ? 'justify-center' : ''
          }`}
          title={collapsed ? 'Uitloggen' : undefined}
        >
          <div className="p-2 rounded-lg mr-3 bg-gray-100 group-hover:bg-red-100 transition-colors">
            <LogOut className="h-4 w-4 text-gray-600 group-hover:text-red-600" />
          </div>
          {!collapsed && <span>Uitloggen</span>}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;