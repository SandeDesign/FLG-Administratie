// Compliance-utilities voor gaploze weektimesheets + Friday-deadline.
//
// Regel van de zaak:
//  - Iedere werkdag (ma t/m vr) van een week moet een `dayStatus` hebben
//    voordat de week ingediend kan worden.
//  - Vrijdag 17:00 van week N = deadline voor die week. Daarna rode banner
//    op het employee-dashboard en push-reminder.
//  - Verlof kan niet met terugwerkende kracht worden aangevraagd (behalve
//    door admin/manager) en moet goedgekeurd zijn voor het gaat tellen.
//
// Geen extra backend-cron nodig: we checken client-side bij elke render.

import { TimesheetEntry, WeeklyTimesheet, DayStatus } from '../types/timesheet';

/** Vaste deadline: vrijdag 17:00 Nederlandse tijd. */
export const WEEK_DEADLINE_DAY = 5; // vrijdag (0 = zondag)
export const WEEK_DEADLINE_HOUR = 17;

/**
 * Bouw de lijst werkdagen (ma t/m vr) voor een weeknummer + jaar.
 * Retourneert 5 datums in chronologische volgorde.
 */
export const getWeekWorkdays = (weekNumber: number, year: number): Date[] => {
  // ISO-week: 4 januari zit altijd in week 1
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() || 7; // zondag=7
  const week1Monday = new Date(jan4);
  week1Monday.setDate(jan4.getDate() - jan4Day + 1);

  const monday = new Date(week1Monday);
  monday.setDate(week1Monday.getDate() + (weekNumber - 1) * 7);

  const days: Date[] = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    d.setHours(0, 0, 0, 0);
    days.push(d);
  }
  return days;
};

/** True wanneer twee datums op dezelfde kalenderdag vallen. */
const sameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/** Uit de entries: map datum (yyyy-mm-dd) → entry (meest recent). */
const entryByDate = (entries: TimesheetEntry[]): Map<string, TimesheetEntry> => {
  const m = new Map<string, TimesheetEntry>();
  entries.forEach((e) => {
    const d = e.date instanceof Date ? e.date : new Date(e.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    m.set(key, e);
  });
  return m;
};

export interface WeekGapResult {
  /** Dagen waar nog geen dayStatus/entry voor is. */
  missingDates: Date[];
  /** True als alle werkdagen een entry + dayStatus hebben. */
  isComplete: boolean;
  /** Totaal werkdagen in de week (altijd 5 voor ma-vr). */
  totalWorkdays: number;
  /** Aantal ingevulde werkdagen. */
  filledWorkdays: number;
}

/**
 * Check of alle werkdagen van deze week een geldige status hebben.
 * Een werkdag telt als "ingevuld" wanneer er een entry is met een
 * `dayStatus` (niet undefined). Voor backwards-compat: entries zonder
 * dayStatus maar MET regularHours > 0 tellen ook als ingevuld (= worked).
 */
export const checkWeekComplete = (timesheet: WeeklyTimesheet | null | undefined): WeekGapResult => {
  if (!timesheet) {
    return { missingDates: [], isComplete: false, totalWorkdays: 5, filledWorkdays: 0 };
  }
  const workdays = getWeekWorkdays(timesheet.weekNumber, timesheet.year);
  const byDate = entryByDate(timesheet.entries || []);

  const missing: Date[] = [];
  let filled = 0;

  workdays.forEach((d) => {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const entry = byDate.get(key);
    const hasStatus =
      !!entry?.dayStatus ||
      // legacy: als entry uren heeft, gelijkstellen aan 'worked'
      (entry && (entry.regularHours || 0) + (entry.overtimeHours || 0) > 0);
    if (hasStatus) filled++;
    else missing.push(d);
  });

  return {
    missingDates: missing,
    isComplete: missing.length === 0,
    totalWorkdays: workdays.length,
    filledWorkdays: filled,
  };
};

/**
 * Is de deadline (vrijdag 17:00) van deze week voorbij?
 * Gebruikt lokale Nederlandse tijd.
 */
export const isWeekDeadlinePassed = (weekNumber: number, year: number, now: Date = new Date()): boolean => {
  const workdays = getWeekWorkdays(weekNumber, year);
  const friday = workdays[4]; // ma=0 ... vr=4
  const deadline = new Date(friday);
  deadline.setHours(WEEK_DEADLINE_HOUR, 0, 0, 0);
  return now.getTime() >= deadline.getTime();
};

/** Huidig ISO-weeknummer + jaar. */
export const getCurrentWeek = (now: Date = new Date()): { week: number; year: number } => {
  const target = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNr = (target.getUTCDay() + 6) % 7; // ma=0
  target.setUTCDate(target.getUTCDate() - dayNr + 3); // donderdag van deze week
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstThursdayDayNr = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstThursdayDayNr + 3);
  const diff = target.getTime() - firstThursday.getTime();
  const week = 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000));
  return { week, year: target.getUTCFullYear() };
};

/**
 * Mag een verlof-aanvraag met deze datums nog worden aangemaakt door
 * een werknemer zelf (geen admin)?
 *  - startDate moet op/na vandaag zijn.
 *  - admin/manager kunnen wel voor verleden indienen (voor correcties).
 */
export const canRequestLeaveAsEmployee = (startDate: Date, now: Date = new Date()): boolean => {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  return start.getTime() >= today.getTime();
};

/**
 * Keywords die wijzen op "opdrachtgever-blame" als verklaring voor te
 * weinig uren. Wanneer een werknemer in z'n suggesties-antwoord op de
 * low-hours review deze keywords gebruikt, willen we een follow-up
 * vraag stellen ("en wat kun jij/het team zelf doen?") om te voorkomen
 * dat alle suggesties op opdrachtgevers worden afgeschoven.
 *
 * Houd dit lokaal gedragen — uitbreiden mag gerust met nieuwe synoniemen
 * als ze in de praktijk opduiken.
 */
const OPDRACHTGEVER_BLAME_KEYWORDS = [
  'riset',
  'opdrachtgever',
  'klant',
  'planning te laag',
  'planning was laag',
  'lage planning',
  'te weinig werk',
  'geen werk',
  'tekort werk',
  'tekort aan werk',
  'niks te doen',
  'niets te doen',
  'weinig planning',
];

/**
 * True wanneer het antwoord termen bevat die wijzen op opdrachtgever-
 * blame. Case-insensitive substring-match.
 */
export const containsOpdrachtgeverBlame = (text: string): boolean => {
  if (!text) return false;
  const lower = text.toLowerCase();
  return OPDRACHTGEVER_BLAME_KEYWORDS.some((kw) => lower.includes(kw));
};

/** Label per DayStatus voor UI. */
export const DAY_STATUS_LABELS: Record<DayStatus, string> = {
  worked: 'Gewerkt',
  holiday: 'Verlof',
  sick: 'Ziek',
  unpaid: 'Onbetaald afwezig',
  meeting: 'Overleg / training',
  weekend: 'Weekend',
  holiday_public: 'Feestdag',
};
