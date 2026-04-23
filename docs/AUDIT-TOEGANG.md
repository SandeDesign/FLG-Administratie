# Toegangsmatrix FLG-Administratie

> Bron: `src/utils/menuConfig.ts`, `src/App.tsx`, `src/contexts/AuthContext.tsx`, `src/contexts/AppContext.tsx`.
> Laatst bijgewerkt: 2026-04-23.

Dit document laat per **bedrijfsvorm** en per **rol** zien wat een gebruiker ziet in de navigatie, op welke routes toegang is, welke rechten gelden en welke data zichtbaar is.

---

## 1. Rollen

| Rol | UID-scope | Korte omschrijving |
|---|---|---|
| **admin** | eigen UID | Primary admin; volledige controle over eigen bedrijven. |
| **co-admin** | `primaryAdminUserId` | Werkt onder een primary admin; zelfde data-scope als die admin. |
| **manager** | toegewezen bedrijven via `companies.allowedUsers` | Beperkte admin-toegang voor specifieke bedrijven. |
| **boekhouder** | `assignedAdminUserIds` in eigen userSettings | Financiële inzage voor één of meer administraties (admin-groepen). |
| **employee** | eigen medewerker-profiel | Zelfservice via `/employee-dashboard/*`. |

Co-admins delen de data-context van hun primary admin: `adminUserId` in `AuthContext` wijst voor co-admins naar de primary, waardoor queries (companies, chats, settings) dezelfde resultaten geven.

---

## 2. Bedrijfsvormen (`companyType`)

| Type | Betekenis | Voorbeeld |
|---|---|---|
| **employer** | Loonmaatschappij — personeel op payroll | Buddy BV |
| **project** | Werkmaatschappij — detachering / projectwerk | Werkmaatschappij X |
| **holding** | Operationele holding / garantsteller | Festina Lente |
| **shareholder** | Aandeelhouder met participaties | Sandebeheer |
| **investor** | Toekomstige projectinvesteerder | (nog niet in menu) |

---

## 3. Matrix per bedrijfsvorm × rol

Legenda: **✓** = zichtbaar, **—** = niet beschikbaar.
(Sidebar/mobile menu — werkelijke bereikbaarheid hangt ook af van router-guards in `App.tsx` en rules in `ProtectedRoute`.)

### 3.1. Employer (loonmaatschappij)

| Menu-item | Sectie | admin | co-admin | manager | boekhouder | employee |
|---|---|---|---|---|---|---|
| Dashboard | — | ✓ | ✓ | ✓ | ✓ | via /employee-dashboard |
| Werknemers / Mijn Team | HR | ✓ | ✓ | ✓ | — | — |
| Uren Goedkeuren | HR | ✓ | ✓ | ✓ | — | — |
| Interne Projecten | HR | ✓ | ✓ | — | — | — |
| Loonverwerking | HR | ✓ | ✓ | ✓ | — | — |
| Verlof Beheren/Goedkeuren | HR | ✓ | ✓ | ✓ | — | — |
| Verzuim Beheren | HR | ✓ | ✓ | ✓ | — | — |
| Klanten & Leveranciers | Financieel | ✓ | ✓ | — | ✓ | — |
| Begroting | Financieel | ✓ | ✓ | — | — | — |
| Declaraties | Financieel | ✓ | ✓ | — | ✓ | — |
| Verkoop | Financieel | ✓ | ✓ | — | ✓ (read-only) | — |
| Inkoop | Financieel | ✓ | ✓ | ✓ | ✓ (read-only) | — |
| Bankafschrift Import | Financieel | ✓ | ✓ | — | ✓ (alleen matching, geen upload) | — |
| Rekeningschema | Financieel | ✓ | ✓ | — | ✓ | — |
| BTW Overzicht | Financieel | ✓ | ✓ | — | ✓ | — |
| Werkgever Stats | Statistieken | ✓ | ✓ | ✓ | — | — |
| **Mijn Zaken** (Uren/Verlof/Verzuim/Declaraties/Loonstroken) | Mijn Zaken | **—** | **—** | **—** | — | via /employee-dashboard |
| Berichten | Systeem | ✓ | ✓ | — | ✓ | — |
| Upload | Systeem | ✓ | ✓ | ✓ | ✓ | — |
| Taken | Systeem | ✓ | ✓ | ✓ | — | — |
| Bedrijven | Systeem | ✓ | ✓ | — | — | — |
| Audit Log | Systeem | ✓ | ✓ | — | — | — |
| Gebruikers Beheer | Systeem | ✓ | — | — | — | — |
| Instellingen | Systeem | ✓ | ✓ | ✓ | ✓ | ✓ |

