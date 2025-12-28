# Interne Flow Analyse - FLG Administratie

## 📋 Overzicht
Dit document analyseert de interne business logic flows van de applicatie: bedrijven aanmaken, inladen, profiel management, en data persistence.

---

## 🏢 1. COMPANY CREATION FLOW

### Huidige Flow (CompanyModal.tsx → firebase.ts)

```
1. User opent CompanyModal
2. Selecteert bedrijfstype: employer, project, of holding
3. Als project/holding → selecteert primaryEmployerId
4. Vult bedrijfsgegevens in:
   - Basis: naam, KvK, BTW, bankrekening, factuurprefix
   - Adres: straat, postcode, plaats, land
   - Contact: email, telefoon, website
   - Theme & Logo (base64)
5. Voor EMPLOYER companies: ook HR settings (CAO, reiskosten, vakantietoeslag, etc.)
6. Submit → createCompany(adminUserId, companyData)
7. Data wordt opgeslagen in Firestore companies collection
```

### Data Structure
```typescript
{
  name, kvk, taxNumber, bankAccount, invoicePrefix,
  companyType: 'employer' | 'project' | 'holding',
  primaryEmployerId?: string, // alleen voor project/holding
  themeColor: string,
  logoUrl: string, // base64 encoded
  address: { street, city, zipCode, country },
  contactInfo: { email, phone, website },
  settings: { ... }, // ALLEEN voor employer
  userId: string, // eigenaar (admin)
  createdAt: Date,
  updatedAt: Date
}
```

### ✅ WAT GOED IS:
- CompanyType wordt correct gebruikt
- PrimaryEmployerId wordt alleen toegevoegd als het een value heeft
- Settings worden alleen opgeslagen voor employer companies
- Validatie voor project companies (moet primaryEmployerId hebben)

### ⚠️ PROBLEMEN & VERBETERINGEN:

#### **PROBLEEM 1: Logo als Base64 (Document Size Limit)**
```typescript
// HUIDIG (CompanyModal.tsx:181)
logoUrl: logoPreview || '', // base64 string
```
**Risico:** Firestore heeft 1MB document size limit. Grote logos kunnen dit overschrijden.
**Impact:** ⭐⭐⭐⭐ (HIGH) - Company creation kan crashen
**Oplossing:** Upload naar Firebase Storage, sla alleen URL op
```typescript
// BETER:
const logoUrl = await uploadLogoToStorage(logoFile, companyId);
companyData.logoUrl = logoUrl; // https://storage.googleapis.com/...
```

#### **PROBLEEM 2: Geen Validatie PrimaryEmployerId**
```typescript
// HUIDIG (CompanyModal.tsx:205)
if ((data.companyType === 'project' || data.companyType === 'holding') && data.primaryEmployerId) {
  companyData.primaryEmployerId = data.primaryEmployerId;
}
```
**Risico:** User kan een primaryEmployerId selecteren die niet meer bestaat
**Impact:** ⭐⭐⭐ (MEDIUM) - Orphaned references
**Oplossing:** Valideer of company bestaat voordat opslaan
```typescript
if (data.primaryEmployerId) {
  const primaryEmployer = await getCompanyById(data.primaryEmployerId);
  if (!primaryEmployer) throw new Error('Primary employer niet gevonden');
  companyData.primaryEmployerId = data.primaryEmployerId;
}
```

#### **PROBLEEM 3: InvoicePrefix Duplicaten**
```typescript
// HUIDIG (CompanyModal.tsx:178)
invoicePrefix: data.invoicePrefix || '',
```
**Risico:** Meerdere bedrijven kunnen dezelfde prefix hebben → duplicate factuurnummers
**Impact:** ⭐⭐⭐⭐ (HIGH) - Verwarring in administratie
**Oplossing:** Valideer uniciteit binnen admin's companies
```typescript
if (data.invoicePrefix) {
  const existing = await getCompaniesByPrefix(adminUserId, data.invoicePrefix);
  if (existing.length > 0 && existing[0].id !== company?.id) {
    throw new Error('Deze prefix wordt al gebruikt');
  }
}
```

