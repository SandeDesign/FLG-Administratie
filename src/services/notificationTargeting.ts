// Hulpfuncties om notificatie-ontvangers te bepalen.
//
// BusinessTask.assignedTo bevat historisch een mix van employee Firestore
// document-IDs en user UIDs. Voor push notifications moeten we altijd de
// user UID hebben (want die is de key van de fcmTokens subcollectie).

import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';

/**
 * Resolve een array met IDs (mix van employee doc-IDs en user UIDs) naar
 * alleen user UIDs. Elke ID die overeenkomt met een user-doc via
 * `employeeId` veld wordt vervangen met de user UID. IDs die al een UID
 * zijn blijven ongemoeid.
 *
 * @param ids Mix van employee doc-IDs en user UIDs
 * @returns Deduplicated lijst van user UIDs
 */
export const resolveToUserUids = async (ids: string[]): Promise<string[]> => {
  if (!ids || ids.length === 0) return [];

  const cleaned = Array.from(new Set(ids.filter(Boolean)));
  const result = new Set<string>();

  // Firestore 'in' query supports max 30 values per chunk
  for (let i = 0; i < cleaned.length; i += 30) {
    const chunk = cleaned.slice(i, i + 30);

    // Zoek users-docs waar employeeId in deze chunk staat
    const q = query(collection(db, 'users'), where('employeeId', 'in', chunk));
    const snap = await getDocs(q);

    const matchedEmployeeIds = new Set<string>();
    snap.docs.forEach(d => {
      const data = d.data();
      const uid = (data.uid as string) || '';
      const empId = data.employeeId as string | undefined;
      if (uid) result.add(uid);
      if (empId) matchedEmployeeIds.add(empId);
    });

    // IDs in de chunk die GEEN employee match hadden behandelen we als UIDs
    chunk.forEach(id => {
      if (!matchedEmployeeIds.has(id)) {
        result.add(id);
      }
    });
  }

  return Array.from(result);
};

/**
 * Vind de UID(s) die de "opdrachtgever" zijn van een taak:
 * de taak-eigenaar (`userId`) + de maker (`createdBy`) indien verschillend.
 */
export const getTaskOwnerUids = (task: { userId?: string; createdBy?: string }): string[] => {
  const uids = new Set<string>();
  if (task.userId) uids.add(task.userId);
  if (task.createdBy && task.createdBy !== task.userId) uids.add(task.createdBy);
  return Array.from(uids);
};
