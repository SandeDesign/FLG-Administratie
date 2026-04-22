import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  MessageSquare,
  Send,
  ArrowLeft,
  Handshake,
  User,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { usePageTitle } from '../contexts/PageTitleContext';
import {
  ChatMessage,
  ChatSummary,
  ChatRole,
  ensureChat,
  subscribeChatsForUser,
  subscribeMessages,
  sendMessage,
  markChatRead,
  buildChatId,
} from '../services/chatService';
import { getUserSettings } from '../services/firebase';
import Card from '../components/ui/Card';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';

interface ContactCandidate {
  uid: string;
  email: string;
  displayName?: string;
}

const formatTime = (d?: Date) => {
  if (!d) return '';
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit' });
};

const Chat: React.FC = () => {
  const { user, userRole } = useAuth();
  const { assignedAdmins } = useApp();
  usePageTitle('Berichten');

  const [searchParams, setSearchParams] = useSearchParams();
  const role: ChatRole = userRole === 'boekhouder' ? 'boekhouder' : 'admin';

  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [contacts, setContacts] = useState<ContactCandidate[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ─── 1) Subscribe op alle chats van deze gebruiker ──────────────────────
  useEffect(() => {
    if (!user) return;
    setLoadingChats(true);
    const unsub = subscribeChatsForUser(
      user.uid,
      role,
      (list) => {
        setChats(list);
        setLoadingChats(false);
      },
      (err) => {
        setError(err.message);
        setLoadingChats(false);
      }
    );
    return () => unsub();
  }, [user, role]);

  // ─── 2) Laad mogelijke contacten (om nieuwe chat te starten) ────────────
  // Boekhouder: assignedAdmins direct uit context
  // Admin: lijst van boekhouder-emails uit eigen userSettings + uid lookup
  useEffect(() => {
    if (!user) return;
    setLoadingContacts(true);
    const load = async () => {
      try {
        if (role === 'boekhouder') {
          setContacts(
            assignedAdmins.map((a) => ({
              uid: a.userId,
              email: a.email,
              displayName: a.displayName,
            }))
          );
        } else {
          // Admin: haal eigen settings op om boekhouderEmails te krijgen,
          // dan voor elke email opzoeken welke uid die heeft (via userSettings).
          const mySettings = await getUserSettings(user.uid);
          const emails: string[] = mySettings?.boekhouderEmails || [];
          if (emails.length === 0) {
            setContacts([]);
            return;
          }
          // Voor elke boekhouder-email zoek de bijbehorende userSettings doc
          const { collection: col, getDocs: gd, query: q, where: w } = await import('firebase/firestore');
          const { db } = await import('../lib/firebase');
          const candidates: ContactCandidate[] = [];
          await Promise.all(
            emails.map(async (email) => {
              try {
                const snap = await gd(q(col(db, 'userSettings'), w('email', '==', email)));
                snap.forEach((d) => {
                  const data = d.data() as any;
                  if (data.userId) {
                    candidates.push({
                      uid: data.userId,
                      email,
                      displayName: data.displayName,
                    });
                  }
                });
              } catch (err) {
                console.warn('[Chat] lookup boekhouder email failed:', email, err);
              }
            })
          );
          setContacts(candidates);
        }
      } finally {
        setLoadingContacts(false);
      }
    };
    load();
  }, [user, role, assignedAdmins]);

  // ─── 3) URL-driven active chat (deep link via ?chat=...) ────────────────
  useEffect(() => {
    const fromUrl = searchParams.get('chat');
    if (fromUrl && fromUrl !== activeChatId) {
      setActiveChatId(fromUrl);
    }
  }, [searchParams, activeChatId]);

  // ─── 4) Subscribe op messages van de actieve chat ───────────────────────
  useEffect(() => {
    if (!activeChatId || !user) {
      setMessages([]);
      return;
    }
    setLoadingMessages(true);
    const unsub = subscribeMessages(
      activeChatId,
      (list) => {
        setMessages(list);
        setLoadingMessages(false);
        // markeer als gelezen
        markChatRead(activeChatId, role).catch(() => undefined);
      },
      (err) => {
        setError(err.message);
        setLoadingMessages(false);
      }
    );
    return () => unsub();
  }, [activeChatId, user, role]);

  // Auto-scroll naar onderkant bij nieuwe berichten
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  // ─── Handlers ───────────────────────────────────────────────────────────
  const openChat = async (contact: ContactCandidate) => {
    if (!user) return;
    const adminUid = role === 'admin' ? user.uid : contact.uid;
    const boekhouderUid = role === 'boekhouder' ? user.uid : contact.uid;
    const adminEmail = role === 'admin' ? user.email || '' : contact.email;
    const boekhouderEmail = role === 'boekhouder' ? user.email || '' : contact.email;
    const id = await ensureChat(adminUid, boekhouderUid, adminEmail, boekhouderEmail);
    setActiveChatId(id);
    const next = new URLSearchParams(searchParams);
    next.set('chat', id);
    setSearchParams(next, { replace: true });
  };

  const handleSend = async () => {
    if (!user || !activeChatId || !draft.trim()) return;
    setSending(true);
    try {
      await sendMessage(activeChatId, {
        senderId: user.uid,
        senderRole: role,
        senderName: user.email || 'Onbekend',
        text: draft.trim(),
      });
      setDraft('');
    } catch (err) {
      console.error('[Chat] send failed:', err);
      setError('Versturen mislukt');
    } finally {
      setSending(false);
    }
  };

  // Combineer contacts + bestaande chats voor de sidebar
  const chatList = useMemo(() => {
    const items: Array<{ chatId: string; label: string; subtitle: string; unread: number; lastMessage?: string; lastMessageAt?: Date; contactUid: string }> = [];
    const seen = new Set<string>();
    chats.forEach((c) => {
      const otherUid = role === 'admin' ? c.boekhouderUid : c.adminUid;
      const otherEmail = role === 'admin' ? c.boekhouderEmail : c.adminEmail;
      const unread = role === 'admin' ? c.adminUnread : c.boekhouderUnread;
      const contact = contacts.find((x) => x.uid === otherUid);
      const label = contact?.displayName || otherEmail || `Gebruiker ${otherUid.substring(0, 6)}`;
      items.push({
        chatId: c.id,
        label,
        subtitle: c.lastMessage || '(nog geen berichten)',
        unread,
        lastMessage: c.lastMessage,
        lastMessageAt: c.lastMessageAt,
        contactUid: otherUid,
      });
      seen.add(otherUid);
    });
    // Voeg contacten toe waar nog geen chat voor bestaat
    contacts.forEach((c) => {
      if (seen.has(c.uid)) return;
      const chatId = role === 'admin' ? buildChatId(user!.uid, c.uid) : buildChatId(c.uid, user!.uid);
      items.push({
        chatId,
        label: c.displayName || c.email,
        subtitle: 'Nog geen berichten',
        unread: 0,
        contactUid: c.uid,
      });
    });
    return items;
  }, [chats, contacts, role, user]);

  const activeChat = useMemo(() => chatList.find((c) => c.chatId === activeChatId), [chatList, activeChatId]);

  if (!user) return null;

  if (loadingChats && chats.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (chatList.length === 0) {
    return (
      <EmptyState
        icon={MessageSquare}
        title={role === 'admin' ? 'Nog geen boekhouders gekoppeld' : 'Nog geen administraties toegewezen'}
        description={
          role === 'admin'
            ? 'Voeg eerst een boekhouder toe via Instellingen → Boekhouders om te kunnen chatten.'
            : 'Vraag een admin om jouw e-mail toe te voegen bij Instellingen → Boekhouders.'
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="hidden lg:block">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-primary-600" />
          Berichten
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {role === 'admin'
            ? 'Real-time chat met je boekhouder(s)'
            : 'Real-time chat met je administraties'}
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 h-[calc(100vh-220px)] min-h-[500px]">
        {/* Sidebar — alleen tonen op lg of als geen chat actief op mobile */}
        <Card className={`${activeChatId ? 'hidden lg:block' : ''} overflow-hidden`}>
          <div className="p-3 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {role === 'admin' ? 'Boekhouders' : 'Administraties'}
            </h2>
            {loadingContacts && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Laden…</p>
            )}
          </div>
          <div className="overflow-y-auto h-[calc(100%-50px)]">
            {chatList.map((c) => (
              <button
                key={c.chatId}
                onClick={() => openChat({ uid: c.contactUid, email: c.label })}
                className={`w-full p-3 flex items-start gap-3 text-left border-b border-gray-100 dark:border-gray-700 transition-colors ${
                  activeChatId === c.chatId
                    ? 'bg-primary-50 dark:bg-primary-900/30'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                <div className="h-10 w-10 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center flex-shrink-0">
                  {role === 'admin' ? (
                    <User className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                  ) : (
                    <Handshake className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {c.label}
                    </p>
                    {c.lastMessageAt && (
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 flex-shrink-0">
                        {formatTime(c.lastMessageAt)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                    {c.subtitle}
                  </p>
                </div>
                {c.unread > 0 && (
                  <span className="bg-primary-600 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 flex-shrink-0">
                    {c.unread}
                  </span>
                )}
              </button>
            ))}
          </div>
        </Card>

        {/* Conversation pane */}
        <Card className={`${!activeChatId ? 'hidden lg:flex' : 'flex'} flex-col overflow-hidden`}>
          {!activeChatId ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-gray-500 dark:text-gray-400">
                <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Selecteer een gesprek om te starten</p>
              </div>
            </div>
          ) : (
            <>
              <div className="p-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3">
                <button
                  onClick={() => {
                    setActiveChatId(null);
                    const next = new URLSearchParams(searchParams);
                    next.delete('chat');
                    setSearchParams(next, { replace: true });
                  }}
                  className="lg:hidden p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                </button>
                <div className="h-8 w-8 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center flex-shrink-0">
                  {role === 'admin' ? (
                    <User className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                  ) : (
                    <Handshake className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {activeChat?.label || 'Gesprek'}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Real-time via Firestore
                  </p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50/50 dark:bg-gray-900/20">
                {loadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <LoadingSpinner />
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-center text-xs text-gray-500 dark:text-gray-400 py-8">
                    Stuur het eerste bericht om dit gesprek te starten.
                  </p>
                ) : (
                  messages.map((m) => {
                    const isMine = m.senderId === user.uid;
                    return (
                      <div
                        key={m.id}
                        className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                            isMine
                              ? 'bg-primary-600 text-white rounded-br-sm'
                              : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-sm border border-gray-200 dark:border-gray-700'
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{m.text}</p>
                          <p
                            className={`text-[10px] mt-1 ${
                              isMine ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'
                            }`}
                          >
                            {formatTime(m.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-3 border-t border-gray-100 dark:border-gray-700 flex gap-2">
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Schrijf een bericht…"
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:border-primary-500"
                  disabled={sending}
                />
                <button
                  onClick={handleSend}
                  disabled={sending || !draft.trim()}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors flex items-center gap-1 text-sm font-medium"
                >
                  <Send className="h-4 w-4" />
                  <span className="hidden sm:inline">Verstuur</span>
                </button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Chat;
