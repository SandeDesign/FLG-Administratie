import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
  companyTypes?: ('employer' | 'project')[];
  description?: string;
}

interface NavigationGroupProps {
  title: string;
  items: NavigationItem[];
  storageKey: string;
  defaultOpen?: boolean;
}

export const NavigationGroup: React.FC<NavigationGroupProps> = ({ 
  title, 
  items, 
  storageKey,
  defaultOpen = true 
}) => {
  const [isExpanded, setIsExpanded] = useState(() => {
    const stored = localStorage.getItem(storageKey);
    return stored !== null ? stored === 'true' : defaultOpen;
  });

  useEffect(() => {
    localStorage.setItem(storageKey, String(isExpanded));
  }, [isExpanded, storageKey]);

  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      {/* Group Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full px-4 py-2.5 text-sm font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-all duration-200"
      >
        <span>{title}</span>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-400" />
        )}
      </button>

      {/* Navigation Items */}
      {isExpanded && (
        <div className="space-y-1 ml-4">
          {items.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                `group flex items-center px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-primary-50 to-indigo-50 text-primary-700 border border-primary-200 shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
              title={item.description}
            >
              <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
              <span className="truncate">{item.name}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
};