// Shared push-sending logica voor zowel HTTP (send-push) als scheduled
// reminders. Haalt FCM tokens op uit users/{uid}/fcmTokens subcollectie,
// stuurt naar alle tokens via sendEachForMulticast, en verwijdert dode
// tokens bij 'registration-token-not-registered' / 'invalid-argument'.

import { getDb, getMessaging } from './firebaseAdmin';

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  taskId?: string;
  category?: string;
  tag?: string;
}

/**
 * Alle tokens ophalen voor één user uit Firestore subcollectie.
 */
const fetchTokensForUser = async (uid: string): Promise<Array<{ token: string; docPath: string }>> => {
  const db = getDb();
  const snap = await db.collection('users').doc(uid).collection('fcmTokens').get();
  return snap.docs.map(d => ({
    token: (d.data().token as string) || d.id,
    docPath: d.ref.path,
  }));
};

/**
 * Verwijder een token-doc als Firebase de token als ongeldig markeert.
 */
const deleteDeadToken = async (docPath: string) => {
  try {
    await getDb().doc(docPath).delete();
  } catch (e) {
    console.warn('[Push] kon dead token niet verwijderen:', docPath, e);
  }
};

/**
 * Stuur een push naar één of meerdere users. Returns aantal succesvolle sends.
 */
export const sendPushToUsers = async (
  userIds: string[],
  payload: PushPayload
): Promise<{ sent: number; failed: number; deletedTokens: number }> => {
  const messaging = getMessaging();

  // Dedupliceer userIds
  const uniqueUids = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueUids.length === 0) {
    return { sent: 0, failed: 0, deletedTokens: 0 };
  }

  // Verzamel alle tokens parallel
  const tokenSets = await Promise.all(uniqueUids.map(fetchTokensForUser));
  const allTokenEntries = tokenSets.flat();

  if (allTokenEntries.length === 0) {
    return { sent: 0, failed: 0, deletedTokens: 0 };
  }

  const tokens = allTokenEntries.map(t => t.token);

  // Deel op in batches van 500 (FCM limiet voor sendEachForMulticast)
  let totalSent = 0;
  let totalFailed = 0;
  let totalDeleted = 0;

  const notification = {
    title: payload.title,
    body: payload.body,
  };

  const data: Record<string, string> = {
    url: payload.url || '/',
  };
  if (payload.taskId) data.taskId = payload.taskId;
  if (payload.category) data.category = payload.category;

  for (let i = 0; i < tokens.length; i += 500) {
    const batchTokens = tokens.slice(i, i + 500);
    const batchEntries = allTokenEntries.slice(i, i + 500);

    try {
      const response = await messaging.sendEachForMulticast({
        tokens: batchTokens,
        notification,
        data,
        webpush: {
          fcmOptions: {
            link: payload.url || '/',
          },
          notification: {
            icon: '/Logo-192.png',
            badge: '/Logo-192.png',
            tag: payload.tag || payload.category || 'flg',
          },
        },
        apns: {
          headers: {
            'apns-priority': '10',
          },
          payload: {
            aps: {
              sound: 'default',
            },
          },
        },
      });

      totalSent += response.successCount;
      totalFailed += response.failureCount;

      // Cleanup dode tokens
      if (response.failureCount > 0) {
        const cleanupPromises: Promise<void>[] = [];
        response.responses.forEach((res, idx) => {
          if (!res.success && res.error) {
            const code = res.error.code;
            const isDead =
              code === 'messaging/registration-token-not-registered' ||
              code === 'messaging/invalid-registration-token' ||
              code === 'messaging/invalid-argument';
            if (isDead) {
              cleanupPromises.push(deleteDeadToken(batchEntries[idx].docPath));
              totalDeleted++;
            } else {
              console.warn('[Push] send error:', code, res.error.message);
            }
          }
        });
        await Promise.all(cleanupPromises);
      }
    } catch (err) {
      console.error('[Push] Batch verzenden mislukt:', err);
      totalFailed += batchTokens.length;
    }
  }

  return { sent: totalSent, failed: totalFailed, deletedTokens: totalDeleted };
};
