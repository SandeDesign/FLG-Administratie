import React, { useState } from 'react';
import { Eye, EyeOff, Building2 } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from '../hooks/useToast';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

const CompaniesVisibilitySettings: React.FC = () => {
  const { companies } = useApp();
  const { success, error: showError } = useToast();
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const handleToggleCompanyVisibility = async (companyId: string, isActive: boolean) => {
    try {
      setLoading(prev => ({ ...prev, [companyId]: true }));
      
      const companyRef = doc(db, 'companies', companyId);
      await updateDoc(companyRef, {
        isActive: !isActive
      });

      success(
        'Bijgewerkt',
        !isActive ? '✓ Bedrijf is nu zichtbaar in dropdown' : '✓ Bedrijf is nu verborgen'
      );
    } catch (error) {
      console.error('Error updating company visibility:', error);
      showError('Fout', 'Kon instellingen niet opslaan');
    } finally {
      setLoading(prev => ({ ...prev, [companyId]: false }));
    }
  };

  const activeCount = companies?.filter((c: any) => c.isActive !== false).length || 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Zichtbare Bedrijven</h3>
        <p className="text-sm text-gray-600">
          Selecteer welke bedrijven zichtbaar zijn in het dropdown menu rechtsboven. Alleen actieve bedrijven verschijnen in het keuzemenu.
        </p>
      </div>

      {/* Summary Card */}
      {companies && companies.length > 0 && (
        <div className="bg-gradient-to-r from-primary-50 to-indigo-50 border border-primary-200 rounded-lg p-4">
          <p className="text-sm font-medium text-primary-900">
            🏢 <strong>{activeCount}</strong> van <strong>{companies.length}</strong> bedrijven zichtbaar
          </p>
        </div>
      )}

      {/* Companies List */}
      <div className="space-y-2 border border-gray-200 rounded-lg overflow-hidden">
        {companies && companies.length > 0 ? (
          companies.map((company: any, index: number) => {
            const isActive = company.isActive !== false; // Default true if not specified
            const isLoading = loading[company.id];

            return (
              <div
                key={company.id}
                className={`flex items-center justify-between p-4 transition-colors ${
                  index !== companies.length - 1 ? 'border-b border-gray-100' : ''
                } ${isLoading ? 'opacity-60' : ''} ${
                  isActive ? 'bg-green-50' : 'bg-gray-50'
                }`}
              >
                <div className="flex items-center space-x-3 flex-1">
                  {/* Logo */}
                  <div className={`p-1.5 rounded-lg flex-shrink-0 w-10 h-10 flex items-center justify-center overflow-hidden ${
                    isActive ? 'bg-white border border-green-200' : 'bg-gray-100'
                  }`}>
                    {company.logoUrl ? (
                      <img 
                        src={company.logoUrl} 
                        alt={company.name} 
                        className="h-8 w-8 object-contain" 
                      />
                    ) : (
                      <Building2 className={`h-5 w-5 ${isActive ? 'text-green-600' : 'text-gray-600'}`} />
                    )}
                  </div>

                  {/* Company Info */}
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-sm ${isActive ? 'text-green-900' : 'text-gray-700'}`}>
                      {company.name}
                    </p>
                    <p className={`text-xs capitalize ${isActive ? 'text-green-600' : 'text-gray-500'}`}>
                      {company.companyType}
                    </p>
                  </div>
                </div>

                {/* Toggle Button */}
                <button
                  onClick={() => handleToggleCompanyVisibility(company.id, isActive)}
                  disabled={isLoading}
                  className={`ml-4 p-2 rounded-lg flex-shrink-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    isActive 
                      ? 'bg-green-100 text-green-600 hover:bg-green-200' 
                      : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                  }`}
                  title={isActive ? 'Verbergen' : 'Tonen'}
                >
                  {isLoading ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : isActive ? (
                    <Eye className="h-5 w-5" />
                  ) : (
                    <EyeOff className="h-5 w-5" />
                  )}
                </button>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-gray-500 text-center py-8">Geen bedrijven gevonden</p>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-xs text-blue-700 space-y-1">
          <span className="block"><strong>💡 Hoe het werkt:</strong></span>
          <span className="block">• Bedrijven met groen oog zijn zichtbaar in het dropdown menu</span>
          <span className="block">• Bedrijven met grijs oog zijn verborgen</span>
          <span className="block">• Klik op het oog-icoon om zichtbaarheid aan te passen</span>
        </p>
      </div>

      {/* Reset Option */}
      {companies && companies.some((c: any) => c.isActive === false) && (
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              try {
                setLoading(prev => ({ ...prev, all: true }));
                
                for (const company of companies) {
                  if (company.isActive === false) {
                    const companyRef = doc(db, 'companies', company.id);
                    await updateDoc(companyRef, { isActive: true });
                  }
                }
                
                success('Klaar', 'Alle bedrijven zijn nu zichtbaar');
              } catch (error) {
                showError('Fout', 'Kon niet alle bedrijven activeren');
              } finally {
                setLoading(prev => ({ ...prev, all: false }));
              }
            }}
            disabled={loading['all']}
          >
            Alles Activeren
          </Button>
        </div>
      )}
    </div>
  );
};

export default CompaniesVisibilitySettings;