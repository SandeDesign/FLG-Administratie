import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Building2,
  Users,
  Bell,
  Shield,
  Database,
  Download,
  HardDrive,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { NotificationService } from '../services/notificationService';
import { getUserSettings, saveUserSettings } from '../services/firebase';
import { NotificationPreferences } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useToast } from '../hooks/useToast';


const Settings: React.FC = () => {
  const { user, userRole, adminUserId } = useAuth();
  const { companies } = useApp();
  const { success, error: showError } = useToast();
  const [activeTab, setActiveTab] = useState<'general' | 'company' | 'notifications' | 'security' | 'data' | 'drive'>('general');
  const [loading, setLoading] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [selectedDefaultCompanyId, setSelectedDefaultCompanyId] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user && activeTab === 'notifications') {
      loadPreferences();
    }
  }, [user, activeTab]);

  useEffect(() => {
    if (user && userRole === 'admin' && activeTab === 'company') {
      loadDefaultCompany();
    }
  }, [user, userRole, activeTab]);

  const loadPreferences = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const prefs = await NotificationService.getPreferences(user.uid);
      setPreferences(prefs);
    } catch (error) {
      console.error('Error loading preferences:', error);
      showError('Fout bij laden', 'Kon voorkeuren niet laden');
    } finally {
      setLoading(false);
    }
  };

  const loadDefaultCompany = async () => {
    if (!adminUserId) return;
    
    try {
      const settings = await getUserSettings(adminUserId);
      setSelectedDefaultCompanyId(settings?.defaultCompanyId || '');
    } catch (error) {
      console.error('Error loading default company:', error);
    }
  };

  const handleSaveNotificationPreferences = async () => {
    if (!user || !preferences) return;

    try {
      setLoading(true);
      await NotificationService.updatePreferences(user.uid, preferences);
      success('Meldingsvoorkeuren opgeslagen', 'Je voorkeuren zijn succesvol opgeslagen');
    } catch (error) {
      console.error('Error saving preferences:', error);
      showError('Fout bij opslaan', 'Kon voorkeuren niet opslaan');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDefaultCompany = async () => {
    if (!adminUserId) return;
    
    try {
      setSaving(true);
      await saveUserSettings(adminUserId, {
        defaultCompanyId: selectedDefaultCompanyId || undefined
      });
      success('Bedrijf opgeslagen', 'Je standaard bedrijf is ingesteld');
    } catch (error) {
      console.error('Error saving default company:', error);
      showError('Fout bij opslaan', 'Kon standaard bedrijf niet opslaan');
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'general', name: 'Algemeen', icon: SettingsIcon },
    { id: 'company', name: 'Bedrijfsinstellingen', icon: Building2 },
    { id: 'drive', name: 'Google Drive', icon: HardDrive },
    { id: 'notifications', name: 'Meldingen', icon: Bell },
    { id: 'security', name: 'Beveiliging', icon: Shield },
    { id: 'data', name: 'Data & Privacy', icon: Database },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Instellingen</h1>
          <p className="mt-2 text-sm text-gray-600">
            Beheer uw applicatie-instellingen en voorkeuren
          </p>
        </div>
      </div>

      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`${
                  activeTab === tab.id
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center transition-colors`}
              >
                <Icon className="h-5 w-5 mr-2" />
                {tab.name}
              </button>
            );
          })}
        </nav>
      </div>

      {activeTab === 'general' && (
        <div className="space-y-6">
          <Card>
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Weergave
              </h2>
              <div className="space-y-4">
                <div className="bg-primary-50 border border-primary-200 rounded-xl p-4">
                  <p className="text-sm text-primary-800">
                    FLG-Administratie gebruikt een licht, professioneel thema gebaseerd op Material Design principes voor optimale leesbaarheid en gebruiksvriendelijkheid.
                  </p>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Bedrijfsinstellingen
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Standaard reiskostenvergoeding
                  </label>
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-600">€</span>
                    <input
                      type="number"
                      step="0.01"
                      defaultValue="0.23"
                      className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:ring-2 focus:ring-primary-500 shadow-sm"
                    />
                    <span className="text-gray-600">per km</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Standaard vakantietoeslag
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      step="0.1"
                      defaultValue="8.0"
                      className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:ring-2 focus:ring-primary-500 shadow-sm"
                    />
                    <span className="text-gray-600">%</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Standaard werkweek
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      step="1"
                      defaultValue="40"
                      className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:ring-2 focus:ring-primary-500 shadow-sm"
                    />
                    <span className="text-gray-600">uur</span>
                  </div>
                </div>

                <div className="pt-4">
                  <Button variant="primary">
                    Instellingen opslaan
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'company' && userRole === 'admin' && (
        <div className="space-y-6">
          <Card>
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Standaard Bedrijf
              </h2>
              <div className="space-y-4">
                <p className="text-sm text-gray-600 mb-4">
                  Kies welk bedrijf standaard wordt geselecteerd wanneer je inlogt
                </p>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Selecteer bedrijf *
                  </label>
                  <select
                    value={selectedDefaultCompanyId}
                    onChange={(e) => setSelectedDefaultCompanyId(e.target.value)}
                    className="w-full px-3 py-2 text-sm text-gray-900 bg-white border rounded-lg border-gray-300 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  >
                    <option value="">Geen standaard (eerste bedrijf)</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </div>

                <Button 
                  variant="primary"
                  onClick={handleSaveDefaultCompany}
                  disabled={saving}
                >
                  {saving ? 'Opslaan...' : 'Standaard bedrijf opslaan'}
                </Button>
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-6 bg-primary-50">
              <h3 className="font-medium text-primary-900 mb-2">💡 Info</h3>
              <p className="text-sm text-primary-800">
                Je kunt ook handmatig een bedrijf selecteren in de sidebar. Dit wijzigt je voorkeur echter niet.
              </p>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'drive' && (
        <div className="space-y-6">
          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <HardDrive className="h-6 w-6 text-primary-600" />
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">Google Drive Integratie</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Verbind Google Drive om facturen automatisch op te slaan.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <div className="bg-primary-50 border border-primary-200 rounded-lg p-3 text-sm text-primary-800">
                  <strong>Mappenstructuur:</strong>
                  <div className="mt-2 text-xs font-mono">
                    FLG-Administratie/<br />
                    └── Bedrijfsnaam/<br />
                    &nbsp;&nbsp;&nbsp;&nbsp;├── Inkomende Facturen<br />
                    &nbsp;&nbsp;&nbsp;&nbsp;├── Uitgaande Facturen<br />
                    &nbsp;&nbsp;&nbsp;&nbsp;└── Exports
                  </div>
                </div>

                <Button
                  onClick={async () => {
                    if (!user) return;
                    try {
                      setSaving(true);
                      const { requestGoogleDriveToken, saveGoogleDriveToken } = await import('../services/googleDriveService');
                      const token = await requestGoogleDriveToken();
                      await saveGoogleDriveToken(user.uid, token);
                      success('Verbonden!', 'Google Drive is succesvol gekoppeld');
                      // Refresh page to update status
                      setTimeout(() => window.location.reload(), 1000);
                    } catch (error) {
                      showError('Verbinding mislukt', error instanceof Error ? error.message : 'Kon Google Drive niet verbinden');
                    } finally {
                      setSaving(false);
                    }
                  }}
                  disabled={saving}
                  icon={HardDrive}
                  variant="primary"
                >
                  {saving ? 'Bezig met verbinden...' : 'Verbind Google Drive'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="space-y-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : (
            <>
              <Card>
                <div className="p-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    E-mail meldingen
                  </h2>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium text-gray-900 dark:text-white">
                          E-mail meldingen inschakelen
                        </label>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Ontvang updates per e-mail
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          setPreferences(
                            preferences
                              ? {
                                  ...preferences,
                                  email: { ...preferences.email, enabled: !preferences.email.enabled },
                                }
                              : null
                          )
                        }
                        className={`${
                          preferences?.email.enabled ? 'bg-primary-600' : 'bg-gray-200'
                        } relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
                      >
                        <span
                          className={`${
                            preferences?.email.enabled ? 'translate-x-6' : 'translate-x-1'
                          } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                        />
                      </button>
                    </div>

                    {preferences?.email.enabled && (
                      <div className="ml-4 space-y-3 border-l-2 border-gray-200 dark:border-gray-700 pl-4">
                        {Object.entries({
                          payrollNotifications: 'Loonverwerkingen',
                          taxReturnNotifications: 'Belastingaangiftes',
                          contractNotifications: 'Contracten',
                          leaveNotifications: 'Verlofaanvragen',
                          expenseNotifications: 'Declaraties',
                          complianceAlerts: 'Compliance waarschuwingen',
                          systemUpdates: 'Systeemupdates',
                        }).map(([key, label]) => (
                          <label key={key} className="flex items-center space-x-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={preferences.email[key as keyof typeof preferences.email] as boolean}
                              onChange={(e) =>
                                setPreferences(
                                  preferences
                                    ? {
                                        ...preferences,
                                        email: {
                                          ...preferences.email,
                                          [key]: e.target.checked,
                                        },
                                      }
                                    : null
                                )
                              }
                              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                            <span className="text-sm text-gray-900 dark:text-white">{label}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              <Card>
                <div className="p-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    In-app meldingen
                  </h2>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium text-gray-900 dark:text-white">
                          Badge weergeven
                        </label>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Toon aantal ongelezen meldingen
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          setPreferences(
                            preferences
                              ? {
                                  ...preferences,
                                  inApp: { ...preferences.inApp, showBadge: !preferences.inApp.showBadge },
                                }
                              : null
                          )
                        }
                        className={`${
                          preferences?.inApp.showBadge ? 'bg-primary-600' : 'bg-gray-200'
                        } relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
                      >
                        <span
                          className={`${
                            preferences?.inApp.showBadge ? 'translate-x-6' : 'translate-x-1'
                          } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </Card>

              <div className="flex justify-end">
                <Button variant="primary" onClick={handleSaveNotificationPreferences}>
                  Voorkeuren opslaan
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'security' && (
        <Card>
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Beveiliging
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Gebruikersrollen en machtigingen
                </label>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Beheer wie toegang heeft tot verschillende delen van de applicatie
                </p>
                <Button variant="outline">
                  <Users className="h-4 w-4 mr-2" />
                  Rollen beheren
                </Button>
              </div>

              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Audit log
                </label>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Bekijk alle acties die zijn uitgevoerd in het systeem
                </p>
                <Button variant="outline">
                  <Shield className="h-4 w-4 mr-2" />
                  Audit log bekijken
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'data' && (
        <div className="space-y-6">
          <Card>
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Data retentie
              </h2>
              <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Volgens de Nederlandse wetgeving moeten loongegevens minimaal 7 jaar bewaard blijven.
                </p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Automatisch archiveren na
                  </label>
                  <select className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-gray-900 dark:text-white">
                    <option value="7">7 jaar (wettelijk minimum)</option>
                    <option value="10">10 jaar</option>
                  </select>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Data export
              </h2>
              <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Download al uw gegevens voor archivering of externe verwerking
                </p>
                <div className="flex space-x-3">
                  <Button variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Export naar Excel
                  </Button>
                  <Button variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Export naar PDF
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Automatische back-ups
              </h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-900 dark:text-white">
                      Dagelijkse back-ups
                    </label>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Maak elke dag automatisch een back-up
                    </p>
                  </div>
                  <button className="bg-primary-600 relative inline-flex h-6 w-11 items-center rounded-full transition-colors">
                    <span className="translate-x-6 inline-block h-4 w-4 transform rounded-full bg-white transition-transform" />
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  Laatste back-up: Vandaag om 03:00
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Settings;