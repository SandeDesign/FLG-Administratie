# Firestore Database Schema - Complete Audit

**Gegenereerd op:** 2025-12-28
**Doel:** Complete documentatie van alle Firestore collecties, velden, types en relaties

---

## 📋 Overzicht Collecties

| Collectie | Doel | Relaties |
|-----------|------|----------|
| `users` | Gebruikersaccounts (admin, manager, employee) | → companies (via userId) |
| `companies` | Bedrijven (employer, project, holding) | → users, employees, branches |
| `branches` | Vestigingen/afdelingen | → companies |
| `employees` | Werknemers | → companies, branches, users |
| `timeEntries` | Urenregistraties | → employees, companies |
| `leaveRequests` | Verlofaanvragen | → employees, companies |
| `absenceRecords` | Ziekte/verzuim | → employees, companies |
| `expenses` | Declaraties | → employees, companies |
| `outgoingInvoices` | Uitgaande facturen (verkoop) | → companies |
| `incomingInvoices` | Inkomende facturen (inkoop) | → companies |
| `budgetItems` | Begroting (kosten/inkomsten) | → companies |
| `businessTasks` | Taken/checklists | → users, companies |
| `auditLogs` | Audit trail | → users, companies, all entities |
| `userSettings` | Gebruikersinstellingen | → users, companies |

---

## 1️⃣ Collection: `companies`

**Type:** `Company`
**Primaire key:** `id` (string, auto-generated)

### Velden:

| Veld | Type | Required | Beschrijving |
|------|------|----------|--------------|
| `id` | string | ✅ | Firestore document ID |
| `userId` | string | ✅ | Eigenaar/admin van bedrijf |
| `name` | string | ✅ | Bedrijfsnaam |
| `kvk` | string | ✅ | KVK nummer |
| `taxNumber` | string | ✅ | Belastingnummer |
| `companyType` | enum | ✅ | `'employer'` \| `'project'` \| `'holding'` |
| `payrollCompanyId` | string | ❌ | Verwijzing naar loonmaatschappij (voor work companies) |
| `primaryEmployerId` | string | ❌ | Verwijzing naar hoofdbedrijf (voor werkmaatschappijen onder holding) |
| `allowedUsers` | string[] | ❌ | Array van user UIDs met toegang (managers/co-admins) |
| `address.street` | string | ✅ | Straat |
| `address.city` | string | ✅ | Stad |
| `address.zipCode` | string | ✅ | Postcode |
| `address.country` | string | ✅ | Land |
| `contactInfo.email` | string | ✅ | Email |
| `contactInfo.phone` | string | ✅ | Telefoon |
| `contactInfo.website` | string | ❌ | Website |
| `settings.defaultCAO` | string | ✅ | Standaard CAO |
| `settings.travelAllowancePerKm` | number | ✅ | Reiskostenvergoeding per km |
| `settings.standardWorkWeek` | number | ✅ | Standaard werkweek uren |
| `settings.holidayAllowancePercentage` | number | ✅ | Vakantiegeld percentage |
| `settings.pensionContributionPercentage` | number | ✅ | Pensioen percentage |
| `logoUrl` | string | ❌ | URL naar logo |
| `themeColor` | string | ❌ | Kleurthema (bijv. 'blue', 'green') |
| `createdAt` | Date | ✅ | Aanmaakdatum |
| `updatedAt` | Date | ✅ | Laatste wijziging |
| `mainBranchId` | string | ❌ | Hoofdvestiging ID |

### Relaties:
- **Eigenaar:** `userId` → `users.id`
- **Loonmaatschappij:** `payrollCompanyId` → `companies.id`
- **Holding:** `primaryEmployerId` → `companies.id`
- **Toegang:** `allowedUsers[]` → `users.id[]`

### Business Logic:
- **Employer companies:** Werkgevers met werknemers
- **Project companies:** Projectbedrijven onder holding
- **Holding companies:** Holdings met werkmaatschappijen (`primaryEmployerId` wijst naar holding)
- **Aandeelhouders:** Holdings zonder `primaryEmployerId` (Sandebeheer, Carlibeheer)

