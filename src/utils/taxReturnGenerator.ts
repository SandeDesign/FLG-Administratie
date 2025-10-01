import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from 'date-fns';
import {
  TaxReturn,
  EmployeeTaxData,
  ValidationError,
  LoonaangifteXML,
  XMLEmployeeData,
  Company,
  Employee,
  PayrollCalculation,
  PeriodType,
} from '../types';

const DUTCH_TAX_RATES_2025 = {
  bracket1: { limit: 38098, rate: 0.3697 },
  bracket2: { limit: 75518, rate: 0.4950 },
  bracket3: { rate: 0.4950 },
};

const SOCIAL_SECURITY_RATES_2025 = {
  aow: 0.1758,
  wlz: 0.0990,
  ww: 0.0274,
};

export class TaxReturnGenerator {

  static validateBSN(bsn: string): boolean {
    if (!bsn || bsn.length !== 9) return false;

    const digits = bsn.split('').map(Number);
    const checksum = digits.reduce((sum, digit, index) => {
      if (index === 8) return sum - digit;
      return sum + digit * (9 - index);
    }, 0);

    return checksum % 11 === 0;
  }

  static calculateTaxWithholding(
    grossWage: number,
    taxTable: 'white' | 'green' | 'special',
    hasTaxCredit: boolean
  ): number {
    let tax = 0;
    let remainingWage = grossWage;

    if (remainingWage <= DUTCH_TAX_RATES_2025.bracket1.limit) {
      tax = remainingWage * DUTCH_TAX_RATES_2025.bracket1.rate;
    } else if (remainingWage <= DUTCH_TAX_RATES_2025.bracket2.limit) {
      tax = DUTCH_TAX_RATES_2025.bracket1.limit * DUTCH_TAX_RATES_2025.bracket1.rate;
      remainingWage -= DUTCH_TAX_RATES_2025.bracket1.limit;
      tax += remainingWage * DUTCH_TAX_RATES_2025.bracket2.rate;
    } else {
      tax = DUTCH_TAX_RATES_2025.bracket1.limit * DUTCH_TAX_RATES_2025.bracket1.rate;
      remainingWage -= DUTCH_TAX_RATES_2025.bracket1.limit;
      const bracket2Amount = DUTCH_TAX_RATES_2025.bracket2.limit - DUTCH_TAX_RATES_2025.bracket1.limit;
      tax += bracket2Amount * DUTCH_TAX_RATES_2025.bracket2.rate;
      remainingWage -= bracket2Amount;
      tax += remainingWage * DUTCH_TAX_RATES_2025.bracket3.rate;
    }

    if (taxTable === 'green') {
      tax *= 0.64;
    }

    if (hasTaxCredit) {
      const monthlyTaxCredit = 3362 / 12;
      tax = Math.max(0, tax - monthlyTaxCredit);
    }

    return Math.round(tax * 100) / 100;
  }

  static calculateSocialSecurity(grossWage: number): {
    aow: number;
    wlz: number;
    ww: number;
    total: number;
  } {
    const aow = Math.round(grossWage * SOCIAL_SECURITY_RATES_2025.aow * 100) / 100;
    const wlz = Math.round(grossWage * SOCIAL_SECURITY_RATES_2025.wlz * 100) / 100;
    const ww = Math.round(grossWage * SOCIAL_SECURITY_RATES_2025.ww * 100) / 100;

    return {
      aow,
      wlz,
      ww,
      total: aow + wlz + ww,
    };
  }

