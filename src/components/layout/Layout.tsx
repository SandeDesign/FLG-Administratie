import React, { useState } from 'react';
import { 
  ArrowLeft, 
  User
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Sidebar from './Sidebar';
import { MobileBottomNav } from './MobileBottomNav';
import { MobileFullScreenMenu } from './MobileFullScreenMenu';
import { NotificationCenter } from '../notifications/NotificationCenter';
import { navigation } from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { userRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const canGoBack = location.pathname !== '/';

  const handleBackClick = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  const handleProfileClick = () => {
    navigate('/settings');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Desktop Sidebar */}
      <Sidebar />
      
      {/* Mobile Full Screen Menu */}
      <MobileFullScreenMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header - GEEN MENU KNOP */}
        <header className="lg:hidden bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between sticky top-0 z-40">
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
                onClick={handleProfileClick}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <User className="h-6 w-6 text-gray-600" />
              </button>
            )}
          </div>
          
          {/* GROTER LOGO */}
          <img src="/Logo-groot.png" alt="AlloonApp Logo" className="h-12 w-auto" />
          
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
        <MobileBottomNav onMenuClick={() => setMobileMenuOpen(true)} />
      </div>
    </div>
  );
};

// Helper function to get page title
const getPageTitle = (pathname: string): string => {
  const titles: { [key: string]: string } = {
    '/': 'Dashboard',
    '/companies': 'Bedrijven',
    '/employees': 'Werknemers',
    '/timesheets': 'Urenregistratie',
    '/timesheet-approvals': 'Uren Goedkeuren',
    '/admin/leave-approvals': 'Verlof Goedkeuren',
    '/admin/absence-management': 'Verzuimbeheer',
    '/admin/expenses': 'Declaraties',
    '/payroll-processing': 'Loonverwerking',
    '/payslips': 'Loonstroken',
    '/tax-returns': 'Loonaangiftes',
    '/exports': 'Exports',
    '/audit-log': 'Audit Log',
    '/settings': 'Instellingen',
  };
  
  return titles[pathname] || 'AlloonApp';
};

export default Layout;