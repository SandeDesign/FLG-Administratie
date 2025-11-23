import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
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
  MoreVertical,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';

interface MobileBottomNavProps {
  onMenuClick: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ onMenuClick }) => {
  const { userRole } = useAuth();
  const { selectedCompany } = useApp();
  
  if (!userRole) return null;

  const companyType = selectedCompany?.companyType as 'employer' | 'project' | undefined;

  const getCoreNavItems = () => {
    // ✅ PROJECT COMPANY - Admin & Manager see same items
    if (companyType === 'project') {
      if (userRole === 'admin' || userRole === 'manager') {
        return [
          { href: '/', icon: Home, label: 'Dashboard', gradient: 'from-primary-500 to-primary-600' },
          { href: '/project-production', icon: Cpu, label: 'Productie', gradient: 'from-purple-500 to-purple-600' },
          { href: '/outgoing-invoices', icon: Send, label: 'Facturen', gradient: 'from-green-500 to-green-600' },
          { href: '/timesheets', icon: Clock, label: 'Uren', gradient: 'from-cyan-500 to-cyan-600' },
        ];
      }
      // Employee in project company
      return [
        { href: '/', icon: Home, label: 'Dashboard', gradient: 'from-primary-500 to-primary-600' },
        { href: '/settings', icon: Settings, label: 'Profiel', gradient: 'from-gray-500 to-gray-600' },
      ];
    }

    // ✅ EMPLOYER COMPANY
    const navItems: Record<string, Array<{ href: string; icon: any; label: string; gradient: string }>> = {
      employee: [
        { href: '/', icon: Home, label: 'Dashboard', gradient: 'from-primary-500 to-primary-600' },
        { href: '/timesheets', icon: Clock, label: 'Uren', gradient: 'from-cyan-500 to-cyan-600' },
        { href: '/payslips', icon: CheckCircle2, label: 'Loonstrook', gradient: 'from-green-500 to-green-600' },
        { href: '/settings', icon: Settings, label: 'Profiel', gradient: 'from-gray-500 to-gray-600' },
      ],
      manager: [
        { href: '/', icon: Home, label: 'Dashboard', gradient: 'from-primary-500 to-primary-600' },
        { href: '/employees', icon: Users, label: 'Team', gradient: 'from-indigo-500 to-indigo-600' },
        { href: '/outgoing-invoices', icon: Send, label: 'Facturen', gradient: 'from-green-500 to-green-600' },
        { href: '/timesheet-approvals', icon: CheckCircle2, label: 'Beheren', gradient: 'from-emerald-500 to-emerald-600' },
      ],
      admin: [
        { href: '/', icon: Home, label: 'Dashboard', gradient: 'from-primary-500 to-primary-600' },
        { href: '/timesheet-approvals', icon: CheckCircle2, label: 'Uren', gradient: 'from-emerald-500 to-emerald-600' },
        { href: '/outgoing-invoices', icon: Send, label: 'Facturen', gradient: 'from-green-500 to-green-600' },
        { href: '/employees', icon: Users, label: 'Team', gradient: 'from-indigo-500 to-indigo-600' },
      ],
    };

    return navItems[userRole] || navItems.employee;
  };

  const coreNavItems = getCoreNavItems();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40">
      {/* Backdrop blur separator */}
      <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      
      {/* Modern glasmorphism nav */}
      <div className="bg-white/95 backdrop-blur-xl border-t border-white/20 shadow-2xl">
        <div className="flex justify-around items-center px-2 py-3 max-w-full">
          {coreNavItems.map(({ href, icon: Icon, label, gradient }) => (
            <NavLink
              key={href}
              to={href}
              title={label}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center flex-1 transition-all duration-300 group relative ${
                  isActive ? 'scale-110' : 'hover:scale-105'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {/* Background glow on active */}
                  {isActive && (
                    <div className={`absolute inset-0 bg-gradient-to-br ${gradient} rounded-full blur-md opacity-20 scale-150`} />
                  )}
                  
                  {/* Icon container */}
                  <div className={`relative p-3 rounded-2xl transition-all duration-300 ${
                    isActive
                      ? `bg-gradient-to-br ${gradient} text-white shadow-lg shadow-${gradient.split('-')[1]}-500/50`
                      : 'bg-gray-100/50 text-gray-600 group-hover:bg-gray-200/50 group-hover:text-gray-800'
                  }`}>
                    <Icon 
                      size={20} 
                      strokeWidth={2.2}
                      className="transition-all duration-300"
                    />
                  </div>
                  
                  {/* Label */}
                  <span className={`text-xs font-semibold mt-1.5 transition-all duration-300 ${
                    isActive
                      ? 'text-gray-900 scale-100 opacity-100'
                      : 'text-gray-600 scale-95 opacity-75 group-hover:opacity-100'
                  }`}>
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
          
          {/* Menu button */}
          <button
            onClick={onMenuClick}
            title="Menu"
            className="flex flex-col items-center justify-center flex-1 transition-all duration-300 group hover:scale-105"
          >
            <div className="relative p-3 rounded-2xl bg-gray-100/50 text-gray-600 group-hover:bg-gray-200/50 group-hover:text-gray-800 transition-all duration-300">
              <MoreVertical 
                size={20}
                strokeWidth={2.2}
              />
            </div>
            <span className="text-xs font-semibold mt-1.5 text-gray-600 scale-95 opacity-75 group-hover:opacity-100 transition-all duration-300">
              Menu
            </span>
          </button>
        </div>
      </div>
    </nav>
  );
};

export default MobileBottomNav;