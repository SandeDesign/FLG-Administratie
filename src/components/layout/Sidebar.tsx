import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Users,
  Clock,
  CalendarCheck,
  Stethoscope,
  FileText,
  Upload,
  Download,
  Settings,
  LogOut,
  Shield,
  ChevronRight,
  ChevronLeft,
  PieChart,
  Wallet,
  Handshake,
  FileOutput,
  FileInput,
  FolderOpen,
  Factory,
  BarChart2,
  User,
  ClipboardList,
  Receipt,
  CreditCard,
  Star,
  TrendingUp,
  ListChecks,
} from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { getUserSettings } from '../../services/firebase';

export interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
  companyTypes?: ('employer' | 'project' | 'holding')[];
  badge?: string;
  color?: string;
}

// Menu per rol en bedrijfstype - CLEANER ICONS
export const navigation: NavigationItem[] = [
  // DASHBOARD - Iedereen
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['admin', 'manager', 'employee'], companyTypes: ['employer', 'project', 'holding'] },

  // ADMIN - EMPLOYER (HR Beheer) - NIET voor holding
  { name: 'Werknemers', href: '/employees', icon: Users, roles: ['admin'], companyTypes: ['employer'] },
  { name: 'Uren Goedkeuren', href: '/timesheet-approvals', icon: ClipboardList, roles: ['admin'], companyTypes: ['employer'] },
  { name: 'Verlof Beheren', href: '/admin/leave-approvals', icon: CalendarCheck, roles: ['admin'], companyTypes: ['employer'] },
  { name: 'Verzuim Beheren', href: '/admin/absence-management', icon: Stethoscope, roles: ['admin'], companyTypes: ['employer'] },

  // FINANCIEEL - Voor alle types (employer, project, holding)
  { name: 'Klanten & Leveranciers', href: '/invoice-relations', icon: Handshake, roles: ['admin'], companyTypes: ['employer', 'project', 'holding'] },
  { name: 'Begroting', href: '/budgeting', icon: Wallet, roles: ['admin'], companyTypes: ['employer', 'project', 'holding'] },
  { name: 'Uitgaande facturen', href: '/outgoing-invoices', icon: FileOutput, roles: ['admin'], companyTypes: ['employer', 'project', 'holding'] },
  { name: 'Inkomende facturen', href: '/incoming-invoices-stats', icon: PieChart, roles: ['admin'], companyTypes: ['employer', 'project', 'holding'] },
  { name: 'Inkoop Upload', href: '/incoming-invoices', icon: Upload, roles: ['admin', 'manager'], companyTypes: ['employer', 'project', 'holding'] },
  { name: 'Declaraties', href: '/admin-expenses', icon: Receipt, roles: ['admin'], companyTypes: ['employer'] },

  // PROJECT COMPANY
  { name: 'Productie', href: '/project-production', icon: Factory, roles: ['admin', 'manager'], companyTypes: ['project'] },
  { name: 'Project Stats', href: '/project-statistics', icon: BarChart2, roles: ['admin'], companyTypes: ['project'] },

  // STATISTIEKEN - Voor alle rollen en bedrijfstypes
  { name: 'Statistieken', href: '/statistics/employer', icon: TrendingUp, roles: ['admin', 'manager'], companyTypes: ['employer'] },
  { name: 'Statistieken', href: '/statistics/project', icon: TrendingUp, roles: ['admin', 'manager'], companyTypes: ['project'] },
  { name: 'Statistieken', href: '/statistics/holding', icon: TrendingUp, roles: ['admin', 'manager'], companyTypes: ['holding'] },

  // SYSTEEM (Admin - Employer en Holding)
  { name: 'Taken', href: '/tasks', icon: ListChecks, roles: ['admin', 'co-admin', 'manager'], companyTypes: ['employer', 'project', 'holding'] },
  { name: 'Bedrijven', href: '/companies', icon: Building2, roles: ['admin'], companyTypes: ['employer', 'holding'] },
  { name: 'Audit Log', href: '/audit-log', icon: Shield, roles: ['admin'], companyTypes: ['employer', 'holding'] },

  // MANAGER - Specifiek (alleen employer)
  { name: 'Mijn Team', href: '/employees', icon: Users, roles: ['manager'], companyTypes: ['employer'] },
  { name: 'Uren Goedkeuren', href: '/timesheet-approvals', icon: ClipboardList, roles: ['manager'], companyTypes: ['employer'] },
  { name: 'Verlof Goedkeuren', href: '/admin/leave-approvals', icon: CalendarCheck, roles: ['manager'], companyTypes: ['employer'] },

  // EMPLOYEE - Mijn zaken (alleen employer)
  { name: 'Mijn Uren', href: '/timesheets', icon: Clock, roles: ['employee', 'manager'], companyTypes: ['employer'] },
  { name: 'Mijn Verlof', href: '/leave', icon: CalendarCheck, roles: ['employee'], companyTypes: ['employer'] },
  { name: 'Mijn Declaraties', href: '/expenses', icon: Receipt, roles: ['employee'], companyTypes: ['employer'] },
  { name: 'Mijn Loonstroken', href: '/payslips', icon: CreditCard, roles: ['employee'], companyTypes: ['employer'] },

  // INSTELLINGEN - Iedereen
  { name: 'Instellingen', href: '/settings', icon: Settings, roles: ['admin', 'manager', 'employee'], companyTypes: ['employer', 'project', 'holding'] },
];

