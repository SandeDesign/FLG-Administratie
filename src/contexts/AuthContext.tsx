import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useToast } from '../hooks/useToast';
import { 
  getUserProfile, 
  createUserProfile, 
  getDefaultCompany,
  createDefaultCompany 
} from '../services/firebase';

// NIEUWE CLEAN USER ROLLEN
export type UserRole = 'system_admin' | 'company_admin' | 'manager' | 'employee';

// BEDRIJF TYPES  
export type CompanyType = 'werkmaatschappij' | 'houdmaatschappij';

// USER PROFILE - alle users zijn ook employees
export interface UserProfile {
  id: string;                    // Firebase Auth UID
  email: string;
  displayName: string;
  role: UserRole;                // Hoofdrol in systeem
  
  // Employee gegevens (alle users hebben dit)
  employeeNumber?: string;
  firstName: string;
  lastName: string;
  phone?: string;
  address?: string;
  
  // Company relaties
  primaryCompanyId: string;      // Hoofdbedrijf waar user werkt
  managedCompanyIds: string[];   // Bedrijven die user beheert (als admin/manager)
  
  // Metadata
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// BEDRIJF STRUCTUUR
export interface Company {
  id: string;
  name: string;
  type: CompanyType;
  kvkNumber?: string;
  vatNumber?: string;
  address?: string;
  
  // Hiërarchie
  parentCompanyId?: string;      // Voor werkmaatschappijen onder houdmaatschappij
  isDefault: boolean;            // True voor "Buddy BV"
  
  // Beheer
  adminUserIds: string[];        // Company admins die dit bedrijf beheren
  managerUserIds: string[];      // Managers binnen dit bedrijf
  
  // Metadata
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  currentCompany: Company | null;
  managedCompanies: Company[];
  loading: boolean;
  
  // Auth methods
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string, firstName: string, lastName: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  
  // Profile methods
  updateUserProfile: (updates: Partial<UserProfile>) => Promise<void>;
  switchCompany: (companyId: string) => Promise<void>;
  