> **Noot**: Mijn Zaken is op employer-contexten verborgen voor alle beheerdersrollen. Medewerkers gebruiken de aparte employee-dashboard route.

### 3.2. Project (werkmaatschappij)

| Menu-item | Sectie | admin | co-admin | manager | boekhouder | employee |
|---|---|---|---|---|---|---|
| Dashboard | — | ✓ | ✓ | ✓ | ✓ | via /employee-dashboard |
| Klanten & Leveranciers | Financieel | ✓ | ✓ | — | ✓ | — |
| Begroting | Financieel | ✓ | ✓ | — | — | — |
| Verkoop | Financieel | ✓ | ✓ | — | ✓ (read-only) | — |
| Inkoop | Financieel | ✓ | ✓ | ✓ | ✓ (read-only) | — |
| Bankafschrift Import | Financieel | ✓ | ✓ | — | ✓ (alleen matching) | — |
| Rekeningschema | Financieel | ✓ | ✓ | — | ✓ | — |
| BTW Overzicht | Financieel | ✓ | ✓ | — | ✓ | — |
| Productie | Project | ✓ | ✓ | ✓ | — | — |
| Project Overzicht | Project | ✓ | ✓ | — | — | — |
| Project Team | Project | ✓ | ✓ | — | — | — |
| Project Stats | Statistieken | ✓ | ✓ | ✓ | — | — |
| **Mijn Zaken** | Mijn Zaken | **—** | **—** | **—** | — | via /employee-dashboard |
| Berichten | Systeem | ✓ | ✓ | — | ✓ | — |
| Upload | Systeem | ✓ | ✓ | ✓ | ✓ | — |
| Taken | Systeem | ✓ | ✓ | ✓ | — | — |
| Investment Pitch | Systeem | ✓ | ✓ | — | — | — |
| Instellingen | Systeem | ✓ | ✓ | ✓ | ✓ | ✓ |

### 3.3. Holding (operationele holding)

| Menu-item | Sectie | admin | co-admin | manager | boekhouder | employee |
|---|---|---|---|---|---|---|
| Dashboard | — | ✓ | ✓ | ✓ | ✓ | — |
| Klanten & Leveranciers | Financieel | ✓ | ✓ | — | ✓ | — |
| Begroting | Financieel | ✓ | ✓ | — | — | — |
| Verkoop | Financieel | ✓ | ✓ | — | ✓ (read-only) | — |
| Inkoop | Financieel | ✓ | ✓ | ✓ | ✓ (read-only) | — |
| Bankafschrift Import | Financieel | ✓ | ✓ | — | ✓ | — |
| Rekeningschema | Financieel | ✓ | ✓ | — | ✓ | — |
| BTW Overzicht | Financieel | ✓ | ✓ | — | ✓ | — |
| Holding Stats | Statistieken | ✓ | ✓ | ✓ | — | — |
| Verlof (Mijn) | Mijn Zaken | ✓ | ✓ | ✓ | — | — |
| Ziekteverzuim (Mijn) | Mijn Zaken | ✓ | ✓ | ✓ | — | — |
| Declaraties (Mijn) | Mijn Zaken | ✓ | ✓ | — | — | — |
| Loonstroken (Mijn) | Mijn Zaken | ✓ | ✓ | — | — | — |
| Berichten | Systeem | ✓ | ✓ | — | ✓ | — |
| Upload | Systeem | ✓ | ✓ | ✓ | ✓ | — |
| Taken | Systeem | ✓ | ✓ | ✓ | — | — |
| Bedrijven | Systeem | ✓ | ✓ | — | — | — |
| Audit Log | Systeem | ✓ | ✓ | — | — | — |
| Gebruikers Beheer | Systeem | ✓ | — | — | — | — |
| Investment Pitch | Systeem | ✓ | ✓ | — | — | — |
| Instellingen | Systeem | ✓ | ✓ | ✓ | ✓ | — |