#### **PROBLEEM 4: Undefined Values**
```typescript
// HUIDIG (CompanyModal.tsx:173-202)
const companyData: any = { ... }
```
**Risico:** Kan undefined fields bevatten → Firestore error
**Impact:** ⭐⭐⭐⭐⭐ (CRITICAL) - Je hebt dit al 559 keer gehad
**Oplossing:** Gebruik removeUndefinedValues() overal
```typescript
const companyData = removeUndefinedValues({
  name: data.name,
  kvk: data.kvk,
  // ... etc
});
await createCompany(adminUserId, companyData);
```

---

## 📥 2. COMPANY LOADING FLOW

### Huidige Flow (AuthContext.tsx → AppContext.tsx → firebase.ts)

```
LOGIN:
1. User logt in → onAuthStateChanged()
2. getUserRole(user.uid) → { role, employeeId, assignedCompanyId }
3. Bepaal adminUserId:
   - Admin → check primaryAdminUserId in userSettings
     - Als co-admin: gebruik primary admin's UID
     - Als primary admin: gebruik eigen UID
   - Manager → gebruik eigen UID
   - Employee → haal userId van employee doc

APP LOAD:
4. AppContext.loadData() getriggerd
5. Voor MANAGER:
   - Laad assignedCompany via getCompanyById(assignedCompanyId)
   - Bepaal companyOwnerUserId = company.userId
   - Set queryUserId = companyOwnerUserId (voor data queries)
   - Voor PROJECT companies: laad ALLE employees (filter client-side)
   - Voor EMPLOYER companies: laad employees.filter(companyId)
6. Voor ADMIN/EMPLOYEE:
   - Laad alle companies via getCompanies(adminUserId)
   - Laad alle employees via getEmployees(adminUserId)
   - Laad alle branches via getBranches(adminUserId)
   - Set queryUserId = adminUserId
7. Filter companies op visibleCompanyIds (admin only)
8. Selecteer default company:
   - Admin: userSettings.defaultCompanyId
   - Fallback: localStorage
   - Fallback: eerste company
9. Apply theme color van selected company
10. Calculate dashboard stats (alleen voor admin)
```

### ✅ WAT GOED IS:
- Scheiding tussen admin/manager/employee flows
- queryUserId wordt correct gezet voor andere pagina's
- Co-admin flow via primaryAdminUserId werkt
- Theme color wordt dynamisch toegepast
- Duplicate loading wordt voorkomen met isLoadingRef

### ⚠️ PROBLEMEN & VERBETERINGEN:

#### **PROBLEEM 5: Inefficiënte Data Loading voor Project Companies**
```typescript
// HUIDIG (AppContext.tsx:165-169)
if (isProjectCompany) {
  // Load ALL employees - they'll be filtered by workCompanies/projectCompanies in the pages
  employeesData = await getEmployees(companyOwnerUserId);
  branchesData = await getBranches(companyOwnerUserId);
}
```
**Risico:** Bij 1000+ employees worden ze ALLEMAAL geladen
**Impact:** ⭐⭐⭐⭐ (HIGH) - Traag, veel Firestore reads
**Oplossing:** Server-side filtering met array-contains query
```typescript
// BETER:
const q = query(
  collection(db, 'employees'),
  where('userId', '==', companyOwnerUserId),
  where('workCompanies', 'array-contains', company.id)
);
```

#### **PROBLEEM 6: Dashboard Stats = Veel Reads**
```typescript
// HUIDIG (AppContext.tsx:61-85)
const pendingLeaveRequests = await Promise.all(
  companiesData.map(company => getPendingLeaveApprovals(company.id, userId))
);
const pendingTimesheets = await Promise.all(
  companiesData.map(company => getPendingTimesheets(userId, company.id))
);
```
**Risico:** Voor 10 companies = 30+ Firestore queries (leaves, timesheets, expenses)
**Impact:** ⭐⭐⭐⭐ (HIGH) - Duur in Firestore reads
**Oplossing:** Aggregatie collection of cache results
```typescript
// BETER: Cache dashboard stats
const statsRef = doc(db, 'dashboardStats', adminUserId);
const cachedStats = await getDoc(statsRef);
if (cachedStats.exists() && isFresh(cachedStats.data().updatedAt)) {
  return cachedStats.data();
}
// ... bereken stats en sla op
```

