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
- OCR: Tesseract.js (client-side) + Claude Vision API (server-side)
- Build tool: Vite 5.4

**Backend / Serverless:**
- Firebase (Firestore, Auth, Storage, Realtime Database) — project: `alloon`
- Netlify Functions (serverless) — voor Claude Vision OCR proxy
- PHP proxy op eigen host — URL: https://internedata.nl
- Make.com webhooks — zie sectie 6

**Hosting:**
- Frontend: Netlify
- PHP proxy: internedata.nl (eigen host)

**Authenticatie:** Firebase Auth (email/password) met role-based access (admin, co-admin, manager, employee)

## 3. Projectstructuur

```
FLG-Administratie/
├── src/
│   ├── components/
│   │   ├── absence/          # Verzuim: ziekmelding, herstel, statistieken
│   │   ├── company/          # Bedrijf/vestiging modals
│   │   ├── employee/         # Medewerker modals
│   │   ├── expense/          # Declaratie modals
│   │   ├── invoices/         # Factuur aanmaak en werkbon import
│   │   ├── layout/           # Layout, Sidebar, MobileNav, NavigationGroups
│   │   ├── leave/            # Verlof: saldo, aanvraag modal
│   │   ├── notifications/    # NotificationCenter
│   │   ├── payslip/          # Loonstrook PDF template
│   │   ├── settings/         # Bottom nav settings, bedrijven zichtbaarheid
│   │   ├── tasks/            # Weekelijkse taken reminder
│   │   └── ui/               # Herbruikbare UI: Button, Card, Input, Modal, Toast, etc.
│   ├── contexts/             # AuthContext, AppContext, DarkModeContext, PageTitleContext
│   ├── hooks/                # useToast
│   ├── lib/                  # Firebase config, PDF generators
│   ├── pages/                # Alle pagina's (Dashboard, Companies, Employees, etc.)
│   ├── services/             # Firebase CRUD, OCR, facturatie, audit, payroll, etc.
│   ├── types/                # TypeScript interfaces (Company, Employee, etc.)
│   ├── utils/                # Helpers: menuConfig, themeColors, validation, etc.
│   └── styles/               # index.css (Tailwind base)
├── netlify/
│   └── functions/            # claude-ocr.ts, claude-vision-ocr.ts
├── public/                   # Logo's, manifest.json, service-worker.js, PHP proxies
├── tailwind.config.js
├── vite.config.ts
├── tsconfig.json
└── netlify.toml
```

## 4. Functionele Beschrijving

### Wat doet deze app?

FLG-Administratie is een multi-tenant administratieplatform voor de Festina Lente Groep. Het stelt admins in staat om meerdere bedrijven (werkgevers, werkmaatschappijen, holdings, aandeelhouders) te beheren, inclusief personeel, urenregistratie, verlof, verzuim (incl. Wet Poortwachter), facturatie, budgettering en loonstroken.

### Hoofdfunctionaliteiten

- **Bedrijvenbeheer** — Aanmaken en beheren van bedrijven met types: employer, project, holding, shareholder, investor. Vestigingen per bedrijf.
- **Personeelsbeheer** — Medewerkers met contractinfo, salarisinfo, persoonlijke gegevens. Koppeling aan bedrijven en vestigingen.
- **Urenregistratie** — Timesheets invoeren, goedkeuren, exporteren. Import vanuit ITKnecht via Make.com.
- **Verlofbeheer** — Verlofaanvragen, goedkeuringen, saldoregistratie.
- **Verzuimbeheer** — Ziekmeldingen, herstelmeldingen, statistieken, Wet Poortwachter tracking.
- **Facturatie** — Uitgaande facturen aanmaken, inkomende facturen uploaden met OCR (Claude Vision), relatiebeheer, statistieken.
- **Budgettering** — Budget planning en tracking per bedrijf.
- **Loonstroken** — PDF generatie van loonstroken.
- **Declaraties** — Onkosten indienen en beheren.
- **Bankafschriften** — Import en matching van bankafschriften.
- **Inkomende post** — Digitaal verwerken van inkomende post.
- **Audit log** — Alle wijzigingen worden gelogd.
- **Taken** — Weekelijkse taken en herinneringen.
- **Statistieken** — Werkgever-, project- en holdingstatistieken.
- **Investment Pitch** — Pitch pagina (frame mode beschikbaar).
- **PWA** — Geïnstalleerd als Progressive Web App met service worker.

