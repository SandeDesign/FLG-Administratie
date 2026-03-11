// src/utils/menuConfig.ts
// Navigation configuration — Single Source of Truth voor alle menu's

import {
  LayoutDashboard,
  Building2,
  Users,
  Clock,
  CalendarCheck,
  Stethoscope,
  FileText,
  Settings,
  Shield,
  Receipt,
  Send,
  TrendingUp,
  Factory,
  BarChart2,
  Wallet,
  UserPlus,
  LineChart,
  PieChart,
  ListChecks,
  Mail,
  FileInput,
  ClipboardList,
  CreditCard,
  Handshake,
  Upload,
  HeartPulse,
  Calendar,
  User,
  Cpu,
  Download,
  Home,
  Zap,
  CheckCircle2,
  Package,
  ListTodo,
  MoreVertical,
} from 'lucide-react';

export type CompanyType = 'employer' | 'project' | 'holding' | 'shareholder' | 'investor';

export interface NavigationItem {
  id: string;
  name: string;
  nameByRole?: Partial<Record<string, string>>;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
  companyTypes: CompanyType[];
  badge?: string;
  color?: string;
  section?: string;
}

// Helper: toon de juiste naam per rol
export const getItemDisplayName = (item: NavigationItem, role: string | null): string =>
  (role && item.nameByRole?.[role]) || item.name;

// ─── ALLE MENU ITEMS ────────────────────────────────────────────────────────

