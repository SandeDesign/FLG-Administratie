import React from 'react';
import { NavLink } from 'react-router-dom';
import { X } from 'lucide-react';
import { MobileNavigationGroup } from './MobileNavigationGroup';

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
}

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  navigation: NavigationItem[];
  userRole: string | null;
}

export const MobileMenu: React.FC<MobileMenuProps> = ({ isOpen, onClose, navigation, userRole }) => {
  if (!isOpen) return null;

  const isEmployee = userRole === 'employee';

  const mainNav = [
    navigation[0],
    navigation[1],
    navigation[2],
  ].filter(item => item && item.roles.includes(userRole || ''));

  const timeNav = [
    navigation[3],
    navigation[4],
    navigation[5],
    navigation[6],
  ].filter(item => item && item.roles.includes(userRole || ''));

  const financialNav = [
    navigation[7],
    navigation[8],
    navigation[9],
    navigation[10],
  ].filter(item => item && item.roles.includes(userRole || ''));

  const systemNav = [
    navigation[11],
    navigation[12],
    navigation[13],
  ].filter(item => item && item.roles.includes(userRole || ''));

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-25 z-40 lg:hidden backdrop-blur-sm"
        onClick={onClose}
      />

      <div className={`fixed inset-y-0 left-0 w-64 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out lg:hidden ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex h-full flex-col">
          <div className="flex h-20 items-center justify-between px-6 border-b border-gray-100">
            <img src="/Logo-groot.png" alt="AlloonApp Logo" className="h-14 w-auto object-contain" />
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X className="h-6 w-6 text-gray-600" />
            </button>
          </div>

          <nav className="flex-1 space-y-4 px-3 py-4 overflow-y-auto">
            {!isEmployee && mainNav.length > 0 && (
              <div className="space-y-1">
                {mainNav.map((item) => (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                        isActive
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      }`
                    }
                  >
                    <item.icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </NavLink>
                ))}
              </div>
            )}

            {timeNav.length > 0 && (
              isEmployee ? (
                <div className="space-y-1">
                  {timeNav.map((item) => (
                    <NavLink
                      key={item.name}
                      to={item.href}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                          isActive
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                        }`
                      }
                    >
                      <item.icon className="mr-3 h-5 w-5" />
                      {item.name}
                    </NavLink>
                  ))}
                </div>
              ) : (
                <MobileNavigationGroup
                  title="Tijd & Aanwezigheid"
                  items={timeNav}
                  onItemClick={onClose}
                  storageKey="mobile-nav-time-attendance"
                  defaultOpen={false}
                />
              )
            )}

            {financialNav.length > 0 && (
              isEmployee ? (
                <div className="space-y-1">
                  {financialNav.map((item) => (
                    <NavLink
                      key={item.name}
                      to={item.href}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                          isActive
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                        }`
                      }
                    >
                      <item.icon className="mr-3 h-5 w-5" />
                      {item.name}
                    </NavLink>
                  ))}
                </div>
              ) : (
                <MobileNavigationGroup
                  title="Financieel"
                  items={financialNav}
                  onItemClick={onClose}
                  storageKey="mobile-nav-financial"
                  defaultOpen={false}
                />
              )
            )}

            {systemNav.length > 0 && (
              isEmployee ? (
                <div className="space-y-1">
                  {systemNav.map((item) => (
                    <NavLink
                      key={item.name}
                      to={item.href}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                          isActive
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                        }`
                      }
                    >
                      <item.icon className="mr-3 h-5 w-5" />
                      {item.name}
                    </NavLink>
                  ))}
                </div>
              ) : (
                <MobileNavigationGroup
                  title="Systeem"
                  items={systemNav}
                  onItemClick={onClose}
                  storageKey="mobile-nav-system"
                  defaultOpen={true}
                />
              )
            )}
          </nav>
        </div>
      </div>
    </>
  );
};
