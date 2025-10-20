// Just add these missing functions to your EXISTING firebase.ts
// Don't replace the whole file, just add these at the bottom

// Add these missing getUserRole and createUserRole functions that AuthContext needs:

export const getUserRole = async (userId: string) => {
  try {
    // First check if there's a user in the old users collection
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      return {
        role: userData.role || 'admin',
        employeeId: userData.employeeId || null
      };
    }

    // If no user doc exists, create one with admin role (first user)
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const isFirstUser = usersSnapshot.size === 0;
    
    const newUserData = {
      role: isFirstUser ? 'admin' : 'employee',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await setDoc(doc(db, 'users', userId), convertToTimestamps(newUserData));
    
    return {
      role: newUserData.role,
      employeeId: null
    };
  } catch (error) {
    console.error('Error getting user role:', error);
    return null;
  }
};

export const createUserRole = async (userId: string, role: string) => {
  try {
    const userData = {
      role,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const cleanedData = removeUndefinedValues(convertToTimestamps(userData));
    await setDoc(doc(db, 'users', userId), cleanedData);
  } catch (error) {
    console.error('Error creating user role:', error);
    throw error;
  }
};

// Add missing imports at the top if they don't exist:
import { setDoc } from 'firebase/firestore';