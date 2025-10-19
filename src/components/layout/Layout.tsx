import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Home, 
  Users, 
  Clock, 
  Settings,
  Building2,
  DollarSign,
  Menu,
  X
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { MobileBottomNav } from './MobileBottomNav';
import { CompanySelector } from '../ui/CompanySelector';
import { NotificationCenter } from '../notifications/NotificationCenter';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const { userRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isEmployee = userRole === 'employee';
  const canGoBack = location.pathname !== '/';

  const handleBackClick = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Desktop Sidebar - Hidden on mobile */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:bg-white lg:border-r lg:border-gray-200">
        <div className="flex h-16 items-center justify-center border-b border-gray-200 px-6">
          <img src="/Logo-groot.png" alt="AlloonApp Logo" className="h-10 w-auto" />
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          {/* Desktop Company Selector - Only for Admin/Manager */}
          {(userRole === 'admin' || userRole === 'manager') && (
            <div className="mb-6">
              <CompanySelector />
            </div>
          )}
          
          {/* Desktop Navigation */}
          <nav className="space-y-2">
            {/* Main Navigation */}
            <div className="pb-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Hoofdmenu
              </h3>
              <DesktopNavLink href="/" icon={Home} label="Dashboard" roles={['admin', 'manager']} />
              <DesktopNavLink href="/companies" icon={Building2} label="Werkmaatschappijen" roles={['admin']} />
              <DesktopNavLink href="/payroll-company" icon={DollarSign} label="Loonmaatschappij" roles={['admin']} />
              <DesktopNavLink href="/employees" icon={Users} label="Werknemers" roles={['admin', 'manager']} />
            </div>

            {/* Time & Attendance */}
            <div className="pb-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Tijd & Aanwezigheid
              </h3>
              <DesktopNavLink href="/timesheets" icon={Clock} label="Urenregistratie" roles={['admin', 'manager', 'employee']} />
              <DesktopNavLink href="/timesheet-approvals" icon={Clock} label="Uren Goedkeuren" roles={['admin', 'manager']} />
              <DesktopNavLink href="/leave-requests" icon={Clock} label="Verlofaanvragen" roles={['admin', 'manager', 'employee']} />
            </div>

            {/* Financial */}
            {!isEmployee && (
              <div className="pb-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Financieel
                </h3>
                <DesktopNavLink href="/payroll" icon={DollarSign} label="Loonverwerking" roles={['admin']} />
                <DesktopNavLink href="/payslips" icon={DollarSign} label="Loonstroken" roles={['admin', 'manager', 'employee']} />
                <DesktopNavLink href="/expenses" icon={DollarSign} label="Declaraties" roles={['admin', 'manager']} />
              </div>
            )}

            {/* System */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Systeem
              </h3>
              <DesktopNavLink href="/settings" icon={Settings} label="Instellingen" roles={['admin', 'manager', 'employee']} />
              {userRole === 'admin' && (
                <DesktopNavLink href="/audit-log" icon={Settings} label="Audit Log" roles={['admin']} />
              )}
            </div>
          </nav>
        </div>
      </aside>

      {/* Mobile Menu Overlay */}
      {showMobileMenu && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black bg-opacity-25" onClick={() => setShowMobileMenu(false)} />
          <div className="fixed top-0 left-0 w-80 h-full bg-white shadow-xl">
            <div className="flex items-center justify-between p-4 border-b">
              <img src="/Logo-groot.png" alt="AlloonApp Logo" className="h-8 w-auto" />
              <button
                onClick={() => setShowMobileMenu(false)}
                className="p-2 rounded-lg hover:bg-gray-100"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="p-4">
              {/* Mobile Company Selector - Only for Admin/Manager */}
              {(userRole === 'admin' || userRole === 'manager') && (
                <div className="mb-6">
                  <CompanySelector />
                </div>
              )}
              
              {/* Mobile Navigation */}
              <nav className="space-y-4">
                <MobileNavSection title="Hoofdmenu">
                  <MobileNavLink href="/" icon={Home} label="Dashboard" roles={['admin', 'manager']} onClick={() => setShowMobileMenu(false)} />
                  <MobileNavLink href="/companies" icon={Building2} label="Werkmaatschappijen" roles={['admin']} onClick={() => setShowMobileMenu(false)} />
                  <MobileNavLink href="/payroll-company" icon={DollarSign} label="Loonmaatschappij" roles={['admin']} onClick={() => setShowMobileMenu(false)} />
                  <MobileNavLink href="/employees" icon={Users} label="Werknemers" roles={['admin', 'manager']} onClick={() => setShowMobileMenu(false)} />
                </MobileNavSection>

                <MobileNavSection title="Tijd & Aanwezigheid">
                  <MobileNavLink href="/timesheets" icon={Clock} label="Urenregistratie" roles={['admin', 'manager', 'employee']} onClick={() => setShowMobileMenu(false)} />
                  <MobileNavLink href="/timesheet-approvals" icon={Clock} label="Uren Goedkeuren" roles={['admin', 'manager']} onClick={() => setShowMobileMenu(false)} />
                  <MobileNavLink href="/leave-requests" icon={Clock} label="Verlofaanvragen" roles={['admin', 'manager', 'employee']} onClick={() => setShowMobileMenu(false)} />
                </MobileNavSection>

                {!isEmployee && (
                  <MobileNavSection title="Financieel">
                    <MobileNavLink href="/payroll" icon={DollarSign} label="Loonverwerking" roles={['admin']} onClick={() => setShowMobileMenu(false)} />
                    <MobileNavLink href="/payslips" icon={DollarSign} label="Loonstroken" roles={['admin', 'manager', 'employee']} onClick={() => setShowMobileMenu(false)} />
                    <MobileNavLink href="/expenses" icon={DollarSign} label="Declaraties" roles={['admin', 'manager']} onClick={() => setShowMobileMenu(false)} />
                  </MobileNavSection>
                )}

                <MobileNavSection title="Systeem">
                  <MobileNavLink href="/settings" icon={Settings} label="Instellingen" roles={['admin', 'manager', 'employee']} onClick={() => setShowMobileMenu(false)} />
                  {userRole === 'admin' && (
                    <MobileNavLink href="/audit-log" icon={Settings} label="Audit Log" roles={['admin']} onClick={() => setShowMobileMenu(false)} />
                  )}
                </MobileNavSection>
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Mobile Header - Static positioned */}
        <header className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center space-x-3">
            {canGoBack ? (
              <button
                onClick={handleBackClick}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ArrowLeft className="h-6 w-6 text-gray-600" />
              </button>
            ) : (
              <button
                onClick={() => setShowMobileMenu(true)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <Menu className="h-6 w-6 text-gray-600" />
              </button>
            )}
          </div>
          
          <img src="/Logo-groot.png" alt="AlloonApp Logo" className="h-8 w-auto" />
          
          <div className="w-10 flex justify-end">
            <NotificationCenter />
          </div>
        </header>

        {/* Desktop Header */}
        <header className="hidden lg:flex lg:items-center lg:justify-between lg:px-6 lg:py-4 lg:bg-white lg:border-b lg:border-gray-200">
          <h1 className="text-2xl font-semibold text-gray-900">
            {getPageTitle(location.pathname)}
          </h1>
          <NotificationCenter />
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-auto">
          <div className="p-4 lg:p-6 pb-20 lg:pb-6">
            {children}
          </div>
        </main>

        {/* Mobile Bottom Navigation */}
        <MobileBottomNav />
      </div>
    </div>
  );
};

// Helper Components
interface NavLinkProps {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  roles: string[];
  onClick?: () => void;
}

const DesktopNavLink: React.FC<NavLinkProps> = ({ href, icon: Icon, label, roles }) => {
  const { userRole } = useAuth();
  const location = useLocation();
  
  if (!userRole || !roles.includes(userRole)) return null;
  
  const isActive = location.pathname === href;
  
  return (
    <a
      href={href}
      className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
        isActive
          ? 'bg-blue-50 text-blue-700 border border-blue-200'
          : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
      }`}
    >
      <Icon className="mr-3 h-5 w-5" />
      {label}
    </a>
  );
};

const MobileNavLink: React.FC<NavLinkProps> = ({ href, icon: Icon, label, roles, onClick }) => {
  const { userRole } = useAuth();
  const location = useLocation();
  
  if (!userRole || !roles.includes(userRole)) return null;
  
  const isActive = location.pathname === href;
  
  return (
    <a
      href={href}
      onClick={onClick}
      className={`flex items-center px-4 py-3 text-base font-medium rounded-xl transition-colors ${
        isActive
          ? 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border border-blue-200'
          : 'text-gray-700 hover:bg-gray-50'
      }`}
    >
      <Icon className="mr-4 h-6 w-6" />
      {label}
    </a>
  );
};

interface MobileNavSectionProps {
  title: string;
  children: React.ReactNode;
}

const MobileNavSection: React.FC<MobileNavSectionProps> = ({ title, children }) => (
  <div>
    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-4">
      {title}
    </h3>
    <div className="space-y-1">
      {children}
    </div>
  </div>
);

// Helper function to get page title
const getPageTitle = (pathname: string): string => {
  const titles: { [key: string]: string } = {
    '/': 'Dashboard',
    '/companies': 'Werkmaatschappijen',
    '/payroll-company': 'Loonmaatschappij',
    '/employees': 'Werknemers',
    '/timesheets': 'Urenregistratie',
    '/timesheet-approvals': 'Uren Goedkeuren',
    '/leave-requests': 'Verlofaanvragen',
    '/payroll': 'Loonverwerking',
    '/payslips': 'Loonstroken',
    '/expenses': 'Declaraties',
    '/settings': 'Instellingen',
    '/audit-log': 'Audit Log',
  };
  
  return titles[pathname] || 'AlloonApp';
};

export default Layout;