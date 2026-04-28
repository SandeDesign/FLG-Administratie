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
- Framework: React 18.3 met React Router DOM 6 (SPA, geen Next.js)
- Taal: TypeScript (strict)
- Styling: Tailwind CSS 3.4
- UI Library: Eigen componenten + Lucide React icons
- Formulieren: React Hook Form + Yup validatie
- Grafieken: Recharts
- PDF generatie: @react-pdf/renderer, jsPDF, pdf-lib
- OCR: Tesseract.js (client-side) + Claude Vision API (server-side via Netlify + PHP proxy)
- Build tool: Vite 5.4
- Kalender: FullCalendar (@fullcalendar/react, daygrid, timegrid, interaction)
- Microsoft integratie: @azure/msal-browser

**Backend / Serverless:**
- Firebase (Firestore, Auth, Storage, Realtime Database) — project: `alloon`
- Netlify Functions (serverless) — voor Claude Vision OCR, push notificaties, task reminders
- PHP proxy op eigen host — URL: https://internedata.nl
- Make.com webhooks — zie sectie 6

**Hosting:**
- Frontend: Netlify
- PHP proxy: internedata.nl (eigen host)

**Authenticatie:** Firebase Auth (email/password) met role-based access (admin, co-admin, manager, boekhouder, employee)

## 3. Projectstructuur

