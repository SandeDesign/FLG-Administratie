import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getPrimaryAdminForCoAdmin } from '../services/firebase';

/**
 * Returns the effective userId to use for Firestore queries
 * - For primary admin: returns their own user.uid
 * - For co-admin: returns the primary admin's user.uid
 * - For manager/employee: returns adminUserId from AuthContext
 *
 * This ensures co-admins see all data from the primary admin.
 */
export const useEffectiveUserId = (): string | null => {
  const { user, userRole, adminUserId } = useAuth();
  const [effectiveUserId, setEffectiveUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const determineEffectiveUserId = async () => {
      if (!user) {
        setEffectiveUserId(null);
        setLoading(false);
        return;
      }

      // For admin role, check if they're a co-admin
      if (userRole === 'admin' && user.email) {
        const primaryAdminUserId = await getPrimaryAdminForCoAdmin(user.email);
        if (primaryAdminUserId) {
          // This user is a co-admin - use primary admin's UID
          setEffectiveUserId(primaryAdminUserId);
        } else {
          // This user is a primary admin - use their own UID
          setEffectiveUserId(user.uid);
        }
      } else {
        // For manager/employee, use adminUserId from AuthContext
        setEffectiveUserId(adminUserId);
      }

      setLoading(false);
    };

    determineEffectiveUserId();
  }, [user, userRole, adminUserId, user?.email]);

  return effectiveUserId;
};