  // Permission helpers
  isSystemAdmin: () => boolean;
  isCompanyAdmin: (companyId?: string) => boolean;
  isManager: (companyId?: string) => boolean;
  canManageUsers: (companyId?: string) => boolean;
  canManageCompany: (companyId: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const [managedCompanies, setManagedCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const { success, error } = useToast();

  // Load user profile en company data
  const loadUserData = async (firebaseUser: User) => {
    try {
      // Haal user profile op
      let profile = await getUserProfile(firebaseUser.uid);
      
      // Als geen profile bestaat, maak dan standaard profile aan
      if (!profile) {
        // Krijg of maak default company (Buddy BV)
        const defaultCompany = await getDefaultCompany();
        
        profile = await createUserProfile({
          id: firebaseUser.uid,
          email: firebaseUser.email!,
          displayName: firebaseUser.displayName || 'Nieuwe Gebruiker',
          role: 'employee', // Start als employee
          firstName: firebaseUser.displayName?.split(' ')[0] || 'Nieuwe',
          lastName: firebaseUser.displayName?.split(' ').slice(1).join(' ') || 'Gebruiker',
          primaryCompanyId: defaultCompany.id,
          managedCompanyIds: [],
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
      
      setUserProfile(profile);
      
      // Load current company
      const { getCompany, getCompaniesByAdminUser } = await import('../services/firebase');
      const company = await getCompany(profile.primaryCompanyId);
      setCurrentCompany(company);
      
      // Load managed companies
      const managed = await getCompaniesByAdminUser(profile.id);
      setManagedCompanies(managed);
      
    } catch (err) {
      console.error('Error loading user data:', err);
      error('Fout bij laden', 'Kon gebruikersgegevens niet laden');
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        await loadUserData(firebaseUser);
      } else {
        setUserProfile(null);
        setCurrentCompany(null);
        setManagedCompanies([]);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      success('Welkom terug!', 'Je bent succesvol ingelogd');
    } catch (err: any) {
      console.error('Sign in error:', err);
      let message = 'Er is een fout opgetreden bij het inloggen';

      switch (err.code) {
        case 'auth/user-not-found':
          message = 'Geen account gevonden met dit e-mailadres';
          break;
        case 'auth/wrong-password':
          message = 'Onjuist wachtwoord';
          break;
        case 'auth/invalid-email':
          message = 'Ongeldig e-mailadres';
          break;
        case 'auth/too-many-requests':
          message = 'Te veel pogingen. Probeer het later opnieuw';
          break;
        default:
          message = err.message;
          break;
      }

      error('Inloggen mislukt', message);
      throw err;
    }
  };

  const signUp = async (
    email: string, 
    password: string, 
    displayName: string,
    firstName: string,
    lastName: string
  ) => {
    try {
      const { user: newUser } = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(newUser, { displayName });

      // Eerste user wordt system admin, andere worden employee
      const { getSystemAdminCount } = await import('../services/firebase');
      const adminCount = await getSystemAdminCount();
      const role: UserRole = adminCount === 0 ? 'system_admin' : 'employee';

      // Krijg default company
      const defaultCompany = await getDefaultCompany();

      // Maak user profile
      const profile = await createUserProfile({
        id: newUser.uid,
        email,
        displayName,
        role,
        firstName,
        lastName,
        primaryCompanyId: defaultCompany.id,
        managedCompanyIds: role === 'system_admin' ? [defaultCompany.id] : [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      setUserProfile(profile);
      success('Account aangemaakt!', `Welkom ${firstName}! Je account is succesvol aangemaakt.`);
    } catch (err: any) {
      console.error('Sign up error:', err);
      let message = 'Er is een fout opgetreden bij het aanmaken van je account';

      switch (err.code) {
        case 'auth/email-already-in-use':
          message = 'Er bestaat al een account met dit e-mailadres';
          break;
        case 'auth/invalid-email':
          message = 'Ongeldig e-mailadres';
          break;
        case 'auth/weak-password':
          message = 'Wachtwoord is te zwak. Gebruik minimaal 6 karakters';
          break;
        default:
          message = err.message;
          break;
      }

      error('Registratie mislukt', message);
      throw err;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setUserProfile(null);
      setCurrentCompany(null);
      setManagedCompanies([]);
      success('Tot ziens!', 'Je bent uitgelogd');
    } catch (err: any) {
      console.error('Sign out error:', err);
      error('Uitloggen mislukt', 'Er is een fout opgetreden');
      throw err;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      success('E-mail verzonden!', 'Controleer je inbox voor de reset link');
    } catch (err: any) {
      console.error('Password reset error:', err);
      let message = 'Er is een fout opgetreden bij het versturen van de reset e-mail';

      switch (err.code) {
        case 'auth/user-not-found':
          message = 'Geen account gevonden met dit e-mailadres';
          break;
        case 'auth/invalid-email':
          message = 'Ongeldig e-mailadres';
          break;
        default:
          message = err.message;
          break;
      }

      error('Reset mislukt', message);
      throw err;
    }
  };

  const updateUserProfile = async (updates: Partial<UserProfile>) => {
    if (!userProfile) return;

    try {
      const { updateUserProfile: updateProfile } = await import('../services/firebase');
      const updatedProfile = await updateProfile(userProfile.id, updates);
      setUserProfile(updatedProfile);
      success('Profiel bijgewerkt', 'Je wijzigingen zijn opgeslagen');
    } catch (err) {
      console.error('Update profile error:', err);
      error('Update mislukt', 'Kon profiel niet bijwerken');
      throw err;
    }
  };

  const switchCompany = async (companyId: string) => {
    if (!userProfile) return;

    try {
      // Check of user toegang heeft tot dit bedrijf
      if (
        userProfile.primaryCompanyId !== companyId &&
        !userProfile.managedCompanyIds.includes(companyId) &&
        userProfile.role !== 'system_admin'
      ) {
        throw new Error('Geen toegang tot dit bedrijf');
      }

      const { getCompany } = await import('../services/firebase');
      const company = await getCompany(companyId);
      
      if (!company) {
        throw new Error('Bedrijf niet gevonden');
      }

      setCurrentCompany(company);
      success('Bedrijf gewijzigd', `Je werkt nu in ${company.name}`);
    } catch (err) {
      console.error('Switch company error:', err);
      error('Wissel mislukt', 'Kon niet wisselen van bedrijf');
      throw err;
    }
  };

  // Permission helpers
  const isSystemAdmin = () => userProfile?.role === 'system_admin';
  
  const isCompanyAdmin = (companyId?: string) => {
    if (userProfile?.role === 'system_admin') return true;
    if (userProfile?.role !== 'company_admin') return false;
    
    if (companyId) {
      return userProfile.managedCompanyIds.includes(companyId);
    }
    
    return userProfile.managedCompanyIds.length > 0;
  };

  const isManager = (companyId?: string) => {
    if (isSystemAdmin() || isCompanyAdmin(companyId)) return true;
    if (userProfile?.role !== 'manager') return false;
    
    if (companyId) {
      return userProfile.primaryCompanyId === companyId || 
             userProfile.managedCompanyIds.includes(companyId);
    }
    
    return true;
  };

  const canManageUsers = (companyId?: string) => {
    return isSystemAdmin() || isCompanyAdmin(companyId) || isManager(companyId);
  };

  const canManageCompany = (companyId: string) => {
    if (isSystemAdmin()) return true;
    return userProfile?.managedCompanyIds.includes(companyId) || false;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        currentCompany,
        managedCompanies,
        loading,
        signIn,
        signUp,
        signOut,
        resetPassword,
        updateUserProfile,
        switchCompany,
        isSystemAdmin,
        isCompanyAdmin,
        isManager,
        canManageUsers,
        canManageCompany,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};