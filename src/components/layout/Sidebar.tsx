import React, { useState, useEffect } from 'react';
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
  UserCheck,
  Briefcase,
  BarChart3,
  Factory,
} from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';

export interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
  companyTypes?: ('employer' | 'project')[]; // ✅ NEW
  badge?: string;
  color?: string;
}

// ✅ UPDATED: Navigation with company type filtering + Statistieken
export const navigation: NavigationItem[] = [
  // ✅ DASHBOARD - SOLO (NO SECTION)
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['admin'], companyTypes: ['employer', 'project'] },
  
  // PERSONEEL SECTION (employer only, but timesheets for all)
  { name: 'Werknemers', href: '/employees', icon: Users, roles: ['admin', 'manager'], companyTypes: ['employer'] },
  { name: 'Urenregistratie', href: '/timesheets', icon: Clock, roles: ['admin', 'employee', 'manager'], companyTypes: ['employer', 'project'] },
  { name: 'Uren Beheren', href: '/timesheet-approvals', icon: Clock, roles: ['admin', 'manager'], companyTypes: ['employer'] },
  { name: 'Verlof Beheren', href: '/admin/leave-approvals', icon: Calendar, roles: ['admin', 'manager'], companyTypes: ['employer'] },
  { name: 'Ziekte Beheren', href: '/admin/absence-management', icon: HeartPulse, roles: ['admin', 'manager'], companyTypes: ['employer'] },
  
  // FACTURATIE SECTION (both)
  { name: 'Relaties', href: '/invoice-relations', icon: UserCheck, roles: ['admin', 'manager'], companyTypes: ['employer', 'project'] },
  { name: 'Verkoop Facturen', href: '/outgoing-invoices', icon: Send, roles: ['admin', 'manager'], companyTypes: ['employer', 'project'] },
  { name: 'Inkoopbonnen', href: '/incoming-invoices-stats', icon: BarChart3, roles: ['admin'], companyTypes: ['employer', 'project'] },
  { name: 'Facturen Uploaden', href: '/incoming-invoices', icon: Upload, roles: ['admin'], companyTypes: ['employer', 'project'] },

  // PROJECT COMPANY SPECIFIC
  { name: 'Productie', href: '/project-production', icon: Factory, roles: ['admin', 'manager'], companyTypes: ['project'] },
  
  // STATISTIEKEN (both)
  { name: 'Statistieken', href: '/project-statistics', icon: BarChart3, roles: ['admin'], companyTypes: ['employer', 'project'] },
  
  // DATA & EXPORTS SECTION (employer only)
  { name: 'Uren Export', href: '/timesheet-export', icon: Download, roles: ['admin', 'manager'], companyTypes: ['employer'] },
  { name: 'Drive Bestanden', href: '/drive-files', icon: FolderOpen, roles: ['admin'], companyTypes: ['employer'] },
  
  // SYSTEEM SECTION
  { name: 'Bedrijven', href: '/companies', icon: Building2, roles: ['admin'], companyTypes: ['employer'] },
  { name: 'Loonstroken', href: '/payslips', icon: FileText, roles: ['admin', 'employee', 'manager'], companyTypes: ['employer', 'project'] },
  { name: 'Audit Log', href: '/audit-log', icon: Shield, roles: ['admin'], companyTypes: ['employer'] },
  { name: 'Instellingen', href: '/settings', icon: Settings, roles: ['admin', 'employee', 'manager'], companyTypes: ['employer', 'project'] },
];

