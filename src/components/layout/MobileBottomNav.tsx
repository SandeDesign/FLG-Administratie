import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Home, 
  Clock, 
  FileText, 
  Settings,
  Users,
  Building2
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export const MobileBottomNav: React.FC = () => {
  const { userRole } = useAuth();
  
  if (!userRole) return null;

  // Define navigation items based on role
  const getNavItems = () => {
    if (userRole === 'employee') {
      return [
        { href: '/', icon: Home, label: 'Dashboard' },
        { href: '/timesheets', icon: Clock, label: 'Uren' },
        { href: '/payslips', icon: FileText, label: 'Loonstrook' },
        { href: '/settings', icon: Settings, label: 'Profiel' },
      ];
    }
    
    if (userRole === 'manager') {
      return [
        { href: '/', icon: Home, label: 'Dashboard' },
        { href: '/employees', icon: Users, label: 'Team' },
        { href: '/timesheets', icon: Clock, label: 'Uren' },
        { href: '/settings', icon: Settings, label: 'Instellingen' },
      ];
    }
    
    // Admin
    return [
      { href: '/', icon: Home, label: 'Dashboard' },
      { href: '/companies', icon: Building2, label: 'Bedrijven' },
      { href: '/employees', icon: Users, label: 'Werknemers' },
      { href: '/timesheets', icon: Clock, label: 'Uren' },
    ];
  };

  const navItems = getNavItems();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-2 py-1 z-30">
      <div className="flex justify-around items-center">
        {navItems.map(({ href, icon: Icon, label }) => (
          <NavLink
            key={href}
            to={href}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center px-3 py-2 min-w-0 flex-1 text-xs font-medium transition-colors ${
                isActive
                  ? 'text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={`h-6 w-6 mb-1 ${isActive ? 'text-blue-600' : 'text-gray-500'}`} />
                <span className="truncate">{label}</span>
                {isActive && (
                  <div className="absolute -top-0.5 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-blue-600 rounded-full" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};