export const ALL_NAVIGATION_ITEMS: NavigationItem[] = [
  // DASHBOARD
  { id: 'dashboard', name: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['admin', 'manager', 'employee'], companyTypes: ['employer', 'project', 'holding', 'shareholder'] },

  // HR / PERSONEEL (employer)
  { id: 'employees', name: 'Werknemers', nameByRole: { manager: 'Mijn Team' }, href: '/employees', icon: Users, roles: ['admin', 'manager'], companyTypes: ['employer'] },
  { id: 'timesheet-approvals', name: 'Uren Goedkeuren', href: '/timesheet-approvals', icon: ClipboardList, roles: ['admin', 'manager'], companyTypes: ['employer'] },
  { id: 'payroll-processing', name: 'Loonverwerking', href: '/payroll-processing', icon: CreditCard, roles: ['admin', 'manager'], companyTypes: ['employer'] },
  { id: 'leave-approvals', name: 'Verlof Beheren', nameByRole: { manager: 'Verlof Goedkeuren' }, href: '/admin/leave-approvals', icon: CalendarCheck, roles: ['admin', 'manager'], companyTypes: ['employer'] },
  { id: 'absence-management', name: 'Verzuim Beheren', href: '/admin/absence-management', icon: Stethoscope, roles: ['admin', 'manager'], companyTypes: ['employer'] },

  // FINANCIEEL (alle bedrijfstypes)
  { id: 'invoice-relations', name: 'Klanten & Leveranciers', href: '/invoice-relations', icon: Handshake, roles: ['admin'], companyTypes: ['employer', 'project', 'holding', 'shareholder'] },
  { id: 'budgeting', name: 'Begroting', href: '/budgeting', icon: Wallet, roles: ['admin'], companyTypes: ['employer', 'project', 'holding', 'shareholder'] },
  { id: 'admin-expenses', name: 'Declaraties', href: '/admin-expenses', icon: Receipt, roles: ['admin'], companyTypes: ['employer'] },
  { id: 'outgoing-invoices', name: 'Verkoop', href: '/outgoing-invoices', icon: Send, roles: ['admin'], companyTypes: ['employer', 'project', 'holding', 'shareholder'] },
  { id: 'incoming-invoices', name: 'Inkomende Facturen', href: '/incoming-invoices', icon: Upload, roles: ['admin', 'manager'], companyTypes: ['employer', 'project', 'holding', 'shareholder'] },
  { id: 'incoming-invoices-stats', name: 'Inkoop', href: '/incoming-invoices-stats', icon: PieChart, roles: ['admin', 'manager'], companyTypes: ['employer', 'project', 'holding', 'shareholder'] },
  { id: 'incoming-post', name: 'Inkomende Post', href: '/incoming-post', icon: Mail, roles: ['admin', 'co-admin', 'manager'], companyTypes: ['employer', 'project', 'holding', 'shareholder'] },
  { id: 'bank-statement-import', name: 'Bankafschrift Import', href: '/bank-statement-import', icon: FileInput, roles: ['admin'], companyTypes: ['employer', 'project', 'holding', 'shareholder'] },

  // PROJECT (project bedrijven)
  { id: 'project-production', name: 'Productie', href: '/project-production', icon: Factory, roles: ['admin', 'manager'], companyTypes: ['project'] },
  { id: 'project-statistics', name: 'Project Overzicht', href: '/project-statistics', icon: BarChart2, roles: ['admin'], companyTypes: ['project'] },
  { id: 'project-team', name: 'Project Team', href: '/project-team', icon: Users, roles: ['admin'], companyTypes: ['project'] },

  // STATISTIEKEN (alle bedrijfstypes)
  { id: 'statistics-employer', name: 'Werkgever Stats', href: '/statistics/employer', icon: TrendingUp, roles: ['admin', 'manager'], companyTypes: ['employer'] },
  { id: 'statistics-project', name: 'Project Stats', href: '/statistics/project', icon: TrendingUp, roles: ['admin', 'manager'], companyTypes: ['project'] },
  { id: 'statistics-holding', name: 'Holding Stats', href: '/statistics/holding', icon: TrendingUp, roles: ['admin', 'manager'], companyTypes: ['holding', 'shareholder'] },

  // MIJN ZAKEN (employee/manager self-service)
  { id: 'timesheets', name: 'Urenregistratie', nameByRole: { employee: 'Mijn Uren', manager: 'Mijn Uren' }, href: '/timesheets', icon: Clock, roles: ['admin', 'employee', 'manager'], companyTypes: ['employer', 'project'] },
  { id: 'leave', name: 'Verlof', nameByRole: { employee: 'Mijn Verlof' }, href: '/leave', icon: CalendarCheck, roles: ['admin', 'employee', 'manager'], companyTypes: ['employer'] },
  { id: 'absence', name: 'Ziekteverzuim', href: '/absence', icon: HeartPulse, roles: ['admin', 'employee', 'manager'], companyTypes: ['employer'] },
  { id: 'expenses-employee', name: 'Declaraties Medewerkers', nameByRole: { employee: 'Mijn Declaraties' }, href: '/expenses', icon: Receipt, roles: ['admin', 'employee', 'manager'], companyTypes: ['employer'] },
  { id: 'payslips', name: 'Loonstroken', nameByRole: { employee: 'Mijn Loonstroken' }, href: '/payslips', icon: FileText, roles: ['admin', 'employee', 'manager'], companyTypes: ['employer'] },

  // SYSTEEM
  { id: 'tasks', name: 'Taken', href: '/tasks', icon: ListChecks, roles: ['admin', 'co-admin', 'manager'], companyTypes: ['employer', 'project', 'holding', 'shareholder'] },
  { id: 'companies', name: 'Bedrijven', href: '/companies', icon: Building2, roles: ['admin'], companyTypes: ['employer', 'holding', 'shareholder'] },
  { id: 'audit-log', name: 'Audit Log', href: '/audit-log', icon: Shield, roles: ['admin'], companyTypes: ['employer', 'holding', 'shareholder'] },
  { id: 'users', name: 'Gebruikers Beheer', href: '/admin/users', icon: UserPlus, roles: ['admin'], companyTypes: ['employer', 'holding', 'shareholder'] },
  { id: 'investment-pitch', name: 'Investment Pitch', href: '/investment-pitch', icon: LineChart, roles: ['admin'], companyTypes: ['project', 'holding'] },
  { id: 'settings', name: 'Instellingen', href: '/settings', icon: Settings, roles: ['admin', 'employee', 'manager'], companyTypes: ['employer', 'project', 'holding', 'shareholder'] },
];