### Gebruikersrollen

1. **Admin** — Volledig beheer van alle bedrijven, personeel, facturatie, instellingen.
2. **Co-admin** — Zelfde rechten als admin, werkt onder een primary admin (via `primaryAdminUserId`).
3. **Manager** — Beheer van toegewezen bedrijven, uren, verlof, verzuim, facturatie.
4. **Employee** — Eigen dashboard: verlof, verzuim, declaraties, uren, loonstroken.

### Gebruikersflow

1. Gebruiker logt in via email/wachtwoord (Firebase Auth).
2. Op basis van role wordt het juiste dashboard geladen (admin/manager/employee).
3. Admin/manager selecteert een bedrijf via CompanySelector.
4. Navigatie via sidebar (desktop) of mobile bottom nav naar modules.
5. Data wordt opgeslagen in Firestore onder de admin's userId namespace.

### Wat doet de app NIET?

- Geen directe bankkoppeling (import via CSV/bestanden).
- Geen eigen emailverzending (via Make.com automations).
- Geen extern gebruikersbeheer (alles via Firebase Auth).

## 5. Visuele Beschrijving

**Kleurenschema:**
- Primair (brand): Bronze #cd853f (Festina Lente thema)
- Accent: Configureerbaar per gebruiker via themeColors (15 presets: blue, indigo, purple, etc.)
- Achtergrond light: #faf9f7 (gray-50)
- Achtergrond dark: gray-900
- Tekst light: gray-900
- Tekst dark: gray-100

**Typografie:**
- Font: Inter (system-ui fallback)
- Gewichten gebruikt: 400, 500, 600, 700

**Design stijl:** Light/Dark theme (toggle via DarkModeContext), Material-inspired cards met shadows, rounded corners (xl/2xl).

**Componenten aanwezig:**
- [x] Navigatie / Sidebar (desktop) + MobileBottomNav + MobileFullScreenMenu
- [x] Dashboard / overzichtspagina (per role)
- [x] Formulieren (React Hook Form + Yup)
- [x] Modals / Dialogs (eigen Modal component)
- [x] Tabellen / Lijsten
- [x] PDF generatie / download (loonstroken, facturen, investment pitch)
- [x] Toast notificaties
- [x] Loading spinners
- [x] Action menus
- [x] Company selector
- [x] Empty states

**Responsive:** Ja — mobile-first met MobileBottomNav en dedicated mobile menu. PWA-ready.

## 6. Make.com Integraties

| Scenario naam | Trigger | Doel | Webhook URL |
|---|---|---|---|
| ITKnecht Uren Import | HTTP webhook | Uren ophalen uit ITKnecht per monteur/week | `https://hook.eu2.make.com/wh18u8c7x989zoakqxqmomjoy2cpfd3b` |
| ITKnecht Factuur Data | HTTP webhook | Factuurdata ophalen per week | `https://hook.eu2.make.com/223n5535ioeop4mjrooygys09al7c2ib` |
| Uitgaande Facturen | HTTP webhook | Factuurgegevens versturen voor verwerking | `https://hook.eu2.make.com/ttdixmxlu9n7rvbnxgfomilht2ihllc2` |
| Productie Import | HTTP webhook | Productiedata importeren vanuit extern systeem | `https://hook.eu2.make.com/qmvow9qbpesofmm9p8srgvck550i7xr6` |
| Betaling Webhook | HTTP webhook | Notificatie bij betaalmarkering inkomende factuur | `https://hook.eu2.make.com/8jntdat5emrvrcfgoq7giviwvtjx9nwt` |