interface Section {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavigationItem[];
  defaultOpen?: boolean;
}

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
            isActive ? 'text-white' : 'text-gray-600'
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
  const { selectedCompany } = useApp();
  const [collapsed, setCollapsed] = useState(true);
  const [expandedSections, setExpandedSections] = useState<string[]>([]);

  // ✅ LOAD STATE FROM LOCALSTORAGE ON MOUNT
  useEffect(() => {
    const savedCollapsed = localStorage.getItem('sidebarCollapsed');
    const savedExpanded = localStorage.getItem('sidebarExpandedSections');
    
    if (savedCollapsed !== null) {
      setCollapsed(JSON.parse(savedCollapsed));
    }
    if (savedExpanded !== null) {
      setExpandedSections(JSON.parse(savedExpanded));
    }
  }, []);

  // ✅ SAVE COLLAPSED STATE TO LOCALSTORAGE
  const handleToggleCollapsed = () => {
    const newState = !collapsed;
    setCollapsed(newState);
    localStorage.setItem('sidebarCollapsed', JSON.stringify(newState));
  };

  // ✅ SAVE EXPANDED SECTIONS TO LOCALSTORAGE
  const toggleSection = (sectionTitle: string) => {
    const newExpandedSections = expandedSections.includes(sectionTitle)
      ? expandedSections.filter(s => s !== sectionTitle)
      : [...expandedSections, sectionTitle];
    
    setExpandedSections(newExpandedSections);
    localStorage.setItem('sidebarExpandedSections', JSON.stringify(newExpandedSections));
  };

  // ✅ NEW: Filter navigation by role AND company type
  const companyType = selectedCompany?.companyType as 'employer' | 'project' | undefined;
  const filteredNavigation = navigation.filter(item => {
    const roleMatches = userRole && item.roles.includes(userRole);
    const companyTypeMatches = !companyType || !item.companyTypes || item.companyTypes.includes(companyType);
    return roleMatches && companyTypeMatches;
  });

  // ✅ DASHBOARD ITEM (NO SECTION)
  const dashboardItem = filteredNavigation.find(i => i.name === 'Dashboard');

  const sections: Section[] = [
    { 
      title: 'HR Beheer', 
      icon: Activity, 
      defaultOpen: false,
      items: filteredNavigation.filter(i => ['Werknemers', 'Urenregistratie', 'Uren Beheren', 'Verlof Beheren', 'Ziekte Beheren'].includes(i.name)) 
    },
    { 
      title: 'Financieel', 
      icon: Receipt, 
      defaultOpen: false,
      items: filteredNavigation.filter(i => ['Relaties', 'Verkoop Facturen', 'Facturen Uploaden', 'Inkoopbonnen'].includes(i.name)) 
    },
    {
      title: 'Project',
      icon: Factory,
      defaultOpen: false,
      items: filteredNavigation.filter(i => ['Productie', 'Statistieken'].includes(i.name))
    },
    { 
      title: 'Data & Exports', 
      icon: TrendingUp, 
      defaultOpen: false,
      items: filteredNavigation.filter(i => ['Uren Export', 'Drive Bestanden'].includes(i.name)) 
    },
    { 
      title: 'Systeem', 
      icon: Settings, 
      defaultOpen: false,
      items: filteredNavigation.filter(i => ['Bedrijven', 'Loonstroken', 'Audit Log', 'Instellingen'].includes(i.name)) 
    },
  ].filter(section => section.items.length > 0);

  return (
    <div className={`hidden lg:flex lg:flex-col lg:bg-white lg:border-r lg:border-gray-200 lg:shadow-sm transition-all duration-300 ${
      collapsed ? 'lg:w-20' : 'lg:w-72'
    }`}>
      {/* ✅ HEADER - GROTER LOGO - DUNNER VAK */}
      <div className="flex h-24 items-center justify-center border-b border-gray-100 px-4 bg-gradient-to-r from-slate-50 to-gray-50 relative">
        {!collapsed && (
          <img src="/Logo-groot.png" alt="AlloonApp Logo" className="h-32 w-auto drop-shadow-sm" />
        )}
        {collapsed && (
          <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-2xl">A</span>
          </div>
        )}
        
        <button
          onClick={handleToggleCollapsed}
          className="absolute -right-3 top-1/2 transform -translate-y-1/2 w-6 h-6 bg-white border border-gray-300 rounded-full flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm"
        >
          <ChevronLeft className={`h-3 w-3 text-gray-600 transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* ❌ COMPANY SELECTOR REMOVED - NOW ONLY IN MOBILE HEADER */}

      {/* Navigation */}
      <nav className="flex-1 space-y-2 px-4 py-6 overflow-y-auto">
        {/* ✅ DASHBOARD - SOLO (NO SECTION) */}
        {dashboardItem && (
          <div className="pb-4 border-b border-gray-200">
            <NavItem item={dashboardItem} collapsed={collapsed} />
          </div>
        )}

        {/* ✅ SECTIONS */}
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