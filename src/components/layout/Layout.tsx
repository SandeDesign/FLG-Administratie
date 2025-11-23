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
        <header className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-40 h-20 max-h-20">
          {/* LEFT: Back button */}
          <div className="flex-1">
            <button
              onClick={handleBackClick}
              className={`p-2 rounded-lg hover:bg-gray-100 transition-colors ${canGoBack ? '' : 'opacity-0 pointer-events-none'}`}
            >
              <ArrowLeft className="h-6 w-6 text-gray-600" />
            </button>
          </div>
          
          {/* CENTER: LOGO */}
          <img src="/Logo_1.png" alt="FLG-Administratie Logo" className="h-12 w-auto flex-shrink-0 mx-2" />
          
          {/* RIGHT: Company Selector */}
          <div className="flex-1 flex justify-end">
            <div className="relative">
              <button
                onClick={() => setCompanyDropdownOpen(!companyDropdownOpen)}
                className="flex items-center space-x-1 px-2 py-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <Building2 className="h-5 w-5 text-primary-600" />
                <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${companyDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu - Opens LEFT on mobile */}
              {companyDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setCompanyDropdownOpen(false)} 
                  />
                  <div className="absolute -left-48 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 w-64 max-h-60 overflow-y-auto lg:right-0">
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
                              ? 'bg-primary-50 border border-primary-200 text-primary-900'
                              : 'hover:bg-gray-50 text-gray-700'
                          }`}
                        >
                          <div className={`p-1.5 rounded-lg ${
                            selectedCompany?.id === company.id ? 'bg-primary-500' : 'bg-gray-400'
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
          </div>
        </header>

        {/* Desktop Header */}
        <header className="hidden lg:flex lg:items-center lg:justify-end lg:px-6 lg:py-4 lg:bg-white lg:border-b lg:border-gray-200">
          {/* RIGHT: Company Selector */}
          <div className="relative">
            <button
              onClick={() => setCompanyDropdownOpen(!companyDropdownOpen)}
              className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Building2 className="h-5 w-5 text-primary-600" />
              <span className="text-sm font-medium text-gray-700">{selectedCompany?.name || 'Selecteer bedrijf'}</span>
              <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${companyDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {companyDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setCompanyDropdownOpen(false)} 
                />
                <div className="absolute -left-48 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 w-64 max-h-60 overflow-y-auto">
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
                            ? 'bg-primary-50 border border-primary-200 text-primary-900'
                            : 'hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <div className={`p-1.5 rounded-lg ${
                          selectedCompany?.id === company.id ? 'bg-primary-500' : 'bg-gray-400'
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