import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Building2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useToast } from '../../hooks/useToast';

const CompaniesVisibilitySettings: React.FC = () => {
  const { user, userRole } = useAuth();
  const { companies } = useApp();
  const { success, error: showError } = useToast();
  const [loadingCompanyId, setLoadingCompanyId] = useState<string | null>(null);

  // Only show for admin
  if (userRole !== 'admin' || !user) {
    return null;
  }

  const visibleCompanies = companies.filter(c => c.isActive !== false);
  const hiddenCompanies = companies.filter(c => c.isActive === false);
  const totalVisible = visibleCompanies.length;
  const totalCompanies = companies.length;

  const handleToggleCompanyVisibility = async (companyId: string, isActive: boolean) => {
    try {
      setLoadingCompanyId(companyId);
      const companyRef = doc(db, 'companies', companyId);
      
      await updateDoc(companyRef, {
        isActive: !isActive
      });

      if (isActive) {
        success('Verborgen', '✓ Bedrijf is nu verborgen in dropdown');
      } else {
        success('Zichtbaar', '✓ Bedrijf is nu zichtbaar in dropdown');
      }
    } catch (error) {
      console.error('Error toggling company visibility:', error);
      showError('Fout', 'Kon zichtbaarheid niet wijzigen');
    } finally {
      setLoadingCompanyId(null);
    }
  };

  const handleEnableAll = async () => {
    if (hiddenCompanies.length === 0) return;

    try {
      setLoadingCompanyId('all');
      
      await Promise.all(
        hiddenCompanies.map(company =>
          updateDoc(doc(db, 'companies', company.id), { isActive: true })
        )
      );

      success('Alle zichtbaar', `✓ ${hiddenCompanies.length} bedrijven zijn nu zichtbaar`);
    } catch (error) {
      console.error('Error enabling all companies:', error);
      showError('Fout', 'Kon niet alle bedrijven activeren');
    } finally {
      setLoadingCompanyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-2">
          <Building2 className="h-5 w-5 text-primary-600" />
          Bedrijven Zichtbaarheid
        </h2>
        <p className="text-sm text-gray-600">
          Kies welke bedrijven zichtbaar zijn in je bedrijfenkeuze. Verborgen bedrijven zijn nog steeds beschikbaar maar verschijnen niet in de dropdown.
        </p>
      </div>

      {/* Summary */}
      <div className="p-3 bg-primary-50 rounded-lg border border-primary-200">
        <p className="text-sm font-medium text-primary-900">
          {totalVisible} van {totalCompanies} bedrijven zichtbaar
        </p>
      </div>

      {/* Visible Companies */}
      {visibleCompanies.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-700">Zichtbare bedrijven</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {visibleCompanies.map(company => (
              <div
                key={company.id}
                className="flex items-center justify-between p-3 bg-white rounded-lg border border-green-200 hover:border-green-300 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {company.logoUrl ? (
                    <img
                      src={company.logoUrl}
                      alt={company.name}
                      className="h-8 w-8 object-contain rounded"
                    />
                  ) : (
                    <div className="h-8 w-8 bg-gray-100 rounded flex items-center justify-center">
                      <Building2 className="h-4 w-4 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{company.name}</p>
                    <p className="text-xs text-gray-500 capitalize">{company.companyType}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleToggleCompanyVisibility(company.id, true)}
                  disabled={loadingCompanyId !== null}
                  className="p-2 text-green-600 hover:bg-green-50 rounded transition-colors"
                  title="Verbergen"
                >
                  {loadingCompanyId === company.id ? (
                    <div className="animate-spin h-4 w-4 border-2 border-green-600 border-t-transparent rounded-full" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hidden Companies */}
      {hiddenCompanies.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-700">Verborgen bedrijven</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {hiddenCompanies.map(company => (
              <div
                key={company.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-300 hover:border-gray-400 transition-colors opacity-75"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {company.logoUrl ? (
                    <img
                      src={company.logoUrl}
                      alt={company.name}
                      className="h-8 w-8 object-contain rounded opacity-50"
                    />
                  ) : (
                    <div className="h-8 w-8 bg-gray-200 rounded flex items-center justify-center">
                      <Building2 className="h-4 w-4 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">{company.name}</p>
                    <p className="text-xs text-gray-500 capitalize">{company.companyType}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleToggleCompanyVisibility(company.id, false)}
                  disabled={loadingCompanyId !== null}
                  className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                  title="Tonen"
                >
                  {loadingCompanyId === company.id ? (
                    <div className="animate-spin h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full" />
                  ) : (
                    <EyeOff className="h-4 w-4" />
                  )}
                </button>
              </div>
            ))}
          </div>

          {/* Enable All Button */}
          {hiddenCompanies.length > 0 && (
            <button
              onClick={handleEnableAll}
              disabled={loadingCompanyId !== null}
              className="w-full mt-3 px-3 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg border border-primary-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Alle bedrijven tonen
            </button>
          )}
        </div>
      )}

      {/* No Hidden Companies */}
      {hiddenCompanies.length === 0 && (
        <div className="p-4 bg-green-50 rounded-lg text-center border border-green-200">
          <p className="text-sm text-green-800">
            ✓ Alle bedrijven zijn zichtbaar in de dropdown
          </p>
        </div>
      )}
    </div>
  );
};

export default CompaniesVisibilitySettings;