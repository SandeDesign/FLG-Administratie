# WERKENDE DATA STRUCTUREN - FLG Administratie

## Overzicht Werkende Pagina's

Deze documentatie toont ALLEEN de pagina's die daadwerkelijk werken in de applicatie, met hun Firebase queries en data flows.

---

## 1. UREN GOEDKEUREN (TimesheetApprovals.tsx)

**Route:** `/timesheet-approvals`
**Sidebar:** "Uren Goedkeuren" (ClipboardList icon)
**Voor:** Admin & Manager (alleen employer companies)

### Firebase Collections Gebruikt

#### A. `weeklyTimesheets` Collection
```typescript
// Query voor ALLE pending timesheets (admin ziet alles)
query(
  collection(db, 'weeklyTimesheets'),
  where('userId', '==', adminUserId),
  where('status', '==', 'submitted')
)

// Query voor ALLE timesheets van een bedrijf
query(
  collection(db, 'weeklyTimesheets'),
  where('userId', '==', userId),
  where('companyId', '==', companyId)
)
```

### Data Structuur: WeeklyTimesheet

```typescript
interface WeeklyTimesheet {
  id: string;
  userId: string;              // Admin user ID
  employeeId: string;          // Welke werknemer
  companyId: string;           // Welk bedrijf
  weekNumber: number;          // Week nummer (1-52)
  year: number;                // Jaar

  // Entries array met alle dagen van de week
  entries: TimesheetEntry[];

  // Totalen
  totalRegularHours: number;
  totalOvertimeHours: number;
  totalEveningHours: number;
  totalNightHours: number;
  totalWeekendHours: number;
  totalTravelKilometers: number;

  // Status flow
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'processed';
  submittedAt?: Date;
  submittedBy?: string;
  approvedAt?: Date;
  approvedBy?: string;
  rejectedAt?: Date;
  rejectedBy?: string;
  rejectionReason?: string;

  // Low hours explanation
  lowHoursExplanation?: string;  // Als uren < 85% van contract

  createdAt: Date;
  updatedAt: Date;
}

interface TimesheetEntry {
  id: string;
  userId: string;
  employeeId: string;
  companyId: string;
  date: Date;                    // Specifieke dag
  regularHours: number;
  overtimeHours: number;
  eveningHours: number;
  nightHours: number;
  weekendHours: number;
  travelKilometers: number;

  // Work activities - gedetailleerde breakdown
  workActivities?: {
    hours: number;
    description: string;
    clientId?: string;
    projectCode?: string;
  }[];

  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Data Flow

1. **Laden van data:**
   - Haalt employees uit `useApp()` context (NIET direct van Firebase)
   - Haalt pending timesheets via `getAllPendingTimesheets(adminUserId)`
   - Haalt ALLE timesheets via custom query op `weeklyTimesheets`

2. **Employee Summary Berekening:**
```typescript
employees.forEach(employee => {
  const employeePendingTimesheets = pendingTimesheets.filter(
    t => t.employeeId === employee.id
  );
  const employeeAllTimesheets = allTimesheetsData.filter(
    t => t.employeeId === employee.id
  );

  const totalPendingHours = employeePendingTimesheets.reduce(
    (sum, t) => sum + t.totalRegularHours, 0
  );
  const contractHours = employee.contractInfo?.hoursPerWeek || 40;
  const expectedHours = contractHours * employeePendingTimesheets.length;
  const hoursLacking = Math.max(0, expectedHours - totalPendingHours);
});
```

3. **Approve/Reject Acties:**
```typescript
// Approve
await updateDoc(doc(db, 'weeklyTimesheets', id), {
  status: 'approved',
  approvedAt: Timestamp.fromDate(new Date()),
  approvedBy: adminUserId,
  updatedAt: Timestamp.fromDate(new Date())
});

