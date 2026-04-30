# CLAUDE.md — FLG-Administratie

Dit bestand is de primaire context voor Claude Code in dit project.

## 1. Project Overview

**Naam:** FLG-Administratie
**Onderdeel van:** SandeDesign ecosysteem
**Doel:** Complete loonadministratie- en bedrijfsbeheersoftware voor FLGroep (Festina Lente Groep) haar bedrijven — beheer van werknemers, uren, verlof, verzuim, facturatie, budgettering en loonberekeningen.
**Status:** In ontwikkeling
**Repo:** https://github.com/SandeDesign/FLG-Administratie

## 2. Tech Stack

**Frontend:**
- Framework: React 18.3 met React Router DOM 6.25 (SPA, geen Next.js)
- Taal: TypeScript 5.5 (strict, ES2020 target, géén path aliases)
- Styling: Tailwind CSS 3.4 (class-based dark mode, bronze/brown primary palette, Inter font)
- UI Library: Eigen componenten + Lucide React icons (^0.344)
- Formulieren: React Hook Form 7 + Yup 1.7 validatie (via @hookform/resolvers)
- Datum/tijd: date-fns ^4.1
- Grafieken: Recharts ^3.2
- PDF generatie: @react-pdf/renderer ^4.3, jsPDF ^3, pdf-lib ^1.17, pdfjs-dist ^5.4
- Excel/CSV: xlsx ^0.18
- DOM-naar-canvas: html2canvas ^1.4 (PDF-snapshots)
- OCR: Tesseract.js ^6 (client-side fallback) + Claude Vision API (server-side via Netlify + PHP proxy)
- Build tool: Vite ^5.4 (manual chunk-splitting voor react-vendor)
- Kalender: FullCalendar 6.1 (@fullcalendar/react, daygrid, timegrid, interaction)
- Microsoft integratie: @azure/msal-browser ^5.4 (Graph API: Calendars.Read, User.Read)

**Backend / Serverless:**
- Firebase (Firestore, Auth, Realtime Database) — project: `alloon`
  > Firebase Storage is NIET meer in gebruik — alle bestandsuploads gaan via internedata.nl proxy
- Netlify Functions (Node 18, esbuild) — voor Claude Vision OCR, push notificaties, task reminders, invoice delivery callback
- PHP proxy op eigen host — URL: https://internedata.nl
- Make.com webhooks — zie sectie 10

**Hosting:**
- Frontend: Netlify
- PHP proxy: internedata.nl (eigen host)

**Authenticatie:** Firebase Auth (email/password) met role-based access (admin, co-admin, manager, boekhouder, employee)

## 3. Projectstructuur

```
FLG-Administratie/
├── src/
│   ├── components/
│   │   ├── absence/          # Verzuim: AbsenceStatsCard, RecoveryModal, SickLeaveModal
│   │   ├── banking/          # BankPartiesOverviewCards (klant/leverancier-overzicht uit bank)
│   │   ├── company/          # CompanyModal, BranchModal
│   │   ├── employee/         # EmployeeModal
│   │   ├── expense/          # ExpenseModal
│   │   ├── invoices/         # CreateInvoiceModal, FactuurWerkbonnenImport
│   │   ├── layout/           # Layout, Sidebar, MobileNav, MobileBottomNav, EmployeeLayout, BoekhouderAdminSelector
│   │   ├── leave/            # LeaveBalanceCard, LeaveRequestModal
│   │   ├── notifications/    # NotificationCenter, PushPromptBanner, PushDiagnostics, ChatUnreadBanner
│   │   ├── payslip/          # PayslipPDFTemplate (loonstrook PDF)
│   │   ├── settings/         # BottomNavSettings, CompaniesVisibilitySettings
│   │   ├── tasks/            # WeeklyTasksReminder, TaskScheduleSidebar, ScheduledTaskPopover
│   │   ├── timesheet/        # IncompleteWeekBanner
│   │   ├── upload/           # InkomendeFacturenTab, InkomendePostTab, UitgaandeFacturenTab (tabs voor /upload pagina)
│   │   └── ui/               # Button, Card, Input, Modal, Toast, ActionMenu, CompanySelector, SmartCompanySelector, PeriodSelector, EmptyState, LoadingSpinner
│   ├── contexts/             # AuthContext, AppContext, DarkModeContext, PageTitleContext
│   ├── hooks/                # useToast, useChatUnreadCount
│   ├── lib/                  # firebase, msalConfig, messaging, generateBtwPDF, generateGrootboekPDF, generateInvestmentPDF
│   ├── pages/                # Alle top-level pagina's (admin/manager/employee gedeeld)
│   │   └── boekhouder/       # Boekhouder-specifieke pagina's (eigen prefix /boekhouder/*)
│   ├── services/             # Firebase CRUD, OCR, facturatie, audit, payroll, etc. (zie sectie 6)
│   ├── types/                # TypeScript interfaces (zie sectie 7)
│   ├── utils/                # menuConfig, themeColors, validation, leaveCalculations, timesheetCompliance, poortwachterTracking, etc.
│   ├── App.tsx               # Router + protected routes per rol
│   └── index.css             # Tailwind base styles
├── netlify/
│   └── functions/            # claude-ocr.ts, claude-vision-ocr.ts, send-push.ts, scheduled-task-reminders.ts, invoice-delivery-callback.ts
│       └── _lib/             # firebaseAdmin.ts, push.ts (gedeeld door functions)
├── public/                   # Logo's, manifest.json, service-worker.js, PHP proxies (proxy3.php, claude-vision-ocr.php, fcm-send.php — proxy2.php draait op host zelf)
├── tailwind.config.js
├── vite.config.ts
├── tsconfig.json
└── netlify.toml
```