---

## 2️⃣ Collection: `branches`

**Type:** `Branch`
**Primaire key:** `id` (string, auto-generated)

### Velden:

| Veld | Type | Required | Beschrijving |
|------|------|----------|--------------|
| `id` | string | ✅ | Firestore document ID |
| `userId` | string | ✅ | Eigenaar |
| `companyId` | string | ✅ | Bedrijf |
| `name` | string | ✅ | Vestigingsnaam |
| `location` | string | ✅ | Locatie |
| `costCenter` | string | ✅ | Kostenplaats |
| `cao` | string | ❌ | CAO voor deze vestiging |
| `specificSettings.overtimeRate` | number | ❌ | Overwerk tarief |
| `specificSettings.irregularRate` | number | ❌ | Onregelmatigheid tarief |
| `specificSettings.shiftRate` | number | ❌ | Ploegentoeslag |
| `createdAt` | Date | ✅ | Aanmaakdatum |
| `updatedAt` | Date | ✅ | Laatste wijziging |

### Relaties:
- **Bedrijf:** `companyId` → `companies.id`
- **Eigenaar:** `userId` → `users.id`

---

## 3️⃣ Collection: `employees`

**Type:** `Employee`
**Primaire key:** `id` (string, auto-generated)

### Velden:

#### Basis:
| Veld | Type | Required | Beschrijving |
|------|------|----------|--------------|
| `id` | string | ✅ | Firestore document ID |
| `userId` | string | ✅ | Eigenaar/admin |
| `payrollCompanyId` | string | ✅ | Loonmaatschappij (bijv. Buddy BV) |
| `branchId` | string | ✅ | Vestiging |
| `workCompanies` | string[] | ❌ | Werkmaatschappijen waar werknemer voor werkt |
| `status` | enum | ✅ | `'active'` \| `'inactive'` \| `'on_leave'` \| `'sick'` |
| `hasAccount` | boolean | ✅ | Heeft medewerker een login account? |
| `accountCreatedAt` | Date | ❌ | Wanneer account aangemaakt |
| `createdAt` | Date | ✅ | Aanmaakdatum |
| `updatedAt` | Date | ✅ | Laatste wijziging |

#### Personal Info:
| Veld | Type | Required | Beschrijving |
|------|------|----------|--------------|
| `personalInfo.firstName` | string | ✅ | Voornaam |
| `personalInfo.lastName` | string | ✅ | Achternaam |
| `personalInfo.initials` | string | ✅ | Initialen |
| `personalInfo.bsn` | string | ✅ | BSN nummer |
| `personalInfo.dateOfBirth` | Date | ✅ | Geboortedatum |
| `personalInfo.placeOfBirth` | string | ✅ | Geboorteplaats |
| `personalInfo.nationality` | string | ✅ | Nationaliteit |
| `personalInfo.address.*` | object | ✅ | Adresgegevens |
| `personalInfo.contactInfo.*` | object | ✅ | Contactgegevens |
| `personalInfo.bankAccount` | string | ✅ | IBAN |
| `personalInfo.maritalStatus` | enum | ✅ | Burgerlijke staat |

#### Contract Info:
| Veld | Type | Required | Beschrijving |
|------|------|----------|--------------|
| `contractInfo.type` | enum | ✅ | Contract type (permanent, temporary, etc.) |
| `contractInfo.startDate` | Date | ✅ | Startdatum |
| `contractInfo.endDate` | Date | ❌ | Einddatum (tijdelijk contract) |
| `contractInfo.hoursPerWeek` | number | ✅ | Uren per week |
| `contractInfo.position` | string | ✅ | Functie |
| `contractInfo.cao` | string | ✅ | CAO |
| `contractInfo.contractStatus` | enum | ✅ | Status contract |