interface Section {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavigationItem[];
  defaultOpen?: boolean;
  color: string;
}

// Navigation Item - Cleaner Design
const NavItem: React.FC<{ item: NavigationItem; collapsed: boolean }> = ({ item, collapsed }) => (
  <NavLink
    to={item.href}
    className={({ isActive }) =>
      `group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-150 ${
        isActive
          ? 'bg-primary-50 text-primary-700 border-l-3 border-primary-500'
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
      } ${collapsed ? 'justify-center' : ''}`
    }
    title={collapsed ? item.name : undefined}
  >
    {({ isActive }) => (
      <>
        <item.icon className={`h-5 w-5 flex-shrink-0 ${
          isActive ? 'text-primary-600' : 'text-gray-400 group-hover:text-gray-600'
        } ${collapsed ? '' : 'mr-3'}`} />
        {!collapsed && (
          <>
            <span className="truncate">{item.name}</span>
            {item.badge && (
              <span className="ml-auto bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full font-medium">
                {item.badge}
              </span>
            )}
          </>
        )}
      </>
    )}
  </NavLink>
);

// Section Header - Cleaner Design
const SectionHeader: React.FC<{
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  collapsed: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  color: string;
}> = ({ title, icon: Icon, collapsed, isExpanded, onToggle, color }) => {
  if (collapsed) {
    return (
      <div className="flex justify-center py-1.5">
        <div className="w-6 h-px bg-gray-200"></div>
      </div>
    );
  }

  return (
    <button
      onClick={onToggle}
      className="flex items-center w-full px-3 py-2 mt-1 rounded-lg hover:bg-gray-50 transition-colors group"
    >
      <div className={`p-1.5 rounded-md ${color} mr-2`}>
        <Icon className="h-3.5 w-3.5 text-white" />
      </div>
      <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide flex-1 text-left">
        {title}
      </span>
      <ChevronRight className={`h-3.5 w-3.5 text-gray-400 transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`} />
    </button>
  );
};

