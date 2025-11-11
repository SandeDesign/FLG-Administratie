// src/components/layout/MobileFullScreenMenu.tsx
import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  X,
  ChevronDown,
  ChevronRight,
  LogOut,
  Building2,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import { getNavigationSections, isMenuItemDisabled, getMenuItemDisabledReason } from '../../utils/menuConfig';

interface MobileFullScreenMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileFullScreenMenu: React.FC<MobileFullScreenMenuProps> = ({ isOpen, onClose }) => {
  const { userRole, signOut } = useAuth();
  const { companies, selectedCompany, setSelectedCompany } = useApp();
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

  if (!userRole) return null;

  const companyType = selectedCompany?.companyType as 'employer' | 'project' | undefined;
  const filteredCategories = getNavigationSections(userRole, companyType);

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
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Menu Content */}
      <div className="fixed inset-y-0 right-0 w-full max-w-sm bg-white shadow-xl transform transition-transform">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-blue-500 to-blue-600">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
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
                    {company.name} {company.companyType === 'project' ? '(Project)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Navigation Categories */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 space-y-4">
              {/* ✅ DASHBOARD - SOLO (NO SECTION) */}
              <NavLink
                to="/"
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center space-x-3 p-4 rounded-lg transition-all duration-200 font-semibold ${
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
                      {/* Dashboard icon from lucide */}
                      <svg className={`h-5 w-5 ${isActive ? 'text-white' : 'text-gray-600'}`} fill="currentColor" viewBox="0 0 24 24">
                        <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
                      </svg>
                    </div>
                    <span>Dashboard</span>
                  </>
                )}
              </NavLink>

              <div className="border-t border-gray-200 pt-4" />

              {/* ✅ SECTIONS */}
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
                      {category.items.map((item) => {
                        const isDisabled = isMenuItemDisabled(item, selectedCompany?.id);
                        const disabledReason = getMenuItemDisabledReason(item);

                        return (
                          <NavLink
                            key={item.name}
                            to={isDisabled ? '#' : item.href}
                            onClick={(e) => {
                              if (isDisabled) {
                                e.preventDefault();
                              } else {
                                onClose();
                              }
                            }}
                            className={({ isActive }) =>
                              `flex items-center space-x-3 p-3 rounded-lg transition-all duration-200 ${
                                isDisabled
                                  ? 'opacity-50 cursor-not-allowed text-gray-400'
                                  : isActive
                                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                    : 'text-gray-700 hover:bg-white hover:shadow-sm'
                              }`
                            }
                            title={disabledReason || item.name}
                          >
                            {({ isActive }) => (
                              <>
                                <div className={`p-2 rounded-lg ${
                                  isDisabled
                                    ? 'bg-gray-200'
                                    : isActive ? 'bg-blue-500' : 'bg-gray-200'
                                }`}>
                                  <item.icon className={`h-4 w-4 ${
                                    isDisabled
                                      ? 'text-gray-400'
                                      : isActive ? 'text-white' : 'text-gray-600'
                                  }`} />
                                </div>
                                <span className="font-medium">{item.name}</span>
                              </>
                            )}
                          </NavLink>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <button
              onClick={() => {
                signOut();
                onClose();
              }}
              className="w-full flex items-center justify-center space-x-2 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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