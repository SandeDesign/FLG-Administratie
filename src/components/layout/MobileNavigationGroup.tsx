import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
}

interface MobileNavigationGroupProps {
  title: string;
  items: NavigationItem[];
  onItemClick: () => void;
  storageKey: string;
  defaultOpen?: boolean;
}

export const MobileNavigationGroup: React.FC<MobileNavigationGroupProps> = ({
  title,
  items,
  onItemClick,
  storageKey,
  defaultOpen = true,
}) => {
  const [isOpen, setIsOpen] = useState(() => {
    const stored = localStorage.getItem(storageKey);
    return stored !== null ? stored === 'true' : defaultOpen;
  });

  useEffect(() => {
    localStorage.setItem(storageKey, String(isOpen));
  }, [isOpen, storageKey]);

  const toggleOpen = () => setIsOpen(!isOpen);

  return (
    <div className="space-y-1">
      <button
        onClick={toggleOpen}
        className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 transition-colors"
      >
        <span>{title}</span>
        {isOpen ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </button>
      {isOpen && (
        <div className="space-y-1">
          {items.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              onClick={onItemClick}
              className={({ isActive }) =>
                `flex items-center px-3 py-2 pl-6 text-sm font-medium rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-700 border border-primary-200'
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
    </div>
  );
};