## 4. Gebruikersrollen & Routing

### Rollen

| Rol | Beschrijving | Route prefix |
|-----|-------------|--------------|
| **admin** | Volledig beheer van alle bedrijven, personeel, facturatie, instellingen | `/` |
| **co-admin** | Zelfde rechten als admin, werkt onder een primary admin (via `primaryAdminUserId`) | `/` |
| **manager** | Beheer van toegewezen bedrijven, uren, verlof, verzuim; geen upload/admin rechten | `/` |
| **boekhouder** | Eigen boekhoud-interface: facturen, BTW, grootboek, bank, chat met admin | `/boekhouder/*` |
| **employee** | Eigen dashboard: verlof, verzuim, declaraties, uren, loonstroken | `/employee-dashboard/*` |

### Route structuur

**Publiek (geen auth vereist):**
- `/login`, `/register`, `/reset-password`

**Admin & Co-Admin routes (`/`):**
- `/` (Dashboard), `/companies`, `/employees`
- `/project-production`, `/project-statistics`, `/project-team`
- `/statistics/employer`, `/statistics/project`, `/statistics/holding`
- `/admin/dashboard`, `/admin/users`, `/admin/roles`
- `/timesheets`, `/timesheet-approvals`, `/timesheet-export`
- `/internal-projects`, `/admin-expenses`
- `/admin/leave-approvals`, `/admin/absence-management`
- `/invoice-relations`, `/budgeting`, `/outgoing-invoices`, `/upload`
- `/incoming-invoices-stats`, `/bank-statement-import`
- `/grootboekrekeningen`, `/btw-overzicht`
- `/tasks`, `/payslips`, `/audit-log`, `/chat`, `/settings`
- `/investment-pitch` (ook beschikbaar zonder layout voor frame mode)
- Legacy redirects: `/incoming-invoices` → `/upload?tab=facturen`, `/incoming-post` → `/upload?tab=post`

**Manager routes (`/`):**
- `/` (ManagerDashboard), `/employees` ("Mijn Team"), `/project-production`, `/internal-projects`
- `/statistics/*`, `/timesheets`, `/timesheet-approvals`, `/timesheet-export`
- `/admin/leave-approvals` ("Verlof Goedkeuren"), `/admin/absence-management`
- Self-service: `/leave`, `/absence`, `/expenses`, `/payslips`
- Beperkt financieel: `/invoice-relations`, `/budgeting`, `/outgoing-invoices`
- `/tasks`, `/settings`
- Geen upload, geen inkoop, geen admin users/roles, geen audit-log

**Boekhouder routes (`/boekhouder/*`):**
- `/boekhouder` (dashboard), `/boekhouder/invoice-relations`, `/boekhouder/outgoing-invoices`
- `/boekhouder/incoming-invoices-stats`, `/boekhouder/bank-statement-import`
- `/boekhouder/grootboekrekeningen`, `/boekhouder/btw-overzicht`
- `/boekhouder/admin-expenses`, `/boekhouder/upload`, `/boekhouder/settings`
- `/boekhouder/chat`, `/boekhouder/payslip-upload`
- Niet-prefixed paden (`/invoice-relations`, etc.) redirecten automatisch naar `/boekhouder/*`

