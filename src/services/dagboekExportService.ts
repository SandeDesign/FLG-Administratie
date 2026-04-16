import { bankImportService } from './bankImportService';
import { supplierService } from './supplierService';
import { BankTransaction } from '../types/bankImport';
import { Grootboekrekening } from '../types/supplier';

export type ExportFormat = 'exact_online' | 'snelstart' | 'twinfield' | 'csv';

interface DagboekRegel {
  datum: string;
  boekstuk: string;
  omschrijving: string;
  grootboekCode: string;
  grootboekNaam: string;
  debet: number;
  credit: number;
  btw: string;
  relatieCode: string;
  relatieNaam: string;
}

export const dagboekExportService = {
  async getConfirmedTransactions(companyId: string): Promise<BankTransaction[]> {
    return bankImportService.getTransactionsByStatus(companyId, 'confirmed');
  },

  async buildDagboekRegels(
    companyId: string,
    transactions: BankTransaction[],
    grootboekrekeningen: Grootboekrekening[]
  ): Promise<DagboekRegel[]> {
    const gbMap = new Map(grootboekrekeningen.map(g => [g.code, g]));
    const crediteuren = await supplierService.getCrediteuren(companyId);
    const debiteuren = await supplierService.getDebiteuren(companyId);

    const regels: DagboekRegel[] = [];

    for (const t of transactions) {
      const date = t.date instanceof Date ? t.date : new Date(t.date);
      const datum = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const gb = t.grootboekrekening ? gbMap.get(t.grootboekrekening) : undefined;
      const btwCode = gb?.btw || '';

      let relatieCode = '';
      let relatieNaam = '';
      if (t.beneficiary) {
        if (t.amount < 0) {
          const cred = crediteuren.find(c => c.name === t.beneficiary);
          if (cred) { relatieCode = cred.code; relatieNaam = cred.name; }
        } else {
          const deb = debiteuren.find(d => d.name === t.beneficiary);
          if (deb) { relatieCode = deb.code; relatieNaam = deb.name; }
        }
      }

      const absAmount = Math.abs(t.amount);
      const boekstuk = t.matchedInvoiceNumber || t.reference || t.id.substring(0, 10);
      const omschrijving = t.description?.substring(0, 100) || t.beneficiary || '';

      // Bankboek regel: bank tegenover grootboek
      regels.push({
        datum,
        boekstuk,
        omschrijving,
        grootboekCode: t.grootboekrekening || (t.amount < 0 ? '3000' : '1200'),
        grootboekNaam: t.grootboekrekeningName || gb?.name || (t.amount < 0 ? 'Crediteuren' : 'Debiteuren'),
        debet: t.amount >= 0 ? 0 : absAmount,
        credit: t.amount >= 0 ? absAmount : 0,
        btw: btwCode,
        relatieCode,
        relatieNaam,
      });

      regels.push({
        datum,
        boekstuk,
        omschrijving,
        grootboekCode: '1100',
        grootboekNaam: 'Bank',
        debet: t.amount >= 0 ? absAmount : 0,
        credit: t.amount >= 0 ? 0 : absAmount,
        btw: '',
        relatieCode: '',
        relatieNaam: '',
      });
    }

    return regels;
  },

  generateCSV(regels: DagboekRegel[], format: ExportFormat): string {
    if (format === 'exact_online') {
      return this.generateExactOnline(regels);
    } else if (format === 'snelstart') {
      return this.generateSnelStart(regels);
    } else if (format === 'twinfield') {
      return this.generateTwinfield(regels);
    }
    return this.generateGenericCSV(regels);
  },

  generateExactOnline(regels: DagboekRegel[]): string {
    const header = 'Dagboek;Boekstuk;Datum;Grootboek;Omschrijving;Debet;Credit;BTW-code;Relatiecode';
    const rows = regels.map(r =>
      `BNK;${r.boekstuk};${r.datum};${r.grootboekCode};${r.omschrijving.replace(/;/g, ',')};${r.debet.toFixed(2)};${r.credit.toFixed(2)};${r.btw};${r.relatieCode}`
    );
    return [header, ...rows].join('\n');
  },

  generateSnelStart(regels: DagboekRegel[]): string {
    const header = 'Dagboekcode;Datum;Boekstuknummer;Grootboekrekening;Debet/Credit;Bedrag;Omschrijving;Relatienummer;BTW-code';
    const rows = regels.map(r => {
      const dc = r.debet > 0 ? 'D' : 'C';
      const bedrag = r.debet > 0 ? r.debet : r.credit;
      return `BNK;${r.datum};${r.boekstuk};${r.grootboekCode};${dc};${bedrag.toFixed(2)};${r.omschrijving.replace(/;/g, ',')};${r.relatieCode};${r.btw}`;
    });
    return [header, ...rows].join('\n');
  },

  generateTwinfield(regels: DagboekRegel[]): string {
    const header = 'Dagboek;Boekstuknr;Datum;Grootboek;Debet;Credit;Omschrijving;Relatie;BTW';
    const rows = regels.map(r =>
      `BNK;${r.boekstuk};${r.datum};${r.grootboekCode};${r.debet.toFixed(2)};${r.credit.toFixed(2)};${r.omschrijving.replace(/;/g, ',')};${r.relatieCode};${r.btw}`
    );
    return [header, ...rows].join('\n');
  },

  generateGenericCSV(regels: DagboekRegel[]): string {
    const header = 'Datum;Boekstuk;Omschrijving;Grootboek Code;Grootboek Naam;Debet;Credit;BTW;Relatie Code;Relatie Naam';
    const rows = regels.map(r =>
      `${r.datum};${r.boekstuk};${r.omschrijving.replace(/;/g, ',')};${r.grootboekCode};${r.grootboekNaam.replace(/;/g, ',')};${r.debet.toFixed(2)};${r.credit.toFixed(2)};${r.btw};${r.relatieCode};${r.relatieNaam.replace(/;/g, ',')}`
    );
    return [header, ...rows].join('\n');
  },

  downloadCSV(content: string, filename: string) {
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },
};
