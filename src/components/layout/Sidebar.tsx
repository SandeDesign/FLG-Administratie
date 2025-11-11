// src/components/layout/Sidebar.tsx
import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  LogOut,
  Building2,
} from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { getNavigationSections, isMenuItemDisabled, getMenuItemDisabledReason } from '../../utils/menuConfig';

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
                      <div className="text-xs text-gray-500">
                        {company.companyType === 'project' ? 'Project' : 'Werkgever'}
                      </div>
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
const NavItem: React.FC<{ 
  item: any; 
  collapsed: boolean;
  isDisabled: boolean;
  disabledReason: string;
}> = ({ item, collapsed, isDisabled, disabledReason }) => (
  <NavLink
    to={isDisabled ? '#' : item.href}
    onClick={(e) => {
      if (isDisabled) {
        e.preventDefault();
      }
    }}
    className={({ isActive }) =>
      `group flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${
        isDisabled
          ? 'opacity-50 cursor-not-allowed text-gray-400'
          : isActive
            ? 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 shadow-sm border border-blue-200'
            : 'text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-slate-50 hover:text-gray-900'
      } ${collapsed ? 'justify-center' : ''}`
    }
    title={collapsed ? item.name : disabledReason || undefined}
  >
    {({ isActive }) => (
      <>
        <div className={`p-2 rounded-lg ${collapsed ? '' : 'mr-3'} transition-all duration-200 ${
          isDisabled
            ? 'bg-gray-200'
            : isActive 
              ? 'bg-blue-500 shadow-sm' 
              : 'bg-gray-100 group-hover:bg-gray-200'
        }`}>
          <item.icon className={`h-4 w-4 ${
            isDisabled
              ? 'text-gray-400'
              : isActive ? 'text-white' : 'text-gray-600'
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

  // ✅ GET NAVIGATION SECTIONS BASED ON COMPANY TYPE
  const companyType = selectedCompany?.companyType as 'employer' | 'project' | undefined;
  const sections = getNavigationSections(userRole, companyType);

  // Dashboard item
  const dashboardItem = sections
    .flatMap(s => s.items)
    .find(i => i.name === 'Dashboard') || 
    { name: 'Dashboard', href: '/', icon: require('lucide-react').LayoutDashboard, roles: ['admin'], companyTypes: ['employer', 'project'] };

  return (
    <div className={`hidden lg:flex lg:flex-col lg:bg-white lg:border-r lg:border-gray-200 lg:shadow-sm transition-all duration-300 ${
      collapsed ? 'w-20' : 'w-64'
    }`}>
      {/* Logo & Collapse Button */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200 flex-shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <img src="/Logo-groot.png" alt="AlloonApp Logo" className="h-8 w-auto" />
            <span className="font-bold text-lg text-gray-900">Alloon</span>
          </div>
        )}
        <button
          onClick={handleToggleCollapsed}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
          title={collapsed ? 'Uitvouwen' : 'Inklappen'}
        >
          {collapsed ? (
            <ChevronRight className="h-5 w-5 text-gray-600" />
          ) : (
            <ChevronLeft className="h-5 w-5 text-gray-600" />
          )}
        </button>
      </div>

      {/* Company Selector */}
      <CompanySelector collapsed={collapsed} />

      {/* Dashboard Item */}
      <div className={`${collapsed ? 'px-2' : 'px-4'} py-4 flex-shrink-0`}>
        <NavItem 
          item={dashboardItem} 
          collapsed={collapsed}
          isDisabled={false}
          disabledReason=""
        />
      </div>

      {/* Navigation Sections - SCROLLABLE */}
      <nav className="flex-1 px-3 py-6 space-y-6 overflow-y-auto overflow-x-hidden">
        {sections.map((section) => (
          <div key={section.title}>
            <SectionHeader
              title={section.title}
              icon={section.icon}
              collapsed={collapsed}
              isExpanded={expandedSections.includes(section.title)}
              onToggle={() => toggleSection(section.title)}
            />

            {(expandedSections.includes(section.title) || collapsed === false) && (
              <div className={`space-y-1 ${collapsed ? '' : 'ml-0'}`}>
                {section.items.map((item) => {
                  const isDisabled = isMenuItemDisabled(item, selectedCompany?.id);
                  const disabledReason = getMenuItemDisabledReason(item);

                  return (
                    <NavItem
                      key={item.name}
                      item={item}
                      collapsed={collapsed}
                      isDisabled={isDisabled}
                      disabledReason={disabledReason}
                    />
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-200 p-4 flex-shrink-0">
        <button
          onClick={() => signOut()}
          className="w-full flex items-center justify-center space-x-2 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
          title={collapsed ? 'Uitloggen' : undefined}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span>Uitloggen</span>}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;