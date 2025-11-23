import React, { useState } from 'react';

import { NavLink } from 'react-router-dom';

import {

  X,

  ChevronRight,

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

  Activity,

  Receipt,

  Send,

  FolderOpen,

  TrendingUp,

  UserCheck,

  BarChart3,

  Factory,

} from 'lucide-react';

import { useAuth } from '../../contexts/AuthContext';

import { useApp } from '../../contexts/AppContext';

 

interface MobileFullScreenMenuProps {

  isOpen: boolean;

  onClose: () => void;

}

 

interface MenuCategory {

  title: string;

  icon: React.ComponentType<{ className?: string }>;

  items: {

    name: string;

    href: string;

    icon: React.ComponentType<{ className?: string }>;

    roles: string[];

    companyTypes?: ('employer' | 'project')[];

    color?: string;

  }[];

}

 

export const MobileFullScreenMenu: React.FC<MobileFullScreenMenuProps> = ({ isOpen, onClose }) => {

  const { userRole, signOut } = useAuth();

  const { companies, selectedCompany, setSelectedCompany } = useApp();

  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

 

  if (!isOpen) return null;

 

  const companyType = selectedCompany?.companyType as 'employer' | 'project' | undefined;

 

  // Menu per rol en bedrijfstype

  const menuCategories: MenuCategory[] = [

    // ═══════════════════════════════════════════════════════════════

    // PERSONEEL - Admin employer

    // ═══════════════════════════════════════════════════════════════

    {

      title: 'Personeel',

      icon: Users,

      items: [

        { name: 'Werknemers', href: '/employees', icon: Users, roles: ['admin'], companyTypes: ['employer'], color: 'text-emerald-600' },

        { name: 'Uren Goedkeuren', href: '/timesheet-approvals', icon: Clock, roles: ['admin'], companyTypes: ['employer'], color: 'text-primary-600' },

        { name: 'Verlof Goedkeuren', href: '/admin/leave-approvals', icon: Calendar, roles: ['admin'], companyTypes: ['employer'], color: 'text-rose-600' },

        { name: 'Ziekte Beheren', href: '/admin/absence-management', icon: HeartPulse, roles: ['admin'], companyTypes: ['employer'], color: 'text-red-600' },

      ]

    },

    // ═══════════════════════════════════════════════════════════════

    // FACTURATIE - Admin both, Manager project alleen inkoop

    // ═══════════════════════════════════════════════════════════════

    {

      title: 'Facturatie',

      icon: Receipt,

      items: [

        { name: 'Relaties', href: '/invoice-relations', icon: UserCheck, roles: ['admin'], companyTypes: ['employer', 'project'], color: 'text-indigo-600' },

        { name: 'Verkoop Facturen', href: '/outgoing-invoices', icon: Send, roles: ['admin'], companyTypes: ['employer', 'project'], color: 'text-green-600' },

        { name: 'Inkoopbonnen', href: '/incoming-invoices-stats', icon: BarChart3, roles: ['admin'], companyTypes: ['employer', 'project'], color: 'text-purple-600' },

        { name: 'Inkoop Facturen', href: '/incoming-invoices', icon: Upload, roles: ['admin', 'manager'], companyTypes: ['employer', 'project'], color: 'text-orange-600' },

      ]

    },

    // ═══════════════════════════════════════════════════════════════

    // PROJECT COMPANY

    // ═══════════════════════════════════════════════════════════════

    {

      title: 'Project',

      icon: Factory,

      items: [

        { name: 'Productie', href: '/project-production', icon: Factory, roles: ['admin', 'manager'], companyTypes: ['project'], color: 'text-cyan-600' },

        { name: 'Statistieken', href: '/project-statistics', icon: BarChart3, roles: ['admin'], companyTypes: ['employer', 'project'], color: 'text-purple-600' },

      ]

    },

    // ═══════════════════════════════════════════════════════════════

    // EMPLOYEE - Mijn zaken

    // ═══════════════════════════════════════════════════════════════

    {

      title: 'Mijn Zaken',

      icon: Activity,

      items: [

        { name: 'Mijn Uren', href: '/timesheets', icon: Clock, roles: ['employee', 'manager'], companyTypes: ['employer', 'project'], color: 'text-amber-600' },

        { name: 'Mijn Verlof', href: '/leave', icon: Calendar, roles: ['employee'], companyTypes: ['employer'], color: 'text-rose-600' },

        { name: 'Mijn Declaraties', href: '/expenses', icon: Receipt, roles: ['employee'], companyTypes: ['employer'], color: 'text-green-600' },

        { name: 'Mijn Loonstroken', href: '/payslips', icon: FileText, roles: ['employee'], companyTypes: ['employer'], color: 'text-teal-600' },

      ]

    },

    // ═══════════════════════════════════════════════════════════════

    // DATA & EXPORTS

    // ═══════════════════════════════════════════════════════════════

    {

      title: 'Data & Exports',

      icon: TrendingUp,

      items: [

        { name: 'Uren Export', href: '/timesheet-export', icon: Download, roles: ['admin'], companyTypes: ['employer'], color: 'text-cyan-600' },

        { name: 'Loonstroken', href: '/payslips', icon: FileText, roles: ['admin'], companyTypes: ['employer'], color: 'text-teal-600' },

        { name: 'Drive Bestanden', href: '/drive-files', icon: FolderOpen, roles: ['admin'], companyTypes: ['employer'], color: 'text-fuchsia-600' },

      ]

    },

    // ═══════════════════════════════════════════════════════════════

    // SYSTEEM

    // ═══════════════════════════════════════════════════════════════

    {

      title: 'Systeem',

      icon: Settings,

      items: [

        { name: 'Bedrijven', href: '/companies', icon: Building2, roles: ['admin'], companyTypes: ['employer'], color: 'text-primary-600' },

        { name: 'Audit Log', href: '/audit-log', icon: Shield, roles: ['admin'], companyTypes: ['employer'], color: 'text-slate-600' },

        { name: 'Instellingen', href: '/settings', icon: Settings, roles: ['admin', 'manager', 'employee'], companyTypes: ['employer', 'project'], color: 'text-gray-600' },

      ]

    }

  ];

 

  // Filter categories and items by role AND company type

  const filteredCategories = menuCategories

    .map(category => ({

      ...category,

      items: category.items.filter(item => {

        const roleMatches = item.roles.includes(userRole || '');

        const companyTypeMatches = !companyType || !item.companyTypes || item.companyTypes.includes(companyType);

        return roleMatches && companyTypeMatches;

      })

    }))

    .filter(category => category.items.length > 0);

 

  const toggleCategory = (categoryTitle: string) => {

    setExpandedCategories(prev =>

      prev.includes(categoryTitle)

        ? prev.filter(cat => cat !== categoryTitle)

        : [...prev, categoryTitle]

    );

  };

 

  return (

    <div className="fixed inset-0 z-50 lg:hidden">

      {/* Overlay */}

      <div

        className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"

        onClick={onClose}

      />

 

      {/* Menu Content */}

      <div className="fixed inset-y-0 right-0 w-full max-w-sm bg-white shadow-2xl transform transition-transform duration-300 ease-out">

        <div className="flex flex-col h-full">

          {/* Header */}

          <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-gray-50">

            <div className="flex items-center space-x-3">

              <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-md">

                <span className="text-white font-bold text-xl">F</span>

              </div>

              <div>

                <h2 className="text-sm font-bold text-gray-900">FLG-Administratie</h2>

                <p className="text-xs text-gray-500 truncate">{selectedCompany?.name || 'Menu'}</p>

              </div>

            </div>

            <button

              onClick={onClose}

              className="p-2 rounded-lg text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors duration-200"

            >

              <X className="h-5 w-5" />

            </button>

          </div>

 

          {/* Company Selector - Only for admin */}

          {userRole === 'admin' && companies && companies.length > 0 && (

            <div className="p-4 border-b border-gray-100">

              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">

                Bedrijf

              </label>

              <select

                value={selectedCompany?.id || ''}

                onChange={(e) => {

                  const company = companies.find(c => c.id === e.target.value);

                  if (company) setSelectedCompany(company);

                }}

                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"

              >

                <option value="">Selecteer bedrijf</option>

                {companies.map((company) => (

                  <option key={company.id} value={company.id}>

                    {company.name} {company.companyType === 'project' || company.companyType === 'work_company' ? '(Project)' : ''}

                  </option>

                ))}

              </select>

            </div>

          )}

 

          {/* Navigation Categories */}

          <div className="flex-1 overflow-y-auto">

            <nav className="p-4 space-y-1">

              {/* DASHBOARD - SOLO (NO SECTION) */}

              <NavLink

                to="/"

                onClick={onClose}

                className={({ isActive }) =>

                  `flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium text-sm ${

                    isActive

                      ? 'bg-gradient-to-r from-primary-50 to-indigo-50 text-primary-700 shadow-sm border border-primary-200'

                      : 'text-gray-700 hover:bg-gray-50'

                  }`

                }

              >

                {({ isActive }) => (

                  <>

                    <div className={`p-2 rounded-lg transition-all duration-200 ${

                      isActive

                        ? 'bg-primary-500 shadow-sm'

                        : 'bg-gray-100 group-hover:bg-gray-200'

                    }`}>

                      <LayoutDashboard className={`h-4 w-4 ${

                        isActive ? 'text-white' : 'text-gray-600'

                      }`} />

                    </div>

                    <span>Dashboard</span>

                  </>

                )}

              </NavLink>

 

              <div className="border-t border-gray-100 my-2" />

 

              {/* SECTIONS */}

              {filteredCategories.map((category) => (

                <div key={category.title} className="space-y-1">

                  {/* Category Header */}

                  <button

                    onClick={() => toggleCategory(category.title)}

                    className="w-full flex items-center justify-between px-4 py-2 text-left hover:bg-gray-50 rounded-lg transition-colors duration-200 group"

                  >

                    <div className="flex items-center space-x-2">

                      <category.icon className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors" />

                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{category.title}</span>

                    </div>

                    <ChevronRight className={`h-3 w-3 text-gray-400 transition-transform duration-200 ${

                      expandedCategories.includes(category.title) ? 'rotate-90' : ''

                    }`} />

                  </button>

 

                  {/* Category Items */}

                  {expandedCategories.includes(category.title) && (

                    <div className="space-y-1">

                      {category.items.map((item) => (

                        <NavLink

                          key={item.name}

                          to={item.href}

                          onClick={onClose}

                          className={({ isActive }) =>

                            `flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-all duration-200 text-sm ml-2 ${

                              isActive

                                ? 'bg-gradient-to-r from-primary-50 to-indigo-50 text-primary-700 shadow-sm border border-primary-200'

                                : 'text-gray-700 hover:bg-gray-50'

                            }`

                          }

                        >

                          {({ isActive }) => (

                            <>

                              <div className={`p-1.5 rounded-lg transition-all duration-200 ${

                                isActive

                                  ? 'bg-primary-500 shadow-sm'

                                  : 'bg-gray-100'

                              }`}>

                                <item.icon className={`h-3.5 w-3.5 ${

                                  isActive ? 'text-white' : 'text-gray-600'

                                }`} />

                              </div>

                              <span className="font-medium">{item.name}</span>

                            </>

                          )}

                        </NavLink>

                      ))}

                    </div>

                  )}

                </div>

              ))}

            </nav>

          </div>

 

          {/* Footer */}

          <div className="border-t border-gray-100 p-4 bg-gradient-to-r from-slate-50 to-gray-50">

            <button

              onClick={() => {

                signOut();

                onClose();

              }}

              className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50 rounded-lg transition-colors duration-200"

            >

              <LogOut className="h-4 w-4" />

              <span>Uitloggen</span>

            </button>

          </div>

        </div>

      </div>

    </div>

  );

};

 

export default MobileFullScreenMenu;