// Reject
await updateDoc(doc(db, 'weeklyTimesheets', id), {
  status: 'rejected',
  rejectedAt: Timestamp.fromDate(new Date()),
  rejectedBy: adminUserId,
  rejectionReason: reason,
  updatedAt: Timestamp.fromDate(new Date())
});
```

### Belangrijke Patronen

✅ **Gebruikt `employees` van useApp()** - NIET getEmployees()
✅ **Timestamp conversie** - Gebruikt convertTimestamps() helper
✅ **Contract hours validatie** - Waarschuwing bij < 85% van contract
✅ **Dashboard modal** - Toont ALLE weken per werknemer uit Firebase

---

## 2. PRODUCTIE VERWERKING (ProjectProduction.tsx)

**Route:** `/project-production`
**Sidebar:** "Productie" (Factory icon)
**Voor:** Admin & Manager (alleen project companies)

### Firebase Collections Gebruikt

#### A. `productionWeeks` Collection
```typescript
// Query voor specifieke week + employee + company
query(
  collection(db, 'productionWeeks'),
  where('userId', '==', queryUserId),
  where('week', '==', selectedWeek),
  where('year', '==', selectedYear),
  where('companyId', '==', companyId),
  where('employeeId', '==', employeeId)
)
```

### Data Structuur: ProductionWeek

```typescript
interface ProductionWeek {
  id: string;
  week: number;                // Week nummer (1-52)
  year: number;                // Jaar
  companyId: string;           // Project company ID
  employeeId: string;          // Welke werknemer
  userId: string;              // Admin user ID

  // Entries array met productie registraties
  entries: ProductionEntry[];

  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'processed';
  totalHours: number;
  totalEntries: number;

  createdAt: Date;
  updatedAt: Date;
}

interface ProductionEntry {
  id?: string;
  monteur: string;             // Naam monteur
  datum: string;               // Datum als string (YYYY-MM-DD)
  uren: number;                // Aantal uren
  opdrachtgever: string;       // Klant/opdrachtgever
  locaties: string;            // Werklocaties

  week: number;
  year: number;
  companyId: string;
  employeeId: string;
  userId: string;

  createdAt: Date;
  updatedAt: Date;
}
```

### Data Flow

1. **Laden van data:**
   - Gebruikt `queryUserId` van `useApp()` context
   - Filtert employees op `workCompanies` of `projectCompanies`:
   ```typescript
   const linked = employees.filter(emp =>
     emp.workCompanies?.includes(selectedCompany.id) ||
     emp.projectCompanies?.includes(selectedCompany.id)
   );
   ```

2. **Import van Make.com webhook:**
```typescript
const response = await fetch(
  'https://hook.eu2.make.com/qmvow9qbpesofmm9p8srgvck550i7xr6',
  {
    method: 'POST',
    body: JSON.stringify({
      action: 'get_production_data',
      week: selectedWeek,
      year: selectedYear,
      companyId: selectedCompany.id,
      employee: {
        id: employee.id,
        firstName: employee.personalInfo.firstName,
        lastName: employee.personalInfo.lastName
      }
    })
  }
);

// Response format van Make.com:
// Array van objects met properties:
// - '0': Monteur naam
// - '1': Datum
// - '2': Uren
// - '3': Opdrachtgever
// - '4': Locaties
```

3. **Save/Update naar Firebase:**
```typescript
const dataToSave = {
  week: selectedWeek,
  year: selectedYear,
  companyId: selectedCompany.id,
  employeeId: selectedEmployeeId,
  userId: queryUserId,
  entries: entries.map(entry => ({
    monteur: entry.monteur,
    datum: entry.datum,
    uren: entry.uren,
    opdrachtgever: entry.opdrachtgever,
    locaties: entry.locaties,
    week: entry.week,
    year: entry.year,
    companyId: entry.companyId,
    employeeId: entry.employeeId,
    userId: entry.userId,
    createdAt: Timestamp.fromDate(entry.createdAt),
    updatedAt: Timestamp.fromDate(new Date())
  })),
  status: 'draft',
  totalHours: totalHours,
  totalEntries: entries.length,
  createdAt: Timestamp.fromDate(createdAt),
  updatedAt: Timestamp.fromDate(new Date())
};

if (existingWeek?.id) {
  // Update existing
  await updateDoc(doc(db, 'productionWeeks', existingWeek.id), dataToSave);
} else {
  // Create new
  await addDoc(collection(db, 'productionWeeks'), dataToSave);
}
```

### Belangrijke Patronen

✅ **queryUserId van useApp()** - NIET adminUserId
✅ **Employee filtering op projectCompanies** - Voor gekoppelde werknemers
✅ **Make.com webhook integratie** - Voor import van productie data
✅ **Week navigator** - Voor navigatie tussen weken
✅ **Timestamp conversie** - Bij save naar Firebase

---

## 3. CORE DATA TYPES

### Employee Type (van AppContext)

```typescript
interface Employee {
  id: string;
  userId: string;              // Admin user ID
  companyId: string;           // Employer company (Buddy BV)
  branchId: string;

