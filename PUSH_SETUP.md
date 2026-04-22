# Push Notifications — Setup Gids

Deze gids beschrijft de eenmalige configuratie om echte push notifications werkend te krijgen in FLG-Administratie. Status: getest en geldig per **april 2026** (iOS Safari 16.4+ / 18.x, Firebase SDK v12, Netlify Scheduled Functions).

De code zelf is al geïmplementeerd. Je hoeft alleen twee credentials in Firebase Console op te halen en in Netlify te zetten.

---

## 1. VAPID key ophalen (voor clients)

De VAPID key laat de browser push-services vertrouwen dat jouw server meldingen mag sturen. Eenmalig aan te maken en herbruikbaar.

1. Ga naar <https://console.firebase.google.com/project/alloon/settings/cloudmessaging>
2. Scroll naar **Web configuration** (helemaal onderaan).
3. Onder **Web Push certificates** zie je mogelijk al een key pair. Zo niet → klik **Generate key pair**.
4. Klik naast de key op het kopieer-icoon — dit is een lange string die begint met `B…`.
5. Bewaar deze string — je hebt hem zo nodig bij stap 3.

> Zie je een melding dat Cloud Messaging API (V1) uit moet staan of aan? Laat hem gewoon aan staan (default), dat werkt voor jullie stack.

---

## 2. Service account ophalen (voor de server)

De Netlify Functions moeten zich als Firebase Admin authenticeren om pushes te kunnen verzenden.

1. Ga naar <https://console.firebase.google.com/project/alloon/settings/serviceaccounts/adminsdk>
2. Klik **Generate new private key** (of *Nieuwe privésleutel genereren*) → **Generate key**.
3. Er wordt een JSON-bestand gedownload, bijvoorbeeld `alloon-firebase-adminsdk-xxxxx.json`.
4. Open dat bestand in een editor. Je ziet iets als:
   ```json
   {
     "type": "service_account",
     "project_id": "alloon",
     "private_key_id": "...",
     "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
     "client_email": "firebase-adminsdk-xxxxx@alloon.iam.gserviceaccount.com",
     ...
   }
   ```
5. Kopieer de **volledige inhoud van het bestand** naar je klembord (alles, inclusief de buitenste `{` en `}`).

> **Bewaar dit bestand veilig / gooi het weg na instellen.** Commit het NIET in git — het is een secret waarmee iemand volledige schrijfrechten op je Firebase project heeft.

---

## 3. Env vars instellen in Netlify

1. Ga naar <https://app.netlify.com/sites/flg-administratie/settings/env> (vervang `flg-administratie` door de exacte site-naam als die anders is).
2. Voeg deze drie variabelen toe:

| Key | Scope | Waarde |
|---|---|---|
| `VITE_FIREBASE_VAPID_KEY` | **Builds** (frontend gebruikt deze bij build) | De VAPID key uit stap 1 |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | **Functions** (server-side) | Volledige JSON uit stap 2, als één string |
| `FIREBASE_PROJECT_ID` | **Functions** | `alloon` |

> Voor `FIREBASE_SERVICE_ACCOUNT_JSON`: Netlify accepteert multi-line waarden — plak de JSON gewoon in het waarde-veld. De `\n` in `private_key` moeten blijven zoals ze zijn.

3. Klik **Save**.
4. Trigger een nieuwe deploy (`Deploys → Trigger deploy → Deploy site`), want `VITE_` vars worden alleen tijdens build ingebakken.

---

## 4. Firestore index voor de scheduled reminder

De scheduled function queryt op `status` + `dueDate` range. Firestore vraagt om een composite index.

Eerste keer dat de functie draait zal die een error loggen met een link — klik die link aan om de index automatisch aan te maken. Alternatief:

1. Ga naar <https://console.firebase.google.com/project/alloon/firestore/indexes>
2. Klik **Create index** met:
   - Collection: `businessTasks`
   - Fields: `status` (Ascending), `dueDate` (Ascending), `__name__` (Ascending)
   - Query scope: Collection

Index duurt 1-5 minuten om te bouwen.

---

## 5. Testen (in volgorde)

### 5a. Desktop Chrome (makkelijkst)
1. Open de deployed app, log in.
2. Je ziet een banner **"Zet meldingen aan voor dit apparaat"** → klik **Activeer**.
3. Chrome vraagt permission → **Toestaan**.
4. Toast verschijnt: "Meldingen actief!".
5. Open Firestore Console → `users/{jouw-uid}/fcmTokens/` → er staat een document. ✓
6. Ga naar <https://console.firebase.google.com/project/alloon/messaging> → **New campaign → Notifications → Send test message**. Plak het FCM token uit Firestore.
7. **Sluit de tab** en druk op "Test" in Firebase Console. Notificatie verschijnt als OS-melding. ✓

### 5b. Android Chrome PWA
Zelfde als hierboven, maar na het installeren als app vanuit Chrome menu → "Toevoegen aan startscherm". Test dat melding ook binnenkomt met scherm uit.