**Employee routes (`/employee-dashboard/*`):**
- `/` redirect naar `/employee-dashboard`
- `/employee-dashboard` (home), `/employee-dashboard/leave`, `/employee-dashboard/absence`
- `/employee-dashboard/expenses`, `/employee-dashboard/timesheets`
- `/employee-dashboard/agenda`, `/employee-dashboard/tasks`, `/employee-dashboard/payslips`

### Gebruikersflow

1. Gebruiker logt in via email/wachtwoord (Firebase Auth).
2. Op basis van role wordt het juiste dashboard geladen.
3. Admin/manager/boekhouder selecteert een bedrijf via CompanySelector.
4. Navigatie via sidebar (desktop) of mobile bottom nav naar modules.
5. Data wordt opgeslagen in Firestore onder de admin's userId namespace.

## 5. Functionele Modules

### Bedrijvenbeheer (`/companies`)
- Aanmaken en beheren van bedrijven met types: `employer`, `project`, `holding`, `shareholder`, `investor`
- Vestigingen (branches) per bedrijf
- Bedrijfsgegevens: naam, adres, KvK, BTW, contactinfo

### Personeelsbeheer (`/employees`)
- Medewerkers aanmaken, bewerken, deactiveren
- Contractinfo (type, startdatum, einddatum, uren per week)
- Salarisinfo, persoonlijke gegevens
- Koppeling aan bedrijven en vestigingen
- Admin beheer: `/admin/users`, `/admin/roles`

### Urenregistratie (`/timesheets`)
- Wekelijkse timesheets invoeren per dag (gaploos verplicht: elke werkdag een `dayStatus`)
- Dag-statussen (`DayStatus` in `types/timesheet.ts`): `worked`, `holiday` (auto via verlof), `sick` (auto via ziekteverzuim), `unpaid`, `meeting`, `holiday_public`, `partial_work` (geen/half werk uitgevoerd), `weekend`
- Automatische compliance-controle (min. 40 uur per week, anders 3-vraag low-hours review verplicht via `lowHoursReview`)
- `partial_work` triggert óók automatisch de low-hours review, ongeacht weektotaal
- Bij gewerkt < 8u verplicht een `effortNote` (wat heb je toch bijgedragen?)
- `IncompleteWeekBanner` waarschuwt bij ontbrekende dag-statussen
- "Riset"-marker is gereserveerd voor ITKnecht-import; manuele invoer met die term wordt geblokkeerd
- Goedkeuringsflow: `/timesheet-approvals`
- Export: `/timesheet-export`
- Import vanuit ITKnecht via Make.com webhook (zie sectie 10)
- Compliance utilities in `utils/timesheetCompliance.ts` (gap-check, deadline vrijdag 17:00, `containsOpdrachtgeverBlame`)

### Verlofbeheer (`/leave`, `/admin/leave-approvals`)
- Verloftypen: vakantie, ziekte, bijzonder, onbetaald, ouderschapsverlof, zorgverlof, ATV
- Aanvraag, goedkeuring/afwijzing workflow
- Saldoregistratie per medewerker per jaar
- `LeaveBalanceCard` toont actueel saldo

### Verzuimbeheer (`/absence`, `/admin/absence-management`)
- Ziekmeldingen en herstelmeldingen
- Wet Poortwachter tracking via `poortwachterTracking.ts`
- Statistieken per medewerker en bedrijf
- `AbsenceStatsCard` voor overzicht

### Facturatie — Uitgaand (`/outgoing-invoices`)
- Facturen aanmaken met `CreateInvoiceModal`
- Factuurregels, BTW-berekeningen, PDF generatie
- Statusflow: concept, verzonden, betaald, vervallen
- Koppeling aan relaties (klanten)
- Export naar Make.com webhook voor verwerking

### Facturatie — Inkomend (`/incoming-invoices-stats`, `/upload`)
- Upload van inkomende facturen met Claude Vision OCR (automatische herkenning)
- OCR via PHP proxy (`claude-vision-ocr.php`) of Netlify Function
- Matching met bankbetalingen
- Statistieken en goedkeuringsflow