  // Project companies waar employee werkt
  projectCompanies?: string[];
  workCompanies?: string[];    // Alternative property name

  personalInfo: {
    firstName: string;
    lastName: string;
    initials: string;
    bsn: string;
    dateOfBirth: Date;
    placeOfBirth: string;
    nationality: string;

    address: {
      street: string;
      houseNumber: string;
      postalCode: string;
      city: string;
      country: string;
    };

    contactInfo: {
      email: string;
      phone: string;
      emergencyContact?: {
        name: string;
        phone: string;
        relation: string;
      };
    };

    bankAccount: string;
    maritalStatus: 'single' | 'married' | 'registered_partnership' | 'divorced' | 'widowed';
  };

  contractInfo: {
    type: 'permanent' | 'temporary' | 'zero_hours' | 'on_call' | 'intern' | 'dga' | 'payroll' | 'freelance';
    startDate: Date;
    endDate?: Date;
    hoursPerWeek: number;       // BELANGRIJK voor timesheet validatie
    position: string;
    department?: string;
    cao: string;
    contractStatus: 'active' | 'notice_period' | 'ended' | 'suspended';
  };

  salaryInfo: {
    salaryScale: string;
    hourlyRate?: number;
    monthlySalary?: number;
    annualSalary?: number;
    paymentType: 'hourly' | 'monthly' | 'annual';
    paymentFrequency: 'monthly' | 'four_weekly' | 'weekly';

    allowances: {
      overtime: number;
      irregular: number;
      shift: number;
      evening: number;
      night: number;
      weekend: number;
      sunday: number;
    };

    travelAllowancePerKm: number;
    taxTable: 'white' | 'green';
    taxCredit: boolean;
  };

  leaveInfo: {
    vacation: {
      entitlement: number;
      accrued: number;
      taken: number;
      remaining: number;
    };
    adv?: {
      accumulated: number;
      taken: number;
      remaining: number;
    };
  };

  status: 'active' | 'inactive' | 'on_leave' | 'sick';
  hasAccount: boolean;

  createdAt: Date;
  updatedAt: Date;
}
```

### Company Type

```typescript
interface Company {
  id: string;
  userId: string;
  name: string;
  kvk: string;
  taxNumber: string;

  // Bedrijfstype - ZEER BELANGRIJK
  companyType: 'employer' | 'project' | 'holding' | 'shareholder' | 'investor';
  // 'employer' = Loonmaatschappij (Buddy) waar personeel in dienst is
  // 'project' = Werkmaatschappij waar personeel wordt gedetacheerd
  // 'holding' = Operationele holding die garant staat
  // 'shareholder' = Aandeelhouder met participaties

  payrollCompanyId?: string;    // Voor work companies
  primaryEmployerId?: string;   // Voor project/holding companies
  allowedUsers?: string[];      // User UIDs met toegang

  address: {
    street: string;
    city: string;
    zipCode: string;
    country: string;
  };

  contactInfo: {
    email: string;
    phone: string;
    website?: string;
  };

  settings: {
    defaultCAO: string;
    travelAllowancePerKm: number;
    standardWorkWeek: number;
    holidayAllowancePercentage: number;
    pensionContributionPercentage: number;
  };

  logoUrl?: string;
  themeColor?: string;

  createdAt: Date;
  updatedAt: Date;
}
```

---

## 4. CONTEXT PROVIDERS (AppContext)

### useApp() Hook - Data die ALTIJD beschikbaar is

```typescript
const {
  selectedCompany,     // Currently selected company
  employees,           // ALL employees from Firebase
  companies,           // ALL companies from Firebase
  queryUserId,         // Admin user ID for queries
  loading,
  setSelectedCompany,
} = useApp();
```

**Belangrijke noten:**
- `employees` komt van `getEmployees(userId)` Firebase query
- Wordt EENMAAL geladen bij app start
- Bevat ALLE employees van de admin user
- Filtering op company gebeurt in de componenten zelf

### Voorbeeld: Employee Filtering per Company

```typescript
// In TimesheetApprovals.tsx
employees.forEach(employee => {
  // Filter timesheets per employee
  const employeeTimesheets = timesheets.filter(
    t => t.employeeId === employee.id
  );
});

