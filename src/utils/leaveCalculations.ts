import { CAO } from '../types';

export function calculateMonthlyHolidayAccrual(
  hoursPerWeek: number,
  cao?: CAO
): number {
  return (4 * hoursPerWeek) / 12;
}

export function calculateWorkingDays(
  startDate: Date,
  endDate: Date,
  excludeWeekends: boolean = true
): number {
  let count = 0;
  const current = new Date(startDate);

  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    if (!excludeWeekends || (dayOfWeek !== 0 && dayOfWeek !== 6)) {
      if (!isPublicHoliday(current)) {
        count++;
      }
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

export function getEasterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(year, month - 1, day);
}

export function getWhitsunDate(year: number): Date {
  const easter = getEasterDate(year);
  const whitsun = new Date(easter);
  whitsun.setDate(easter.getDate() + 49);
  return whitsun;
}

export function isPublicHoliday(date: Date): boolean {
  const year = date.getFullYear();
  const easter = getEasterDate(year);
  const easterMonday = new Date(easter);
  easterMonday.setDate(easter.getDate() + 1);

  const goodFriday = new Date(easter);
  goodFriday.setDate(easter.getDate() - 2);

  const ascension = new Date(easter);
  ascension.setDate(easter.getDate() + 39);

  const whitsun = getWhitsunDate(year);
  const whitMonday = new Date(whitsun);
  whitMonday.setDate(whitsun.getDate() + 1);

  const holidays = [
    new Date(year, 0, 1), // Nieuwjaarsdag
    goodFriday, // Goede Vrijdag
    easter, // Eerste Paasdag
    easterMonday, // Tweede Paasdag
    new Date(year, 3, 27), // Koningsdag (27 april)
    ascension, // Hemelvaartsdag
    whitsun, // Eerste Pinksterdag
    whitMonday, // Tweede Pinksterdag
    new Date(year, 11, 25), // Eerste Kerstdag
    new Date(year, 11, 26), // Tweede Kerstdag
  ];

  // Bevrijdingsdag (5 mei) is elke 5 jaar een nationale feestdag
  if (year % 5 === 0) {
    holidays.push(new Date(year, 4, 5));
  }

  return holidays.some(holiday =>
    holiday.toDateString() === date.toDateString()
  );
}

export function calculateAbsencePercentage(
  sickDays: number,
  totalWorkingDays: number
): number {
  if (totalWorkingDays === 0) return 0;
  return (sickDays / totalWorkingDays) * 100;
}

export function calculateYearlyHolidayEntitlement(
  hoursPerWeek: number,
  cao?: CAO
): number {
  return 4 * hoursPerWeek;
}

export function calculateADVDays(
  hoursPerWeek: number,
  cao?: CAO
): number {
  if (cao?.code === 'BOUW') {
    return cao.extraDays || 13;
  }
  return 0;
}

export function calculateWorkingHours(
  startTime: string,
  endTime: string
): number {
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);

  const startInMinutes = startHour * 60 + startMinute;
  const endInMinutes = endHour * 60 + endMinute;

  return (endInMinutes - startInMinutes) / 60;
}

export function getDaysUntilExpiry(expiryDate: Date): number {
  const now = new Date();
  // Set both dates to start of day to compare only days
  now.setHours(0, 0, 0, 0);
  expiryDate.setHours(0, 0, 0, 0);
  const diffTime = expiryDate.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function shouldWarnAboutExpiry(expiryDate: Date): boolean {
  const daysUntilExpiry = getDaysUntilExpiry(expiryDate);
  return daysUntilExpiry <= 90 && daysUntilExpiry > 0;
}

export function calculateExpiryDate(baseDate: Date, yearsToAdd: number = 5): Date {
  const expiryDate = new Date(baseDate);
  expiryDate.setFullYear(expiryDate.getFullYear() + yearsToAdd);
  return expiryDate;
}

export function getWorkingDaysInMonth(year: number, month: number): number {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  return calculateWorkingDays(firstDay, lastDay);
}

export function getWorkingDaysInYear(year: number): number {
  const firstDay = new Date(year, 0, 1);
  const lastDay = new Date(year, 11, 31);
  return calculateWorkingDays(firstDay, lastDay);
}

export function formatLeaveType(type: string): string {
  const typeMap: Record<string, string> = {
    holiday: 'Vakantie',
    sick: 'Ziekte',
    special: 'Bijzonder verlof',
    unpaid: 'Onbetaald verlof',
    parental: 'Ouderschapsverlof',
    care: 'Zorgverlof',
    short_leave: 'Kort verzuim',
    adv: 'ADV',
  };
  return typeMap[type] || type;
}

export function formatExpenseType(type: string): string {
  const typeMap: Record<string, string> = {
    travel: 'Reiskosten',
    meal: 'Maaltijden',
    accommodation: 'Accommodatie',
    parking: 'Parkeren', // Added parking
    phone: 'Telefoon',
    office: 'Kantoor',
    training: 'Opleiding',
    representation: 'Representatie',
    other: 'Overig',
  };
  return typeMap[type] || type;
}