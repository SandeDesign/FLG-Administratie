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
import { getUserRole, getEmployeeById } from '../services/firebase';

interface AuthContextType {
  user: User | null;
  userRole: string | null;
  currentEmployeeId: string | null;
  adminUserId: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [currentEmployeeId, setCurrentEmployeeId] = useState<string | null>(null);
  const [adminUserId, setAdminUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { success, error } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);

      if (user) {
        try {
          const roleData = await getUserRole(user.uid);
          setUserRole(roleData?.role || null);
          setCurrentEmployeeId(roleData?.employeeId || null);

          if (roleData?.role === 'admin') {
            setAdminUserId(user.uid);
          } else if (roleData?.role === 'employee' && roleData?.employeeId) {
            const employeeDoc = await getEmployeeById(roleData.employeeId);
            if (employeeDoc) {
              setAdminUserId(employeeDoc.userId);
            } else {
              setAdminUserId(null);
            }
          } else {
            setAdminUserId(null);
          }
        } catch (err) {
          console.error('Error loading user role:', err);
          setUserRole(null);
          setCurrentEmployeeId(null);
          setAdminUserId(null);
        }
      } else {
        setUserRole(null);
        setCurrentEmployeeId(null);
        setAdminUserId(null);
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

  const signUp = async (email: string, password: string, displayName: string) => {
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(user, { displayName });

      const { createUserRole } = await import('../services/firebase');
      await createUserRole(user.uid, 'admin');
      setUserRole('admin');

      success('Account aangemaakt!', 'Je kunt nu beginnen met het beheren van je loonadministratie');
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
      setUserRole(null);
      setCurrentEmployeeId(null);
      setAdminUserId(null);
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

  return (
    <AuthContext.Provider
      value={{
        user,
        userRole,
        currentEmployeeId,
        adminUserId,
        loading,
        signIn,
        signUp,
        signOut,
        resetPassword,
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