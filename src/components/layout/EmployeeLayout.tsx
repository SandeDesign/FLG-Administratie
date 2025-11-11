import React, { useState } from 'react';
import { User, LogOut, Calendar, HeartPulse, Receipt, Clock, Menu, X, Zap } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../ui/Button';

interface EmployeeLayoutProps {
  children: React.ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/employee-dashboard', icon: User },
  { name: 'Verlof', href: '/employee-dashboard/leave', icon: Calendar },
  { name: 'Verzuim', href: '/employee-dashboard/absence', icon: HeartPulse },
  { name: 'Declaraties', href: '/employee-dashboard/expenses', icon: Receipt },
  { name: 'Uren', href: '/employee-dashboard/timesheets', icon: Clock },
];

const EmployeeLayout: React.FC<EmployeeLayoutProps> = ({ children }) => {
  const { user, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-32 right-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Header */}
      <div className="relative z-20 backdrop-blur-xl bg-white/5 border-b border-white/10 sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-3 sm:py-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                {mobileMenuOpen ? (
                  <X className="h-6 w-6 text-blue-300" />
                ) : (
                  <Menu className="h-6 w-6 text-blue-300" />
                )}
              </button>
              <img src="/Logo-groot.png" alt="AlloonApp Logo" className="h-10 w-auto" />
              <div className="hidden sm:block">
                <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
                  AlloonApp
                </h1>
                <p className="text-xs sm:text-sm text-blue-200/70">
                  {user?.displayName || user?.email}
                </p>
              </div>
            </div>
            <Button 
              onClick={signOut} 
              variant="ghost" 
              size="sm"
              className="text-blue-300 hover:text-white hover:bg-white/10"
            >
              <LogOut className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline text-sm">Uitloggen</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Desktop Navigation */}
      <div className="hidden lg:block relative z-10 backdrop-blur-xl bg-white/5 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-4 py-4 text-sm font-medium border-b-2 transition-all duration-300 ${
                      isActive
                        ? 'border-blue-400 text-blue-300 bg-blue-500/10'
                        : 'border-transparent text-white/60 hover:text-white/80 hover:bg-white/5'
                    }`
                  }
                >
                  <Icon className="h-4 w-4" />
                  {item.name}
                </NavLink>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="relative z-10 lg:hidden backdrop-blur-xl bg-white/5 border-b border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="py-2 space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all duration-300 ${
                        isActive
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-400/30'
                          : 'text-white/60 hover:text-white/80 hover:bg-white/5'
                      }`
                    }
                  >
                    <Icon className="h-5 w-5" />
                    {item.name}
                  </NavLink>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        {children}
      </main>
    </div>
  );
};

export default EmployeeLayout;