#### **PROBLEEM 7: VisibleCompanyIds Filter TE LAAT**
```typescript
// HUIDIG (AppContext.tsx:210-220)
// Filter companies based on user's visibleCompanyIds setting
if (userRole === 'admin' && user) {
  const userSettings = await getUserSettings(user.uid);
  const visibleIds = userSettings?.visibleCompanyIds;
  if (visibleIds && Array.isArray(visibleIds) && visibleIds.length > 0) {
    companiesData = companiesData.filter(c => visibleIds.includes(c.id));
  }
}
```
**Risico:** Alle companies worden geladen, daarna gefilterd
**Impact:** ⭐⭐⭐ (MEDIUM) - Onnodige reads voor invisible companies
**Oplossing:** Filter in query met where('__name__', 'in', visibleIds)
```typescript
// BETER:
const visibleIds = userSettings?.visibleCompanyIds;
if (visibleIds && visibleIds.length > 0) {
  const q = query(
    collection(db, 'companies'),
    where('userId', '==', adminUserId),
    where('__name__', 'in', visibleIds)
  );
  companiesData = await getDocs(q);
}
```

#### **PROBLEEM 8: Default Company = 3 Bronnen**
```typescript
// HUIDIG (AppContext.tsx:228-243)
// 1. userSettings.defaultCompanyId
// 2. localStorage.defaultCompany_${adminUserId}
// 3. companiesData[0]
```
**Risico:** localStorage en userSettings kunnen out of sync raken
**Impact:** ⭐⭐ (LOW) - User moet elke keer opnieuw selecteren
**Oplossing:** Gebruik ALLEEN userSettings, verwijder localStorage fallback
```typescript
// BETER:
const defaultCompanyId = userSettings?.defaultCompanyId;
const companyToSelect = defaultCompanyId
  ? companiesData.find(c => c.id === defaultCompanyId)
  : companiesData[0];
setSelectedCompany(companyToSelect);
// Geen localStorage meer!
```

---

## 👤 3. PROFILE MANAGEMENT FLOW

### Account Creation (AuthContext.tsx signUp)
```
1. User vult email, password, displayName in
2. createUserWithEmailAndPassword() in Firebase Auth
3. updateProfile({ displayName })
4. createUserRole(uid, 'admin', undefined, { firstName, lastName, email })
   - Maakt user doc in 'users' collection
5. setUserRole('admin')
```

### Profile Updates (Settings.tsx)
```
EMAIL WIJZIGEN:
1. User vult nieuw email + huidig wachtwoord in
2. reauthenticateWithCredential(credential)
3. updateEmail(user, newEmail)
4. Toast success

WACHTWOORD WIJZIGEN:
1. User vult huidig wachtwoord + nieuw wachtwoord 2x in
2. reauthenticateWithCredential(credential)
3. updatePassword(user, newPassword)
4. Toast success

PROFIELFOTO:
1. User upload foto (max 2MB)
2. FileReader.readAsDataURL() → base64
3. saveUserSettings(uid, { profilePhoto: base64 })

DEFAULT COMPANY:
1. User selecteert bedrijf uit dropdown
2. saveUserSettings(uid, { defaultCompanyId })

FAVORIETE PAGINA'S:
1. User selecteert pagina's (per bedrijf)
2. Haalt huidige favoritePages op (object)
3. Update favoritePages[companyId] = selectedPages
4. saveUserSettings(uid, { favoritePages })

BOTTOM NAV:
1. User kiest 3 iconen (per bedrijf)
2. Map iconen naar BottomNavItem[] met href/label/gradient
3. Update bottomNavItems[companyId] = items
4. saveUserSettings(uid, { bottomNavItems })
```