// In ProjectProduction.tsx
const linkedEmployees = employees.filter(emp =>
  emp.workCompanies?.includes(selectedCompany.id) ||
  emp.projectCompanies?.includes(selectedCompany.id)
);
```

---

## 5. FIREBASE SERVICE PATTERNS

### Timestamp Conversie (timesheetService.ts)

```typescript
// Firebase Timestamp → JavaScript Date
const convertTimestamps = (data: any) => {
  const converted = { ...data };

  if (converted.submittedAt && typeof converted.submittedAt.toDate === 'function') {
    converted.submittedAt = converted.submittedAt.toDate();
  }
  if (converted.approvedAt && typeof converted.approvedAt.toDate === 'function') {
    converted.approvedAt = converted.approvedAt.toDate();
  }
  // ... etc voor alle date fields

  // Recursief voor entries arrays
  if (converted.entries && Array.isArray(converted.entries)) {
    converted.entries = converted.entries.map(entry => convertTimestamps(entry));
  }

  return converted;
};

// JavaScript Date → Firebase Timestamp
const convertToTimestamps = (data: any) => {
  const converted = { ...data };

  if (converted.submittedAt instanceof Date) {
    converted.submittedAt = Timestamp.fromDate(converted.submittedAt);
  }
  if (converted.approvedAt instanceof Date) {
    converted.approvedAt = Timestamp.fromDate(converted.approvedAt);
  }
  // ... etc

  return converted;
};
```

### Standard Query Patterns

```typescript
// 1. Get ALL documents voor een user
const q = query(
  collection(db, 'collectionName'),
  where('userId', '==', userId)
);

// 2. Get filtered documents
const q = query(
  collection(db, 'collectionName'),
  where('userId', '==', userId),
  where('companyId', '==', companyId),
  where('status', '==', 'submitted')
);

// 3. Get with ordering
const q = query(
  collection(db, 'collectionName'),
  where('userId', '==', userId),
  orderBy('createdAt', 'desc')
);

// 4. Execute query
const querySnapshot = await getDocs(q);
const results = querySnapshot.docs.map(doc => ({
  id: doc.id,
  ...convertTimestamps(doc.data())
}));
```

### Standard Update Pattern

```typescript
// 1. Check authorization
const docRef = doc(db, 'collectionName', id);
const docSnap = await getDoc(docRef);

if (!docSnap.exists() || docSnap.data().userId !== userId) {
  throw new Error('Unauthorized');
}

// 2. Prepare update data
const updateData = convertToTimestamps({
  ...updates,
  updatedAt: new Date()
});