#### Salary Info:
| Veld | Type | Required | Beschrijving |
|------|------|----------|--------------|
| `salaryInfo.salaryScale` | string | ✅ | Salarisschaal |
| `salaryInfo.hourlyRate` | number | ❌ | Uurloon |
| `salaryInfo.monthlySalary` | number | ❌ | Maandsalaris |
| `salaryInfo.annualSalary` | number | ❌ | Jaarsalaris |
| `salaryInfo.paymentType` | enum | ✅ | Betaaltype |
| `salaryInfo.allowances.*` | object | ✅ | Toeslagen (overtime, onregelmatig, etc.) |
| `salaryInfo.taxTable` | enum | ✅ | Loontabel (white/green) |

#### Leave Info:
| Veld | Type | Required | Beschrijving |
|------|------|----------|--------------|
| `leaveInfo.vacation.entitlement` | number | ✅ | Vakantiedagen aanspraak |
| `leaveInfo.vacation.accrued` | number | ✅ | Opgebouwd |
| `leaveInfo.vacation.taken` | number | ✅ | Opgenomen |
| `leaveInfo.vacation.remaining` | number | ✅ | Resterend |

### Relaties:
- **Loonmaatschappij:** `payrollCompanyId` → `companies.id`
- **Vestiging:** `branchId` → `branches.id`
- **Werkmaatschappijen:** `workCompanies[]` → `companies.id[]`

---

## 4️⃣ Collection: `timeEntries`

**Type:** `TimeEntry`
**Primaire key:** `id` (string, auto-generated)

### Velden:

| Veld | Type | Required | Beschrijving |
|------|------|----------|--------------|
| `id` | string | ✅ | Firestore document ID |
| `userId` | string | ✅ | Eigenaar |
| `employeeId` | string | ✅ | Werknemer |
| `workCompanyId` | string | ❌ | Voor welke werkmaatschappij |
| `date` | Date | ✅ | Datum |
| `regularHours` | number | ✅ | Normale uren |
| `overtimeHours` | number | ✅ | Overuren |
| `irregularHours` | number | ✅ | Onregelmatige uren |
| `travelKilometers` | number | ✅ | Reiskilometers |
| `project` | string | ❌ | Project naam |
| `branchId` | string | ✅ | Vestiging |
| `notes` | string | ❌ | Notities |
| `status` | enum | ✅ | `'pending'` \| `'approved'` \| `'rejected'` |
| `createdAt` | Date | ✅ | Aanmaakdatum |
| `updatedAt` | Date | ✅ | Laatste wijziging |

---

## 5️⃣ Collection: `leaveRequests`

**Type:** `LeaveRequest`
**Primaire key:** `id` (string, auto-generated)

### Velden:

| Veld | Type | Required | Beschrijving |
|------|------|----------|--------------|
| `id` | string | ✅ | Firestore document ID |
| `userId` | string | ✅ | Eigenaar |
| `employeeId` | string | ✅ | Werknemer |
| `companyId` | string | ✅ | Bedrijf |
| `type` | enum | ✅ | `'vacation'` \| `'adv'` \| `'snipper'` \| `'unpaid'` |
| `startDate` | Date | ✅ | Startdatum |
| `endDate` | Date | ✅ | Einddatum |
| `days` | number | ✅ | Aantal dagen |
| `reason` | string | ❌ | Reden |
| `status` | enum | ✅ | `'pending'` \| `'approved'` \| `'rejected'` |
| `createdAt` | Date | ✅ | Aanmaakdatum |

---

## 6️⃣ Collection: `absenceRecords`

**Type:** `AbsenceRecord`
**Primaire key:** `id` (string, auto-generated)

### Velden:

