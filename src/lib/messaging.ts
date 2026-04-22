// Firebase Cloud Messaging (FCM) — client-side wrapper voor push notifications.
//
// Gebruikt de bestaande service worker (/service-worker.js) in plaats van
// een aparte firebase-messaging-sw.js, door de SW registration door te
// geven aan getToken().
//
// iOS Safari 16.4+ vereist dat de app als PWA is geïnstalleerd
// (Add to Home Screen, display: standalone) voordat push werkt.

import app, { db } from './firebase';
import {
  getMessaging,
  getToken,
  onMessage,
  deleteToken,
  isSupported,
  type Messaging,
  type MessagePayload,
} from 'firebase/messaging';
import {
  doc,
  setDoc,
  deleteDoc,
  collection,
  serverTimestamp,
  query,
  where,
  getDocs,
} from 'firebase/firestore';

// VAPID key: publieke helft van een keypair (private helft zit bij Firebase).
// Mag veilig in frontend code — dit is exact hoe de rest van firebase.ts ook
// publieke configs hardcoded heeft. import.meta.env wordt als override
// gebruikt indien beschikbaar tijdens build.
const VAPID_KEY =
  (import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined) ||
  'BNC4g-LWqqIwa-_yHnhM7y-aMZ0-uUYLeXPswZRQrohFFiSevJBpFJJj4uIGiuDEga0rJxPpwPgun-7mOyOdZQg';

let messagingInstance: Messaging | null = null;

/**
 * Check of push notifications technisch mogelijk zijn in deze browser.
 * Belangrijk voor iOS Safari dat alleen push ondersteunt in standalone PWA mode.
 */
export const isPushSupported = async (): Promise<boolean> => {
  try {
    if (typeof window === 'undefined') return false;
    if (!('Notification' in window)) return false;
    if (!('serviceWorker' in navigator)) return false;
    if (!('PushManager' in window)) return false;
    return await isSupported();
  } catch {
    return false;
  }
};

/**
 * Detecteer of we op iOS zijn.
 */
export const isIos = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
};

/**
 * Detecteer of de app als PWA (standalone) draait.
 * iOS vereist dit voor push notifications.
 */
export const isStandalone = (): boolean => {
  if (typeof window === 'undefined') return false;
  // iOS gebruikt navigator.standalone, andere browsers display-mode media query
  return (
    (navigator as any).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  );
};

/**
 * Detecteer platform op basis van UA.
 */
export const detectPlatform = (): 'ios' | 'android' | 'web' => {
  if (typeof navigator === 'undefined') return 'web';
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) return 'ios';
  if (/Android/.test(navigator.userAgent)) return 'android';
  return 'web';
};

const getMessagingInstance = async (): Promise<Messaging | null> => {
  if (messagingInstance) return messagingInstance;
  if (!(await isPushSupported())) return null;
  messagingInstance = getMessaging(app);
  return messagingInstance;
};

/**
 * Vraag browser-toestemming voor notificaties.
 * MOET aangeroepen worden vanuit een user gesture (klik event).
 */
export const requestPushPermission = async (): Promise<NotificationPermission> => {
  if (!('Notification' in window)) return 'denied';
  const permission = await Notification.requestPermission();
  return permission;
};

/**
 * Haal de huidige FCM token op voor dit device.
 * Herbruikt de al geregistreerde service worker.
 */
export const getCurrentDeviceToken = async (): Promise<string | null> => {
  const messaging = await getMessagingInstance();
  if (!messaging) return null;

  try {
    // Zorg dat de SW geregistreerd is
    const registration = await navigator.serviceWorker.ready;
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    return token || null;
  } catch (error) {
    console.error('[Messaging] getToken failed:', error);
    return null;
  }
};

/**
 * Registreer het huidige device in Firestore onder users/{uid}/fcmTokens.
 * Idempotent: doc-id is de FCM token zelf, dus dubbel registreren geeft
 * gewoon een update op lastSeenAt.
 */
export const registerCurrentDeviceToken = async (uid: string): Promise<string | null> => {
  const token = await getCurrentDeviceToken();
  if (!token) return null;

  const tokenRef = doc(db, 'users', uid, 'fcmTokens', token);
  try {
    await setDoc(
      tokenRef,
      {
        token,
        platform: detectPlatform(),
        userAgent: navigator.userAgent.substring(0, 500),
        createdAt: serverTimestamp(),
        lastSeenAt: serverTimestamp(),
      },
      { merge: true }
    );
    return token;
  } catch (error) {
    console.error('[Messaging] Kon token niet opslaan in Firestore:', error);
    return null;
  }
};

/**
 * Unsubscribe dit device — token uit Firebase en uit Firestore.
 */
export const unregisterCurrentDeviceToken = async (uid: string): Promise<void> => {
  const messaging = await getMessagingInstance();
  if (!messaging) return;

  try {
    // Haal eerst de huidige token op zodat we weten welk doc te verwijderen
    const registration = await navigator.serviceWorker.ready;
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY!,
      serviceWorkerRegistration: registration,
    }).catch(() => null);

    // Revoke bij FCM
    await deleteToken(messaging).catch(() => undefined);

    // Delete uit Firestore
    if (token) {
      await deleteDoc(doc(db, 'users', uid, 'fcmTokens', token)).catch(() => undefined);
    } else {
      // Fallback: verwijder alle tokens van deze user met deze userAgent
      const q = query(
        collection(db, 'users', uid, 'fcmTokens'),
        where('userAgent', '==', navigator.userAgent.substring(0, 500))
      );
      const snap = await getDocs(q);
      await Promise.all(snap.docs.map(d => deleteDoc(d.ref).catch(() => undefined)));
    }
  } catch (error) {
    console.error('[Messaging] unregister mislukt:', error);
  }
};

/**
 * Foreground listener. Wordt aangeroepen wanneer een push binnenkomt
 * terwijl de app open is. In dat geval toont de SW de notificatie NIET
 * automatisch — jij bepaalt hier wat er gebeurt.
 */
export const onForegroundMessage = async (
  handler: (payload: MessagePayload) => void
): Promise<() => void> => {
  const messaging = await getMessagingInstance();
  if (!messaging) return () => undefined;
  return onMessage(messaging, handler);
};