### Upload centrum (`/upload`)
Drie tabbladen:
- **Inkomende facturen** (`InkomendeFacturenTab`) — OCR verwerking
- **Inkomende post** (`InkomendePostTab`) — digitale postverwerking
- **Uitgaande facturen** (`UitgaandeFacturenTab`) — factuurupload

### Bankafschriften (`/bank-statement-import`)
- CSV/bestand import van bankafschriften
- Automatisch matchen van transacties met facturen/declaraties
- `matchedPaymentsService` voor koppelingslogica

### Boekhouden
- **Grootboekrekeningen** (`/grootboekrekeningen`) — rekeningschema beheer, export
- **BTW Overzicht** (`/btw-overzicht`) — BTW-aangifte voorbereiding, periodeoverzicht, PDF export
- **Declaraties** (`/admin-expenses`) — Onkostenbeheer en goedkeuringen

### Budgettering (`/budgeting`)
- Budget planning en tracking per bedrijf
- Kosten vs. inkomsten per periode
- Prognoses

### Loonstroken (`/payslips`)
- Loonstrook aanmaken en beheren per medewerker
- PDF generatie via `PayslipPDFTemplate`
- Boekhouder kan loonstroken uploaden via `/boekhouder/payslip-upload`

### Statistieken
- **Werkgeverstatistieken** (`/statistics/employer`) — personeel, kosten, uren per werkgever
- **Projectstatistieken** (`/statistics/project`) — productie, uren, kosten per project
- **Holdingstatistieken** (`/statistics/holding`) — geconsolideerd overzicht holding

### Productie (`/project-production`)
- Productiedata per project importeren vanuit extern systeem (Make.com webhook)
- Uren en productie koppelen
- **ProductionPool** — beschikbaar productiewerk toewijzen

### Interne Projecten (`/internal-projects`)
- Interne tijdregistratie op niet-klant projecten
- Koppeling aan medewerkers

### Chat (`/chat`, `/boekhouder/chat`)
- Real-time berichten tussen admin en boekhouder (Firestore Realtime)
- `useChatUnreadCount` hook voor ongelezen teller
- `ChatUnreadBanner` in layout

### Notificaties
- Push notificaties via Firebase Cloud Messaging (FCM)
- `NotificationCenter` — in-app notificatie inbox
- `PushPromptBanner` — toestemming vragen voor push
- `PushDiagnostics` — debug tool voor push setup
- `scheduled-task-reminders` Netlify Function voor geplande herinneringen

### Taken (`/tasks`)
- Weekelijkse terugkerende taken per bedrijf/medewerker
- `TaskScheduleSidebar` voor taakplanning
- `WeeklyTasksReminder` component voor taakherinneringen
- `ScheduledTaskPopover` voor taakdetails

### Medewerker Agenda (`/employee-dashboard/agenda`)
- FullCalendar integratie
- Verlof, verzuim en afspraken in kalenderweergave

### Audit Log (`/audit-log`)
- Alle Firestore schrijfacties worden gelogd via `auditService`
- Overzicht van wijzigingen per gebruiker/datum/actie

### Instellingen (`/settings`)
- Themakleuren instellen (15 presets via `themeColors.ts`)
- Mobile bottom nav aanpassen per gebruiker (`BottomNavSettings`)
- Bedrijven zichtbaarheid configureren (`CompaniesVisibilitySettings`)

### Investment Pitch (`/investment-pitch`)
- Investor presentatie pagina
- Frame mode beschikbaar (laadt zonder navigatie/layout)

### PWA
- Service worker in `public/service-worker.js`
- Manifest in `public/manifest.json`
- Installeerbaar als Progressive Web App

## 6. Services Overzicht (`src/services/`)

