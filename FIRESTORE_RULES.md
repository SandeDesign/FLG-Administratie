# 🔥 FIRESTORE REGELS - VERPLICHT LEZEN

## ⚠️ KRITIEKE REGEL #1: NOOIT UNDEFINED NAAR FIRESTORE

**Firestore accepteert GEEN `undefined` waarden!**

Dit zorgt voor errors zoals:
```
FirebaseError: Function addDoc() called with invalid data.
Unsupported field value: undefined
```

## ✅ ALTIJD DOEN

### 1. Gebruik `removeUndefinedValues` helper OVERAL

**VOOR ELKE Firestore write operatie:**

```typescript
import { removeUndefinedValues } from './helpers';

// ❌ FOUT - Direct naar Firestore
await addDoc(collection(db, 'tasks'), taskData);

// ✅ GOED - Eerst undefined waarden verwijderen
const cleanData = removeUndefinedValues(taskData);
await addDoc(collection(db, 'tasks'), cleanData);
```

### 2. removeUndefinedValues Helper

Deze helper staat in `/src/services/firebase.ts`:

```typescript
const removeUndefinedValues = (obj: any): any => {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(removeUndefinedValues);
  }

  const cleaned: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleaned[key] = removeUndefinedValues(value);
    }
  }
  return cleaned;
};
```

### 3. Gebruik optionele velden correct

```typescript
// ❌ FOUT
const data = {
  title: 'Test',
  description: undefined,  // NOOIT undefined toewijzen!
  notes: undefined,
};

// ✅ GOED - Gebruik spread operator of alleen gedefinieerde velden
const data = {
  title: 'Test',
  ...(description && { description }), // Alleen toevoegen als het bestaat
};

// Of met object filter:
const data = removeUndefinedValues({
  title: 'Test',
  description,
  notes,
});
```

## 📝 CHECKLIST VOOR ELKE NIEUWE FIRESTORE FUNCTIE

- [ ] Gebruikt `removeUndefinedValues()` voor `addDoc()`
- [ ] Gebruikt `removeUndefinedValues()` voor `updateDoc()`
- [ ] Gebruikt `removeUndefinedValues()` voor `setDoc()`
- [ ] Geen directe `undefined` assignments in objecten
- [ ] Optional velden gebruiken spread operator of worden gefilterd
- [ ] Timestamp conversie gebeurt VOOR undefined filtering

## 🏗️ STANDAARD PATROON

```typescript
export const createEntity = async (userId: string, data: any) => {
  try {
    const now = new Date();

    const newEntity = {
      ...data,
      userId,
      createdAt: now,
      updatedAt: now,
    };

    // STAP 1: Converteer timestamps
    const withTimestamps = convertToTimestamps(newEntity);

    // STAP 2: Verwijder undefined waarden - ALTIJD!
    const cleanData = removeUndefinedValues(withTimestamps);

    // STAP 3: Naar Firestore
    const docRef = await addDoc(collection(db, 'entities'), cleanData);

    return docRef.id;
  } catch (error) {
    console.error('Error creating entity:', error);
    throw error;
  }
};
```

## 🚨 COMMON MISTAKES

### Mistake #1: Optional parameters
```typescript
// ❌ FOUT
function saveTask(title: string, description?: string) {
  return {
    title,
    description,  // Dit is undefined als niet meegegeven!
  };
}

// ✅ GOED
function saveTask(title: string, description?: string) {
  return removeUndefinedValues({
    title,
    description,
  });
}
```

### Mistake #2: Partial updates
```typescript
// ❌ FOUT
const updates = {
  title: newTitle,
  description: newDescription,  // Kan undefined zijn!
};
await updateDoc(docRef, updates);

// ✅ GOED
const updates = removeUndefinedValues({
  title: newTitle,
  description: newDescription,
});
await updateDoc(docRef, updates);
```

### Mistake #3: Nested objects
```typescript
// ❌ FOUT
const data = {
  user: {
    name: 'Test',
    email: undefined,  // Nested undefined!
  }
};

// ✅ GOED
const data = removeUndefinedValues({
  user: {
    name: 'Test',
    email: userEmail,
  }
});
```

## 📚 WAAR removeUndefinedValues AL WORDT GEBRUIKT

✅ `src/services/firebase.ts` - Alle basis CRUD operaties
✅ `src/services/auditService.ts` - Audit logging
⚠️ **Check altijd nieuwe services!**

## 🎯 TL;DR

**GEBRUIK ALTIJD `removeUndefinedValues()` VOOR JE DATA NAAR FIRESTORE STUURT!**

Dit voorkomt 99% van alle Firestore errors in dit project.

---

**Laatste update:** 2024-12-28
**Aantal keer deze fout gemaakt:** Te vaak 😅
**Aantal keer deze fout nog maken:** 0️⃣
