// Chat service — real-time chat tussen admin en boekhouder via Firestore
//
// Datamodel (Firestore):
//   chats/{chatId}                     ← summary doc
//     adminUid, boekhouderUid, adminEmail, boekhouderEmail
//     lastMessage, lastMessageAt, lastSenderId
//     adminUnread, boekhouderUnread    ← per-rol unread counter
//     createdAt, updatedAt
//   chats/{chatId}/messages/{messageId}
//     senderId, senderRole, senderName, text, createdAt
//
// chatId = `${adminUid}_${boekhouderUid}` (deterministisch zodat beide
// partijen dezelfde doc kunnen vinden zonder eerst te zoeken).

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
  getDocs,
  Unsubscribe,
  Timestamp,
  increment,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export type ChatRole = 'admin' | 'boekhouder';

export interface ChatSummary {
  id: string;
  adminUid: string;
  boekhouderUid: string;
  adminEmail?: string;
  boekhouderEmail?: string;
  lastMessage?: string;
  lastMessageAt?: Date;
  lastSenderId?: string;
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

export const buildChatId = (adminUid: string, boekhouderUid: string) =>
  `${adminUid}_${boekhouderUid}`;

/**
 * Initialiseer een chat summary doc als die nog niet bestaat. Idempotent.
 */
export const ensureChat = async (
  adminUid: string,
  boekhouderUid: string,
  adminEmail?: string,
  boekhouderEmail?: string
): Promise<string> => {
  const chatId = buildChatId(adminUid, boekhouderUid);
  const ref = doc(db, 'chats', chatId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      adminUid,
      boekhouderUid,
      adminEmail: adminEmail || '',
      boekhouderEmail: boekhouderEmail || '',
      lastMessage: '',
      lastMessageAt: null,
      lastSenderId: null,
      adminUnread: 0,
      boekhouderUnread: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } else if ((adminEmail || boekhouderEmail) && (!snap.data()?.adminEmail || !snap.data()?.boekhouderEmail)) {
    // Patch missing email fields als die nu wel bekend zijn.
    await updateDoc(ref, {
      adminEmail: adminEmail || snap.data()?.adminEmail || '',
      boekhouderEmail: boekhouderEmail || snap.data()?.boekhouderEmail || '',
      updatedAt: serverTimestamp(),
    });
  }
  return chatId;
};

/**
 * Subscribe op alle chats voor een gebruiker. Voor een admin: chats waar
 * adminUid === uid. Voor een boekhouder: chats waar boekhouderUid === uid.
 * Calls callback elke keer als data wijzigt. Returnt Unsubscribe.
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
          adminUid: data.adminUid,
          boekhouderUid: data.boekhouderUid,
          adminEmail: data.adminEmail,
          boekhouderEmail: data.boekhouderEmail,
          lastMessage: data.lastMessage,
          lastMessageAt: tsToDate(data.lastMessageAt),
          lastSenderId: data.lastSenderId,
          adminUnread: data.adminUnread || 0,
          boekhouderUnread: data.boekhouderUnread || 0,
          createdAt: tsToDate(data.createdAt),
          updatedAt: tsToDate(data.updatedAt),
        };
      });
      // Sorteer op lastMessageAt desc (recentste eerst). null/undefined onderaan.
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
 * Verstuur een bericht. Update ook de summary doc met lastMessage en
 * verhoogt de unread teller voor de andere partij.
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

  // Verhoog unread voor de andere partij
  const unreadField = message.senderRole === 'admin' ? 'boekhouderUnread' : 'adminUnread';

  await updateDoc(chatRef, {
    lastMessage: message.text,
    lastMessageAt: serverTimestamp(),
    lastSenderId: message.senderId,
    [unreadField]: increment(1),
    updatedAt: serverTimestamp(),
  });
};

/**
 * Reset de unread counter voor de huidige rol. Aanroepen wanneer de chat
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
    // chat doesn't exist yet — niet erg
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