### 5c. iPhone Safari PWA (belangrijkste test)
1. Open de deployed URL in **Safari** op iPhone (iOS 16.4+).
2. Tik op Delen-icoon → **"Zet op beginscherm"**.
3. Open de app vanaf je beginscherm (niet via Safari).
4. Log in. Je ziet de banner → **Activeer** → iOS vraagt permission → **Sta toe**.
5. Vergrendel je telefoon.
6. Laat iemand anders (of vanaf een ander account) een taak aanmaken toegewezen aan jou → push komt binnen op het vergrendelscherm. ✓

### 5d. End-to-end taak triggers
Met 2 accounts (admin + werknemer):

1. **Toewijzing**: admin maakt taak met dueDate over 2 uur, toegewezen aan werknemer → werknemer krijgt direct push.
2. **Deadline reminder**: wacht tot de dueDate binnen 1u15min ligt. Binnen 15 min komt de scheduled reminder → werknemer krijgt push "Deadline over 1 uur".
3. **Voltooiing**: werknemer zet taak op voltooid → admin krijgt push "Taak voltooid".

---

## 6. Hoe het werkt (kort)

```
┌─────────────┐    1. getToken(VAPID_KEY)     ┌──────────────┐
│   Client    │ ─────────────────────────────▶│  FCM server  │
│ (iPhone/PWA)│◀──── token (lange string) ────│              │
└─────┬───────┘                                └──────────────┘
      │ 2. save token in users/{uid}/fcmTokens
      ▼
┌─────────────┐
│  Firestore  │
└─────────────┘
      ▲
      │ 3. trigger (taak aangemaakt/voltooid)
      │
┌─────────────┐   4. fetch tokens, POST bericht   ┌──────────────┐
│  Netlify    │ ──────────────────────────────────▶│  FCM server  │
│  Function   │                                    └──────┬───────┘
└─────────────┘                                           │ 5. push via APNs / FCM
                                                          ▼
                                                  ┌──────────────┐
                                                  │  Device OS   │
                                                  │  Notification│
                                                  └──────────────┘
```

Voor de deadline-reminder draait `scheduled-task-reminders.ts` elke 15 minuten automatisch op Netlify.

---

## 7. Troubleshooting

**"Permission denied" in Chrome**
Chrome onthoudt afwijzen. Reset: slotje 🔒 naast URL → Site-instellingen → Meldingen op "Standaard" of "Toestaan".

**"Geen token ontvangen" in console**
1. Check dat `VITE_FIREBASE_VAPID_KEY` in Netlify staat EN er een nieuwe deploy is na het instellen.
2. DevTools → Application → Service Workers → zorg dat `/service-worker.js` actief is (niet `firebase-messaging-sw.js`).
3. Hard refresh (Ctrl+Shift+R) om oude SW te updaten.

**iOS: banner blijft "install first" tonen terwijl PWA al geïnstalleerd is**
iOS is kieskeurig: de app MOET via "Zet op beginscherm" zijn geïnstalleerd (niet Safari tab). Check in Safari dat `navigator.standalone === true` via de Web Inspector Remote (Mac → Develop → iPhone → tab).

**Scheduled function draait niet**
Netlify dashboard → Functions → `scheduled-task-reminders` → Logs. Moet om de 15 min een entry laten zien. Zo niet, check dat de function build-time is opgepikt (eerste deploy na aanmaak).

**Push werkt in 1 tab maar niet als app dicht is**
Dat betekent de SW's `push` event komt wel binnen maar iOS/browser houdt hem niet vast. Meestal oorzaak: `firebase-messaging-compat.js` versie mismatch. Check dat `public/service-worker.js` dezelfde versie laadt als `package.json` `firebase` dependency (momenteel `12.3.0`).

**Token verdwijnt na paar dagen**
Normaal — FCM roteert. Onze SW registreert bij elke login opnieuw, dus gebruiker die weer inlogt krijgt nieuw token automatisch.

---

## 8. Uitbreiding naar andere notificatie-types

Om later ook notificaties te sturen voor verlof-aanvraag, declaraties, etc.: roep in de betreffende service `NotificationService.createNotification(userId, {...})` aan met de juiste category. De push-channel wordt automatisch toegevoegd als de user tokens heeft. Geen extra werk aan de server-kant.

---

## 9. Developer notes

**Frontend files:**
- `src/lib/messaging.ts` — FCM client wrapper
- `src/services/notificationTargeting.ts` — employee-id → user-uid resolver
- `src/components/notifications/PushPromptBanner.tsx` — opt-in UI
- `src/services/notificationService.ts` — `sendPushNotification`, `notifyTaskCompleted`
- `src/services/firebase.ts` — triggers in `createTask` / `updateTask`
- `public/service-worker.js` — background push handler

**Server files:**
- `netlify/functions/_lib/firebaseAdmin.ts` — Admin SDK singleton
- `netlify/functions/_lib/push.ts` — `sendPushToUsers()` met cleanup
- `netlify/functions/send-push.ts` — HTTP endpoint voor client-triggered pushes
- `netlify/functions/scheduled-task-reminders.ts` — elke 15 min deadline check

**Types:**
- `BusinessTask.reminderSentAt?: Date` — flag tegen dubbele reminders
- `Notification.category`: `task_completed`, `task_deadline_reminder` toegevoegd
