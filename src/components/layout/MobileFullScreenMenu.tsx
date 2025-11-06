import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  X, 
  ChevronDown, 
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
  Shield,
  Zap,
  Activity,
  Receipt,
  Send,
  FolderOpen,
  TrendingUp
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
    color?: string;
  }[];
}

export const MobileFullScreenMenu: React.FC<MobileFullScreenMenuProps> = ({ isOpen, onClose }) => {
  const { userRole } = useAuth();
  const { companies, selectedCompany, setSelectedCompany } = useApp();
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['Hoofdmenu']);

  if (!isOpen) return null;

  const menuCategories: MenuCategory[] = [
    {
      title: 'Hoofdmenu',
      icon: Zap,
      items: [
        { name: 'Dashboarddd', href: '/', icon: LayoutDashboard, roles: ['admin'], color: 'text-purple-600' },
        { name: 'Bedrijven', href: '/companies', icon: Building2, roles: ['admin'], color: 'text-blue-600' },
        { name: 'Werknemers', href: '/employees', icon: Users, roles: ['admin'], color: 'text-green-600' },
      ]
    },
    {
      title: 'Tijd & Aanwezigheid',
      icon: Activity,
      items: [
        { name: 'Urenregistratie', href: '/timesheets', icon: Clock, roles: ['admin', 'employee'], color: 'text-orange-600' },
        { name: 'Uren Goedkeuren', href: '/timesheet-approvals', icon: Clock, roles: ['admin'], color: 'text-indigo-600' },
        { name: 'Verlof Goedkeuren', href: '/admin/leave-approvals', icon: Calendar, roles: ['admin'], color: 'text-teal-600' },
        { name: 'Verzuim Beheren', href: '/admin/absence-management', icon: HeartPulse, roles: ['admin'], color: 'text-red-600' },
      ]
    },
    {
      title: 'Facturatie',
      icon: Receipt,
      items: [
        { name: 'Uitgaande Facturen', href: '/outgoing-invoices', icon: Send, roles: ['admin'], color: 'text-emerald-600' },
        { name: 'Inkomende Facturen', href: '/incoming-invoices', icon: Upload, roles: ['admin'], color: 'text-amber-600' },
      ]
    },
    {
      title: 'Data & Bestanden',
      icon: TrendingUp,
      items: [
        { name: 'Uren Export', href: '/timesheet-export', icon: Download, roles: ['admin'], color: 'text-cyan-600' },
        { name: 'Drive Bestanden', href: '/drive-files', icon: FolderOpen, roles: ['admin'], color: 'text-violet-600' },
      ]
    },
    {
      title: 'Systeem',
      icon: Settings,
      items: [
        { name: 'Loonstroken', href: '/payslips', icon: FileText, roles: ['admin', 'employee'], color: 'text-cyan-600' },
        { name: 'Audit Log', href: '/audit-log', icon: Shield, roles: ['admin'], color: 'text-slate-600' },
        { name: 'Instellingen', href: '/settings', icon: Settings, roles: ['admin', 'employee'], color: 'text-gray-600' },
      ]
    }
  ];

  const toggleCategory = (categoryTitle: string) => {
    setExpandedCategories(prev =>
      prev.includes(categoryTitle)
        ? prev.filter(cat => cat !== categoryTitle)
        : [...prev, categoryTitle]
    );
  };

  // Filter categories based on user role
  const filteredCategories = menuCategories.map(category => ({
    ...category,
    items: category.items.filter(item => item.roles.includes(userRole || ''))
  })).filter(category => category.items.length > 0);

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Menu Content */}
      <div className="fixed inset-y-0 right-0 w-full max-w-sm bg-white shadow-xl transform transition-transform">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-blue-500 to-blue-600">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                <span className="text-blue-600 font-bold text-lg">A</span>
              </div>
              <h2 className="text-xl font-bold text-white">Menu</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-white hover:bg-white hover:bg-opacity-20 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Company Selector - Only for admin */}
          {userRole === 'admin' && companies && companies.length > 0 && (
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Actief Bedrijf
              </label>
              <select
                value={selectedCompany?.id || ''}
                onChange={(e) => {
                  const company = companies.find(c => c.id === e.target.value);
                  if (company) setSelectedCompany(company);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Selecteer bedrijf</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Navigation Categories */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 space-y-4">
              {filteredCategories.map((category) => (
                <div key={category.title} className="bg-gray-50 rounded-xl overflow-hidden">
                  {/* Category Header */}
                  <button
                    onClick={() => toggleCategory(category.title)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-blue-500 rounded-lg">
                        <category.icon className="h-5 w-5 text-white" />
                      </div>
                      <span className="font-semibold text-gray-900">{category.title}</span>
                    </div>
                    {expandedCategories.includes(category.title) ? (
                      <ChevronDown className="h-5 w-5 text-gray-500" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-gray-500" />
                    )}
                  </button>

                  {/* Category Items */}
                  {expandedCategories.includes(category.title) && (
                    <div className="px-4 pb-4 space-y-2">
                      {category.items.map((item) => (
                        <NavLink
                          key={item.name}
                          to={item.href}
                          onClick={onClose}
                          className={({ isActive }) =>
                            `flex items-center space-x-3 p-3 rounded-lg transition-all duration-200 ${
                              isActive
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'text-gray-700 hover:bg-white hover:shadow-sm'
                            }`
                          }
                        >
                          {({ isActive }) => (
                            <>
                              <div className={`p-2 rounded-lg ${
                                isActive ? 'bg-blue-500' : 'bg-gray-200'
                              }`}>
                                <item.icon className={`h-4 w-4 ${
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
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <div className="text-center text-sm text-gray-500">
              AlloonApp v1.0
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};