### Co-Admin Creation (Settings.tsx)
```
1. Admin voert co-admin email in
2. createFirebaseUser(email, 'DeInstallatie1234!!')
   - Cloud function maakt Firebase Auth account
3. Als nieuw account:
   - Maak doc in 'users' collection: { uid, role: 'admin', email }
   - Maak doc in 'userSettings': {
       email,
       primaryAdminUserId: currentAdmin.uid,
       primaryAdminEmail: currentAdmin.email
     }
4. Add email to admin's coAdminEmails array
5. saveUserSettings(adminUid, { coAdminEmails })
```

### ✅ WAT GOED IS:
- Reauthenticatie voor sensitive changes (email/wachtwoord)
- Co-admin krijgt direct link naar primary admin via primaryAdminUserId
- Favorieten en bottom nav zijn per bedrijf (goede scheiding)
- Profile photo validatie (max 2MB)

### ⚠️ PROBLEMEN & VERBETERINGEN:

#### **PROBLEEM 9: Profielfoto als Base64**
```typescript
// HUIDIG (Settings.tsx:213-218)
const reader = new FileReader();
reader.onloadend = () => {
  const base64 = reader.result as string;
  setProfilePhotoBase64(base64);
};
await saveUserSettings(user.uid, { profilePhoto: base64 });
```
**Risico:** 2MB foto = ~2.7MB base64 → te groot voor Firestore doc (1MB limit)
**Impact:** ⭐⭐⭐⭐⭐ (CRITICAL) - Kan niet opslaan
**Oplossing:** Resize + compress client-side, of gebruik Storage
```typescript
// BETER:
const resized = await resizeImage(file, 200, 200); // max 200x200px
const base64 = await compressImage(resized, 0.7); // 70% quality
// Of nog beter: upload to Firebase Storage
const url = await uploadToStorage(file, `profiles/${user.uid}`);
```

#### **PROBLEEM 10: FavoritePages Inconsistentie**
```typescript
// HUIDIG (Settings.tsx:78-80)
const favoritePagesObj = favoritePages && typeof favoritePages === 'object' && !Array.isArray(favoritePages)
  ? favoritePages
  : {};
```
**Risico:** favoritePages kan array OF object zijn → data corruptie
**Impact:** ⭐⭐⭐ (MEDIUM) - Favorieten verdwijnen
**Oplossing:** Migratie script + strict typing
```typescript
// Migration:
if (Array.isArray(favoritePages)) {
  // Oud formaat: array → converteer naar object met default company
  const defaultCompanyId = companies[0]?.id;
  if (defaultCompanyId) {
    favoritePages = { [defaultCompanyId]: favoritePages };
  }
}
```

#### **PROBLEEM 11: Hardcoded Co-Admin Wachtwoord**
```typescript
// HUIDIG (Settings.tsx:113)
const result = await createFirebaseUser(coAdminEmail, 'DeInstallatie1234!!');
```
**Risico:** Alle co-admins hebben hetzelfde wachtwoord → security risk
**Impact:** ⭐⭐⭐⭐ (HIGH) - Security issue
**Oplossing:** Genereer random wachtwoord + stuur password reset email
```typescript
// BETER:
const randomPassword = generateSecurePassword(); // 16 chars, random
const result = await createFirebaseUser(coAdminEmail, randomPassword);
// Stuur direct password reset email
await sendPasswordResetEmail(auth, coAdminEmail);
success('Uitnodiging verzonden', `${coAdminEmail} heeft een email ontvangen om wachtwoord in te stellen`);
```

#### **PROBLEEM 12: Co-Admin Cleanup**
```typescript
// HUIDIG (Settings.tsx:172-186)
const handleRemoveCoAdmin = async (email: string) => {
  const newCoAdmins = coAdmins.filter(e => e !== email);
  await saveUserSettings(user.uid, { coAdminEmails: newCoAdmins });
  setCoAdmins(newCoAdmins);
}
```
**Risico:** Co-admin's userSettings blijft primaryAdminUserId bevatten
**Impact:** ⭐⭐ (LOW) - Co-admin kan nog steeds inloggen
**Oplossing:** Verwijder ook primaryAdminUserId uit co-admin's settings
```typescript
// BETER:
const coAdminUid = await getUserUidByEmail(email);
if (coAdminUid) {
  await updateDoc(doc(db, 'userSettings', coAdminUid), {
    primaryAdminUserId: deleteField(),
    primaryAdminEmail: deleteField()
  });
}
```

