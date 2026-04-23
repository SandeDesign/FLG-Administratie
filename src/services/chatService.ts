// Chat service — real-time chat per BEDRIJF tussen admin-team en boekhouder.
//
// Datamodel (Firestore):
//   chats/{chatId}                     ← summary doc
//     companyId, companyName, adminUid, boekhouderUid
//     adminEmail, boekhouderEmail      ← optioneel, voor display
//     lastMessage, lastMessageAt, lastSenderId, lastSenderName
//     adminUnread, boekhouderUnread    ← per-kant gedeelde teller
//     createdAt, updatedAt
//   chats/{chatId}/messages/{messageId}
//     senderId, senderRole, senderName, text, createdAt
//
// chatId = `${companyId}_${boekhouderUid}` — 1 thread per bedrijf per
// boekhouder. Alle admins (primary + co-admins) binnen hetzelfde admin-team
// delen dezelfde thread, want adminUid in het doc = PRIMARY admin uid.

import {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit as fsLimit,
  onSnapshot,
  addDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  getDoc,
  Unsubscribe,
  increment,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export type ChatRole = 'admin' | 'boekhouder';

export interface ChatSummary {
  id: string;
  companyId: string;
  companyName: string;
  adminUid: string;
  boekhouderUid: string;
  adminEmail?: string;
  boekhouderEmail?: string;
  lastMessage?: string;
  lastMessageAt?: Date;
  lastSenderId?: string;
  lastSenderName?: string;
  adminUnread: number;
  boekhouderUnread: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderRole: ChatRole;
  senderName: string;
  text: string;
  createdAt?: Date;
}

const tsToDate = (v: any): Date | undefined => {
  if (!v) return undefined;
  if (v instanceof Date) return v;
  if (v?.toDate) return v.toDate();
  return undefined;
};

export const buildChatId = (companyId: string, boekhouderUid: string) =>
  `${companyId}_${boekhouderUid}`;

/**
 * Initialiseer een chat summary doc als die nog niet bestaat. Idempotent.
 * `adminUid` is de PRIMARY admin van het bedrijf; co-admins gebruiken
 * diezelfde UID zodat ze dezelfde thread delen.
 */
export const ensureChat = async (
  params: {
    companyId: string;
    companyName: string;
    adminUid: string;
    boekhouderUid: string;
    adminEmail?: string;
    boekhouderEmail?: string;
  }
): Promise<string> => {
  const chatId = buildChatId(params.companyId, params.boekhouderUid);
  const ref = doc(db, 'chats', chatId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      companyId: params.companyId,
      companyName: params.companyName,
      adminUid: params.adminUid,
      boekhouderUid: params.boekhouderUid,
      adminEmail: params.adminEmail || '',
      boekhouderEmail: params.boekhouderEmail || '',
      lastMessage: '',
      lastMessageAt: null,
      lastSenderId: null,
      lastSenderName: '',
      adminUnread: 0,
      boekhouderUnread: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } else {
    // Patch ontbrekende velden zodat oude threads consistent blijven
    const data = snap.data() as any;
    const patch: any = {};
    if (!data.companyName && params.companyName) patch.companyName = params.companyName;
    if (!data.adminEmail && params.adminEmail) patch.adminEmail = params.adminEmail;
    if (!data.boekhouderEmail && params.boekhouderEmail)
      patch.boekhouderEmail = params.boekhouderEmail;
    if (Object.keys(patch).length > 0) {
      patch.updatedAt = serverTimestamp();
      await updateDoc(ref, patch);
    }
  }
  return chatId;
};

/**
 * Subscribe op alle chats voor een gebruiker. Admin/co-admin: pass de
 * PRIMARY admin uid zodat team-shared chats worden meegenomen.
 */
export const subscribeChatsForUser = (
  uid: string,
  role: ChatRole,
  callback: (chats: ChatSummary[]) => void,
  onError?: (err: Error) => void
): Unsubscribe => {
  const field = role === 'admin' ? 'adminUid' : 'boekhouderUid';
  const q = query(collection(db, 'chats'), where(field, '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const chats: ChatSummary[] = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          companyId: data.companyId,
          companyName: data.companyName || '',
          adminUid: data.adminUid,
          boekhouderUid: data.boekhouderUid,
          adminEmail: data.adminEmail,
          boekhouderEmail: data.boekhouderEmail,
          lastMessage: data.lastMessage,
          lastMessageAt: tsToDate(data.lastMessageAt),
          lastSenderId: data.lastSenderId,
          lastSenderName: data.lastSenderName,
          adminUnread: data.adminUnread || 0,
          boekhouderUnread: data.boekhouderUnread || 0,
          createdAt: tsToDate(data.createdAt),
          updatedAt: tsToDate(data.updatedAt),
        };
      });
      chats.sort((a, b) => {
        const at = a.lastMessageAt?.getTime() || 0;
        const bt = b.lastMessageAt?.getTime() || 0;
        return bt - at;
      });
      callback(chats);
    },
    (err) => {
      console.error('[chatService] subscribeChatsForUser error:', err);
      onError?.(err);
    }
  );
};