### 3.4. Shareholder (aandeelhouder)

Zelfde als **Holding**, uitgezonderd:
- Investment Pitch: **—** (alleen holding/project)

---

## 4. Matrix per rol (data-scope + rechten)

### 4.1. admin
- **Data-scope**: alles onder eigen `userId` — companies, employees, invoices, settings, audit, etc.
- **Write-rechten**: volledig op alle eigen data. Kan bedrijven aanmaken en verwijderen, co-admins + boekhouders toevoegen, gebruikers beheren.
- **Unieke rechten**: `Gebruikers Beheer` is alleen voor primary admin zichtbaar.
- **Zichtbaarheid bedrijven**: filterbaar via `userSettings.visibleCompanyIds`.

### 4.2. co-admin
- **Data-scope**: identiek aan primary admin (alle queries draaien onder `primaryAdminUserId`).
- **Write-rechten**: vrijwel alles, behalve Gebruikers Beheer.
- **Audit**: wijzigingen worden gelogd via `AuditService` met echte afzender-UID.

### 4.3. manager
- **Data-scope**: alleen bedrijven waarin `allowedUsers` hun UID bevat (één selectie tegelijk).
- **Write-rechten**: HR (uren goedkeuren, loonverwerking, verlof/verzuim goedkeuren), inkoop-inzage, bedrijfsstatistieken, taken.
- **Niet**: facturatie-aanmaak (wel inkoop inzage), bedrijven beheren, audit log, gebruikers, investment pitch.

### 4.4. boekhouder
- **Data-scope**: alle bedrijven van `assignedAdminUserIds`. Bedrijfsselectie via eigen `BoekhouderAdminSelector` (administratie → bedrijf).
- **Routes**: apart `/boekhouder/*` prefix met replica-pagina's uit `src/pages/boekhouder/`.
- **Read-only**: verkoop & inkoop (invoices, relaties inzichtelijk, geen mutaties).
- **Full access**: grootboek, BTW overzicht, bankafschriften (matching & confirm, upload verborgen), uploads (inkomende facturen/post, uitgaande facturen), declaraties.
- **Niet**: HR (werknemers, timesheets, verlof, verzuim), dashboard-inzichten van admin, audit log, gebruikersbeheer, begroting.
- **Team-shared chats**: alle admin+co-admins binnen één administratie delen dezelfde threads via `adminUid`.

### 4.5. employee
- **Navigatie**: via `EmployeeLayout` op `/employee-dashboard/*` — aparte hardcoded nav.
- **Data-scope**: eigen medewerker-record, eigen uren, verlof, verzuim, declaraties, loonstroken, agenda, taken.
- **Niet**: menuConfig-items (die zijn alleen voor beheerrollen op hun routes).

---

## 5. Chat (cross-rol)

| Eigenschap | Waarde |
|---|---|
| Route admin / co-admin | `/chat` |
| Route boekhouder | `/boekhouder/chat` |
| Datamodel | `chats/{companyId}_{boekhouderUid}` + `messages` subcollectie |
| Gedeelde threads | Primary admin en al z'n co-admins zien dezelfde chats |
| Unread badge | Zichtbaar in sidebar, mobile menu, mobile bottom nav, en dashboard-banner |
| Werkmaatschappij-filter | Chats zijn altijd company-scoped; de lijst groepeert per tegenpartij |

