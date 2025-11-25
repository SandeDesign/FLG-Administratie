import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Building2,
  User,
  Mail,
  Lock,
  Camera,
  Check,
  UserPlus,
  X as XIcon,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { getUserSettings, saveUserSettings } from '../services/firebase';
import { updateEmail, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { createFirebaseUser } from '../utils/firebaseAuth';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useToast } from '../hooks/useToast';

const Settings: React.FC = () => {
  const { user, userRole } = useAuth();
  const { companies } = useApp();
  const { success, error: showError } = useToast();
  const [activeTab, setActiveTab] = useState<'account' | 'company'>('account');
  const [loading, setLoading] = useState(false);
  const [selectedDefaultCompanyId, setSelectedDefaultCompanyId] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // Account settings state
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profilePhotoBase64, setProfilePhotoBase64] = useState<string>('');
  const [photoPreview, setPhotoPreview] = useState<string>('');

  // Co-admin state
  const [coAdminEmail, setCoAdminEmail] = useState('');
  const [coAdmins, setCoAdmins] = useState<string[]>([]);

  useEffect(() => {
    if (user && userRole === 'admin' && activeTab === 'company') {
      loadDefaultCompany();
    }
  }, [user, userRole, activeTab]);

  useEffect(() => {
    if (user) {
      setNewEmail(user.email || '');
      loadProfilePhoto();
    }
  }, [user]);

  const loadDefaultCompany = async () => {
    if (!user) return;

    try {
      const settings = await getUserSettings(user.uid);
      setSelectedDefaultCompanyId(settings?.defaultCompanyId || '');
      setCoAdmins(settings?.coAdminEmails || []);
    } catch (error) {
      console.error('Error loading default company:', error);
    }
  };

  const handleAddCoAdmin = async () => {
    if (!user || !coAdminEmail) return;

    if (!coAdminEmail.includes('@')) {
      showError('Ongeldig e-mailadres', 'Voer een geldig e-mailadres in');
      return;
    }

    if (coAdmins.includes(coAdminEmail)) {
      showError('Al toegevoegd', 'Deze gebruiker is al een co-admin');
      return;
    }

    try {
      setSaving(true);

      // Try to create Firebase Authentication account
      console.log('Creating Firebase Auth account for:', coAdminEmail);
      const result = await createFirebaseUser(coAdminEmail, 'DeInstallatie1234!!');

      console.log('Account creation result:', result);

      if (!result.success) {
        showError('Account aanmaken mislukt', result.error || 'Kon Firebase account niet aanmaken');
        return;
      }

      if (result.alreadyExists) {
        toast.info('Account bestaat al', `${coAdminEmail} heeft al een account`);
      } else {
        toast.success('Account aangemaakt!', `Er is een account aangemaakt voor ${coAdminEmail} met wachtwoord: DeInstallatie1234!!`);
      }

      // Add to co-admin list
      const newCoAdmins = [...coAdmins, coAdminEmail];
      await saveUserSettings(user.uid, { coAdminEmails: newCoAdmins });
      setCoAdmins(newCoAdmins);
      setCoAdminEmail('');
      success('Co-admin toegevoegd', `${coAdminEmail} heeft nu toegang tot al je bedrijven`);
    } catch (error) {
      console.error('Error adding co-admin:', error);
      showError('Fout bij toevoegen', 'Kon co-admin niet toevoegen');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveCoAdmin = async (email: string) => {
    if (!user) return;

    try {
      setSaving(true);
      const newCoAdmins = coAdmins.filter(e => e !== email);
      await saveUserSettings(user.uid, { coAdminEmails: newCoAdmins });
      setCoAdmins(newCoAdmins);
      success('Co-admin verwijderd', `${email} heeft geen toegang meer`);
    } catch (error) {
      console.error('Error removing co-admin:', error);
      showError('Fout bij verwijderen', 'Kon co-admin niet verwijderen');
    } finally {
      setSaving(false);
    }
  };

  const loadProfilePhoto = async () => {
    if (!user) return;

    try {
      const settings = await getUserSettings(user.uid);
      if (settings?.profilePhoto) {
        setProfilePhotoBase64(settings.profilePhoto);
        setPhotoPreview(settings.profilePhoto);
      }
    } catch (error) {
      console.error('Error loading profile photo:', error);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showError('Bestand te groot', 'Kies een afbeelding kleiner dan 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setProfilePhotoBase64(base64);
      setPhotoPreview(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfilePhoto = async () => {
    if (!user || !profilePhotoBase64) return;

    try {
      setSaving(true);
      await saveUserSettings(user.uid, { profilePhoto: profilePhotoBase64 });
      success('Profielfoto opgeslagen', 'Je profielfoto is bijgewerkt');
    } catch (error) {
      console.error('Error saving profile photo:', error);
      showError('Fout bij opslaan', 'Kon profielfoto niet opslaan');
    } finally {
      setSaving(false);
    }
  };

  const handleChangeEmail = async () => {
    if (!user || !newEmail || !currentPassword) {
      showError('Validatiefout', 'Vul alle velden in');
      return;
    }

    if (newEmail === user.email) {
      showError('Geen wijziging', 'Dit is al je huidige e-mailadres');
      return;
    }

    try {
      setSaving(true);

      // Re-authenticate
      const credential = EmailAuthProvider.credential(user.email!, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Update email
      await updateEmail(user, newEmail);

      success('E-mail bijgewerkt', 'Je e-mailadres is succesvol gewijzigd');
      setCurrentPassword('');
    } catch (error: any) {
      console.error('Error changing email:', error);
      if (error.code === 'auth/wrong-password') {
        showError('Verkeerd wachtwoord', 'Het huidige wachtwoord is onjuist');
      } else if (error.code === 'auth/email-already-in-use') {
        showError('E-mail in gebruik', 'Dit e-mailadres is al gekoppeld aan een ander account');
      } else {
        showError('Fout bij wijzigen', error.message || 'Kon e-mail niet wijzigen');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!user || !currentPassword || !newPassword || !confirmPassword) {
      showError('Validatiefout', 'Vul alle velden in');
      return;
    }

    if (newPassword !== confirmPassword) {
      showError('Wachtwoorden komen niet overeen', 'Controleer je nieuwe wachtwoord');
      return;
    }

    if (newPassword.length < 6) {
      showError('Wachtwoord te kort', 'Gebruik minimaal 6 tekens');
      return;
    }

    try {
      setSaving(true);

      // Re-authenticate
      const credential = EmailAuthProvider.credential(user.email!, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Update password
      await updatePassword(user, newPassword);

      success('Wachtwoord bijgewerkt', 'Je wachtwoord is succesvol gewijzigd');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Error changing password:', error);
      if (error.code === 'auth/wrong-password') {
        showError('Verkeerd wachtwoord', 'Het huidige wachtwoord is onjuist');
      } else {
        showError('Fout bij wijzigen', error.message || 'Kon wachtwoord niet wijzigen');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDefaultCompany = async () => {
    if (!user) return;

    try {
      setSaving(true);
      await saveUserSettings(user.uid, {
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
    { id: 'account', name: 'Account', icon: User },
    ...(userRole === 'admin' ? [{ id: 'company', name: 'Bedrijf', icon: Building2 }] : []),
  ];

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Instellingen</h1>
          <p className="mt-2 text-sm text-gray-600">
            Beheer je account en voorkeuren
          </p>
        </div>
      </div>

      <div className="border-b border-gray-200">
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

      {activeTab === 'account' && (
        <div className="space-y-6">
          {/* Profile Photo */}
          <Card>
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Profielfoto
              </h2>
              <div className="flex items-center gap-6">
                <div className="relative">
                  {photoPreview ? (
                    <img
                      src={photoPreview}
                      alt="Profile"
                      className="h-24 w-24 rounded-full object-cover border-4 border-gray-200"
                    />
                  ) : (
                    <div className="h-24 w-24 rounded-full bg-primary-100 flex items-center justify-center border-4 border-gray-200">
                      <User className="h-12 w-12 text-primary-600" />
                    </div>
                  )}
                  <label
                    htmlFor="photo-upload"
                    className="absolute bottom-0 right-0 bg-primary-600 rounded-full p-2 cursor-pointer hover:bg-primary-700 transition-colors shadow-lg"
                  >
                    <Camera className="h-4 w-4 text-white" />
                    <input
                      id="photo-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoUpload}
                    />
                  </label>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-600 mb-3">
                    Upload een profielfoto (max 2MB)
                  </p>
                  {profilePhotoBase64 && profilePhotoBase64 !== photoPreview && (
                    <Button
                      onClick={handleSaveProfilePhoto}
                      disabled={saving}
                      size="sm"
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Opslaan
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Change Email */}
          <Card>
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                E-mailadres wijzigen
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nieuw e-mailadres
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="nieuw@email.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Huidig wachtwoord (ter bevestiging)
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <Button
                  onClick={handleChangeEmail}
                  disabled={saving || !newEmail || !currentPassword}
                  loading={saving}
                >
                  E-mail wijzigen
                </Button>
              </div>
            </div>
          </Card>

          {/* Change Password */}
          <Card>
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Wachtwoord wijzigen
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Huidig wachtwoord
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nieuw wachtwoord
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="••••••••"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Minimaal 6 tekens</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bevestig nieuw wachtwoord
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <Button
                  onClick={handleChangePassword}
                  disabled={saving || !currentPassword || !newPassword || !confirmPassword}
                  loading={saving}
                >
                  Wachtwoord wijzigen
                </Button>
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
                    Selecteer bedrijf
                  </label>
                  <select
                    value={selectedDefaultCompanyId}
                    onChange={(e) => setSelectedDefaultCompanyId(e.target.value)}
                    className="w-full px-3 py-2 text-sm text-gray-900 bg-white border rounded-lg border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
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
                  loading={saving}
                >
                  Standaard bedrijf opslaan
                </Button>
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary-600" />
                Co-Admins Beheren
              </h2>
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Voeg andere gebruikers toe die toegang hebben tot <strong>al jouw bedrijven</strong> met dezelfde rechten als jij.
                </p>

                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="email"
                      value={coAdminEmail}
                      onChange={(e) => setCoAdminEmail(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddCoAdmin()}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="email@voorbeeld.nl"
                    />
                  </div>
                  <Button
                    onClick={handleAddCoAdmin}
                    disabled={saving || !coAdminEmail}
                    size="sm"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Toevoegen
                  </Button>
                </div>

                {coAdmins.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-medium text-gray-700">Huidige co-admins:</p>
                    {coAdmins.map((email) => (
                      <div
                        key={email}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                      >
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-500" />
                          <span className="text-sm text-gray-900">{email}</span>
                        </div>
                        <button
                          onClick={() => handleRemoveCoAdmin(email)}
                          className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                          disabled={saving}
                          title="Verwijderen"
                        >
                          <XIcon className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {coAdmins.length === 0 && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg text-center">
                    <p className="text-sm text-gray-500">
                      Nog geen co-admins toegevoegd
                    </p>
                  </div>
                )}

                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-800">
                    <strong>Let op:</strong> Co-admins krijgen volledige toegang tot al je bedrijven, werknemers en financiële gegevens. Voeg alleen vertrouwde personen toe.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Settings;
