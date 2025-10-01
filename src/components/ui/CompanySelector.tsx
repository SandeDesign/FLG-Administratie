import React from 'react';
import { Building2, ChevronDown } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { Company } from '../../types';

export const CompanySelector: React.FC = () => {
  const { companies, selectedCompany, setSelectedCompany } = useApp();
  const { userRole } = useAuth();

  if (userRole !== 'admin' || companies.length === 0) {
    return null;
  }

  const handleCompanyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const companyId = e.target.value;
    const company = companies.find(c => c.id === companyId);
    setSelectedCompany(company || null);
  };

  return (
    <div className="relative">
      <div className="flex items-center space-x-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <Building2 className="h-4 w-4 text-gray-500 dark:text-gray-400" />
        <select
          value={selectedCompany?.id || ''}
          onChange={handleCompanyChange}
          className="appearance-none bg-transparent text-sm font-medium text-gray-900 dark:text-white border-none focus:outline-none pr-6 cursor-pointer"
        >
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>
        <ChevronDown className="h-4 w-4 text-gray-400 pointer-events-none absolute right-3" />
      </div>
    </div>
  );
};
