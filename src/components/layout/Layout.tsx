import React, { useState } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import { MobileMenu } from './MobileMenu';
import { navigation } from './Sidebar';
import { useAuth } from '../../contexts/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { userRole } = useAuth();

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <MobileMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        navigation={navigation}
        userRole={userRole}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="lg:hidden flex items-center justify-between h-16 px-4 bg-white border-b border-gray-100 shadow-sm">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Menu className="h-6 w-6 text-gray-600" />
          </button>
          <img src="/Logo-groot.png" alt="AlloonApp Logo" className="h-8 w-auto object-contain" />
          <div className="w-10" />
        </header>

        <main className="flex-1 overflow-auto">
          <div className="p-6 sm:p-8 lg:p-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;