/**
 * Subscribe op messages binnen één chat (oudste eerst).
 */
export const subscribeMessages = (
  chatId: string,
  callback: (messages: ChatMessage[]) => void,
  onError?: (err: Error) => void,
  max: number = 200
): Unsubscribe => {
  const q = query(
    collection(db, 'chats', chatId, 'messages'),
    orderBy('createdAt', 'asc'),
    fsLimit(max)
  );
  return onSnapshot(
    q,
    (snap) => {
      const messages: ChatMessage[] = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          senderId: data.senderId,
          senderRole: data.senderRole,
          senderName: data.senderName || '',
          text: data.text || '',
          createdAt: tsToDate(data.createdAt),
        };
      });
      callback(messages);
    },
    (err) => {
      console.error('[chatService] subscribeMessages error:', err);
      onError?.(err);
    }
  );
};

/**
 * Verstuur een bericht + update summary (last message + unread counter
 * voor de andere kant).
 */
export const sendMessage = async (
  chatId: string,
  message: Omit<ChatMessage, 'id' | 'createdAt'>
): Promise<void> => {
  const chatRef = doc(db, 'chats', chatId);
  const messagesCol = collection(db, 'chats', chatId, 'messages');

  await addDoc(messagesCol, {
    senderId: message.senderId,
    senderRole: message.senderRole,
    senderName: message.senderName,
    text: message.text,
    createdAt: serverTimestamp(),
  });

  const unreadField = message.senderRole === 'admin' ? 'boekhouderUnread' : 'adminUnread';

  await updateDoc(chatRef, {
    lastMessage: message.text,
    lastMessageAt: serverTimestamp(),
    lastSenderId: message.senderId,
    lastSenderName: message.senderName,
    [unreadField]: increment(1),
    updatedAt: serverTimestamp(),
  });
};

/**
 * Reset de unread teller voor de actieve rol. Aanroepen wanneer de chat
 * wordt geopend.
 */
export const markChatRead = async (
  chatId: string,
  role: ChatRole
): Promise<void> => {
  const ref = doc(db, 'chats', chatId);
  const field = role === 'admin' ? 'adminUnread' : 'boekhouderUnread';
  try {
    await updateDoc(ref, {
      [field]: 0,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    // chat bestaat nog niet — niet erg
    console.warn('[chatService] markChatRead failed:', err);
  }
};

/**
 * Helper: totaal unread voor een rol over al diens chats.
 */
export const sumUnread = (chats: ChatSummary[], role: ChatRole): number => {
  const field = role === 'admin' ? 'adminUnread' : 'boekhouderUnread';
  return chats.reduce((sum, c) => sum + ((c as any)[field] || 0), 0);
};
