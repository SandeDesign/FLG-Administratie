import React, { useState, useEffect } from 'react';
import { HardDrive, CheckCircle, RefreshCw } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { checkDriveConnection } from '../services/googleDriveService';

const GoogleDriveSettings: React.FC = () => {
  const [connectionStatus, setConnectionStatus] = useState<{
    connected: boolean;
    message: string;
  } | null>(null);
  const [checking, setChecking] = useState(true);

  const checkConnection = async () => {
    setChecking(true);
    try {
      const status = await checkDriveConnection();
      setConnectionStatus(status);
    } catch (error) {
      setConnectionStatus({
        connected: false,
        message: 'Kon verbinding niet controleren',
      });
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkConnection();
  }, []);

  return (
    <Card>
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <HardDrive className="h-6 w-6 text-primary-600" />
            <div>
              <h3 className="text-lg font-medium text-gray-900">Google Drive Integratie</h3>
              <p className="mt-1 text-sm text-gray-500">
                Centrale verbinding via Service Account - werkt voor alle gebruikers
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span className="text-sm font-medium text-green-600">Altijd verbonden</span>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {/* Info box */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
            <strong>Service Account Verbinding</strong>
            <p className="mt-1 text-xs">
              Google Drive is verbonden via een centrale Service Account.
              Alle uploads gaan automatisch naar de gedeelde FLG-Administratie map.
              Geen handmatige connectie nodig per gebruiker.
            </p>
          </div>

          {/* Folder structure */}
          <div className="bg-primary-50 border border-primary-200 rounded-lg p-3 text-sm text-primary-800">
            <strong>Mappenstructuur:</strong>
            <div className="mt-1 text-xs font-mono">
              FLG-Administratie/<br />
              └── Bedrijfsnaam/<br />
              &nbsp;&nbsp;&nbsp;&nbsp;├── Inkoop/<br />
              &nbsp;&nbsp;&nbsp;&nbsp;├── Verkoop/<br />
              &nbsp;&nbsp;&nbsp;&nbsp;└── Productie/
            </div>
          </div>

          {/* Status check button */}
          <div className="flex items-center space-x-3">
            <Button
              onClick={checkConnection}
              disabled={checking}
              variant="secondary"
              size="sm"
              icon={RefreshCw}
            >
              {checking ? 'Controleren...' : 'Verbinding testen'}
            </Button>

            {connectionStatus && (
              <span className={`text-sm ${connectionStatus.connected ? 'text-green-600' : 'text-red-600'}`}>
                {connectionStatus.message}
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default GoogleDriveSettings;
