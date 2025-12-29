import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  X,
  ChevronDown,
  LogOut,
  LayoutDashboard,
  Star,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import { getFilteredNavigation, getNavigationSections, CompanyType } from '../../utils/menuConfig';
import { getUserSettings } from '../../services/firebase';

interface MobileFullScreenMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileFullScreenMenu: React.FC<MobileFullScreenMenuProps> = ({ isOpen, onClose }) => {
  const { userRole, signOut, user } = useAuth();
  const { companies, selectedCompany, setSelectedCompany } = useApp();
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [favoritePages, setFavoritePages] = useState<string[]>([]);

  // Load favorite pages from user settings for the selected company
  useEffect(() => {
    const loadFavorites = async () => {
      if (user && userRole === 'admin' && selectedCompany?.id) {
        try {
          const settings = await getUserSettings(user.uid);
          if (settings?.favoritePages && settings.favoritePages[selectedCompany.id]) {
            const companyFavorites = settings.favoritePages[selectedCompany.id];
            setFavoritePages(companyFavorites);
          } else {
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

  if (!isOpen) return null;

  const companyType = selectedCompany?.companyType as CompanyType | undefined;

  // Get filtered navigation using menuConfig
  const filteredNavigation = getFilteredNavigation(userRole, companyType);

  // Dashboard item (standalone)
  const dashboardItem = filteredNavigation.find(i => i.name === 'Dashboard');

  // Favorite items (only for admin)
  const favoriteItems = userRole === 'admin' && favoritePages.length > 0
    ? filteredNavigation.filter(i => favoritePages.includes(i.href) && i.name !== 'Dashboard')
    : [];

  // Get sections from menuConfig
  const menuSections = getNavigationSections(userRole, companyType);

  const toggleSection = (sectionTitle: string) => {
    setExpandedSections(prev =>
      prev.includes(sectionTitle)
        ? prev.filter(s => s !== sectionTitle)
        : [...prev, sectionTitle]
    );
  };

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Modern Overlay with blur */}
      <div
        className="fixed inset-0 bg-gradient-to-br from-gray-900/60 via-gray-800/50 to-gray-900/60 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modern Menu Content */}
      <div className="fixed inset-y-0 right-0 w-full max-w-sm bg-gradient-to-br from-white via-gray-50/95 to-white/90 backdrop-blur-xl shadow-2xl transform transition-transform duration-300 ease-out overflow-hidden flex flex-col">

        {/* Modern Header with Gradient */}
        <div className="relative p-6 border-b border-white/20 bg-gradient-to-br from-primary-600 via-primary-500 to-indigo-600 flex-shrink-0 shadow-lg">
          {/* Background pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" style={{
              backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
              backgroundSize: '32px 32px'
            }} />
          </div>

          <div className="relative flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {selectedCompany?.logoUrl ? (
                <div className="w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center bg-white dark:bg-gray-800 shadow-xl shadow-black/20 ring-2 ring-white/30">
                  <img
                    src={selectedCompany.logoUrl}
                    alt={selectedCompany.name}
                    className="w-full h-full object-contain p-2"
                  />
                </div>
              ) : (
                <div className="w-14 h-14 bg-gradient-to-br from-white to-gray-100 rounded-2xl flex items-center justify-center shadow-xl shadow-black/20 ring-2 ring-white/30">
                  <Sparkles className="w-7 h-7 text-primary-600" />
                </div>
              )}
              <div>
                <h2 className="text-base font-bold text-white drop-shadow-sm">FLG-Administratie</h2>
                <p className="text-xs text-primary-100 truncate max-w-[160px] mt-0.5">{selectedCompany?.name || 'Menu'}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2.5 rounded-xl text-white/90 hover:bg-white hover:text-white transition-all duration-200 backdrop-blur-sm shadow-lg"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modern Company Selector */}
        {userRole === 'admin' && companies && companies.length > 0 && (
          <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 bg-white dark:bg-gray-800 backdrop-blur-sm">
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2.5">
              Bedrijf Selecteren
            </label>
            <select
              value={selectedCompany?.id || ''}
              onChange={(e) => {
                const company = companies.find(c => c.id === e.target.value);
                if (company) setSelectedCompany(company);
              }}
              className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-sm font-medium text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all shadow-sm hover:shadow-md hover:border-primary-200"
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

        {/* Modern Navigation */}
        <nav className="flex-1 overflow-y-auto px-4 py-5 space-y-3">

          {/* Dashboard Card */}
          {dashboardItem && (
            <div className="mb-4">
              <NavLink
                to={dashboardItem.href}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center space-x-4 px-5 py-4 rounded-2xl transition-all duration-300 font-semibold text-sm shadow-lg hover:shadow-xl ${
                    isActive
                      ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-primary-500/40'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-gray-200/50 dark:shadow-gray-900/50'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className={`p-3 rounded-xl transition-all duration-300 ${
                      isActive ? 'bg-white dark:bg-gray-800/20 shadow-inner' : 'bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600'
                    }`}>
                      <LayoutDashboard className={`h-5 w-5 ${
                        isActive ? 'text-white' : 'text-gray-700 dark:text-gray-300'
                      }`} />
                    </div>
                    <span className="flex-1">Dashboard</span>
                    {isActive && (
                      <div className="w-2 h-2 rounded-full bg-white dark:bg-gray-800 shadow-sm"></div>
                    )}
                  </>
                )}
              </NavLink>
            </div>
          )}

          {/* Favorites Card */}
          {favoriteItems.length > 0 && (
            <div className="bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 rounded-2xl p-4 mb-4 shadow-lg border border-amber-100">
              <button
                onClick={() => toggleSection('Favorieten')}
                className="w-full flex items-center justify-between mb-3 group"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg">
                    <Star className="h-4 w-4 text-white fill-white" />
                  </div>
                  <span className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wide">Favorieten</span>
                </div>
                <ChevronDown className={`h-5 w-5 text-amber-600 dark:text-amber-400 transition-transform duration-300 ${
                  expandedSections.includes('Favorieten') ? 'rotate-180' : ''
                }`} />
              </button>

              {expandedSections.includes('Favorieten') && (
                <div className="space-y-1.5 mt-2">
                  {favoriteItems.map((item) => {
                    const ItemIcon = item.icon;
                    return (
                      <NavLink
                        key={item.name}
                        to={item.href}
                        onClick={onClose}
                        className={({ isActive }) =>
                          `flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium ${
                            isActive
                              ? 'bg-white dark:bg-gray-800 text-amber-700 dark:text-amber-400 shadow-md'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-white dark:bg-gray-800/60 dark:hover:bg-gray-800/60'
                          }`
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <div className={`p-2 rounded-lg transition-all duration-200 ${
                              isActive ? 'bg-amber-100 dark:bg-amber-900/50' : 'bg-white dark:bg-gray-800/70 dark:bg-gray-700/70'
                            }`}>
                              <ItemIcon className={`h-4 w-4 ${
                                isActive ? 'text-amber-600 dark:text-amber-400' : 'text-gray-600 dark:text-gray-400 dark:text-gray-500'
                              }`} />
                            </div>
                            <span className="flex-1">{item.name}</span>
                          </>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Modern Section Cards */}
          {menuSections.map((section) => {
            const SectionIcon = section.icon;
            const isExpanded = expandedSections.includes(section.title);
            return (
              <div key={section.title} className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-shadow duration-300">
                <button
                  onClick={() => toggleSection(section.title)}
                  className="w-full flex items-center justify-between p-4 group hover:bg-gray-50 transition-colors duration-200"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary-500 to-indigo-600 shadow-lg group-hover:shadow-xl transition-shadow">
                      <SectionIcon className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wide">{section.title}</span>
                  </div>
                  <ChevronDown className={`h-5 w-5 text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 transition-transform duration-300 ${
                    isExpanded ? 'rotate-180 text-primary-600 dark:text-primary-400' : ''
                  }`} />
                </button>

                {isExpanded && (
                  <div className="px-3 pb-3 space-y-1 bg-gradient-to-br from-gray-50 to-white">
                    {section.items.map((item) => {
                      const ItemIcon = item.icon;
                      return (
                        <NavLink
                          key={item.name}
                          to={item.href}
                          onClick={onClose}
                          className={({ isActive }) =>
                            `flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium ${
                              isActive
                                ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/30'
                                : 'text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 hover:shadow-md'
                            }`
                          }
                        >
                          {({ isActive }) => (
                            <>
                              <div className={`p-2 rounded-lg transition-all duration-200 ${
                                isActive ? 'bg-white dark:bg-gray-800/20 shadow-inner' : 'bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600'
                              }`}>
                                <ItemIcon className={`h-4 w-4 ${
                                  isActive ? 'text-white' : 'text-gray-600 dark:text-gray-400 dark:text-gray-500'
                                }`} />
                              </div>
                              <span className="flex-1">{item.name}</span>
                              {isActive && (
                                <div className="w-2 h-2 rounded-full bg-white dark:bg-gray-800 shadow-sm"></div>
                              )}
                            </>
                          )}
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Modern Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-5 bg-gradient-to-br from-gray-50 via-white to-gray-50 flex-shrink-0 shadow-inner">
          <button
            onClick={() => {
              signOut();
              onClose();
            }}
            className="w-full flex items-center justify-center space-x-3 px-5 py-3.5 text-sm font-bold text-red-700 bg-white dark:bg-gray-800 hover:bg-red-50 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl border border-red-100 hover:border-red-200"
          >
            <LogOut className="h-5 w-5" />
            <span>Uitloggen</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MobileFullScreenMenu;
