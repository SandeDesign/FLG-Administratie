import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Building2,
  ChevronDown
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import Sidebar from './Sidebar';
import { MobileBottomNav } from './MobileBottomNav';
import { MobileFullScreenMenu } from './MobileFullScreenMenu';
import { NotificationCenter } from '../notifications/NotificationCenter';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);
  const { userRole } = useAuth();
  const { companies, selectedCompany, setSelectedCompany } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  
  const isDashboard = location.pathname === '/';
  const canGoBack = location.pathname !== '/';

  const handleBackClick = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  // Get page title based on current route
  const getPageTitle = (pathname: string): string => {
    const titles: { [key: string]: string } = {
      '/': 'Dashboard',
      '/companies': 'Bedrijven',
      '/employees': 'Werknemers',
      '/timesheets': 'Urenregistratie',
      '/timesheet-approvals': 'Uren Goedkeuren',
      '/admin/leave-approvals': 'Verlof Goedkeuren',
      '/admin/absence-management': 'Verzuimbeheer',
      '/outgoing-invoices': 'Uitgaande Facturen',
      '/incoming-invoices': 'Inkomende Facturen',
      '/timesheet-export': 'Uren Export',
      '/drive-files': 'Drive Bestanden',
      '/payslips': 'Loonstroken',
      '/audit-log': 'Audit Log',
      '/settings': 'Instellingen',
    };
    
    return titles[pathname] || 'AlloonApp';
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
        {/* Mobile Header */}
        <header className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
          {/* LEFT: Back button OR Company Selector */}
          <div className="flex-1">
            {isDashboard ? (
              // DASHBOARD: Company Selector
              <div className="relative">
                <button
                  onClick={() => setCompanyDropdownOpen(!companyDropdownOpen)}
                  className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <Building2 className="h-5 w-5 text-blue-600" />
                  <span className="text-sm font-medium text-gray-900 truncate max-w-[120px]">
                    {selectedCompany?.name || 'Selecteer bedrijf'}
                  </span>
                  <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${companyDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {companyDropdownOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setCompanyDropdownOpen(false)} 
                    />
                    <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 w-64 max-h-60 overflow-y-auto">
                      <div className="p-2 space-y-1">
                        {companies && companies.map((company) => (
                          <button
                            key={company.id}
                            onClick={() => {
                              setSelectedCompany(company);
                              setCompanyDropdownOpen(false);
                            }}
                            className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors text-left ${
                              selectedCompany?.id === company.id
                                ? 'bg-blue-50 border border-blue-200 text-blue-900'
                                : 'hover:bg-gray-50 text-gray-700'
                            }`}
                          >
                            <div className={`p-1.5 rounded-lg ${
                              selectedCompany?.id === company.id ? 'bg-blue-500' : 'bg-gray-400'
                            }`}>
                              <Building2 className="h-3 w-3 text-white" />
                            </div>
                            <span className="font-medium text-sm">{company.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              // ANDERE PAGINA'S: Back button
              <button
                onClick={handleBackClick}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ArrowLeft className="h-6 w-6 text-gray-600" />
              </button>
            )}
          </div>
          
          {/* CENTER: GROTER LOGO */}
          <img src="/Logo-groot.png" alt="AlloonApp Logo" className="h-16 w-auto flex-shrink-0 mx-2" />
          
          {/* RIGHT: Notifications */}
          <div className="flex-1 flex justify-end">
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
        <main className="flex-1 overflow-y-auto overflow-x-hidden pb-24 lg:pb-0">
          <div className="p-4 lg:p-6">
            {children}
          </div>
        </main>

        {/* Mobile Bottom Navigation */}
        <MobileBottomNav onMenuClick={() => setMobileMenuOpen(true)} />
      </div>
    </div>
  );
};

export default Layout;