| Service | Doel |
|---------|------|
| `firebase.ts` | Kernservice: CRUD voor alle entiteiten (bedrijven, medewerkers, uren, verlof, etc.) |
| `timesheetService.ts` | Weekelijkse timesheets aanmaken, indienen, goedkeuren, berekenen |
| `chatService.ts` | Real-time berichten admin ↔ boekhouder per bedrijf |
| `auditService.ts` | Audit logging en compliance tracking voor alle writes |
| `outgoingInvoiceService.ts` | Uitgaande facturen CRUD, statusbeheer, Make.com koppeling |
| `incomingInvoiceService.ts` | Inkomende facturen OCR, matching, goedkeuringsflow |
| `bankImportService.ts` | Bankafschrift parsing, transactiematching, reconciliatie |
| `payrollService.ts` | Loontijdvakbeheer, berekeningen, belastingverwerking |
| `payslipService.ts` | Loonstrook aanmaken en beheren (CRUD, status) |
| `payslipPdfGenerator.ts` | PDF rendering helper voor loonstroken |
| `supplierService.ts` | Leverancier/klant relatiebeheer |
| `notificationService.ts` | Notificaties aanmaken en versturen (email, push, in-app) |
| `notificationTargeting.ts` | Gebruikerstargeting voor notificaties |
| `taskSchedulingService.ts` | Taken plannen en terugkerende taken genereren |
| `projectStatisticsService.ts` | Project metrics en analytics |
| `taxReturnGenerator.ts` | BTW-aangifte berekeningen |
| `fileUploadService.ts` | Bestandsupload naar externe opslag (internedata.nl) |
| `ocrService.ts` | OCR tekstextractie uit documenten (Tesseract + Claude Vision) |
| `exportService.ts` | Data export functionaliteit |
| `dagboekExportService.ts` | Dagboek/grootboek export |
| `itknechtService.ts` | ITKnecht uren integratie via Make.com |
| `itknechtFactuurService.ts` | ITKnecht factuur synchronisatie |
| `microsoftService.ts` | Microsoft Graph API integratie |
| `matchedPaymentsService.ts` | Betaling-factuur koppelingslogica |
| `internalProjectService.ts` | Interne projecten voor uren-allocatie |

## 7. Types Overzicht (`src/types/`)

| Bestand | Bevat |
|---------|-------|
| `index.ts` | Kernentiteiten: Company, Employee, TimeEntry, LeaveRequest, Expense, BudgetItem, UserSettings, UserRole, BusinessTask, IncomingPost, etc. |
| `timesheet.ts` | WeeklyTimesheet, TimesheetEntry, WorkActivity, DayStatus, TimesheetApproval |
| `leave.ts` | LeaveRequest, LeaveBalance, LeaveType, LeaveStatus |
| `expense.ts` | Expense types, voertuigtypes, status enums |
| `payroll.ts` | PayrollPeriod, PayrollEarning, PayrollDeduction, PayrollTaxes, HourlyRate, Allowance, Deduction |
| `payslip.ts` | Loonstrook datastructuren |
| `audit.ts` | AuditLog, audit actietypes |
| `notification.ts` | Notification, NotificationPreferences, EmailTemplate, NotificationSchedule |
| `bankImport.ts` | Bankafschrift en transactie structuren |
| `supplier.ts` | Leverancier/klant data |
| `microsoft.ts` | Microsoft integratie types |
| `taxReturn.ts` | BTW-aangifte berekeningen |
| `export.ts` | Export configuraties |
| `internalProject.ts` | Interne project structuren |
| `absence.ts` | SickLeave, AbsenceStatistics |
| `statistics.types` | ⚠️ Statistieken types — bestand mist `.ts` extensie (zie sectie 15) |

## 8. Navigatie & Menu (`src/utils/menuConfig.ts`)

**35 navigatie-items** gedefinieerd in `ALL_NAVIGATION_ITEMS`:
- Elk item heeft: `id`, `name`, `href`, `icon`, `roles[]`, `companyTypes[]`
- Support voor rol-specifieke namen en hrefs via `nameByRole` en `hrefByRole`
- Boekhouder krijgt automatisch `/boekhouder/*` prefix via `hrefByRole`
- Items worden gefilterd door `getFilteredNavigation(role, companyType)` en gegroepeerd per sectie via `getNavigationSections()`

**6 navigatie-secties (collapsible):**
1. **Statistieken** (3 items) — statistics-employer, statistics-project, statistics-holding
2. **HR** (6 items) — employees, timesheet-approvals, internal-projects, payroll-processing, leave-approvals, absence-management
3. **Financieel** (8 items) — invoice-relations, budgeting, admin-expenses, outgoing-invoices, incoming-invoices-stats, bank-statement-import, grootboekrekeningen, btw-overzicht
4. **Project** (3 items) — project-production, project-statistics, project-team
5. **Mijn Zaken** (5 items) — timesheets, leave, absence, expenses-employee, payslips
6. **Systeem** (9 items) — chat, payslip-upload, upload, tasks, companies, audit-log, users, investment-pitch, settings

