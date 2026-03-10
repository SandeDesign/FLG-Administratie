export function getQuarterDateRange(year: number, quarter: number | null): { start: Date; end: Date } {
  if (!quarter) {
    return {
      start: new Date(year, 0, 1),
      end: new Date(year, 11, 31, 23, 59, 59)
    };
  }
  const startMonth = (quarter - 1) * 3;
  return {
    start: new Date(year, startMonth, 1),
    end: new Date(year, startMonth + 3, 0, 23, 59, 59)
  };
}

export function isInQuarter(date: Date, year: number, quarter: number | null): boolean {
  if (date.getFullYear() !== year) return false;
  if (!quarter) return true;
  const month = date.getMonth();
  const qStart = (quarter - 1) * 3;
  return month >= qStart && month < qStart + 3;
}

export function isWeekInQuarter(week: number, quarter: number | null): boolean {
  if (!quarter) return true;
  switch (quarter) {
    case 1: return week >= 1 && week <= 13;
    case 2: return week >= 14 && week <= 26;
    case 3: return week >= 27 && week <= 39;
    case 4: return week >= 40 && week <= 53;
    default: return true;
  }
}

export function getQuarterLabel(quarter: number | null): string {
  if (!quarter) return 'Heel jaar';
  return `Q${quarter}`;
}

export function getQuarterMonths(quarter: number | null): number[] {
  if (!quarter) return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const start = (quarter - 1) * 3;
  return [start, start + 1, start + 2];
}