  static aggregateEmployeeTaxData(
    employee: Employee,
    payrollRecords: PayrollCalculation[],
    periodStart: Date,
    periodEnd: Date
  ): EmployeeTaxData {
    const totalGross = payrollRecords.reduce((sum, record) => sum + record.grossPay, 0); // Corrected: use grossPay
    const totalDeductions = payrollRecords.reduce((sum, record) => sum + record.deductions.reduce((dSum, d) => dSum + d.amount, 0), 0); // Corrected: sum deductions from array
    const totalNet = payrollRecords.reduce((sum, record) => sum + record.netPay, 0); // Corrected: use netPay

    const grossSalary = payrollRecords.reduce((sum, record) => sum + record.regularPay, 0); // Corrected: use regularPay
    const overtime = payrollRecords.reduce((sum, record) => sum + record.overtimePay, 0); // Corrected: use overtimePay
    const eveningHoursPay = payrollRecords.reduce((sum, record) => sum + record.eveningPay, 0); // Added eveningPay
    const nightHoursPay = payrollRecords.reduce((sum, record) => sum + record.nightPay, 0); // Added nightPay
    const weekendHoursPay = payrollRecords.reduce((sum, record) => sum + record.weekendPay, 0); // Added weekendPay

    const totalWages = grossSalary + overtime + eveningHoursPay + nightHoursPay + weekendHoursPay; // Sum all relevant pay components

    const socialSecurity = this.calculateSocialSecurity(totalWages);
    const taxWithheld = this.calculateTaxWithholding(
      totalWages,
      employee.salaryInfo.taxTable,
      employee.salaryInfo.taxCredit
    );

    const daysWorked = payrollRecords.length > 0 ? payrollRecords.length * 21 : 0; // Simplified, needs actual calculation based on timesheets

    return {
      employeeId: employee.id,
      bsn: employee.personalInfo.bsn,
      fullName: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
      periodData: {
        startDate: periodStart,
        endDate: periodEnd,
        daysWorked,
      },
      wages: {
        grossSalary,
        overtime,
        bonuses: 0, // Placeholder
        holidayAllowance: payrollRecords.reduce((sum, record) => sum + record.vacationPay, 0), // Corrected: use vacationPay
        otherAllowances: payrollRecords.reduce((sum, record) => sum + record.travelAllowance, 0), // Corrected: use travelAllowance
        total: totalGross,
      },
      deductions: {
        pensionEmployee: payrollRecords.reduce((sum, record) => sum + record.taxes.pensionEmployee, 0), // Corrected: use taxes.pensionEmployee
        otherDeductions: totalDeductions - payrollRecords.reduce((sum, record) => sum + record.taxes.pensionEmployee, 0), // Other deductions
        total: totalDeductions,
      },
      tax: {
        taxableWage: totalWages,
        taxWithheld,
        taxCredit: employee.salaryInfo.taxCredit,
        taxTable: employee.salaryInfo.taxTable,
      },
      socialSecurity,
      netWage: totalNet,
    };
  }

  static validateTaxReturn(taxReturn: TaxReturn): ValidationError[] {
    const errors: ValidationError[] = [];

    if (taxReturn.employeeData.length === 0) {
      errors.push({
        field: 'employeeData',
        code: 'NO_EMPLOYEES',
        message: 'Geen werknemers gevonden voor deze periode',
        severity: 'error',
      });
    }

    taxReturn.employeeData.forEach((empData) => {
      if (!this.validateBSN(empData.bsn)) {
        errors.push({
          field: 'bsn',
          code: 'INVALID_BSN',
          message: `Ongeldig BSN nummer voor ${empData.fullName}`,
          severity: 'error',
          employeeId: empData.employeeId,
        });
      }

      if (empData.wages.total <= 0) {
        errors.push({
          field: 'wages',
          code: 'NO_WAGES',
          message: `Geen loon gevonden voor ${empData.fullName}`,
          severity: 'warning',
          employeeId: empData.employeeId,
        });
      }

      if (empData.tax.taxWithheld < 0) {
        errors.push({
          field: 'tax',
          code: 'NEGATIVE_TAX',
          message: `Negatieve loonheffing voor ${empData.fullName}`,
          severity: 'error',
          employeeId: empData.employeeId,
        });
      }
    });

    if (taxReturn.totals.totalGrossWages <= 0) {
      errors.push({
        field: 'totals',
        code: 'NO_TOTAL_WAGES',
        message: 'Totaal bruto loon is 0 of negatief',
        severity: 'error',
      });
    }

    return errors;
  }