// ─── SECTION DEFINITIONS ────────────────────────────────────────────────────

export interface Section {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavigationItem[];
  defaultOpen?: boolean;
  color: string;
}

// Items per sectie (via id)
const SECTION_ITEMS: Record<string, string[]> = {
  Statistieken: ['statistics-employer', 'statistics-project', 'statistics-holding'],
  HR: ['employees', 'timesheet-approvals', 'payroll-processing', 'leave-approvals', 'absence-management'],
  Financieel: ['invoice-relations', 'budgeting', 'admin-expenses', 'outgoing-invoices', 'incoming-invoices', 'incoming-invoices-stats', 'incoming-post', 'bank-statement-import'],
  Project: ['project-production', 'project-statistics', 'project-team'],
  'Mijn Zaken': ['timesheets', 'leave', 'absence', 'expenses-employee', 'payslips'],
  Systeem: ['tasks', 'companies', 'audit-log', 'users', 'investment-pitch', 'settings'],
};

const SECTION_META: Array<{ title: string; icon: React.ComponentType<{ className?: string }>; color: string; defaultOpen?: boolean }> = [
  { title: 'Statistieken', icon: TrendingUp, color: 'bg-indigo-500', defaultOpen: false },
  { title: 'HR', icon: Users, color: 'bg-blue-500', defaultOpen: false },
  { title: 'Financieel', icon: Wallet, color: 'bg-emerald-500', defaultOpen: false },
  { title: 'Project', icon: Factory, color: 'bg-orange-500', defaultOpen: false },
  { title: 'Mijn Zaken', icon: User, color: 'bg-cyan-500', defaultOpen: false },
  { title: 'Systeem', icon: Settings, color: 'bg-gray-500', defaultOpen: false },
];

// ─── FILTER & SECTION FUNCTIONS ─────────────────────────────────────────────

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
 * Uniforme sectie-indeling voor Sidebar en MobileFullScreenMenu
 */
export const getNavigationSections = (
  userRole: string | null,
  companyType?: CompanyType
): Section[] => {
  const filtered = getFilteredNavigation(userRole, companyType);

  return SECTION_META.map(meta => ({
    ...meta,
    items: filtered.filter(item => SECTION_ITEMS[meta.title]?.includes(item.id)),
  })).filter(section => section.items.length > 0);
};

// ─── BOTTOM NAV DEFAULTS ────────────────────────────────────────────────────

export interface BottomNavDefault {
  href: string;
  icon: string;
  iconComponent: React.ComponentType<{ className?: string }>;
  label: string;
  gradient: string;
}

// Gedeelde icon map voor string → component mapping (Firestore slaat strings op)
export const ICON_MAP: Record<string, React.ComponentType<{ className?: string; size?: number; strokeWidth?: number }>> = {
  Home,
  Clock,
  Settings,
  Users,
  Zap,
  CheckCircle2,
  Cpu,
  Package,
  Send,
  Download,
  Upload,
  Wallet,
  TrendingUp,
  ListTodo,
};

/**
 * Get the 3 default middle items for mobile bottom nav
 * Eén bron voor zowel MobileBottomNav als BottomNavSettings
 */