---

## 💾 4. DATA PERSISTENCE PATTERNS

### Huidige Patronen

#### Pattern 1: Direct Firestore Writes in Components
```typescript
// HUIDIG (Settings.tsx:320-329)
const handleSaveDefaultCompany = async () => {
  await saveUserSettings(user.uid, { defaultCompanyId: selectedDefaultCompanyId });
}
```
**Probleem:** Business logic in UI components
**Impact:** ⭐⭐⭐ (MEDIUM) - Moeilijk te testen/hergebruiken

#### Pattern 2: Service Layer (firebase.ts)
```typescript
// GOED (firebase.ts)
export const createCompany = async (adminUserId: string, companyData: Omit<Company, 'id'>) => {
  // ... business logic here
}
```
**Voordeel:** Centralized business logic

#### Pattern 3: removeUndefinedValues() - INCONSISTENT
```typescript
// ALLEEN in auditService.ts
const cleanData = removeUndefinedValues(data);
await addDoc(collection(db, 'auditLogs'), cleanData);

// NIET in andere services!
await setDoc(doc(db, 'companies', id), companyData); // KAN undefined bevatten!
```
**Probleem:** Niet consistent toegepast
**Impact:** ⭐⭐⭐⭐⭐ (CRITICAL) - 559x undefined errors

#### Pattern 4: Base64 Encoding voor Images
```typescript
logoUrl: string, // base64
profilePhoto: string, // base64
```
**Probleem:** Firestore 1MB document limit
**Impact:** ⭐⭐⭐⭐ (HIGH) - Kan niet opslaan

#### Pattern 5: Timestamp Conversions
```typescript
// convertTimestamps() in firebase.ts
if (field instanceof Timestamp) {
  result[key] = field.toDate();
}
```
**Voordeel:** Consistent Date handling

#### Pattern 6: localStorage als Fallback
```typescript
localStorage.setItem(`defaultCompany_${adminUserId}`, companyId);
```
**Probleem:** Kan out of sync met Firestore
**Impact:** ⭐⭐ (LOW) - Verwarrend voor user

### ⚠️ VERBETERINGEN:

#### **VERBETERING 1: removeUndefinedValues() OVERAL**
```typescript
// Maak een wrapper voor alle Firestore writes:
const safeSetDoc = async (ref: DocumentReference, data: any) => {
  const cleaned = removeUndefinedValues(data);
  return setDoc(ref, cleaned);
};

const safeUpdateDoc = async (ref: DocumentReference, data: any) => {
  const cleaned = removeUndefinedValues(data);
  return updateDoc(ref, cleaned);
};

// Gebruik in alle services:
await safeSetDoc(doc(db, 'companies', id), companyData);
```

#### **VERBETERING 2: Migreer naar Firebase Storage voor Images**
```typescript
// Upload functie:
export const uploadImage = async (
  file: File,
  path: string
): Promise<string> => {
  const storage = getStorage();
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
};

// Gebruik:
const logoUrl = await uploadImage(logoFile, `companies/${companyId}/logo`);
companyData.logoUrl = logoUrl; // URL ipv base64
```

#### **VERBETERING 3: Validatie Laag**
```typescript
// Maak validators voor elk entity type:
export const validateCompany = (data: Partial<Company>): string[] => {
  const errors: string[] = [];

  if (!data.name || data.name.trim().length === 0) {
    errors.push('Bedrijfsnaam is verplicht');
  }

  if (data.companyType === 'project' && !data.primaryEmployerId) {
    errors.push('Project bedrijf moet een primary employer hebben');
  }

  // ... meer validatie

  return errors;
};

// Gebruik voor save:
const errors = validateCompany(companyData);
if (errors.length > 0) throw new Error(errors.join(', '));
```

