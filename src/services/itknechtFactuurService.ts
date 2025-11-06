// src/services/itknechtFactuurService.ts

export interface FactuurRegel {
  datum: string;
  uren: number;
  opdrachtgever: string;
  locaties: string;
}

export interface FactuurWeekData {
  week: number;
  monteur: string;
  regels: FactuurRegel[];
  totalUren: number;
}

export interface FactuurImportRequest {
  action: 'get_factuur_data';
  week: number;
  year: number;
  companyId: string;
}

export class ITKnechtFactuurService {
  private static WEBHOOK_URL = 'https://hook.eu2.make.com/223n5535ioeop4mjrooygys09al7c2ib'; // Vervang met jouw Make webhook URL

  /**
   * Fetch factuurgegevens van ITKnecht via Make.com webhook
   */
  static async fetchFactuurData(
    week: number,
    year: number,
    companyId: string
  ): Promise<FactuurWeekData[]> {
    const payload: FactuurImportRequest = {
      action: 'get_factuur_data',
      week,
      year,
      companyId
    };

    console.log('🚀 Fetching factuur data:', payload);

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

    console.log('✅ Factuur data received:', data);
    return data as FactuurWeekData[];
  }

  /**
   * Transform factuurregels naar invoice items
   */
  static transformToInvoiceItems(weekDataList: FactuurWeekData[]): any[] {
    const items: any[] = [];

    weekDataList.forEach(weekData => {
      const weekHeader = `Week ${weekData.week} ${weekData.monteur}`;
      
      weekData.regels.forEach(regel => {
        items.push({
          description: `${regel.datum} ${regel.uren} ${regel.opdrachtgever} "${regel.locaties}"`,
          quantity: 1,
          rate: 0, // Wordt ingevuld met dagtarief
          amount: 0
        });
      });
    });

    return items;
  }

  /**
   * Get current year
   */
  static getCurrentYear(): number {
    return new Date().getFullYear();
  }

  /**
   * Get current week number
   */
  static getCurrentWeek(): number {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const diff = now.getTime() - start.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    const day = Math.floor(diff / oneDay);
    const week = Math.ceil((day + 1) / 7);
    return week;
  }

  /**
   * Get week options (current week backwards)
   */
  static getWeekOptions(count: number = 8): Array<{ week: number; label: string }> {
    const currentWeek = this.getCurrentWeek();
    const options = [];

    for (let i = 0; i < count; i++) {
      const week = currentWeek - i;
      options.push({
        week,
        label: `Week ${week}`
      });
    }

    return options;
  }
}