(Dashboard staat los buiten de secties = 35 items totaal.)

**Bedrijfstype context:**
- Items gefilterd op `companyType`: employer, project, holding, shareholder, investor
- Verschillende bedrijven tonen andere menu-items

**Mobile Bottom Nav defaults:**
- Employee: Uren, Loonstrook, Profiel
- Boekhouder: Upload, BTW, Grootboek
- Admin: Verkoop, Uren, Upload
- Manager: Stats, Team, Beheren

## 9. Visuele Beschrijving

**Kleurenschema:**
- Primair (brand): Bronze `#cd853f` (Festina Lente thema)
- Accent: Configureerbaar per gebruiker via `themeColors.ts` (15 presets)
- Achtergrond light: `#faf9f7` (gray-50)
- Achtergrond dark: gray-900
- Tekst light: gray-900
- Tekst dark: gray-100

**Typografie:**
- Font: Inter (system-ui fallback)
- Gewichten: 400, 500, 600, 700

**Design stijl:** Light/Dark theme (toggle via DarkModeContext), cards met shadows, rounded corners (xl/2xl).

**Responsive:** Mobile-first met MobileBottomNav en MobileFullScreenMenu. PWA-ready.

## 10. Make.com Integraties

| Scenario naam | Trigger | Doel | Webhook URL |
|---|---|---|---|
| ITKnecht Uren Import | HTTP webhook | Uren ophalen uit ITKnecht per monteur/week (gebruikt in `itknechtService.ts` én `Timesheets.tsx`) | `https://hook.eu2.make.com/wh18u8c7x989zoakqxqmomjoy2cpfd3b` |
| ITKnecht Factuur Data | HTTP webhook | Factuurdata ophalen per week | `https://hook.eu2.make.com/223n5535ioeop4mjrooygys09al7c2ib` |
| Uitgaande Facturen | HTTP webhook | Factuurgegevens versturen voor verwerking (`OutgoingInvoices.tsx`) | `https://hook.eu2.make.com/ttdixmxlu9n7rvbnxgfomilht2ihllc2` |
| Productie Import | HTTP webhook | Productiedata importeren (monteur, uren, locaties, klant) | `https://hook.eu2.make.com/qmvow9qbpesofmm9p8srgvck550i7xr6` |
| Inkomende Factuur — Aanmaak | HTTP webhook | Nieuwe leveranciersfactuur registreren | `https://hook.eu2.make.com/8jntdat5emrvrcfgoq7giviwvtjx9nwt` |
| Inkomende Factuur — Workflow | HTTP webhook | Statusupdate / verwerkingsflow inkomende factuur | `https://hook.eu2.make.com/sphpptl7j3x0aadqjidzb5r17uatkr5b` |

**Payload ITKnecht Uren:**
```json
{
  "action": "get_hours_data",
  "monteur": "Naam Monteur",
  "week": 10,
  "year": 2026,
  "companyId": "firestore-company-id"
}
```

**Payload ITKnecht Factuur:**
```json
{
  "action": "get_factuur_data",
  "week": 10,
  "year": 2026,
  "companyId": "firestore-company-id"
}
```

## 11. PHP Proxy / Eigen Host

**Host:** https://internedata.nl

| Endpoint | Methode | Gebruikt door | Doel |
|---|---|---|---|
| `/proxy2.php` | POST | `services/fileUploadService.ts` | Recursieve upload naar uniforme structuur `FLG-Administratie/{CompanyName}/{Category}/{year}/` (Verkoop, Inkoop, Post, Loonstroken) |
| `/proxy3.php` | POST | (legacy) | Inkomende post bestanden ophalen per bedrijf |
| `/claude-vision-ocr.php` | POST | `services/ocrService.ts` | OCR via Claude Vision API (factuur scanning) |
| `/fcm-send.php` | POST/GET | `services/notificationService.ts`, `PushDiagnostics` | FCM push notificaties versturen + GET als health-check |

**Waarom PHP proxy:** CORS omzeilen, API keys (Anthropic) verbergen op server, bestandsopslag op eigen host (vervangt Firebase Storage).

## 12. Netlify Functions (`netlify/functions/`)

| Function | Doel |
|----------|------|
| `claude-ocr.ts` | OCR tekstextractie uit afbeeldingen via Claude API |
| `claude-vision-ocr.ts` | Verbeterde OCR via Claude Vision voor factuur/document parsing |
| `send-push.ts` | Push notificaties versturen via FCM |
| `scheduled-task-reminders.ts` | Geplande taakherinneringen versturen |
| `invoice-delivery-callback.ts` | Webhook voor factuurlevering status callbacks |

