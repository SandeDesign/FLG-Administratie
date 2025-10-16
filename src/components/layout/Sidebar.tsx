import React, { useEffect, useState } from 'react';
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
  Briefcase,
  Target,
  FolderOpen,
} from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { NotificationCenter } from '../notifications/NotificationCenter';
import { CompanySelector } from '../ui/CompanySelector';
import { NavigationGroup } from './NavigationGroup';
import { Company } from '../../types';

export interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
  companyTypes?: ('employer' | 'project')[];
  description?: string;
}

// ✅ CONTEXT-AWARE NAVIGATION DEFINITIES
const coreNavigation: NavigationItem[] = [
  { 
    name: 'Dashboard', 
    href: '/', 
    icon: LayoutDashboard, 
    roles: ['admin'], 
    companyTypes: ['employer', 'project'],
    description: 'Overzicht en statistieken'
  },
];

const organizationNavigation: NavigationItem[] = [
  { 
    name: 'Bedrijven', 
    href: '/companies', 
    icon: Building2, 
    roles: ['admin'], 
    companyTypes: ['employer'], // Alleen voor employer companies
    description: 'Beheer je bedrijven en projecten'
  },
  { 
    name: 'Werknemers', 
    href: '/employees', 
    icon: Users, 
    roles: ['admin'], 
    companyTypes: ['employer', 'project'],
    description: 'Personeelsbeheer'
  },
  { 
    name: 'Project Team', 
    href: '/project-team', 
    icon: Target, 
    roles: ['admin'], 
    companyTypes: ['project'], // Alleen voor project companies
    description: 'Toegewezen projectmedewerkers'
  },
];

const timeAttendanceNavigation: NavigationItem[] = [
  { 
    name: 'Urenregistratie', 
    href: '/timesheets', 
    icon: Clock, 
    roles: ['admin', 'employee'], 
    companyTypes: ['employer', 'project'],
    description: 'Tijd registratie en overzichten'
  },
  { 
    name: 'Uren Goedkeuren', 
    href: '/timesheet-approvals', 
    icon: Calendar, 
    roles: ['admin'], 
    companyTypes: ['employer', 'project'],
    description: 'Goedkeuring van geregistreerde uren'
  },
  { 
    name: 'Project Uren', 
    href: '/project-hours', 
    icon: Briefcase, 
    roles: ['admin'], 
    companyTypes: ['project'], // Project-specifiek
    description: 'Projecturen en voortgang'
  },
  { 
    name: 'Verlof Goedkeuren', 
    href: '/admin/leave-approvals', 
    icon: Calendar, 
    roles: ['admin'], 
    companyTypes: ['employer'], // Alleen primaire werkgever
    description: 'Verlofaanvragen beheren'
  },
  { 
    name: 'Verzuim Beheren', 
    href: '/admin/absence-management', 
    icon: HeartPulse, 
    roles: ['admin'], 
    companyTypes: ['employer'], // Alleen primaire werkgever
    description: 'Ziekteverzuim en reïntegratie'
  },
];

const financialNavigation: NavigationItem[] = [
  { 
    name: 'Declaraties', 
    href: '/admin/expenses', 
    icon: Receipt, 
    roles: ['admin'], 
    companyTypes: ['employer', 'project'],
    description: 'Onkostendeclaraties beheren'
  },
  { 
    name: 'Project Kosten', 
    href: '/project-costs', 
    icon: FolderOpen, 
    roles: ['admin'], 
    companyTypes: ['project'], // Project-specifiek
    description: 'Project gerelateerde kosten'
  },
  { 
    name: 'Loonverwerking', 
    href: '/payroll-processing', 
    icon: Calculator, 
    roles: ['admin'], 
    companyTypes: ['employer'], // Alleen primaire werkgever
    description: 'Salarissen en loonstroken'
  },
  { 
    name: 'Loonstroken', 
    href: '/payslips', 
    icon: FileText, 
    roles: ['admin', 'employee'], 
    companyTypes: ['employer'], // Alleen primaire werkgever
    description: 'Loonstroken bekijken'
  },
  { 
    name: 'Loonaangiftes', 
    href: '/tax-returns', 
    icon: BookOpen, 
    roles: ['admin'], 
    companyTypes: ['employer'], // Alleen primaire werkgever
    description: 'Belastingaangiftes'
  },
];

const systemNavigation: NavigationItem[] = [
  { 
    name: 'Exports', 
    href: '/exports', 
    icon: Download, 
    roles: ['admin'], 
    companyTypes: ['employer', 'project'],
    description: 'Data export en rapporten'
  },
  { 
    name: 'Audit Log', 
    href: '/audit-log', 
    icon: Shield, 
    roles: ['admin'], 
    companyTypes: ['employer'], // Alleen primaire werkgever
    description: 'Systeem audit trail'
  },
  { 
    name: 'Instellingen', 
    href: '/settings', 
    icon: Settings, 
    roles: ['admin', 'employee'], 
    companyTypes: ['employer', 'project'],
    description: 'Applicatie instellingen'
  },
];