  static generateLoonaangifteXML(taxReturn: TaxReturn, company: Company): string {
    const period = taxReturn.period;
    const periodNumber = period.month || period.quarter || 0;

    const xmlData: LoonaangifteXML = {
      header: {
        submitterKvK: company.kvk,
        submitterTaxNumber: company.taxNumber,
        contactPerson: company.contactInfo.email.split('@'),
        contactEmail: company.contactInfo.email,
        contactPhone: company.contactInfo.phone,
      },
      period: {
        year: period.year,
        periodNumber,
        periodType: period.type === 'monthly' ? 'maand' : period.type === 'quarterly' ? 'kwartaal' : 'jaar',
      },
      employees: taxReturn.employeeData.map((empData) => this.mapToXMLEmployee(empData)),
      totals: {
        totalLoon: taxReturn.totals.totalGrossWages,
        totalIngehouden: taxReturn.totals.totalTaxWithheld,
        totalPremies: taxReturn.totals.totalSocialContributions,
      },
    };

    return this.buildXMLString(xmlData);
  }

  private static mapToXMLEmployee(empData: EmployeeTaxData): XMLEmployeeData {
    const nameParts = empData.fullName.split(' ');
    const achternaam = nameParts[nameParts.length - 1];
    const voorletters = nameParts.charAt(0).toUpperCase();

    return {
      bsn: empData.bsn,
      voorletters,
      achternaam,
      geboortedatum: format(new Date(), 'yyyy-MM-dd'), // Placeholder, should come from employee data
      inkomstenverhouding: {
        datumAanvang: format(empData.periodData.startDate, 'yyyy-MM-dd'),
        datumEinde: format(empData.periodData.endDate, 'yyyy-MM-dd'),
        codeAardArbeidsverhouding: '10', // Example code
        codeSoortInkomstenverhouding: '11', // Example code
      },
      loongegevens: {
        loonTijdvak: format(empData.periodData.startDate, 'yyyy-MM'),
        loonOverTijdvak: empData.wages.total,
        loonheffing: empData.tax.taxWithheld,
        premieVolksverzekeringen: {
          aow: empData.socialSecurity.aow,
          wlz: empData.socialSecurity.wlz,
        },
        premieWerknemersverzekeringen: {
          ww: empData.socialSecurity.ww,
        },
      },
    };
  }