**Gedeelde libraries (`_lib/`):**
- `firebaseAdmin.ts` — Firebase Admin SDK initialisatie
- `push.ts` — Push notificatie helper functies

## 13. Coding Regels voor dit Project

Claude Code houdt zich ALTIJD aan deze regels.

### Verplicht:

- Gebruik altijd `fetch`, nooit `axios`
- Componenten zijn altijd functional components met hooks
- TypeScript — vermijd `any` waar mogelijk
- CSS via Tailwind utility classes, geen inline styles
- Formulieren via React Hook Form + Yup validatie
- Firebase Firestore als database — NOOIT Supabase of andere databases
- Alle data opgeslagen onder `users/{adminUserId}/` namespace in Firestore
- Iconen via Lucide React
- Dark mode support in alle componenten (`dark:` prefix)
- Nederlandse UI teksten (labels, meldingen, buttons)
- Audit logging via `auditService` bij elke Firestore write

### Verboden:

- Geen Next.js — dit is een Vite SPA
- Geen Supabase — uitsluitend Firebase/Firestore
- Geen nieuwe npm packages zonder overleg
- Geen `console.log` in productie code (alleen error logging)
- Geen directe Firestore writes zonder audit logging
- Geen hardcoded API keys in frontend code (gebruik env vars of proxy)

### Naamgeving:

- Componenten: PascalCase (`EmployeeModal.tsx`)
- Functies/variabelen: camelCase
- Bestanden: PascalCase voor componenten, camelCase voor services/utils
- CSS classes: Tailwind utility classes
- Types/Interfaces: PascalCase (`Company`, `Employee`)

## 14. Environment Variables

```bash
# Frontend (.env) — Vite gebruikt VITE_ prefix
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...
VITE_MICROSOFT_CLIENT_ID=...  # MSAL — Microsoft Graph (calendar agenda integratie)

# Netlify Functions
ANTHROPIC_API_KEY=...  # Voor Claude Vision OCR (claude-ocr.ts, claude-vision-ocr.ts)
# Firebase Admin: standaard service account credentials (GOOGLE_APPLICATION_CREDENTIALS
# of FIREBASE_* env vars zoals geconfigureerd in netlify/functions/_lib/firebaseAdmin.ts)

# Nooit committen:
# - API keys
# - Firebase config met echte waarden
# - Webhook secrets
```

## 15. Bekende Issues / TODO

- [ ] Firebase config bevat hardcoded fallback waarden in `src/lib/firebase.ts` — zou volledig op env vars moeten draaien
- [ ] `src/components/sedy6Ka59` — leeg/ongeldig bestand (0 bytes), opruimen
- [ ] `src/types/statistics.types` — mist `.ts` extensie (zou `statistics.types.ts` moeten zijn)
- [ ] TypeScript `any` wordt nog op meerdere plekken gebruikt
- [ ] Make.com webhook URLs staan hardcoded in services/pages (`itknechtService.ts`, `itknechtFactuurService.ts`, `OutgoingInvoices.tsx`, `ProjectProduction.tsx`, `IncomingInvoicesStats.tsx`, `Timesheets.tsx`) — beter via env vars
- [ ] `package.json` heet nog `vite-react-typescript-starter` v0.0.0 — zou hernoemd moeten worden naar FLG-Administratie

## 16. SandeDesign Ecosysteem Context

| Project | Doel | Relatie |
|---|---|---|
| Facto | Facturatie voor freelancers | Los project, geen directe koppeling |
| Bindra | Contract signing | Los project |
| Uitgaaf | Budgettering | Los project |
| Agendi | Planning/agenda | Los project |
| Vlottr | Auto verhuur Limburg | Los project |

**Gedeelde patronen:**
- Make.com als automation laag
- PHP proxy op internedata.nl voor server-side calls
- React/TypeScript als frontend standaard
- Firebase als backend standaard
- Vite als build tool
- Tailwind CSS als styling
- Netlify als hosting
- Zelfde GitHub organisatie (SandeDesign)

---

*Gegenereerd via CLAUDE.md basis template — SandeDesign*
*Laatst bijgewerkt: 2026-04-30*