---

## 6. Permissies / Firestore

Let op: `firestore.rules` in productie staat op `allow read, write: if true` (development). Echte role-based rules moeten nog worden gebouwd. Onderstaande scope is daarmee **client-side afgedwongen** — niet backend.

### 6.1. Belangrijkste collections

| Collection | Owner-bepalende sleutel | Leesbaar door |
|---|---|---|
| `companies` | `userId` (admin) | admin+co-admin van die userId, managers in `allowedUsers`, boekhouders met `assignedAdminUserIds ∋ userId` |
| `employees` | idem | admin+co-admin, managers voor toegewezen bedrijven |
| `outgoingInvoices`, `incomingInvoices` | company-scoped | admin-team, boekhouder (read-only), manager (inkoop) |
| `bankTransactions`, `bankImports` | company-scoped | admin-team, boekhouder |
| `suppliers`, `crediteuren`, `debiteuren`, `grootboekrekeningen` | company-scoped | admin-team, boekhouder |
| `fcmTokens` (sub onder `users/{uid}`) | eigen uid | eigen user + server-side admin |
| `chats/{chatId}/messages` | adminUid + boekhouderUid in summary | admin-team (via primary adminUid) + boekhouder |

### 6.2. Ingangen en route-guards

Alleen in `App.tsx` checkt elke hoofd-route-tak op `userRole` voordat routes gerenderd worden. Een boekhouder die een `/companies` URL in de adresbalk tikt, krijgt `NotFound`. Een manager die `/admin/users` probeert, krijgt ook niets.

---

## 7. Data-inzicht per rol (samenvatting)

| Data-soort | admin | co-admin | manager | boekhouder | employee |
|---|---|---|---|---|---|
| Alle bedrijven van primary admin | ✓ | ✓ | alleen toegewezen | alleen toegewezen administraties | — |
| Werknemers | ✓ | ✓ | alleen toegewezen bedrijven | — | eigen profiel |
| Urenregistratie (team) | ✓ | ✓ | ✓ (goedkeuren) | — | — |
| Urenregistratie (eigen) | ✓ (holding) | ✓ (holding) | ✓ (holding) | — | ✓ |
| Loonstroken (alle medewerkers) | ✓ | ✓ | — | — | — |
| Loonstroken (eigen) | ✓ (holding) | ✓ (holding) | — | — | ✓ |
| Verkoop + factuuraanmaak | ✓ | ✓ | — | lezen | — |
| Inkoop + factuurupload | ✓ | ✓ | ✓ (inkoop) | lezen + uploaden | — |
| Grootboek + BTW overzicht | ✓ | ✓ | — | ✓ (volledig) | — |
| Bankafschriften | ✓ upload+match | ✓ upload+match | — | matchen/confirm | — |
| Declaraties (beheer) | ✓ | ✓ | — | ✓ | — |
| Declaraties (indienen) | — | — | — | — | ✓ |
| Chat admin↔boekhouder | ✓ (team) | ✓ (team) | — | ✓ | — |
| Audit log | ✓ | ✓ | — | — | — |
| Gebruikers beheer | ✓ (primary) | — | — | — | — |
| Investment Pitch | ✓ | ✓ | — | — | — |

---

## 8. Bekende gaten / follow-ups

- **Firestore rules**: productie staat volledig open; role-based rules moeten worden gebouwd zodat backend matcht met client-side scope.
- **Mijn Zaken op holding/shareholder**: nu nog zichtbaar voor admin-rollen — als de wens is om dat ook te verbergen, `companyTypes: []` maken.
- **Boekhouder companies-lijst**: boekhouder ziet nu via `assignedAdminUserIds` alle bedrijven van toegewezen admins. Een visibility-filter (zoals admins kunnen zetten via `visibleCompanyIds`) is voor boekhouder nog niet beschikbaar.
- **Investor-type**: nog geen menu-items toegewezen — placeholder voor later.
