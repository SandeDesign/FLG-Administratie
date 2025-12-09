// src/utils/menuConfig.ts
// Navigation configuration with company type awareness

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
  Shield,
  Activity,
  Receipt,
  Send,
  FolderOpen,
  UserCheck,
  TrendingUp,
  Factory,
  BarChart3,
  Wallet,
  DollarSign,
  UserPlus,
  Package,
  LineChart,
  PieChart,
} from 'lucide-react';

export type CompanyType = 'employer' | 'project' | 'holding';

export interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
  companyTypes: CompanyType[];
  badge?: string;
  color?: string;
  section?: string;
}

// ALLE MOGELIJKE MENU ITEMS
export const ALL_NAVIGATION_ITEMS: NavigationItem[] = [
  // ✅ DASHBOARD - SOLO (NO SECTION)
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['admin'], companyTypes: ['employer', 'project', 'holding'] },

  // ✅ PROJECT-SPECIFIC ITEMS (alleen voor project bedrijven)
  { name: 'Project Dashboard', href: '/project-dashboard', icon: LayoutDashboard, roles: ['admin'], companyTypes: ['project'], section: 'Project' },
  { name: 'Productie Verwerking', href: '/project-production', icon: Factory, roles: ['admin'], companyTypes: ['project'], section: 'Project' },
  { name: 'Statistieken', href: '/project-statistics', icon: BarChart3, roles: ['admin'], companyTypes: ['project'], section: 'Project' },

  // PERSONEEL SECTION (alleen employer - NIET holding)
  { name: 'Werknemers', href: '/employees', icon: Users, roles: ['admin', 'manager'], companyTypes: ['employer'] },
  { name: 'Urenregistratie', href: '/timesheets', icon: Clock, roles: ['admin', 'employee', 'manager'], companyTypes: ['employer'] },
  { name: 'Uren Goedkeuren', href: '/timesheet-approvals', icon: Clock, roles: ['admin', 'manager'], companyTypes: ['employer'] },
  { name: 'Verlof', href: '/leave', icon: Calendar, roles: ['admin', 'employee', 'manager'], companyTypes: ['employer'] },
  { name: 'Verlof Goedkeuren', href: '/admin/leave-approvals', icon: Calendar, roles: ['admin', 'manager'], companyTypes: ['employer'] },
  { name: 'Ziekteverzuim', href: '/absence', icon: HeartPulse, roles: ['admin', 'employee', 'manager'], companyTypes: ['employer'] },
  { name: 'Verzuim Beheren', href: '/admin/absence-management', icon: HeartPulse, roles: ['admin', 'manager'], companyTypes: ['employer'] },

  // STATISTIEKEN SECTION (voor alle bedrijfstypes)
  { name: 'Statistieken', href: '/statistics/employer', icon: TrendingUp, roles: ['admin', 'manager'], companyTypes: ['employer'], section: 'Statistieken' },
  { name: 'Statistieken', href: '/statistics/project', icon: TrendingUp, roles: ['admin', 'manager'], companyTypes: ['project'], section: 'Statistieken' },
  { name: 'Statistieken', href: '/statistics/holding', icon: TrendingUp, roles: ['admin', 'manager'], companyTypes: ['holding'], section: 'Statistieken' },

  // FACTURATIE SECTION (employer, project, holding)
  { name: 'Relaties', href: '/invoice-relations', icon: UserCheck, roles: ['admin'], companyTypes: ['employer', 'project', 'holding'] },
  { name: 'Begroting', href: '/budgeting', icon: Wallet, roles: ['admin'], companyTypes: ['employer', 'project', 'holding'] },
  { name: 'Declaraties', href: '/admin-expenses', icon: Receipt, roles: ['admin'], companyTypes: ['employer'] },
  { name: 'Uitgaande Facturen', href: '/outgoing-invoices', icon: Send, roles: ['admin'], companyTypes: ['employer', 'project', 'holding'] },
  { name: 'Inkomende Facturen', href: '/incoming-invoices', icon: Upload, roles: ['admin'], companyTypes: ['employer', 'project', 'holding'] },
  { name: 'Inkoop Overzicht', href: '/incoming-invoices-stats', icon: PieChart, roles: ['admin'], companyTypes: ['employer', 'project', 'holding'] },
  { name: 'Declaraties Medewerkers', href: '/expenses', icon: Receipt, roles: ['admin', 'employee', 'manager'], companyTypes: ['employer'] },

  // DATA & EXPORTS SECTION (alleen employer - NIET holding)
  { name: 'Uren Export', href: '/timesheet-export', icon: Download, roles: ['admin', 'manager'], companyTypes: ['employer'] },
  { name: 'Drive Bestanden', href: '/drive-files', icon: FolderOpen, roles: ['admin'], companyTypes: ['employer', 'holding'] },
  { name: 'Exports Beheer', href: '/exports-management', icon: Package, roles: ['admin'], companyTypes: ['employer', 'holding'] },

  // SYSTEEM SECTION (employer en holding)
  { name: 'Bedrijven', href: '/companies', icon: Building2, roles: ['admin'], companyTypes: ['employer', 'holding'] },
  { name: 'Loonstroken', href: '/payslips', icon: FileText, roles: ['admin', 'employee', 'manager'], companyTypes: ['employer'] },
  { name: 'Gebruikers Beheer', href: '/admin/users', icon: UserPlus, roles: ['admin'], companyTypes: ['employer', 'holding'] },
  { name: 'Instellingen', href: '/settings', icon: Settings, roles: ['admin', 'employee', 'manager'], companyTypes: ['employer', 'project', 'holding'] },

  // PROJECT EXTRA PAGES
  { name: 'Productie Pool', href: '/production-pool', icon: Package, roles: ['admin'], companyTypes: ['project'], section: 'Project' },
  { name: 'Project Team', href: '/project-team', icon: Users, roles: ['admin'], companyTypes: ['project'], section: 'Project' },
  { name: 'Investment Pitch', href: '/investment-pitch', icon: LineChart, roles: ['admin'], companyTypes: ['project', 'holding'] },
];