```
FLG-Administratie/
├── src/
│   ├── components/
│   │   ├── absence/          # Verzuim: ziekmelding, herstel, statistieken
│   │   ├── banking/          # Bank transactie overzicht kaarten
│   │   ├── company/          # Bedrijf/vestiging modals
│   │   ├── employee/         # Medewerker modals
│   │   ├── expense/          # Declaratie modals
│   │   ├── invoices/         # Factuur aanmaak en werkbon import
│   │   ├── layout/           # Layout, Sidebar, MobileNav, BoekhouderAdminSelector
│   │   ├── leave/            # Verlof: saldo, aanvraag modal
│   │   ├── notifications/    # NotificationCenter, PushPromptBanner, PushDiagnostics, ChatUnreadBanner
│   │   ├── payslip/          # Loonstrook PDF template
│   │   ├── settings/         # Bottom nav settings, bedrijven zichtbaarheid
│   │   ├── tasks/            # WeeklyTasksReminder, TaskScheduleSidebar, ScheduledTaskPopover
│   │   ├── timesheet/        # IncompleteWeekBanner
│   │   └── ui/               # Button, Card, Input, Modal, Toast, ActionMenu, CompanySelector, SmartCompanySelector, PeriodSelector, EmptyState, LoadingSpinner
│   ├── contexts/             # AuthContext, AppContext, DarkModeContext, PageTitleContext
│   ├── hooks/                # useToast, useChatUnreadCount
│   ├── lib/                  # Firebase config, generateBtwPDF, generateGrootboekPDF, generateInvestmentPDF, messaging
│   ├── pages/                # Alle admin/manager pagina's
│   │   └── boekhouder/       # Boekhouder-specifieke pagina's (eigen prefix /boekhouder/*)
│   ├── services/             # Firebase CRUD, OCR, facturatie, audit, payroll, etc.
│   ├── types/                # TypeScript interfaces (Company, Employee, etc.)
│   ├── utils/                # menuConfig, themeColors, validation, leaveCalculations, timesheetCompliance, poortwachterTracking, etc.
│   └── index.css             # Tailwind base styles
├── netlify/
│   └── functions/            # claude-ocr.ts, claude-vision-ocr.ts, send-push.ts, scheduled-task-reminders.ts, invoice-delivery-callback.ts
│       └── _lib/             # firebaseAdmin.ts, push.ts (gedeeld door functions)
├── public/                   # Logo's, manifest.json, service-worker.js, PHP proxies (proxy3.php, claude-vision-ocr.php, fcm-send.php)
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
- `/companies`, `/employees`
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

**Manager routes (`/`):**
Subset van admin: teams, timesheets, goedkeuringen, statistieken, interne projecten, verlof/verzuim beheer. Geen upload, factuurupload, admin users/roles.

**Boekhouder routes (`/boekhouder/*`):**
- `/boekhouder` (dashboard), `/boekhouder/invoice-relations`, `/boekhouder/outgoing-invoices`
- `/boekhouder/incoming-invoices-stats`, `/boekhouder/bank-statement-import`
- `/boekhouder/grootboekrekeningen`, `/boekhouder/btw-overzicht`
- `/boekhouder/admin-expenses`, `/boekhouder/upload`, `/boekhouder/settings`
- `/boekhouder/chat`, `/boekhouder/payslip-upload`

**Employee routes (`/employee-dashboard/*`):**
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
- Wekelijkse timesheets invoeren per dag
- Dag-statussen: gewerkt, vrij, ziek, onbetaald, vergadering, weekend
- Automatische compliance-controle (min. 40 uur per week)
- `IncompleteWeekBanner` waarschuwt bij lage uren
- Goedkeuringsflow: `/timesheet-approvals`
- Export: `/timesheet-export`
- Import vanuit ITKnecht via Make.com webhook

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
| `payslipService.ts` | Loonstrook aanmaken en PDF generatie |
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

## 8. Navigatie & Menu (`src/utils/menuConfig.ts`)

**28 navigatie-items** gedefinieerd in `ALL_NAVIGATION_ITEMS`:
- Elk item heeft: `id`, `name`, `href`, `icon`, `roles[]`, `companyTypes[]`
- Support voor rol-specifieke namen en hrefs via `nameByRole` en `hrefByRole`
- Boekhouder krijgt automatisch `/boekhouder/*` prefix

**6 navigatie-secties (collapsible):**
1. **Statistieken** — Werkgever, project, holding statistieken
2. **HR** — Medewerkers, urenbeheer, interne projecten, loonstroken, verlof, verzuim
3. **Financieel** — Relaties, budgettering, declaraties, verkoop, inkoop, bank, grootboek, BTW
4. **Project** — Productie, projectstatistieken, projectteam
5. **Mijn Zaken** — Timesheets, verlof, verzuim, declaraties, loonstroken (selfservice)
6. **Systeem** — Chat, upload, taken, bedrijven, audit log, gebruikers, investment pitch, instellingen

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
| ITKnecht Uren Import | HTTP webhook | Uren ophalen uit ITKnecht per monteur/week | `https://hook.eu2.make.com/wh18u8c7x989zoakqxqmomjoy2cpfd3b` |
| ITKnecht Factuur Data | HTTP webhook | Factuurdata ophalen per week | `https://hook.eu2.make.com/223n5535ioeop4mjrooygys09al7c2ib` |
| Uitgaande Facturen | HTTP webhook | Factuurgegevens versturen voor verwerking | `https://hook.eu2.make.com/ttdixmxlu9n7rvbnxgfomilht2ihllc2` |
| Productie Import | HTTP webhook | Productiedata importeren vanuit extern systeem | `https://hook.eu2.make.com/qmvow9qbpesofmm9p8srgvck550i7xr6` |
| Betaling Webhook | HTTP webhook | Notificatie bij betaalmarkering inkomende factuur | `https://hook.eu2.make.com/8jntdat5emrvrcfgoq7giviwvtjx9nwt` |

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

| Endpoint | Methode | Doel |
|---|---|---|
| `/proxy2.php` | POST | Bestanden uploaden naar internedata.nl (facturen, documenten) |
| `/proxy3.php` | POST | Inkomende post bestanden ophalen per bedrijf |
| `/claude-vision-ocr.php` | POST | OCR via Claude Vision API (factuur scanning) |
| `/fcm-send.php` | POST | FCM push notificaties versturen |

**Waarom PHP proxy:** CORS omzeilen, API keys (Anthropic) verbergen op server, bestandsopslag op eigen host.

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

# Netlify Functions
ANTHROPIC_API_KEY=...  # Voor Claude Vision OCR

# Nooit committen:
# - API keys
# - Firebase config met echte waarden
# - Webhook secrets
```

## 15. Bekende Issues / TODO

- [ ] Firebase config bevat hardcoded fallback waarden in `src/lib/firebase.ts` — zou volledig op env vars moeten draaien
- [ ] `src/components/sedy6Ka59` — ongeldig bestand, lijkt corrupt of per ongeluk aangemaakt, verwijderen
- [ ] `src/types/statistics.types` — mist `.ts` extensie
- [ ] TypeScript `any` wordt nog op meerdere plekken gebruikt
- [ ] Sommige Make.com webhook URLs staan hardcoded in services/pages — beter via env vars

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
*Laatst bijgewerkt: 2026-04-28*
