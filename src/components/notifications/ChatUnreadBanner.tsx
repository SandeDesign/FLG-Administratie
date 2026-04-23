import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, ArrowRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  ChatSummary,
  subscribeChatsForUser,
  sumUnread,
} from '../../services/chatService';

/**
 * Compact dashboard-banner die verschijnt zodra er ongelezen chat-berichten
 * zijn voor de huidige gebruiker. Klikken navigeert naar de chatpagina.
 */
const ChatUnreadBanner: React.FC = () => {
  const { user, userRole, adminUserId } = useAuth();
  const navigate = useNavigate();
  const [chats, setChats] = useState<ChatSummary[]>([]);

  const role = userRole === 'boekhouder' ? 'boekhouder' : 'admin';
  const isEligible = userRole === 'admin' || userRole === 'co-admin' || userRole === 'boekhouder';
  // Admin + co-admin delen chat-threads → query onder primary adminUid
  const subjectUid = role === 'boekhouder' ? user?.uid : (adminUserId || user?.uid);

  useEffect(() => {
    if (!user || !isEligible || !subjectUid) return;
    const unsub = subscribeChatsForUser(subjectUid, role, setChats);
    return () => unsub();
  }, [user, role, isEligible, subjectUid]);

  if (!isEligible) return null;

  const unread = sumUnread(chats, role);
  if (unread === 0) return null;

  const chatPath = userRole === 'boekhouder' ? '/boekhouder/chat' : '/chat';

  return (
    <button
      onClick={() => navigate(chatPath)}
      className="w-full flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-primary-50 to-primary-100 dark:from-primary-900/30 dark:to-primary-800/30 border border-primary-200 dark:border-primary-700 hover:from-primary-100 hover:to-primary-200 dark:hover:from-primary-900/40 dark:hover:to-primary-800/40 transition-colors text-left group"
    >
      <div className="relative">
        <div className="h-10 w-10 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0">
          <MessageSquare className="h-5 w-5 text-white" />
        </div>
        <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
          {unread > 99 ? '99+' : unread}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-primary-900 dark:text-primary-100">
          {unread === 1 ? '1 nieuw bericht' : `${unread} nieuwe berichten`}
        </p>
        <p className="text-xs text-primary-700 dark:text-primary-300">
          Klik om je gesprekken te openen
        </p>
      </div>
      <ArrowRight className="h-5 w-5 text-primary-600 dark:text-primary-400 flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
    </button>
  );
};

export default ChatUnreadBanner;