// SECTION DEFINITIONS
export interface Section {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavigationItem[];
  defaultOpen?: boolean;
}

/**
 * Get filtered navigation items based on user role and company type
 */
export const getFilteredNavigation = (
  userRole: string | null,
  companyType?: CompanyType
): NavigationItem[] => {
  if (!userRole || !companyType) return [];

  return ALL_NAVIGATION_ITEMS.filter(
    item => item.roles.includes(userRole) && item.companyTypes.includes(companyType)
  );
};

/**
 * Get navigation sections based on user role and company type
 */
export const getNavigationSections = (
  userRole: string | null,
  companyType?: CompanyType
): Section[] => {
  const filtered = getFilteredNavigation(userRole, companyType);

  // Dashboard item (standalone)
  const dashboardItem = filtered.find(i => i.name === 'Dashboard');

  if (companyType === 'project') {
    // PROJECT BEDRIJF SECTIONS
    return [
      {
        title: 'Project',
        icon: Factory,
        defaultOpen: true,
        items: filtered.filter(i => i.section === 'Project'),
      },
      {
        title: 'Statistieken',
        icon: TrendingUp,
        defaultOpen: false,
        items: filtered.filter(i => i.section === 'Statistieken'),
      },
      {
        title: 'Facturatie',
        icon: Receipt,
        defaultOpen: false,
        items: filtered.filter(i => ['Relaties', 'Begroting', 'Uitgaande Facturen', 'Inkomende Facturen', 'Inkoop Overzicht'].includes(i.name)),
      },
      {
        title: 'Overig',
        icon: Settings,
        defaultOpen: false,
        items: filtered.filter(i => ['Investment Pitch', 'Instellingen'].includes(i.name)),
      },
    ].filter(section => section.items.length > 0);
  }

  if (companyType === 'holding') {
    // HOLDING BEDRIJF SECTIONS (geen HR-functionaliteiten)
    return [
      {
        title: 'Statistieken',
        icon: TrendingUp,
        defaultOpen: true,
        items: filtered.filter(i => i.section === 'Statistieken'),
      },
      {
        title: 'Facturatie',
        icon: Receipt,
        defaultOpen: false,
        items: filtered.filter(i =>
          ['Relaties', 'Begroting', 'Uitgaande Facturen', 'Inkomende Facturen', 'Inkoop Overzicht'].includes(i.name)
        ),
      },
      {
        title: 'Data & Exports',
        icon: BarChart3,
        defaultOpen: false,
        items: filtered.filter(i => ['Drive Bestanden', 'Exports Beheer'].includes(i.name)),
      },
      {
        title: 'Systeem',
        icon: Settings,
        defaultOpen: false,
        items: filtered.filter(i => ['Bedrijven', 'Belastingaangiften', 'Audit Log', 'Gebruikers Beheer', 'Rollen Beheer', 'Investment Pitch', 'Instellingen'].includes(i.name)),
      },
    ].filter(section => section.items.length > 0);
  }

  // EMPLOYER BEDRIJF SECTIONS
  return [
    {
      title: 'Statistieken',
      icon: TrendingUp,
      defaultOpen: false,
      items: filtered.filter(i => i.section === 'Statistieken'),
    },
    {
      title: 'Personeel',
      icon: Activity,
      defaultOpen: false,
      items: filtered.filter(i =>
        ['Werknemers', 'Urenregistratie', 'Uren Goedkeuren', 'Verlof', 'Verlof Goedkeuren', 'Ziekteverzuim', 'Verzuim Beheren', 'Salarisverwerking', 'Declaraties Medewerkers'].includes(i.name)
      ),
    },
    {
      title: 'Facturatie',
      icon: Receipt,
      defaultOpen: false,
      items: filtered.filter(i =>
        ['Relaties', 'Begroting', 'Declaraties', 'Uitgaande Facturen', 'Inkomende Facturen', 'Inkoop Overzicht'].includes(i.name)
      ),
    },
    {
      title: 'Data & Exports',
      icon: BarChart3,
      defaultOpen: false,
      items: filtered.filter(i => ['Uren Export', 'Drive Bestanden', 'Exports Beheer'].includes(i.name)),
    },
    {
      title: 'Systeem',
      icon: Settings,
      defaultOpen: false,
      items: filtered.filter(i => ['Bedrijven', 'Loonstroken', 'Belastingaangiften', 'Audit Log', 'Gebruikers Beheer', 'Rollen Beheer', 'Instellingen'].includes(i.name)),
    },
  ].filter(section => section.items.length > 0);
};

