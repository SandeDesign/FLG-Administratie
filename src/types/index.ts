export interface Company {
  id: string;
  userId: string;
  name: string;
  kvk: string;
  taxNumber: string;
  address: {
    street: string;
    city: string;
    zipCode: string;
    country: string;
  };
  contactInfo: {
    email: string;
    phone: string;
    website?: string;
  };
  settings: {
    defaultCAO: string;
    travelAllowancePerKm: number;
    standardWorkWeek: number;
    holidayAllowancePercentage: number;
    pensionContributionPercentage: number;
  };
  logoUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  mainBranchId?: string; // ID van de hoofd vestiging
}

export interface Branch {
  id: string;
  userId: string;
  companyId: string;
  name: string;
  location: string;
  costCenter: string;
  cao?: string;
  specificSettings?: {
    overtimeRate: number;
    irregularRate: number;
    shiftRate: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface Employee {
  id: string;
  userId: string;
  companyId: string;
  branchId: string;
  
  // PERSOONLIJKE GEGEVENS (uitgebreid)
  personalInfo: {
    firstName: string;
    lastName: string;
    initials: string;
    bsn: string; // VERPLICHT - Burgerservicenummer (11-proef validatie)
    dateOfBirth: Date;
    placeOfBirth: string;
    nationality: string;
    
    address: {
      street: string;
      houseNumber: string;
      houseNumberAddition?: string;
      postalCode: string; // Format: 1234 AB
      city: string;
      country: string;
    };
    
    contactInfo: {
      email: string;
      phone: string;
      emergencyContact?: {
        name: string;
        phone: string;
        relation: string;
      };
    };
    
    bankAccount: string;
    maritalStatus: 'single' | 'married' | 'registered_partnership' | 'divorced' | 'widowed';
    
    // Kopie identiteitsbewijs (bestandsnaam/URL)
    identityDocument?: string;
  };
  
  // CONTRACT INFORMATIE (uitgebreid)
  contractInfo: {
    type: 'permanent' | 'temporary' | 'zero_hours' | 'on_call' | 'intern' | 'dga' | 'payroll' | 'freelance';
    startDate: Date;
    endDate?: Date; // Verplicht bij temporary
    probationPeriod?: number; // In maanden
    hoursPerWeek: number;
    position: string;
    department?: string;
    costCenter?: string;
    
    // CAO informatie
    cao: string; // Bijv. "Bouw", "Horeca", "Zorg", "Metaal", "Algemeen"
    caoCode?: string;
    
    // Contract status
    contractStatus: 'active' | 'notice_period' | 'ended' | 'suspended';
    noticeDate?: Date; // Datum opzegging
    endReason?: string; // Reden einde contract
  };
  
  // LOON GEGEVENS (uitgebreid)
  salaryInfo: {
    salaryScale: string; // A-F of custom
    
    // Primair loon
    hourlyRate?: number;
    monthlySalary?: number;
    annualSalary?: number;
    
    // Type loon
    paymentType: 'hourly' | 'monthly' | 'annual';
    paymentFrequency: 'monthly' | 'four_weekly' | 'weekly';
    
    // Toeslagen percentages
    allowances: {
      overtime: number; // % (bijv. 150)
      irregular: number; // % avond/nacht/weekend
      shift: number; // % ploegendienst
      weekend: number; // % weekend
      evening?: number; // % 18:00-23:00
      night?: number; // % 23:00-06:00
      sunday?: number; // % zondag
      callDuty?: number; // % consignatie
    };
    
    // Vergoedingen
    holidayAllowancePercentage: number; // Standaard 8%
    thirteenthMonth: boolean; // 13e maand
    endOfYearBonus?: number; // Eindejaarsuitkering
    
    travelAllowance: {
      type: 'per_km' | 'public_transport' | 'fixed';
      amountPerKm?: number; // €0,23 standaard
      fixedAmount?: number;
    };
    
    phoneAllowance?: number;
    homeWorkAllowance?: number; // Thuiswerkvergoeding
    clothingAllowance?: number;
    
    // Pensioenpremie
    pensionScheme?: string;
    pensionContribution: number;
    pensionEmployerContribution: number; // % werkgever aandeel
    pensionFund?: string; // Naam pensioenfonds
    
    // Fiscale gegevens
    taxCredit: boolean; // Loonheffingskorting toepassen
    taxTable: 'white' | 'green' | 'special'; // Wit/Groen/Bijzondere tabel
    
    // Aftrekposten
    deductions?: {
      type: string; // 'advance' | 'loan' | 'garnishment' | 'contribution'
      amount: number;
      description: string;
      active: boolean;
    }[];
    
    // Auto van de zaak
    companyCarBenefit?: {
      catalogValue: number;
      co2Emission: number;
      privateUsePercentage: number; // Bijtelling %
      monthlyAmount: number;
    };
  };
  
  // VERLOF & VERZUIM
  leaveInfo: {
    // Vakantiedagen
    holidayDays: {
      statutory: number; // Wettelijk (4x contracturen per week)
      extraStatutory: number; // Bovenwettelijk
      accumulated: number; // Opgebouwd
      taken: number; // Opgenomen
      remaining: number; // Resterend
      expiryDate: Date; // Vervaldatum (5 jaar)
    };
    
    // ADV dagen
    advDays?: {
      accumulated: number;
      taken: number;
      remaining: number;
    };
    
    // Overige dagen
    seniorDays?: number;
    snipperDays?: number;
  };
  
  status: 'active' | 'inactive' | 'on_leave' | 'sick';
  
  // Account informatie
  hasAccount: boolean; // Of werknemer een gebruikersaccount heeft
  accountCreatedAt?: Date; // Wanneer account is aangemaakt
  
  createdAt: Date;
  updatedAt: Date;
  
  // Historie
  salaryHistory?: {
    date: Date;
    oldValue: number;
    newValue: number;
    reason: string;
    changedBy: string;
  }[];
}

export interface TimeEntry {
  id: string;
  userId: string;
  employeeId: string;
  date: Date;
  regularHours: number;
  overtimeHours: number;
  irregularHours: number;
  travelKilometers: number;
  project?: string;
  branchId: string;
  status: 'draft' | 'approved' | 'processed';
  createdAt: Date;
  updatedAt: Date;
}

export interface PayrollCalculation {
  id: string;
  userId: string;
  employeeId: string;
  period: {
    month: number;
    year: number;
  };
  gross: {
    baseSalary: number;
    overtime: number;
    irregularHours: number;
    shift: number;
    total: number;
  };
  allowances: {
    travel: number;
    holiday: number;
    total: number;
  };
  deductions: {
    tax: number;
    pension: number;
    other: number;
    total: number;
  };
  net: number;
  breakdown: any[];
  status: 'calculated' | 'approved' | 'paid';
  createdAt: Date;
  updatedAt: Date;
}

export interface Regulation {
  id: string;
  userId: string;
  title: string;
  description: string;
  category: 'tax' | 'minimum-wage' | 'pension' | 'cao' | 'other';
  effectiveDate: Date;
  endDate?: Date;
  sourceUrl: string;
  isNew: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DashboardStats {
  activeEmployees: number;
  totalGrossThisMonth: number;
  companiesCount: number;
  branchesCount: number;
  pendingApprovals: number;
}

export interface CAO {
  id: string;
  name: string;
  code: string;
  sector: string;
  description: string;
  
  // Loonschalen
  salaryScales: {
    scale: string;
    hourlyRates: { [key: string]: number };
    monthlyRates: { [key: string]: number };
  }[];
  
  // Toeslagen
  allowances: {
    overtime: number;
    irregular: number;
    shift: number;
    weekend: number;
    evening?: number;
    night?: number;
    sunday?: number;
  };
  
  // Vergoedingen
  travelAllowancePerKm: number;
  holidayAllowancePercentage: number;
  
  // Vakantiedagen
  holidayDaysFormula: string; // "4 * hoursPerWeek"
  extraDays?: number;
  
  // Pensioen
  pensionFund?: string;
  pensionAge: number;
  pensionContribution: {
    employee: number;
    employer: number;
  };
  
  // Bijzondere regelingen
  specialProvisions?: string[];
  
  lastUpdated: Date;
}

// Voorgedefinieerde CAO's
export const DUTCH_CAOS: CAO[] = [
  {
    id: 'cao-algemeen',
    name: 'Algemeen (geen specifieke CAO)',
    code: 'ALG',
    sector: 'Algemeen',
    description: 'Standaard Nederlandse arbeidsvoorwaarden zonder specifieke CAO',
    salaryScales: [
      {
        scale: 'A',
        hourlyRates: { 'starters': 12.50, 'ervaren': 15.00 },
        monthlyRates: { 'starters': 2166, 'ervaren': 2600 }
      },
      {
        scale: 'B',
        hourlyRates: { 'starters': 15.00, 'ervaren': 18.00 },
        monthlyRates: { 'starters': 2600, 'ervaren': 3120 }
      },
      {
        scale: 'C',
        hourlyRates: { 'starters': 18.00, 'ervaren': 22.00 },
        monthlyRates: { 'starters': 3120, 'ervaren': 3813 }
      },
    ],
    allowances: {
      overtime: 125,
      irregular: 120,
      shift: 115,
      weekend: 125,
    },
    travelAllowancePerKm: 0.23,
    holidayAllowancePercentage: 8,
    holidayDaysFormula: '4 * hoursPerWeek',
    pensionAge: 68,
    pensionContribution: {
      employee: 6,
      employer: 14
    },
    lastUpdated: new Date('2025-01-01')
  },
  {
    id: 'cao-bouw',
    name: 'Bouw & Infra',
    code: 'BOUW',
    sector: 'Bouw',
    description: 'CAO voor de Bouwnijverheid',
    salaryScales: [
      {
        scale: 'Grondwerker',
        hourlyRates: { 'start': 14.50, '1jaar': 15.20, '2jaar': 16.00 },
        monthlyRates: { 'start': 2513, '1jaar': 2634, '2jaar': 2773 }
      },
      {
        scale: 'Metselaar',
        hourlyRates: { 'start': 16.00, '1jaar': 17.50, '2jaar': 19.00 },
        monthlyRates: { 'start': 2773, '1jaar': 3033, '2jaar': 3293 }
      },
      {
        scale: 'Voorman',
        hourlyRates: { 'start': 19.00, '1jaar': 20.50, '2jaar': 22.00 },
        monthlyRates: { 'start': 3293, '1jaar': 3553, '2jaar': 3813 }
      },
    ],
    allowances: {
      overtime: 150,
      irregular: 140,
      shift: 125,
      weekend: 150,
      sunday: 200,
    },
    travelAllowancePerKm: 0.23,
    holidayAllowancePercentage: 10.42, // Bouw heeft hoger percentage
    holidayDaysFormula: '5 * hoursPerWeek',
    extraDays: 13, // ADV dagen
    pensionFund: 'bpfBOUW',
    pensionAge: 68,
    pensionContribution: {
      employee: 7,
      employer: 16
    },
    specialProvisions: [
      'Depositouren',
      'Slechtweerregeling',
      'Reisuren = werktijd',
    ],
    lastUpdated: new Date('2025-01-01')
  },
  {
    id: 'cao-horeca',
    name: 'Horeca & Catering',
    code: 'HORECA',
    sector: 'Horeca',
    description: 'CAO voor de Horeca en Catering sector',
    salaryScales: [
      {
        scale: '1A - Beginnend medewerker',
        hourlyRates: { 'default': 12.90 },
        monthlyRates: { 'default': 2236 }
      },
      {
        scale: '3 - Zelfstandig werkend',
        hourlyRates: { 'default': 14.80 },
        monthlyRates: { 'default': 2565 }
      },
      {
        scale: '5 - Leidinggevend',
        hourlyRates: { 'default': 17.50 },
        monthlyRates: { 'default': 3033 }
      },
    ],
    allowances: {
      overtime: 125,
      irregular: 150, // Horeca heeft hoge onregelmatigheidstoeslag
      shift: 120,
      weekend: 150,
      evening: 125,
      night: 140,
      sunday: 200,
    },
    travelAllowancePerKm: 0.21,
    holidayAllowancePercentage: 8,
    holidayDaysFormula: '4 * hoursPerWeek',
    pensionFund: 'Horeca & Catering',
    pensionAge: 68,
    pensionContribution: {
      employee: 4.7,
      employer: 9.4
    },
    specialProvisions: [
      'Fooienregeling',
      'Werken op feestdagen 200%',
    ],
    lastUpdated: new Date('2025-01-01')
  },
  {
    id: 'cao-zorg',
    name: 'Zorg & Welzijn',
    code: 'ZORG',
    sector: 'Zorg',
    description: 'CAO voor de Zorg en Welzijn sector',
    salaryScales: [
      {
        scale: 'Schaal 3 - Verzorgende',
        hourlyRates: { 'start': 14.20, 'ervaren': 16.50 },
        monthlyRates: { 'start': 2461, 'ervaren': 2860 }
      },
      {
        scale: 'Schaal 5 - Verpleegkundige',
        hourlyRates: { 'start': 17.80, 'ervaren': 21.20 },
        monthlyRates: { 'start': 3085, 'ervaren': 3675 }
      },
    ],
    allowances: {
      overtime: 125,
      irregular: 135,
      shift: 125,
      weekend: 145,
      evening: 115,
      night: 130,
      sunday: 170,
    },
    travelAllowancePerKm: 0.23,
    holidayAllowancePercentage: 8,
    holidayDaysFormula: '4 * hoursPerWeek',
    pensionFund: 'PFZW',
    pensionAge: 68,
    pensionContribution: {
      employee: 7.5,
      employer: 15.5
    },
    specialProvisions: [
      'Inconveniëntentoeslag',
      'Bereikbaarheidsdienst',
    ],
    lastUpdated: new Date('2025-01-01')
  },
  {
    id: 'cao-metaal',
    name: 'Metaal & Techniek',
    code: 'METAAL',
    sector: 'Metaal',
    description: 'CAO voor de Metaal en Techniek sector',
    salaryScales: [
      {
        scale: 'Niveau 1',
        hourlyRates: { 'start': 13.80, 'ervaren': 15.50 },
        monthlyRates: { 'start': 2392, 'ervaren': 2687 }
      },
      {
        scale: 'Niveau 3',
        hourlyRates: { 'start': 16.20, 'ervaren': 18.90 },
        monthlyRates: { 'start': 2809, 'ervaren': 3276 }
      },
      {
        scale: 'Niveau 5',
        hourlyRates: { 'start': 19.50, 'ervaren': 23.20 },
        monthlyRates: { 'start': 3380, 'ervaren': 4021 }
      },
    ],
    allowances: {
      overtime: 150,
      irregular: 125,
      shift: 120,
      weekend: 150,
    },
    travelAllowancePerKm: 0.23,
    holidayAllowancePercentage: 8.33,
    holidayDaysFormula: '4 * hoursPerWeek',
    pensionFund: 'PME',
    pensionAge: 68,
    pensionContribution: {
      employee: 6.75,
      employer: 13.5
    },
    specialProvisions: [
      'Ploegentoeslag',
      'Gereedschapsvergoeding',
    ],
    lastUpdated: new Date('2025-01-01')
  }
];

export interface UserRole {
  uid: string;
  role: 'admin' | 'employee';
  employeeId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export * from './leave';
export * from './absence';
export * from './expense';
export * from './taxReturn';
export * from './notification';
export * from './audit';
export * from './timesheet';
export * from './payroll';
export * from './payslip';
export * from './export';