| Veld | Type | Required | Beschrijving |
|------|------|----------|--------------|
| `id` | string | ✅ | Firestore document ID |
| `userId` | string | ✅ | Eigenaar |
| `employeeId` | string | ✅ | Werknemer |
| `companyId` | string | ✅ | Bedrijf |
| `type` | enum | ✅ | `'sick'` \| `'recovery'` \| `'other'` |
| `startDate` | Date | ✅ | Startdatum ziekte |
| `endDate` | Date | ❌ | Hersteldatum |
| `percentageWorking` | number | ❌ | Percentage werken (bij gedeeltelijk herstel) |
| `notes` | string | ❌ | Notities |
| `status` | enum | ✅ | `'active'` \| `'recovered'` |
| `createdAt` | Date | ✅ | Aanmaakdatum |

---

## 7️⃣ Collection: `expenses`

**Type:** `Expense`
**Primaire key:** `id` (string, auto-generated)

### Velden:

| Veld | Type | Required | Beschrijving |
|------|------|----------|--------------|
| `id` | string | ✅ | Firestore document ID |
| `userId` | string | ✅ | Eigenaar |
| `employeeId` | string | ✅ | Werknemer |
| `companyId` | string | ✅ | Bedrijf |
| `amount` | number | ✅ | Bedrag |
| `category` | enum | ✅ | Categorie (travel, meal, equipment, etc.) |
| `date` | Date | ✅ | Datum declaratie |
| `description` | string | ✅ | Omschrijving |
| `receiptUrl` | string | ❌ | URL naar bon/receipt |
| `status` | enum | ✅ | `'pending'` \| `'approved'` \| `'rejected'` \| `'paid'` |
| `createdAt` | Date | ✅ | Aanmaakdatum |

---

## 8️⃣ Collection: `outgoingInvoices`

**Type:** `OutgoingInvoice`
**Primaire key:** `id` (string, auto-generated)

### Velden:

| Veld | Type | Required | Beschrijving |
|------|------|----------|--------------|
| `id` | string | ✅ | Firestore document ID |
| `userId` | string | ✅ | Eigenaar |
| `companyId` | string | ✅ | Bedrijf (verkoper) |
| `invoiceNumber` | string | ✅ | Factuurnummer |
| `clientName` | string | ✅ | Klant naam |
| `clientEmail` | string | ❌ | Klant email |
| `invoiceDate` | Date | ✅ | Factuurdatum |
| `dueDate` | Date | ✅ | Vervaldatum |
| `items` | array | ✅ | Factuurdregels |
| `subtotal` | number | ✅ | Subtotaal |
| `vatAmount` | number | ✅ | BTW bedrag |
| `totalAmount` | number | ✅ | Totaalbedrag |
| `status` | enum | ✅ | `'draft'` \| `'sent'` \| `'paid'` \| `'overdue'` |
| `createdAt` | Date | ✅ | Aanmaakdatum |

---

## 9️⃣ Collection: `incomingInvoices`

**Type:** `IncomingInvoice`
**Primaire key:** `id` (string, auto-generated)

### Velden:

| Veld | Type | Required | Beschrijving |
|------|------|----------|--------------|
| `id` | string | ✅ | Firestore document ID |
| `userId` | string | ✅ | Eigenaar |
| `companyId` | string | ✅ | Bedrijf (koper) |
| `supplierName` | string | ✅ | Leverancier naam |
| `invoiceNumber` | string | ✅ | Factuurnummer |
| `invoiceDate` | Date | ✅ | Factuurdatum |
| `dueDate` | Date | ✅ | Vervaldatum |
| `amount` | number | ✅ | Bedrag |
| `vatAmount` | number | ✅ | BTW bedrag |
| `totalAmount` | number | ✅ | Totaalbedrag |
| `category` | string | ❌ | Categorie |
| `status` | enum | ✅ | `'pending'` \| `'approved'` \| `'paid'` |
| `createdAt` | Date | ✅ | Aanmaakdatum |

---

## 🔟 Collection: `budgetItems`

**Type:** `BudgetItem`
**Primaire key:** `id` (string, auto-generated)

### Velden:

