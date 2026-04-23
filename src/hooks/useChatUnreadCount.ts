import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  ChatSummary,
  subscribeChatsForUser,
  sumUnread,
} from '../services/chatService';

/**
 * Real-time totaal aantal ongelezen chatberichten voor de huidige gebruiker.
 * Admin + co-admin delen dezelfde threads (gequeried onder primary adminUid).
 * Returnt 0 als de gebruiker geen chat-rol heeft.
 */
export const useChatUnreadCount = (): number => {
  const { user, userRole, adminUserId } = useAuth();
  const [chats, setChats] = useState<ChatSummary[]>([]);

  const role = userRole === 'boekhouder' ? 'boekhouder' : 'admin';
  const isEligible = userRole === 'admin' || userRole === 'co-admin' || userRole === 'boekhouder';
  const subjectUid = role === 'boekhouder' ? user?.uid : (adminUserId || user?.uid);

  useEffect(() => {
    if (!user || !isEligible || !subjectUid) {
      setChats([]);
      return;
    }
    const unsub = subscribeChatsForUser(subjectUid, role, setChats);
    return () => unsub();
  }, [user, role, isEligible, subjectUid]);

  if (!isEligible) return 0;
  return sumUnread(chats, role);
};
