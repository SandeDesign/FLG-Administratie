import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface DarkModeContextType {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  setDarkMode: (value: boolean) => void;
}

const DarkModeContext = createContext<DarkModeContextType | undefined>(undefined);

export const DarkModeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load dark mode preference from localStorage en Firestore
  useEffect(() => {
    const loadDarkModePreference = async () => {
      try {
        // 1. Check localStorage first (sneller)
        const localPref = localStorage.getItem('darkMode');
        if (localPref !== null) {
          const darkModeEnabled = localPref === 'true';
          setIsDarkMode(darkModeEnabled);
          applyDarkMode(darkModeEnabled);
        }

        // 2. Als user is ingelogd, haal preference op uit Firestore
        if (user) {
          const userSettingsRef = doc(db, 'userSettings', user.uid);
          const userSettingsDoc = await getDoc(userSettingsRef);

          if (userSettingsDoc.exists()) {
            const data = userSettingsDoc.data();
            if (data.darkMode !== undefined) {
              setIsDarkMode(data.darkMode);
              applyDarkMode(data.darkMode);
              // Sync met localStorage
              localStorage.setItem('darkMode', data.darkMode.toString());
            }
          }
        }
      } catch (error) {
        console.error('Error loading dark mode preference:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDarkModePreference();
  }, [user]);

  const applyDarkMode = (enabled: boolean) => {
    if (enabled) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const setDarkMode = async (value: boolean) => {
    setIsDarkMode(value);
    applyDarkMode(value);

    // Save to localStorage
    localStorage.setItem('darkMode', value.toString());

    // Save to Firestore if user is logged in
    if (user) {
      try {
        const userSettingsRef = doc(db, 'userSettings', user.uid);
        const userSettingsDoc = await getDoc(userSettingsRef);

        if (userSettingsDoc.exists()) {
          await updateDoc(userSettingsRef, {
            darkMode: value,
          });
        } else {
          await setDoc(userSettingsRef, {
            darkMode: value,
          });
        }
      } catch (error) {
        console.error('Error saving dark mode preference:', error);
      }
    }
  };

  const toggleDarkMode = () => {
    setDarkMode(!isDarkMode);
  };

  return (
    <DarkModeContext.Provider value={{ isDarkMode, toggleDarkMode, setDarkMode }}>
      {children}
    </DarkModeContext.Provider>
  );
};

export const useDarkMode = () => {
  const context = useContext(DarkModeContext);
  if (context === undefined) {
    throw new Error('useDarkMode must be used within a DarkModeProvider');
  }
  return context;
};
