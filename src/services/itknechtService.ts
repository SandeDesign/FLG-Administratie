// src/services/itknechtService.ts

export interface ITKnechtDayEntry {
  monteur: string;
  dag: string; // "Maandag", "Dinsdag", etc.
  start_tijd: string;
  eind_tijd: string;
  totaal_factuureerbare_uren: number;
  gereden_kilometers: number;
  week: number;
  entries?: {
    client: string;
    uren: number;
    beschrijving: string;
  }[];
}

export interface ITKnechtImportRequest {
  action: 'get_hours_data';
  monteur: string;
  week: number;
  year: number;
  companyId: string;
}

export class ITKnechtService {
  private static WEBHOOK_URL = 'https://hook.eu2.make.com/wh18u8c7x989zoakqxqmomjoy2cpfd3b'; // Replace with actual URL

  /**
   * Fetch hours data from ITKnecht via Make.com webhook
   */
  static async fetchHoursData(
    monteurName: string,
    week: number,
    year: number,
    companyId: string
  ): Promise<ITKnechtDayEntry[]> {
    const payload: ITKnechtImportRequest = {
      action: 'get_hours_data',
      monteur: monteurName,
      week,
      year,
      companyId
    };

    const response = await fetch(this.WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`ITKnecht webhook failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Validate response format
    if (!Array.isArray(data)) {
      throw new Error('Invalid response format from ITKnecht webhook');
    }

    return data as ITKnechtDayEntry[];
  }

  /**
   * Transform ITKnecht day name to standard format
   */
  static normalizeDayName(day: string): string {
    const dayMap: { [key: string]: string } = {
      'monday': 'Maandag',
      'tuesday': 'Dinsdag', 
      'wednesday': 'Woensdag',
      'thursday': 'Donderdag',
      'friday': 'Vrijdag',
      'saturday': 'Zaterdag',
      'sunday': 'Zondag',
      'ma': 'Maandag',
      'di': 'Dinsdag',
      'wo': 'Woensdag', 
      'do': 'Donderdag',
      'vr': 'Vrijdag',
      'za': 'Zaterdag',
      'zo': 'Zondag'
    };

    const normalized = dayMap[day.toLowerCase()];
    return normalized || day; // Return original if not found
  }

  /**
   * Calculate total hours from ITKnecht entries
   */
  static calculateTotalHours(entries: ITKnechtDayEntry[]): {
    totalHours: number;
    totalKilometers: number;
    dayCount: number;
  } {
    let totalHours = 0;
    let totalKilometers = 0;

    entries.forEach(entry => {
      totalHours += entry.totaal_factuureerbare_uren || 0;
      totalKilometers += entry.gereden_kilometers || 0;
    });

    return {
      totalHours,
      totalKilometers,
      dayCount: entries.length
    };
  }

  /**
   * Group ITKnecht entries by day of week
   */
  static groupByDay(entries: ITKnechtDayEntry[]): { [day: string]: ITKnechtDayEntry[] } {
    const grouped: { [day: string]: ITKnechtDayEntry[] } = {};

    entries.forEach(entry => {
      const day = this.normalizeDayName(entry.dag);
      if (!grouped[day]) {
        grouped[day] = [];
      }
      grouped[day].push(entry);
    });

    return grouped;
  }

  /**
   * Validate monteur name format for better matching
   */
  static formatMonteurName(firstName: string, lastName: string): string {
    return `${firstName} ${lastName}`.trim();
  }

  /**
   * Check if ITKnecht data is recent/valid
   */
  static isDataValid(entries: ITKnechtDayEntry[], targetWeek: number, targetYear: number): boolean {
    if (!entries.length) return false;

    // Check if at least one entry matches the target week/year
    return entries.some(entry => 
      entry.week === targetWeek && 
      // Add year check if available in your data
      true // Assume year is correct for now
    );
  }

  /**
   * Generate import summary for user feedback
   */
  static generateImportSummary(entries: ITKnechtDayEntry[]): string {
    const totals = this.calculateTotalHours(entries);
    const uniqueDays = new Set(entries.map(e => this.normalizeDayName(e.dag))).size;

    return `Geïmporteerd: ${totals.totalHours} uur over ${uniqueDays} dagen, ${totals.totalKilometers} km`;
  }

  /**
   * Handle different possible data formats from Make.com
   */
  static normalizeITKnechtData(rawData: any): ITKnechtDayEntry[] {
    if (!rawData) return [];

    // Handle single object
    if (!Array.isArray(rawData)) {
      rawData = [rawData];
    }

    return rawData.map((entry: any) => ({
      monteur: entry.monteur || entry.user?.name || '',
      dag: entry.dag || entry.dayOfWeek || '',
      start_tijd: entry.start_tijd || entry.travel?.vertrektijd || '',
      eind_tijd: entry.eind_tijd || entry.travel?.thuiskomsttijd || '',
      totaal_factuureerbare_uren: parseFloat(entry.totaal_factuureerbare_uren || entry.travel?.totalHours || 0),
      gereden_kilometers: parseFloat(entry.gereden_kilometers || entry.travel?.kilometers || 0),
      week: parseInt(entry.week || entry.weekNumber || 0),
      entries: entry.entries || []
    }));
  }
}

export default ITKnechtService;