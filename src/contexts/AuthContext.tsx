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
import { auth, db } from '../lib/firebase';
import { useToast } from '../hooks/useToast';
import { getUserRole, getEmployeeById } from '../services/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  doc, 
  addDoc, 
  Timestamp 
} from 'firebase/firestore';

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

  // Enhanced createUserRole function
  const createUserRole = async (
    uid: string, 
    role: 'admin' | 'manager' | 'employee', 
    employeeId?: string,
    email?: string,
    displayName?: string
  ): Promise<void> => {
    const roleData = {
      uid,
      role,
      employeeId: employeeId || null,
      email: email || '',
      displayName: displayName || '',
      isActive: true,
      createdAt: Timestamp.fromDate(new Date()),
      updatedAt: Timestamp.fromDate(new Date())
    };
    
    await addDoc(collection(db, 'users'), roleData);
  };

  // Enhanced updateLastLogin function
  const updateLastLogin = async (uid: string): Promise<void> => {
    const q = query(
      collection(db, 'users'),
      where('uid', '==', uid)
    );

    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const userDoc = querySnapshot.docs[0];
      await updateDoc(doc(db, 'users', userDoc.id), {
        lastLoginAt: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date())
      });
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);

      if (user) {
        try {
          const roleData = await getUserRole(user.uid);
          setUserRole(roleData?.role || null);
          setCurrentEmployeeId(roleData?.employeeId || null);

          // Handle admin, manager, and employee roles properly
          if (roleData?.role === 'admin') {
            setAdminUserId(user.uid);
          } else if ((roleData?.role === 'employee' || roleData?.role === 'manager') && roleData?.employeeId) {
            // Both employee and manager roles need employeeId and should find their admin
            const employeeDoc = await getEmployeeById(roleData.employeeId);
            if (employeeDoc) {
              setAdminUserId(employeeDoc.userId);
            } else {
              setAdminUserId(null);
            }
          } else {
            setAdminUserId(null);
          }

          // Update last login time
          await updateLastLogin(user.uid);
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

      // Create user role with enhanced function
      await createUserRole(user.uid, 'admin', undefined, email, displayName);
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
      success('E-mail verzonden!', 'Controleer je e-mail voor instructies om je wachtwoord te resetten');
    } catch (err: any) {
      console.error('Reset password error:', err);
      let message = 'Er is een fout opgetreden bij het verzenden van de reset e-mail';

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

  const value: AuthContextType = {
    user,
    userRole,
    currentEmployeeId,
    adminUserId,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};