**Payload structuur ITKnecht Uren:**
```json
{
  "action": "get_hours_data",
  "monteur": "Naam Monteur",
  "week": 10,
  "year": 2026,
  "companyId": "firestore-company-id"
}
```

**Payload structuur ITKnecht Factuur:**
```json
{
  "action": "get_factuur_data",
  "week": 10,
  "year": 2026,
  "companyId": "firestore-company-id"
}
```

## 7. PHP Proxy / Eigen Host

**Host:** https://internedata.nl

| Endpoint | Methode | Doel |
|---|---|---|
| `/proxy2.php` | POST | Bestanden uploaden naar internedata.nl (facturen, documenten) |
| `/proxy3.php` | POST | Inkomende post bestanden ophalen per bedrijf |
| `/claude-vision-ocr.php` | POST | OCR via Claude Vision API (factuur scanning) |

**Waarom PHP proxy:** CORS omzeilen, API keys (Anthropic) verbergen op server, bestandsopslag op eigen host.

## 8. Coding Regels voor dit Project

Claude Code houdt zich ALTIJD aan deze regels, ook als een andere aanpak "logischer" lijkt.

### Verplicht:

- Gebruik altijd `fetch`, nooit `axios`
- Componenten zijn altijd functional components met hooks
- TypeScript — vermijd `any` waar mogelijk
- CSS via Tailwind utility classes, geen inline styles
- Formulieren via React Hook Form + Yup validatie
- Firebase Firestore als database — alle data onder `users/{adminUserId}/` namespace
- Iconen via Lucide React
- Dark mode support in alle componenten (`dark:` prefix)
- Nederlandse UI teksten (labels, meldingen, buttons)

### Verboden:

- Geen Next.js — dit is een Vite SPA
- Geen nieuwe npm packages zonder overleg
- Geen `console.log` in productie code (behalve error logging)
- Geen directe Firestore writes zonder audit logging (gebruik AuditService)
- Geen hardcoded API keys in frontend code (gebruik env vars of proxy)

### Naamgeving:

- Componenten: PascalCase (`EmployeeModal.tsx`)
- Functies/variabelen: camelCase
- Bestanden: PascalCase voor componenten, camelCase voor services/utils
- CSS classes: Tailwind utility classes
- Types/Interfaces: PascalCase (`Company`, `Employee`)

## 9. Environment Variables

```bash
# Frontend (.env.local) — Vite gebruikt VITE_ prefix
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

## 10. Bekende Issues / TODO

- [ ] Firebase config bevat hardcoded fallback waarden in `src/lib/firebase.ts` — zou volledig op env vars moeten draaien
- [ ] Import path fout in `App.tsx` regel 17: `../components/settings/CompaniesVisibilitySettings` (relatief pad buiten src)
- [ ] `src/components/sedy6Ka59` — ongeldig bestand, lijkt corrupt of per ongeluk aangemaakt
- [ ] `src/types/statistics.types` — mist `.ts` extensie
- [ ] TypeScript `any` wordt nog op meerdere plekken gebruikt
- [ ] Service worker registratie in `index.html` maar `service-worker.js` staat in `public/`
- [ ] Sommige Make.com webhook URLs staan hardcoded in services/pages — beter via env vars

## 11. SandeDesign Ecosysteem Context

Dit project is onderdeel van een breder ecosysteem. Gerelateerde projecten:

| Project | Doel | Relatie |
|---|---|---|
| Facto | Facturatie voor freelancers | Los project, geen directe koppeling |
| Bindra | Contract signing | Los project |
| Uitgaaf | Budgettering | Los project |
| Agendi | Planning/agenda | Los project |
| Vlottr | Auto verhuur Limburg | Los project |

### Gedeelde patronen in het ecosysteem:

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
*Laatst bijgewerkt: 2026-03-07*