const Sidebar: React.FC = () => {
  const { signOut, userRole, user } = useAuth();
  const { selectedCompany } = useApp();
  const [collapsed, setCollapsed] = useState(true);
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [favoritePages, setFavoritePages] = useState<string[]>([]);

  // Load state from localStorage on mount
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

  // Load favorite pages from user settings voor het geselecteerde bedrijf
  useEffect(() => {
    const loadFavorites = async () => {
      if (user && userRole === 'admin' && selectedCompany?.id) {
        try {
          const settings = await getUserSettings(user.uid);
          console.log('Loaded all favorites from settings:', settings?.favoritePages);

          // Haal favorieten op voor het geselecteerde bedrijf
          if (settings?.favoritePages && settings.favoritePages[selectedCompany.id]) {
            const companyFavorites = settings.favoritePages[selectedCompany.id];
            console.log(`Favorites for company ${selectedCompany.name}:`, companyFavorites);
            setFavoritePages(companyFavorites);
          } else {
            console.log(`No favorites found for company ${selectedCompany.name}`);
            setFavoritePages([]);
          }
        } catch (error) {
          console.error('Error loading favorites:', error);
          setFavoritePages([]);
        }
      } else {
        setFavoritePages([]);
      }
    };

    loadFavorites();
  }, [user?.uid, userRole, selectedCompany?.id]);

  const handleToggleCollapsed = () => {
    const newState = !collapsed;
    setCollapsed(newState);
    localStorage.setItem('sidebarCollapsed', JSON.stringify(newState));
  };

  const toggleSection = (sectionTitle: string) => {
    const newExpandedSections = expandedSections.includes(sectionTitle)
      ? expandedSections.filter(s => s !== sectionTitle)
      : [...expandedSections, sectionTitle];

    setExpandedSections(newExpandedSections);
    localStorage.setItem('sidebarExpandedSections', JSON.stringify(newExpandedSections));
  };

  // Filter navigation by role AND company type
  const companyType = selectedCompany?.companyType as 'employer' | 'project' | 'holding' | undefined;
  const filteredNavigation = navigation.filter(item => {
    const roleMatches = userRole && item.roles.includes(userRole);
    const companyTypeMatches = !companyType || !item.companyTypes || item.companyTypes.includes(companyType);
    return roleMatches && companyTypeMatches;
  });

  // Dashboard item (no section)
  const dashboardItem = filteredNavigation.find(i => i.name === 'Dashboard');

  // Favorite items (only for admin)
  const favoriteItems = userRole === 'admin' && favoritePages.length > 0
    ? filteredNavigation.filter(i => favoritePages.includes(i.href) && i.name !== 'Dashboard')
    : [];

  // Sections with distinct colors
  const sections: Section[] = [
    {
      title: 'Statistieken',
      icon: TrendingUp,
      color: 'bg-indigo-500',
      defaultOpen: companyType === 'holding' || companyType === 'project',
      items: filteredNavigation.filter(i => i.name === 'Statistieken')
    },
    {
      title: 'HR',
      icon: Users,
      color: 'bg-blue-500',
      defaultOpen: false,
      items: filteredNavigation.filter(i =>
        ['Werknemers', 'Uren Goedkeuren', 'Verlof Beheren', 'Verzuim Beheren', 'Mijn Team'].includes(i.name)
      )
    },
    {
      title: 'Financieel',
      icon: Wallet,
      color: 'bg-emerald-500',
      defaultOpen: false,
      items: filteredNavigation.filter(i =>
        ['Klanten & Leveranciers', 'Begroting', 'Uitgaande facturen', 'Inkomende facturen', 'Inkoop Upload', 'Declaraties'].includes(i.name)
      )
    },
    {
      title: 'Project',
      icon: Factory,
      color: 'bg-orange-500',
      defaultOpen: false,
      items: filteredNavigation.filter(i => ['Productie', 'Project Stats'].includes(i.name))
    },
    {
      title: 'Data',
      icon: Download,
      color: 'bg-purple-500',
      defaultOpen: false,
      items: filteredNavigation.filter(i => ['Uren Export', 'Loonstroken', 'Drive'].includes(i.name))
    },
    {
      title: 'Mijn Zaken',
      icon: User,
      color: 'bg-cyan-500',
      defaultOpen: false,
      items: filteredNavigation.filter(i =>
        ['Mijn Uren', 'Mijn Verlof', 'Mijn Declaraties', 'Mijn Loonstroken', 'Verlof Goedkeuren'].includes(i.name)
      )
    },
    {
      title: 'Systeem',
      icon: Settings,
      color: 'bg-gray-500',
      defaultOpen: false,
      items: filteredNavigation.filter(i => ['Taken', 'Bedrijven', 'Audit Log', 'Instellingen'].includes(i.name))
    },
  ].filter(section => section.items.length > 0);

  return (
    <div className={`hidden lg:flex lg:flex-col lg:bg-white lg:border-r lg:border-gray-200 transition-all duration-200 ${
      collapsed ? 'lg:w-16' : 'lg:w-64'
    }`}>
      {/* Header - Logo */}
      <div className="flex h-16 items-center justify-center border-b border-gray-100 px-3 relative">
        {!collapsed && (
          selectedCompany?.logoUrl ? (
            <img src={selectedCompany.logoUrl} alt={selectedCompany.name} className="h-10 w-auto max-w-[200px] object-contain" />
          ) : (
            <img src="/Logo_1.png" alt="Logo" className="h-10 w-auto" />
          )
        )}
        {collapsed && (
          selectedCompany?.logoUrl ? (
            <div className="w-9 h-9 rounded-lg overflow-hidden flex items-center justify-center">
              <img src={selectedCompany.logoUrl} alt={selectedCompany.name} className="w-full h-full object-contain p-0.5" />
            </div>
          ) : (
            <div className="w-9 h-9 bg-primary-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">F</span>
            </div>
          )
        )}

        <button
          onClick={handleToggleCollapsed}
          className="absolute -right-3 top-1/2 transform -translate-y-1/2 w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center hover:bg-gray-50 shadow-sm z-10"
        >
          <ChevronLeft className={`h-3 w-3 text-gray-500 transition-transform duration-150 ${collapsed ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 overflow-y-auto space-y-1">
        {/* Dashboard - Solo */}
        {dashboardItem && (
          <div className="pb-3 mb-2 border-b border-gray-100">
            <NavItem item={dashboardItem} collapsed={collapsed} />
          </div>
        )}

        {/* Favorites Section - Only for admin */}
        {favoriteItems.length > 0 && (
          <div className="pb-3 mb-2">
            <SectionHeader
              title="Favorieten"
              icon={Star}
              collapsed={collapsed}
              isExpanded={expandedSections.includes('Favorieten')}
              onToggle={() => toggleSection('Favorieten')}
              color="bg-amber-500"
            />
            {(collapsed || expandedSections.includes('Favorieten')) && (
              <div className={`space-y-0.5 ${collapsed ? '' : 'ml-2 pl-3 border-l border-gray-100 mt-1'}`}>
                {favoriteItems.map((item) => (
                  <NavItem key={item.name} item={item} collapsed={collapsed} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Manager: Flat list without collapsible sections */}
        {userRole === 'manager' ? (
          <div className="space-y-0.5">
            {filteredNavigation.filter(i => i.name !== 'Dashboard').map((item) => (
              <NavItem key={item.name} item={item} collapsed={collapsed} />
            ))}
          </div>
        ) : (
          /* Admin/Employee: Sections with dropdowns */
          <div className="space-y-1">
            {sections.map((section) => (
              <div key={section.title}>
                <SectionHeader
                  title={section.title}
                  icon={section.icon}
                  collapsed={collapsed}
                  isExpanded={expandedSections.includes(section.title)}
                  onToggle={() => toggleSection(section.title)}
                  color={section.color}
                />

                {(collapsed || expandedSections.includes(section.title)) && (
                  <div className={`space-y-0.5 ${collapsed ? '' : 'ml-2 pl-3 border-l border-gray-100'}`}>
                    {section.items.map((item) => (
                      <NavItem key={item.name} item={item} collapsed={collapsed} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-100 p-2">
        <button
          onClick={signOut}
          className={`flex w-full items-center px-3 py-2.5 text-sm font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ${
            collapsed ? 'justify-center' : ''
          }`}
          title={collapsed ? 'Uitloggen' : undefined}
        >
          <LogOut className={`h-5 w-5 ${collapsed ? '' : 'mr-3'}`} />
          {!collapsed && <span>Uitloggen</span>}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;