/**
 * Get mobile bottom nav items based on user role and company type
 */
export const getMobileBottomNavItems = (
  userRole: string | null,
  companyType?: CompanyType
): Array<{ href: string; icon: React.ComponentType<{ className?: string }>; label: string }> => {
  if (!userRole || !companyType) return [];

  if (companyType === 'project') {
    // PROJECT BEDRIJF MOBILE NAV
    const projectItems = [
      { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
      { href: '/project-dashboard', icon: Factory, label: 'Project' },
      { href: '/outgoing-invoices', icon: Send, label: 'Facturen' },
      { href: '/settings', icon: Settings, label: 'Instellingen' },
    ];
    return projectItems;
  }

  if (companyType === 'holding') {
    // HOLDING BEDRIJF MOBILE NAV
    const holdingItems = [
      { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
      { href: '/outgoing-invoices', icon: Send, label: 'Facturen' },
      { href: '/incoming-invoices', icon: Upload, label: 'Inkoop' },
      { href: '/settings', icon: Settings, label: 'Instellingen' },
    ];
    return holdingItems;
  }

  // EMPLOYER BEDRIJF MOBILE NAV
  const navItems: Record<string, Array<{ href: string; icon: React.ComponentType<{ className?: string }>; label: string }>> = {
    employee: [
      { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
      { href: '/timesheets', icon: Clock, label: 'Uren' },
      { href: '/payslips', icon: FileText, label: 'Loonstrook' },
      { href: '/settings', icon: Settings, label: 'Profiel' },
    ],
    manager: [
      { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
      { href: '/employees', icon: Users, label: 'Team' },
      { href: '/incoming-invoices', icon: Upload, label: 'Inkoop' },
      { href: '/timesheet-approvals', icon: Calendar, label: 'Goedkeuren' },
    ],
    admin: [
      { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
      { href: '/timesheet-approvals', icon: Clock, label: 'Uren' },
      { href: '/outgoing-invoices', icon: Send, label: 'Facturen' },
      { href: '/employees', icon: Users, label: 'Werknemers' },
    ],
  };

  return navItems[userRole] || navItems.employee;
};

/**
 * Check if menu item should be disabled (company not selected)
 */
export const isMenuItemDisabled = (
  item: NavigationItem,
  selectedCompanyId?: string
): boolean => {
  // Items that don't require company selection
  const noCompanyRequired = ['Dashboard', 'Bedrijven', 'Instellingen'];

  if (noCompanyRequired.includes(item.name)) {
    return false;
  }

  return !selectedCompanyId;
};

/**
 * Get tooltip for disabled menu items
 */
export const getMenuItemDisabledReason = (item: NavigationItem): string => {
  const noCompanyRequired = ['Dashboard', 'Bedrijven', 'Instellingen'];

  if (!noCompanyRequired.includes(item.name)) {
    return 'Selecteer eerst een bedrijf';
  }

  return '';
};