| Veld | Type | Required | Beschrijving |
|------|------|----------|--------------|
| `id` | string | ✅ | Firestore document ID |
| `userId` | string | ✅ | Eigenaar |
| `companyId` | string | ✅ | Bedrijf |
| `type` | enum | ✅ | `'cost'` \| `'income'` |
| `name` | string | ✅ | Naam (bijv. "KPN Telefoon") |
| `category` | enum | ✅ | Categorie (telecom, software, etc.) |
| `amount` | number | ✅ | Bedrag per periode |
| `frequency` | enum | ✅ | `'monthly'` \| `'quarterly'` \| `'yearly'` |
| `startDate` | Date | ✅ | Startdatum |
| `endDate` | Date | ❌ | Einddatum (optioneel) |
| `supplier` | string | ❌ | Leverancier/Klant |
| `isActive` | boolean | ✅ | Actief? |
| `createdAt` | Date | ✅ | Aanmaakdatum |

---

## 1️⃣1️⃣ Collection: `businessTasks`

**Type:** `BusinessTask`
**Primaire key:** `id` (string, auto-generated)

### Velden:

| Veld | Type | Required | Beschrijving |
|------|------|----------|--------------|
| `id` | string | ✅ | Firestore document ID |
| `userId` | string | ✅ | Eigenaar/maker |
| `companyId` | string | ✅ | Bedrijf |
| `createdBy` | string | ✅ | Aanmaker |
| `assignedTo` | string[] | ❌ | Toegewezen aan (user UIDs) |
| `title` | string | ✅ | Titel |
| `description` | string | ❌ | Beschrijving |
| `category` | enum | ✅ | Categorie (operational, financial, etc.) |
| `priority` | enum | ✅ | `'low'` \| `'medium'` \| `'high'` \| `'urgent'` |
| `status` | enum | ✅ | `'pending'` \| `'in_progress'` \| `'completed'` \| `'cancelled'` |
| `dueDate` | Date | ✅ | Vervaldatum |
| `completedDate` | Date | ❌ | Voltooiingsdatum |
| `isRecurring` | boolean | ✅ | Terugkerend? |
| `frequency` | enum | ❌ | `'daily'` \| `'weekly'` \| `'monthly'` \| `'quarterly'` \| `'yearly'` |
| `nextOccurrence` | Date | ❌ | Volgende occurrence |
| `progress` | number | ✅ | Voortgang (0-100) |
| `createdAt` | Date | ✅ | Aanmaakdatum |
| `updatedAt` | Date | ✅ | Laatste wijziging |

---

## 1️⃣2️⃣ Collection: `auditLogs`

**Type:** `AuditLog`
**Primaire key:** `id` (string, auto-generated)

### Velden:

| Veld | Type | Required | Beschrijving |
|------|------|----------|--------------|
| `id` | string | ✅ | Firestore document ID |
| `userId` | string | ✅ | Uitvoerder actie |
| `companyId` | string | ❌ | Bedrijf context |
| `employeeId` | string | ❌ | Werknemer context |
| `action` | string | ✅ | Actie (create, update, delete, approve, etc.) |
| `entityType` | enum | ✅ | Type entiteit |
| `entityId` | string | ❌ | ID van entiteit |
| `description` | string | ✅ | Beschrijving actie |
| `metadata` | object | ❌ | Extra data |
| `createdAt` | Date | ✅ | Tijdstip actie |

### 🚨 KRITIEK: removeUndefinedValues()
ALTIJD gebruiken bij Firestore writes! Zie FIRESTORE_RULES.md

---

## 1️⃣3️⃣ Collection: `userSettings`

**Type:** `UserSettings`
**Primaire key:** User UID (document ID = user.uid)

### Velden:

| Veld | Type | Required | Beschrijving |
|------|------|----------|--------------|
| `id` | string | ❌ | Optional (meestal gelijk aan userId) |
| `userId` | string | ✅ | User ID |
| `defaultCompanyId` | string | ❌ | Standaard bedrijf bij login |
| `favoritePages` | object | ❌ | `{ [companyId]: string[] }` - Favoriete pagina's per bedrijf |
| `bottomNavItems` | object | ❌ | `{ [companyId]: BottomNavItem[] }` - Custom bottom nav iconen (3 items) |
| `createdAt` | Date | ✅ | Aanmaakdatum |
| `updatedAt` | Date | ✅ | Laatste wijziging |

