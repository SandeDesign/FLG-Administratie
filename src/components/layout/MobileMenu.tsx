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
  CalendarCheck,
  Stethoscope,
  Upload,
  Download,
  Settings,
  Shield,
  LogOut,
  Wallet,
  Handshake,
  FileOutput,
  PieChart,
  Factory,
  BarChart2,
  User,
  ClipboardList,
  Receipt,
  CreditCard,
  FolderOpen,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import { navigation } from './Sidebar';

interface MobileFullScreenMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MenuSection {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  items: typeof navigation;
}

export const MobileFullScreenMenu: React.FC<MobileFullScreenMenuProps> = ({ isOpen, onClose }) => {
  const { userRole, signOut } = useAuth();
  const { companies, selectedCompany, setSelectedCompany } = useApp();
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['Dashboard']);

  if (!isOpen) return null;

  // Filter navigation by role AND company type
  const companyType = selectedCompany?.companyType as 'employer' | 'project' | undefined;
  const filteredNavigation = navigation.filter(item => {
    const roleMatches = userRole && item.roles.includes(userRole);
    const companyTypeMatches = !companyType || !item.companyTypes || item.companyTypes.includes(companyType);
    return roleMatches && companyTypeMatches;
  });

  // Dashboard item (no section)
  const dashboardItem = filteredNavigation.find(i => i.name === 'Dashboard');

  // Sections matching Sidebar
  const menuSections: MenuSection[] = [
    {
      title: 'HR',
      icon: Users,
      color: 'bg-blue-500',
      items: filteredNavigation.filter(i =>
        ['Werknemers', 'Uren Goedkeuren', 'Verlof Beheren', 'Verzuim Beheren', 'Mijn Team'].includes(i.name)
      )
    },
    {
      title: 'Financieel',
      icon: Wallet,
      color: 'bg-emerald-500',
      items: filteredNavigation.filter(i =>
        ['Klanten & Leveranciers', 'Begroting', 'Verkoop', 'Inkoop Upload', 'Inkoop Overzicht', 'Declaraties'].includes(i.name)
      )
    },
    {
      title: 'Project',
      icon: Factory,
      color: 'bg-orange-500',
      items: filteredNavigation.filter(i => ['Productie', 'Project Stats'].includes(i.name))
    },
    {
      title: 'Data',
      icon: Download,
      color: 'bg-purple-500',
      items: filteredNavigation.filter(i => ['Uren Export', 'Loonstroken', 'Drive'].includes(i.name))
    },
    {
      title: 'Mijn Zaken',
      icon: User,
      color: 'bg-cyan-500',
      items: filteredNavigation.filter(i =>
        ['Mijn Uren', 'Mijn Verlof', 'Mijn Declaraties', 'Mijn Loonstroken', 'Verlof Goedkeuren'].includes(i.name)
      )
    },
    {
      title: 'Systeem',
      icon: Settings,
      color: 'bg-gray-500',
      items: filteredNavigation.filter(i => ['Bedrijven', 'Audit Log', 'Instellingen'].includes(i.name))
    },
  ].filter(section => section.items.length > 0);

  const toggleCategory = (categoryTitle: string) => {
    setExpandedCategories(prev =>
      prev.includes(categoryTitle)
        ? prev.filter(cat => cat !== categoryTitle)
        : [...prev, categoryTitle]
    );
  };

  return (
    <div className="lg:hidden fixed inset-0 z-50 bg-white">
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center space-x-3">
            <img src="/Logo_1.png" alt="Logo" className="h-10 w-auto" />
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="h-6 w-6 text-gray-500" />
          </button>
        </div>

        {/* Company Selector - Admin only */}
        {userRole === 'admin' && companies && companies.length > 0 && (
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Geselecteerd bedrijf:</label>
              <select
                value={selectedCompany?.id || ''}
                onChange={(e) => {
                  const company = companies.find(c => c.id === e.target.value);
                  if (company) setSelectedCompany(company);
                }}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              >
                <option value="">Selecteer bedrijf...</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Dashboard - Solo */}
            {dashboardItem && (
              <div className="bg-gradient-to-r from-primary-50 to-primary-100 rounded-xl p-1 mb-4">
                <NavLink
                  to={dashboardItem.href}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center space-x-3 p-3 rounded-lg transition-all ${
                      isActive
                        ? 'bg-primary-600 text-white shadow-lg'
                        : 'bg-white text-gray-700 hover:shadow-sm'
                    }`
                  }
                >
                  <dashboardItem.icon className="h-5 w-5" />
                  <span className="font-semibold">{dashboardItem.name}</span>
                </NavLink>
              </div>
            )}

            {/* Sections */}
            {menuSections.map((section) => (
              <div key={section.title} className="bg-gray-50 rounded-xl overflow-hidden">
                {/* Section Header */}
                <button
                  onClick={() => toggleCategory(section.title)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 ${section.color} rounded-lg`}>
                      <section.icon className="h-5 w-5 text-white" />
                    </div>
                    <span className="font-semibold text-gray-900">{section.title}</span>
                    <span className="text-xs text-gray-500">({section.items.length})</span>
                  </div>
                  {expandedCategories.includes(section.title) ? (
                    <ChevronDown className="h-5 w-5 text-gray-500" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-gray-500" />
                  )}
                </button>

                {/* Section Items */}
                {expandedCategories.includes(section.title) && (
                  <div className="px-4 pb-4 space-y-2">
                    {section.items.map((item) => (
                      <NavLink
                        key={item.name}
                        to={item.href}
                        onClick={onClose}
                        className={({ isActive }) =>
                          `flex items-center space-x-3 p-3 rounded-lg transition-all duration-200 ${
                            isActive
                              ? 'bg-primary-50 text-primary-700 border border-primary-200'
                              : 'text-gray-700 hover:bg-white hover:shadow-sm'
                          }`
                        }
                      >
                        <item.icon className="h-4 w-4" />
                        <span className="font-medium">{item.name}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 bg-white">
          <button
            onClick={() => {
              signOut();
              onClose();
            }}
            className="w-full flex items-center justify-center space-x-2 px-4 py-3 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span>Uitloggen</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MobileFullScreenMenu;