#### **VERBETERING 4: Transaction Support**
```typescript
// Voor complex saves met meerdere docs:
export const createCompanyWithAudit = async (adminUserId: string, companyData: any) => {
  const batch = writeBatch(db);

  const companyRef = doc(collection(db, 'companies'));
  batch.set(companyRef, removeUndefinedValues(companyData));

  const auditRef = doc(collection(db, 'auditLogs'));
  batch.set(auditRef, removeUndefinedValues({
    action: 'CREATE_COMPANY',
    companyId: companyRef.id,
    userId: adminUserId,
    timestamp: new Date()
  }));

  await batch.commit();
  return companyRef.id;
};
```

---

## 📊 PRIORITERING VAN FIXES

### 🔴 CRITICAL (Doe NU):
1. **removeUndefinedValues() overal** (⭐⭐⭐⭐⭐)
   - Wrap alle Firestore writes
   - Voorkomt 559 undefined errors

2. **Base64 Images naar Storage** (⭐⭐⭐⭐⭐)
   - Logo's en profielfoto's
   - Voorkomt document size limit errors

### 🟡 HIGH (Deze week):
3. **InvoicePrefix Validatie** (⭐⭐⭐⭐)
   - Voorkomt duplicate factuurnummers

4. **Inefficiënte Queries Fixen** (⭐⭐⭐⭐)
   - Project company employees filtering
   - Dashboard stats aggregatie
   - VisibleCompanyIds in query

5. **Co-Admin Wachtwoord** (⭐⭐⭐⭐)
   - Random password + reset email
   - Security fix

### 🟢 MEDIUM (Deze maand):
6. **PrimaryEmployerId Validatie** (⭐⭐⭐)
   - Check of company bestaat

7. **FavoritePages Migratie** (⭐⭐⭐)
   - Array naar Object conversie

8. **Default Company Cleanup** (⭐⭐)
   - Verwijder localStorage gebruik

---

## 💡 ALGEMENE AANBEVELINGEN

### 1. **Consistente Error Handling**
```typescript
// Momenteel:
try { ... } catch (error) { console.error(error); }

// Beter:
try {
  ...
} catch (error) {
  console.error('[CompanyService] Error creating company:', error);
  AuditService.logError('CREATE_COMPANY', error, { companyData });
  throw new AppError('Kon bedrijf niet aanmaken', error);
}
```

### 2. **Type Safety**
```typescript
// Gebruik strict types ipv any:
const companyData: any = { ... }; // ❌
const companyData: CreateCompanyInput = { ... }; // ✅
```

### 3. **Business Logic Layer**
```typescript
// Verplaats business logic van components naar services:
// ❌ Settings.tsx:handleSaveDefaultCompany
// ✅ userService.ts:setDefaultCompany(userId, companyId)
```

### 4. **Data Normalization**
```typescript
// Voor vaak gebruikte data (zoals company info in employees):
// Overweeg denormalization met sync mechanisme
// OF gebruik Firestore subcollections voor better queries
```

---

## 🎯 CONCLUSIE

De huidige flows werken functioneel, maar hebben **performance en data integrity risico's**:

**Grootste Risico's:**
1. Undefined values → crasht app (559x gehad!)
2. Base64 images → kan niet opslaan (document size limit)
3. Inefficiënte queries → duur in Firestore costs
4. Geen validatie → orphaned references en duplicates
5. Hardcoded passwords → security risk

**Snelste Wins:**
1. removeUndefinedValues() wrapper (1 uur werk, voorkomt 90% crashes)
2. Image resize/compress (2 uur werk, lost size limit op)
3. InvoicePrefix uniqueness check (30 min werk, voorkomt admin chaos)

**Impact Overzicht:**
- 🔴 CRITICAL fixes → voorkomt app crashes (5-10 uur werk)
- 🟡 HIGH fixes → bespaart €50-100/maand Firestore costs (8-12 uur werk)
- 🟢 MEDIUM fixes → betere UX, minder support tickets (4-6 uur werk)

**Totaal:** ~20-30 uur werk voor significante verbetering in stabiliteit en kosten.
