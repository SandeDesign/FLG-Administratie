import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { InternalProject } from '../types/internalProject';

const COLLECTION = 'internalProjects';

const convertTimestamps = (data: Record<string, unknown>): InternalProject => {
  const converted = { ...data } as Record<string, unknown>;
  if (converted.createdAt && typeof (converted.createdAt as Timestamp).toDate === 'function') {
    converted.createdAt = (converted.createdAt as Timestamp).toDate();
  }
  if (converted.updatedAt && typeof (converted.updatedAt as Timestamp).toDate === 'function') {
    converted.updatedAt = (converted.updatedAt as Timestamp).toDate();
  }
  return converted as unknown as InternalProject;
};

export const getInternalProjects = async (
  userId: string,
  companyId: string,
  includeInactive = false
): Promise<InternalProject[]> => {
  const conditions = [
    where('userId', '==', userId),
    where('companyId', '==', companyId),
  ];

  if (!includeInactive) {
    conditions.push(where('isActive', '==', true));
  }

  const q = query(
    collection(db, COLLECTION),
    ...conditions,
    orderBy('name', 'asc')
  );

  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...convertTimestamps(d.data() as Record<string, unknown>), id: d.id }));
};

export const createInternalProject = async (
  project: Omit<InternalProject, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  const now = Timestamp.now();
  const ref = await addDoc(collection(db, COLLECTION), {
    ...project,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
};

export const updateInternalProject = async (
  id: string,
  updates: Partial<Omit<InternalProject, 'id' | 'userId' | 'companyId' | 'createdAt'>>
): Promise<void> => {
  await updateDoc(doc(db, COLLECTION, id), {
    ...updates,
    updatedAt: Timestamp.now(),
  });
};

export const deleteInternalProject = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, COLLECTION, id));
};