// ✅ CONTEXT-AWARE FILTER FUNCTIE
const filterNavigationByContext = (
  navigation: NavigationItem[], 
  userRole: string | null, 
  selectedCompany: Company | null
): NavigationItem[] => {
  return navigation.filter(item => {
    // Check role permission
    if (!userRole || !item.roles.includes(userRole)) {
      return false;
    }
    
    // Check company type permission
    if (selectedCompany && item.companyTypes) {
      return item.companyTypes.includes(selectedCompany.companyType);
    }
    
    // Default: show if no specific company type restrictions
    return !item.companyTypes || item.companyTypes.length === 0;
  });
};

// ✅ COMPANY TYPE INDICATOR COMPONENT
const CompanyTypeIndicator: React.FC<{ company: Company }> = ({ company }) => {
  const isProject = company.companyType === 'project';
  
  return (
    <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium ${
      isProject 
        ? 'bg-blue-50 text-blue-700 border border-blue-200' 
        : 'bg-green-50 text-green-700 border border-green-200'
    }`}>
      {isProject ? (
        <>
          <Target className="h-3 w-3" />
          <span>Project</span>
        </>
      ) : (
        <>
          <Building2 className="h-3 w-3" />
          <span>Werkgever</span>
        </>
      )}
    </div>
  );
};

export const Sidebar: React.FC = () => {
  const { user, signOut, userRole } = useAuth();
  const { selectedCompany } = useApp();
  const [navigationGroups, setNavigationGroups] = useState<{
    core: NavigationItem[];
    organization: NavigationItem[];
    timeAttendance: NavigationItem[];
    financial: NavigationItem[];
    system: NavigationItem[];
  }>({
    core: [],
    organization: [],
    timeAttendance: [],
    financial: [],
    system: []
  });

  // ✅ UPDATE NAVIGATION BASED ON CONTEXT
  useEffect(() => {
    setNavigationGroups({
      core: filterNavigationByContext(coreNavigation, userRole, selectedCompany),
      organization: filterNavigationByContext(organizationNavigation, userRole, selectedCompany),
      timeAttendance: filterNavigationByContext(timeAttendanceNavigation, userRole, selectedCompany),
      financial: filterNavigationByContext(financialNavigation, userRole, selectedCompany),
      system: filterNavigationByContext(systemNavigation, userRole, selectedCompany)
    });
  }, [userRole, selectedCompany]);

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

      {/* Company Selector + Type Indicator */}
      {userRole === 'admin' && (
        <div className="px-4 py-3 border-b border-gray-100 space-y-3">
          <CompanySelector />
          {selectedCompany && (
            <CompanyTypeIndicator company={selectedCompany} />
          )}
        </div>
      )}

      {/* Context-Aware Navigation */}
      <nav className="flex-1 space-y-4 px-3 py-4 overflow-y-auto">
        {/* Core Navigation */}
        {navigationGroups.core.length > 0 && (
          <NavigationGroup 
            title="Hoofdmenu" 
            items={navigationGroups.core} 
          />
        )}

        {/* Organization Navigation */}
        {!isEmployee && navigationGroups.organization.length > 0 && (
          <NavigationGroup 
            title="Organisatie" 
            items={navigationGroups.organization} 
          />
        )}

        {/* Time & Attendance Navigation */}
        {navigationGroups.timeAttendance.length > 0 && (
          <NavigationGroup 
            title="Tijd & Aanwezigheid" 
            items={navigationGroups.timeAttendance} 
          />
        )}

        {/* Financial Navigation */}
        {navigationGroups.financial.length > 0 && (
          <NavigationGroup 
            title="Financieel" 
            items={navigationGroups.financial} 
          />
        )}

        {/* System Navigation */}
        {navigationGroups.system.length > 0 && (
          <NavigationGroup 
            title="Systeem" 
            items={navigationGroups.system} 
          />
        )}

        {/* No Company Selected Message */}
        {userRole === 'admin' && !selectedCompany && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-700">
              Selecteer een bedrijf om alle functies te bekijken
            </p>
          </div>
        )}
      </nav>

      {/* User Menu */}
      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center space-x-3 mb-3">
          <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
            <span className="text-xs font-medium text-blue-700">
              {user?.email?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user?.email}
            </p>
            <p className="text-xs text-gray-500 capitalize">
              {userRole}
            </p>
          </div>
        </div>
        
        <button
          onClick={signOut}
          className="flex items-center space-x-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <LogOut className="h-4 w-4" />
          <span>Uitloggen</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;