export const getBottomNavDefaults = (
  userRole: string | null,
  companyType?: CompanyType
): BottomNavDefault[] => {
  if (!userRole || !companyType) return [];

  // HOLDING
  if (companyType === 'holding') {
    return [
      { href: '/statistics/holding', icon: 'TrendingUp', iconComponent: TrendingUp, label: 'Stats', gradient: 'from-primary-600 to-primary-700' },
      { href: '/outgoing-invoices', icon: 'Send', iconComponent: Send, label: 'Verkoop', gradient: 'from-primary-500 to-primary-600' },
      { href: '/budgeting', icon: 'Wallet', iconComponent: Wallet, label: 'Begroting', gradient: 'from-primary-600 to-primary-700' },
    ];
  }

  // SHAREHOLDER
  if (companyType === 'shareholder') {
    return [
      { href: '/statistics/holding', icon: 'TrendingUp', iconComponent: TrendingUp, label: 'Stats', gradient: 'from-primary-600 to-primary-700' },
      { href: '/outgoing-invoices', icon: 'Send', iconComponent: Send, label: 'Facturen', gradient: 'from-primary-500 to-primary-600' },
      { href: '/incoming-invoices', icon: 'Upload', iconComponent: Upload, label: 'Inkoop', gradient: 'from-primary-600 to-primary-700' },
    ];
  }

  // PROJECT
  if (companyType === 'project') {
    return [
      { href: '/statistics/project', icon: 'TrendingUp', iconComponent: TrendingUp, label: 'Stats', gradient: 'from-primary-600 to-primary-700' },
      { href: '/project-production', icon: 'Cpu', iconComponent: Cpu, label: 'Productie', gradient: 'from-primary-500 to-primary-600' },
      { href: '/outgoing-invoices', icon: 'Send', iconComponent: Send, label: 'Facturen', gradient: 'from-primary-600 to-primary-700' },
    ];
  }

  // EMPLOYER - per rol
  if (userRole === 'admin') {
    return [
      { href: '/outgoing-invoices', icon: 'Send', iconComponent: Send, label: 'Verkoop', gradient: 'from-primary-600 to-primary-700' },
      { href: '/timesheet-approvals', icon: 'CheckCircle2', iconComponent: CheckCircle2, label: 'Uren', gradient: 'from-primary-500 to-primary-600' },
      { href: '/incoming-invoices', icon: 'Upload', iconComponent: Upload, label: 'Inkoop', gradient: 'from-primary-600 to-primary-700' },
    ];
  }

  if (userRole === 'manager') {
    return [
      { href: '/statistics/employer', icon: 'TrendingUp', iconComponent: TrendingUp, label: 'Stats', gradient: 'from-primary-600 to-primary-700' },
      { href: '/employees', icon: 'Users', iconComponent: Users, label: 'Team', gradient: 'from-primary-500 to-primary-600' },
      { href: '/timesheet-approvals', icon: 'CheckCircle2', iconComponent: CheckCircle2, label: 'Beheren', gradient: 'from-primary-600 to-primary-700' },
    ];
  }

  // Employee
  return [
    { href: '/timesheets', icon: 'Clock', iconComponent: Clock, label: 'Uren', gradient: 'from-primary-600 to-primary-700' },
    { href: '/payslips', icon: 'CheckCircle2', iconComponent: CheckCircle2, label: 'Loonstrook', gradient: 'from-primary-500 to-primary-600' },
    { href: '/settings', icon: 'Settings', iconComponent: Settings, label: 'Profiel', gradient: 'from-primary-600 to-primary-700' },
  ];
};

// ─── MENU ITEM HELPERS ──────────────────────────────────────────────────────

/**
 * Check if menu item should be disabled (company not selected)
 */
export const isMenuItemDisabled = (
  item: NavigationItem,
  selectedCompanyId?: string
): boolean => {
  const noCompanyRequired = ['dashboard', 'companies', 'settings'];
  if (noCompanyRequired.includes(item.id)) return false;
  return !selectedCompanyId;
};

/**
 * Get tooltip for disabled menu items
 */
export const getMenuItemDisabledReason = (item: NavigationItem): string => {
  const noCompanyRequired = ['dashboard', 'companies', 'settings'];
  if (!noCompanyRequired.includes(item.id)) return 'Selecteer eerst een bedrijf';
  return '';
};