  private static buildXMLString(data: LoonaangifteXML): string {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Loonaangifte xmlns="http://www.nltaxonomie.nl/2023/loonaangifte" version="2023.01">
  <Bericht>
    <BerichtVersie>2023.01</BerichtVersie>
    <BerichtType>Loonaangifte</BerichtType>
    <BerichtDatum>${format(new Date(), 'yyyy-MM-dd')}</BerichtDatum>
  </Bericht>
  <Administratie>
    <Administratienummer>${data.header.submitterKvK}</Administratienummer>
    <LoonheffingsnummerInhoudingsplichtige>${data.header.submitterTaxNumber}</LoonheffingsnummerInhoudingsplichtige>
    <Contactpersoon>
      <Naam>${data.header.contactPerson}</Naam>
      <Email>${data.header.contactEmail}</Email>
      <Telefoon>${data.header.contactPhone}</Telefoon>
    </Contactpersoon>
  </Administratie>
  <Tijdvak>
    <Jaar>${data.period.year}</Jaar>
    <Periode>${data.period.periodNumber}</Periode>
    <PeriodeType>${data.period.periodType}</PeriodeType>
  </Tijdvak>
  <Werknemers>
${data.employees.map(emp => this.generateEmployeeXML(emp)).join('\n')}
  </Werknemers>
  <Totalen>
    <TotaalLoon>${data.totals.totalLoon.toFixed(2)}</TotaalLoon>
    <TotaalIngehouden>${data.totals.totalIngehouden.toFixed(2)}</TotaalIngehouden>
    <TotaalPremies>${data.totals.totalPremies.toFixed(2)}</TotaalPremies>
  </Totalen>
</Loonaangifte>`;

    return xml;
  }

  private static generateEmployeeXML(emp: XMLEmployeeData): string {
    return `    <Werknemer>
      <BSN>${emp.bsn}</BSN>
      <Voorletters>${emp.voorletters}</Voorletters>
      <Achternaam>${emp.achternaam}</Achternaam>
      <Geboortedatum>${emp.geboortedatum}</Geboortedatum>
      <Inkomstenverhouding>
        <DatumAanvang>${emp.inkomstenverhouding.datumAanvang}</DatumAanvang>
        ${emp.inkomstenverhouding.datumEinde ? `<DatumEinde>${emp.inkomstenverhouding.datumEinde}</DatumEinde>` : ''}
        <CodeAardArbeidsverhouding>${emp.inkomstenverhouding.codeAardArbeidsverhouding}</CodeAardArbeidsverhouding>
        <CodeSoortInkomstenverhouding>${emp.inkomstenverhouding.codeSoortInkomstenverhouding}</CodeSoortInkomstenverhouding>
      </Inkomstenverhouding>
      <Loongegevens>
        <LoonTijdvak>${emp.loongegevens.loonTijdvak}</LoonTijdvak>
        <LoonOverTijdvak>${emp.loongegevens.loonOverTijdvak.toFixed(2)}</LoonOverTijdvak>
        <Loonheffing>${emp.loongegevens.loonheffing.toFixed(2)}</Loonheffing>
        <PremieVolksverzekeringen>
          <AOW>${emp.loongegevens.premieVolksverzekeringen.aow.toFixed(2)}</AOW>
          <WLZ>${emp.loongegevens.premieVolksverzekeringen.wlz.toFixed(2)}</WLZ>
        </PremieVolksverzekeringen>
        <PremieWerknemersverzekeringen>
          <WW>${emp.loongegevens.premieWerknemersverzekeringen.ww.toFixed(2)}</WW>
        </PremieWerknemersverzekeringen>
      </Loongegevens>
    </Werknemer>`;
  }

  static getPeriodDates(year: number, periodType: PeriodType, periodNumber?: number): {
    startDate: Date;
    endDate: Date;
  } {
    if (periodType === 'monthly' && periodNumber) {
      return {
        startDate: startOfMonth(new Date(year, periodNumber - 1, 1)),
        endDate: endOfMonth(new Date(year, periodNumber - 1, 1)),
      };
    } else if (periodType === 'quarterly' && periodNumber) {
      const quarterStartMonth = (periodNumber - 1) * 3;
      return {
        startDate: startOfQuarter(new Date(year, quarterStartMonth, 1)),
        endDate: endOfQuarter(new Date(year, quarterStartMonth, 1)),
      };
    } else {
      return {
        startDate: startOfYear(new Date(year, 0, 1)),
        endDate: endOfYear(new Date(year, 0, 1)),
      };
    }
  }

  static calculateTotals(employeeData: EmployeeTaxData[]): TaxReturn['totals'] {
    return {
      totalGrossWages: employeeData.reduce((sum, emp) => sum + emp.wages.total, 0),
      totalTaxWithheld: employeeData.reduce((sum, emp) => sum + emp.tax.taxWithheld, 0),
      totalSocialContributions: employeeData.reduce((sum, emp) => sum + emp.socialSecurity.total, 0),
      totalNetWages: employeeData.reduce((sum, emp) => sum + emp.netWage, 0),
      numberOfEmployees: employeeData.length,
    };
  }
}