### BottomNavItem structuur:
```typescript
{
  href: string;        // Route (bijv. '/timesheets')
  icon: string;        // Icon naam (bijv. 'Clock')
  label: string;       // Label (bijv. 'Uren')
  gradient: string;    // Gradient kleur
}
```

---

## 📊 Relatie Diagram

```
users (admin/manager/employee)
  └─ companies (employer/project/holding)
      ├─ primaryEmployerId → companies (holding)
      ├─ allowedUsers[] → users
      └─ branches
          └─ employees
              ├─ payrollCompanyId → companies
              ├─ workCompanies[] → companies
              ├─ timeEntries
              │   └─ workCompanyId → companies
              ├─ leaveRequests
              ├─ absenceRecords
              └─ expenses

companies
  ├─ outgoingInvoices (verkoop)
  ├─ incomingInvoices (inkoop)
  ├─ budgetItems (kosten/inkomsten)
  └─ businessTasks
      └─ assignedTo[] → users

userSettings (per user)
  └─ favoritePages, bottomNavItems (per company)

auditLogs (alle acties)
```

---

## 🔐 Beveiliging & Validatie

### Firestore Rules (verwacht):
- Users kunnen alleen hun eigen data lezen/schrijven (`userId` check)
- Co-admins hebben toegang via `allowedUsers[]`
- Managers hebben beperkte toegang (alleen hun toegewezen bedrijven)
- Employees kunnen alleen eigen timeEntries/leaveRequests aanmaken

### Required Checks bij elke write:
1. ✅ **removeUndefinedValues()** - VERPLICHT (zie FIRESTORE_RULES.md)
2. ✅ **convertToTimestamps()** - Dates omzetten naar Firestore Timestamps
3. ✅ **AuditService.logAction()** - Audit logging
4. ✅ Role-based access control (userRole check)

---

## 🎯 Critical Business Logic

### Company Hierarchie:
1. **Holding** (Festina Lente):
   - `companyType: 'holding'`
   - `primaryEmployerId: undefined` (top-level)
   - Werkmaatschappijen wijzen naar holding via `primaryEmployerId`

2. **Werkmaatschappijen** (Buddy, DeInstallatie):
   - `companyType: 'employer'` of `'project'`
   - `primaryEmployerId: <holding_id>`
   - Maakt deel uit van holding cijfers

3. **Aandeelhouders** (Sandebeheer, Carlibeheer):
   - `companyType: 'holding'`
   - `primaryEmployerId: undefined`
   - Zijn GEEN werkmaatschappijen
   - Worden NIET meegeteld in holding statistieken

### Holding Statistieken Berekening:
```typescript
// ✅ CORRECT: Alleen werkmaatschappijen
const workCompanies = companies.filter(c =>
  c.primaryEmployerId === holdingId &&
  c.userId === adminUserId
);

// ❌ FOUT: Alle bedrijven (inclusief aandeelhouders)
const allCompanies = companies.filter(c => c.userId === adminUserId);
```

---

## 📝 Implementatie Checklist

Voor elke nieuwe feature:
- [ ] Type definitie in `types/index.ts`
- [ ] Firebase CRUD functies in `services/firebase.ts`
- [ ] `removeUndefinedValues()` bij alle writes
- [ ] `convertToTimestamps()` en `convertTimestamps()` voor dates
- [ ] Audit logging via `AuditService.logAction()`
- [ ] Role-based access control
- [ ] Form validatie (Yup schema)
- [ ] Error handling
- [ ] Loading states
- [ ] Toast notifications

---

**Document versie:** 1.0
**Laatste update:** 2025-12-28
**Beheerder:** FLG Administratie Development Team