// 3. Update
await updateDoc(docRef, updateData);
```

---

## 6. ANDERE WERKENDE PAGINA's

### Dashboard.tsx
**Collections gebruikt:**
- `outgoingInvoices` - Voor omzet berekeningen
- `incomingInvoices` - Voor kosten berekeningen
- `budgetItems` - Voor budget tracking
- `timeEntries` - Voor uren statistieken

### OutgoingInvoices.tsx
**Collections gebruikt:**
- `invoiceRelations` - Voor klant/leverancier data
- `productionWeeks` - Voor productie uren in facturen

### EmployerStatistics.tsx
**Collections gebruikt:**
- `timeEntries` - Voor uren statistieken
- `payrollCalculations` - Voor loonkosten (LET OP: Payroll heeft issues)
- `sickLeave` - Voor verzuim statistieken
- `leaveRequests` - Voor verlof statistieken
- `outgoingInvoices` - Voor omzet
- `incomingInvoices` - Voor kosten

### ProjectStatistics.tsx
**Collections gebruikt:**
- `timeEntries` - Voor project uren
- `outgoingInvoices` - Voor project omzet
- `incomingInvoices` - Voor project kosten

---

## 7. FIREBASE COLLECTIONS OVERZICHT

### Werkende Collections

| Collection | Purpose | Key Fields | Used By |
|------------|---------|------------|---------|
| `weeklyTimesheets` | Weekly timesheet submissions | userId, employeeId, companyId, weekNumber, year, status, entries | TimesheetApprovals, Dashboard |
| `productionWeeks` | Production tracking for projects | userId, employeeId, companyId, week, year, entries | ProjectProduction, OutgoingInvoices |
| `employees` | Employee master data | userId, companyId, personalInfo, contractInfo, salaryInfo | AppContext (ALL pages) |
| `companies` | Company master data | userId, companyType, name, settings | AppContext (ALL pages) |
| `timeEntries` | Individual time entries | userId, employeeId, date, regularHours | Statistics pages |
| `outgoingInvoices` | Outgoing invoices | userId, companyId, amount, status | Dashboard, Statistics |
| `incomingInvoices` | Incoming invoices | userId, companyId, amount, status | Dashboard, Statistics |
| `budgetItems` | Budget planning items | userId, companyId, type, amount, frequency | Budgeting, Dashboard |
| `invoiceRelations` | Customers & suppliers | userId, companyId, name, type | OutgoingInvoices, InvoiceRelations |
| `leaveRequests` | Leave requests | userId, employeeId, type, startDate, endDate, status | Leave pages, Statistics |
| `sickLeave` | Sick leave tracking | userId, employeeId, startDate, status | Absence pages, Statistics |

### Collections met Issues (VERMIJDEN)

| Collection | Issue | Status |
|------------|-------|--------|
| `payrollPeriods` | Incomplete implementation | ⚠️ NIET GEBRUIKEN |
| `payrollCalculations` | Errors in calculation logic | ⚠️ NIET GEBRUIKEN |
| `payslips` | Dependent on broken payroll | ⚠️ NIET GEBRUIKEN |

---

## 8. BEST PRACTICES (Gebaseerd op werkende code)

### ✅ DO's

1. **Gebruik AppContext voor employee/company data:**
   ```typescript
   const { employees, selectedCompany, queryUserId } = useApp();
   ```

2. **Filter employees in component:**
   ```typescript
   const filteredEmployees = employees.filter(emp =>
     emp.companyId === selectedCompany.id
   );
   ```

3. **Converteer Timestamps altijd:**
   ```typescript
   const data = convertTimestamps(doc.data());
   ```

4. **Check company type voor features:**
   ```typescript
   if (selectedCompany.companyType !== 'employer') {
     return <EmptyState />;
   }
   ```

5. **Gebruik Number() conversie voor Firebase data:**
   ```typescript
   const hours = Number(data.hours) || 0;
   ```

6. **Update operations met userId check:**
   ```typescript
   if (docSnap.data().userId !== userId) {
     throw new Error('Unauthorized');
   }
   ```

### ❌ DON'Ts

1. **NIET direct getEmployees() in pages:**
   ```typescript
   // ❌ BAD
   const employees = await getEmployees(userId);

   // ✅ GOOD
   const { employees } = useApp();
   ```

2. **NIET zonder companyType filtering:**
   ```typescript
   // ❌ BAD - Shows payroll for ALL companies

   // ✅ GOOD
   if (selectedCompany.companyType !== 'employer') return null;
   ```

3. **NIET zonder Timestamp conversie:**
   ```typescript
   // ❌ BAD
   const date = data.createdAt; // Firebase Timestamp

   // ✅ GOOD
   const date = convertTimestamps(data).createdAt; // JavaScript Date
   ```

4. **NIET zonder error handling:**
   ```typescript
   // ❌ BAD
   await updateDoc(docRef, data);

   // ✅ GOOD
   try {
     await updateDoc(docRef, data);
   } catch (error) {
     console.error('Error:', error);
     showError('Fout', 'Kon niet opslaan');
   }
   ```

---

## 9. DEBUGGING TIPS

### Firebase Console Queries

```javascript
// In Firebase Console
db.collection('weeklyTimesheets')
  .where('userId', '==', 'USER_ID')
  .where('status', '==', 'submitted')
  .get()
```

### Console Logging Patterns

```typescript
// Log query results
console.log('📊 Query results:', {
  collection: 'weeklyTimesheets',
  count: querySnapshot.docs.length,
  firstDoc: querySnapshot.docs[0]?.data()
});

// Log data transformations
console.log('🔄 Before conversion:', rawData);
console.log('✅ After conversion:', convertedData);

// Log employee filtering
console.log('👥 Total employees:', employees.length);
console.log('🎯 Filtered employees:', filteredEmployees.length);
```

---

## CONCLUSIE

Deze documentatie bevat ALLEEN werkende functionaliteit. Alle payroll-gerelateerde code is bewust weggelaten omdat deze niet functioneert zoals verwacht.

**Werkende data flows:**
- ✅ Timesheet approvals (weeklyTimesheets)
- ✅ Production processing (productionWeeks)
- ✅ Statistics (timeEntries, invoices, budgetItems)
- ✅ Employee management (employees, companies)
- ✅ Invoice management (outgoingInvoices, incomingInvoices)

**Niet-werkende data flows:**
- ❌ Payroll processing
- ❌ Payslip generation
- ❌ Salary calculations

Voor nieuwe features: volg de patronen van TimesheetApprovals.tsx en ProjectProduction.tsx.
