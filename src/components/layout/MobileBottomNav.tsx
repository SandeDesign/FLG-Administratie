import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Home,
  Clock,
  Settings as SettingsIcon,
  Users,
  Zap,
  CheckCircle2,
  Cpu,
  Package,
  Send,
  Download,
  MoreVertical,
  Upload,
  Wallet,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import { db } from '../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { BottomNavItem } from '../../types';

interface MobileBottomNavProps {
  onMenuClick: () => void;
}

// Icon mapping voor string naar component
const ICON_MAP: Record<string, any> = {
  Home,
  Clock,
  Settings: SettingsIcon,
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
};

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ onMenuClick }) => {
  const { user, userRole } = useAuth();
  const { selectedCompany } = useApp();
  const [customNavItems, setCustomNavItems] = useState<BottomNavItem[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && selectedCompany) {
      loadCustomNavItems();
    }
  }, [user, selectedCompany]);

  const loadCustomNavItems = async () => {
    if (!user || !selectedCompany) return;

    try {
      const settingsRef = doc(db, 'userSettings', user.uid);
      const settingsDoc = await getDoc(settingsRef);

      if (settingsDoc.exists()) {
        const data = settingsDoc.data();
        const companyBottomNav = data.bottomNavItems?.[selectedCompany.id];

        if (companyBottomNav && Array.isArray(companyBottomNav) && companyBottomNav.length === 3) {
          setCustomNavItems(companyBottomNav);
        } else {
          setCustomNavItems(null); // Gebruik defaults
        }
      } else {
        setCustomNavItems(null); // Gebruik defaults
      }
    } catch (error) {
      console.error('Error loading custom nav items:', error);
      setCustomNavItems(null); // Gebruik defaults bij error
    } finally {
      setLoading(false);
    }
  };

  if (!userRole) return null;

  const companyType = selectedCompany?.companyType as 'employer' | 'project' | 'holding' | undefined;

  const getCoreNavItems = () => {
    // ✅ HOLDING COMPANY
    if (companyType === 'holding') {
      if (userRole === 'admin' || userRole === 'manager') {
        return [
          { href: '/', icon: Home, label: 'Dashboard', gradient: 'from-primary-500 to-primary-600' },
          { href: '/statistics/holding', icon: TrendingUp, label: 'Stats', gradient: 'from-primary-600 to-primary-700' },
          { href: '/outgoing-invoices', icon: Send, label: 'Verkoop', gradient: 'from-primary-500 to-primary-600' },
          { href: '/budgeting', icon: Wallet, label: 'Begroting', gradient: 'from-primary-600 to-primary-700' },
        ];
      }
      // Employee in holding company (shouldn't happen, but fallback)
      return [
        { href: '/', icon: Home, label: 'Dashboard', gradient: 'from-primary-500 to-primary-600' },
        { href: '/settings', icon: Settings, label: 'Profiel', gradient: 'from-primary-600 to-primary-700' },
      ];
    }

    // ✅ PROJECT COMPANY - Admin & Manager see same items
    if (companyType === 'project') {
      if (userRole === 'admin' || userRole === 'manager') {
        return [
          { href: '/', icon: Home, label: 'Dashboard', gradient: 'from-primary-500 to-primary-600' },
          { href: '/statistics/project', icon: TrendingUp, label: 'Stats', gradient: 'from-primary-600 to-primary-700' },
          { href: '/project-production', icon: Cpu, label: 'Productie', gradient: 'from-primary-500 to-primary-600' },
          { href: '/outgoing-invoices', icon: Send, label: 'Facturen', gradient: 'from-primary-600 to-primary-700' },
        ];
      }
      // Employee in project company
      return [
        { href: '/', icon: Home, label: 'Dashboard', gradient: 'from-primary-500 to-primary-600' },
        { href: '/settings', icon: Settings, label: 'Profiel', gradient: 'from-primary-600 to-primary-700' },
      ];
    }

    // ✅ EMPLOYER COMPANY
    const navItems: Record<string, Array<{ href: string; icon: any; label: string; gradient: string }>> = {
      employee: [
        { href: '/', icon: Home, label: 'Dashboard', gradient: 'from-primary-500 to-primary-600' },
        { href: '/timesheets', icon: Clock, label: 'Uren', gradient: 'from-primary-600 to-primary-700' },
        { href: '/payslips', icon: CheckCircle2, label: 'Loonstrook', gradient: 'from-primary-500 to-primary-600' },
        { href: '/settings', icon: Settings, label: 'Profiel', gradient: 'from-primary-600 to-primary-700' },
      ],
      manager: [
        { href: '/', icon: Home, label: 'Dashboard', gradient: 'from-primary-500 to-primary-600' },
        { href: '/statistics/employer', icon: TrendingUp, label: 'Stats', gradient: 'from-primary-600 to-primary-700' },
        { href: '/employees', icon: Users, label: 'Team', gradient: 'from-primary-500 to-primary-600' },
        { href: '/timesheet-approvals', icon: CheckCircle2, label: 'Beheren', gradient: 'from-primary-600 to-primary-700' },
      ],
      admin: [
        { href: '/', icon: Home, label: 'Dashboard', gradient: 'from-primary-500 to-primary-600' },
        { href: '/outgoing-invoices', icon: Send, label: 'Verkoop', gradient: 'from-primary-600 to-primary-700' },
        { href: '/timesheet-approvals', icon: CheckCircle2, label: 'Uren', gradient: 'from-primary-500 to-primary-600' },
        { href: '/incoming-invoices', icon: Upload, label: 'Inkoop', gradient: 'from-primary-600 to-primary-700' },
      ],
    };

    return navItems[userRole] || navItems.employee;
  };

  // Gebruik custom nav items als beschikbaar, anders defaults
  const defaultNavItems = getCoreNavItems();
  const navItemsToUse = customNavItems || defaultNavItems;

  // Als custom items, converteer icon string naar component
  const finalNavItems = customNavItems
    ? customNavItems.map(item => ({
        ...item,
        icon: ICON_MAP[item.icon] || Clock, // Fallback naar Clock als icon niet gevonden
      }))
    : navItemsToUse;

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40">
      {/* Backdrop blur separator */}
      <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      {/* Modern glasmorphism nav */}
      <div className="bg-white/95 backdrop-blur-xl border-t border-white/20 shadow-2xl">
        <div className="flex justify-around items-center px-2 py-3 max-w-full">
          {finalNavItems.map(({ href, icon: Icon, label, gradient }) => (
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