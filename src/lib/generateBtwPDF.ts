import jsPDF from 'jspdf';
import { BankTransaction } from '../types/bankImport';
import { Grootboekrekening } from '../types/supplier';
import { OutgoingInvoice } from '../services/outgoingInvoiceService';
import { IncomingInvoice } from '../services/incomingInvoiceService';

const colors = {
  bronze: { r: 205, g: 133, b: 63 },
  bronzeLight: { r: 237, g: 195, b: 143 },
  bronzeDark: { r: 161, g: 98, b: 38 },
  dark: { r: 31, g: 41, b: 55 },
  mid: { r: 107, g: 114, b: 128 },
  light: { r: 249, g: 250, b: 251 },
  white: { r: 255, g: 255, b: 255 },
  red: { r: 220, g: 38, b: 38 },
  redLight: { r: 254, g: 226, b: 226 },
  green: { r: 22, g: 163, b: 74 },
  greenLight: { r: 220, g: 252, b: 231 },
  blue: { r: 37, g: 99, b: 235 },
  amber: { r: 180, g: 83, b: 9 },
  amberBg: { r: 254, g: 243, b: 199 },
  catBg: { r: 240, g: 244, b: 255 },
  catText: { r: 37, g: 99, b: 235 },
  border: { r: 229, g: 231, b: 235 },
  headerBg: { r: 55, g: 65, b: 81 },
};

const BTW_TARIEVEN: Array<{ key: string; label: string; pct: number }> = [
  { key: 'hoog', label: '21% Hoog tarief', pct: 21 },
  { key: 'laag', label: '9% Laag tarief', pct: 9 },
  { key: 'geen', label: '0% Geen BTW', pct: 0 },
  { key: 'verlegd', label: 'Verlegd', pct: 0 },
];

const BTW_PERCENTAGES: Record<string, number> = {
  hoog: 21,
  laag: 9,
  geen: 0,
  verlegd: 0,
};

interface BtwRow {
  code: string;
  naam: string;
  btwType: string;
  btwPct: number;
  netto: number;
  btw: number;
  bruto: number;
  count: number;
  isUncat: boolean;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(n);

function safeDate(d: Date | number): Date {
  return d instanceof Date ? d : new Date(d);
}
function isValid(d: Date): boolean {
  return !isNaN(d.getTime());
}
function formatDutchDate(d: Date): string {
  return isValid(d)
    ? d.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : 'Onbekend';
}

export const generateBtwPDF = (
  transactions: BankTransaction[],
  grootboekrekeningen: Grootboekrekening[],
  outgoingInvoices: OutgoingInvoice[],
  incomingInvoices: IncomingInvoice[],
  companyName: string,
  year: number,
  quarter: number | null
) => {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const marginL = 15;
  const marginR = 15;
  const contentWidth = pageWidth - marginL - marginR;
  let y = 0;
  let pageNum = 1;

  const periodLabel = quarter ? `Q${quarter} ${year}` : `Heel jaar ${year}`;
  const generatedDate = new Date().toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });

  // --- Berekeningen ---
  const gbMap = new Map(grootboekrekeningen.map((g) => [g.code, g]));
  const outInvMap = new Map(outgoingInvoices.map((i) => [i.id || '', i]));
  const inInvMap = new Map(incomingInvoices.map((i) => [i.id || '', i]));

  // Effectieve BTW info per transactie (invoice > grootboek), consistent btwType + bedragen
  const pctToType = (pct: number): string => {
    if (pct >= 20 && pct <= 22) return 'hoog';
    if (pct >= 8 && pct <= 10) return 'laag';
    return 'geen';
  };

  const getEffective = (t: BankTransaction): { btwType: string; pct: number; netto: number; btw: number } => {
    const abs = Math.abs(t.amount);
    if (t.matchedInvoiceId) {
      const inv = t.matchedInvoiceType === 'outgoing'
        ? outInvMap.get(t.matchedInvoiceId)
        : inInvMap.get(t.matchedInvoiceId);
      if (inv) {
        const total = Number(inv.totalAmount);
        let vat = Number(inv.vatAmount);
        let net = Number(inv.amount);
        if (!isFinite(vat)) vat = 0;
        if (!isFinite(net) && isFinite(total)) net = total - vat;
        if (isFinite(total) && total > 0 && isFinite(net) && isFinite(vat)) {
          const ratio = abs / total;
          const netto = net * ratio;
          const btw = vat * ratio;
          const pct = net > 0 ? Math.round((vat / net) * 100) : 0;
          return { btwType: pctToType(pct), pct, netto, btw };
        }
      }
    }
    const gb = t.grootboekrekening ? gbMap.get(t.grootboekrekening) : undefined;
    const btwType = gb?.btw || 'geen';
    const pct = BTW_PERCENTAGES[btwType] ?? 0;
    const netto = pct > 0 ? abs / (1 + pct / 100) : abs;
    const btw = abs - netto;
    return { btwType, pct, netto, btw };
  };

  const deriveBtw = (t: BankTransaction): { netto: number; btw: number; pct: number } => {
    const e = getEffective(t);
    return { netto: e.netto, btw: e.btw, pct: e.pct };
  };

  const regelMap = new Map<string, {
    code: string; naam: string; btwType: string; btwPct: number;
    inNetto: number; inBtw: number; inBruto: number;
    uitNetto: number; uitBtw: number; uitBruto: number;
    count: number;
  }>();

  for (const t of transactions) {
    const isIn = t.amount >= 0;
    const abs = Math.abs(t.amount);
    const eff = getEffective(t);
    const netto = eff.netto;
    const btw = eff.btw;
    let key: string, code: string, naam: string, btwType: string, pct: number;

    if (t.grootboekrekening) {
      const gb = gbMap.get(t.grootboekrekening);
      btwType = eff.btwType;
      pct = eff.pct;
      key = `${t.grootboekrekening}_${btwType}`;
      code = t.grootboekrekening;
      naam = gb?.name || t.grootboekrekening;
    } else {
      btwType = '?';
      pct = 0;
      key = isIn ? '_in' : '_uit';
      code = '—';
      naam = isIn ? 'Zonder grootboek (inkomend)' : 'Zonder grootboek (uitgaand)';
    }

    let r = regelMap.get(key);
    if (!r) {
      r = { code, naam, btwType, btwPct: pct, inNetto: 0, inBtw: 0, inBruto: 0, uitNetto: 0, uitBtw: 0, uitBruto: 0, count: 0 };
      regelMap.set(key, r);
    }

    if (isIn) { r.inBruto += abs; r.inNetto += netto; r.inBtw += btw; }
    else { r.uitBruto += abs; r.uitNetto += netto; r.uitBtw += btw; }
    r.count++;
  }

  const rows: BtwRow[] = [];
  for (const r of regelMap.values()) {
    rows.push({
      code: r.code,
      naam: r.naam,
      btwType: r.btwType,
      btwPct: r.btwPct,
      netto: r.inNetto - r.uitNetto,
      btw: r.inBtw - r.uitBtw,
      bruto: r.inBruto - r.uitBruto,
      count: r.count,
      isUncat: r.btwType === '?',
    });
  }
  rows.sort((a, b) => a.code.localeCompare(b.code));

  let totaalAfdracht = 0;
  let totaalVoorbelasting = 0;
  for (const r of regelMap.values()) {
    totaalAfdracht += r.inBtw;
    totaalVoorbelasting += r.uitBtw;
  }
  const saldo = totaalAfdracht - totaalVoorbelasting;

  const totaalIn = transactions.filter((t) => t.amount >= 0).reduce((s, t) => s + t.amount, 0);
  const totaalUit = transactions.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const zonderGb = transactions.filter((t) => !t.grootboekrekening).length;

  // BTW per tarief aggregatie — gebruikt effectieve BTW uit invoice/grootboek
  const tariefMap = new Map<string, { netto: number; btw: number; bruto: number; count: number }>();
  for (const t of transactions) {
    if (!t.grootboekrekening) continue;
    const eff = getEffective(t);
    const abs = Math.abs(t.amount);
    const sign = t.amount >= 0 ? 1 : -1;
    let entry = tariefMap.get(eff.btwType);
    if (!entry) { entry = { netto: 0, btw: 0, bruto: 0, count: 0 }; tariefMap.set(eff.btwType, entry); }
    entry.netto += sign * eff.netto;
    entry.btw += sign * eff.btw;
    entry.bruto += sign * abs;
    entry.count++;
  }

  // --- Helpers ---
  const addFooter = () => {
    const footerY = pageHeight - 10;
    pdf.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
    pdf.setLineWidth(0.3);
    pdf.line(marginL, footerY - 3, pageWidth - marginR, footerY - 3);
    pdf.setFontSize(8);
    pdf.setTextColor(colors.mid.r, colors.mid.g, colors.mid.b);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`${companyName} — BTW overzicht ${periodLabel}`, marginL, footerY);
    pdf.text(generatedDate, pageWidth / 2, footerY, { align: 'center' });
    pdf.text(`Pagina ${pageNum}`, pageWidth - marginR, footerY, { align: 'right' });
  };

  const addPage = () => {
    addFooter();
    pdf.addPage();
    pageNum++;
    y = 20;
  };

  const checkBreak = (needed: number) => {
    if (y + needed > pageHeight - 18) addPage();
  };

  // --- Cover / header (55mm bronze band) ---
  pdf.setFillColor(colors.bronze.r, colors.bronze.g, colors.bronze.b);
  pdf.rect(0, 0, pageWidth, 55, 'F');
  // subtle darker band at bottom for depth
  pdf.setFillColor(colors.bronzeDark.r, colors.bronzeDark.g, colors.bronzeDark.b);
  pdf.rect(0, 52, pageWidth, 3, 'F');

  // Left: title + company + period
  pdf.setTextColor(colors.white.r, colors.white.g, colors.white.b);
  pdf.setFontSize(24);
  pdf.setFont('helvetica', 'bold');
  pdf.text('BTW OVERZICHT', marginL, 22);
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'normal');
  pdf.text(companyName, marginL, 33);
  pdf.setFontSize(10);
  pdf.setTextColor(colors.bronzeLight.r, colors.bronzeLight.g, colors.bronzeLight.b);
  pdf.text(periodLabel, marginL, 44);

  // Right: dominant saldo hero
  pdf.setFontSize(28);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(colors.white.r, colors.white.g, colors.white.b);
  pdf.text(fmt(Math.abs(saldo)), pageWidth - marginR, 26, { align: 'right' });
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(colors.bronzeLight.r, colors.bronzeLight.g, colors.bronzeLight.b);
  pdf.text(saldo >= 0 ? 'Te betalen aan Belastingdienst' : 'Terug te ontvangen', pageWidth - marginR, 37, { align: 'right' });
  pdf.setFontSize(8);
  pdf.text(`Gegenereerd ${generatedDate}`, pageWidth - marginR, 46, { align: 'right' });

  // --- 3 summary boxes ---
  y = 65;
  const boxW = (contentWidth - 10) / 3;
  const boxH = 32;

  const drawBox = (x: number, label: string, value: string, sublabel: string, accent: { r: number; g: number; b: number }) => {
    // Modern minimalist box: witte achtergrond, dunne border, bronze accent top bar
    pdf.setFillColor(colors.white.r, colors.white.g, colors.white.b);
    pdf.rect(x, y, boxW, boxH, 'F');
    pdf.setFillColor(accent.r, accent.g, accent.b);
    pdf.rect(x, y, boxW, 2, 'F');
    pdf.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
    pdf.setLineWidth(0.3);
    pdf.rect(x, y, boxW, boxH);

    pdf.setFontSize(7.5);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(colors.mid.r, colors.mid.g, colors.mid.b);
    pdf.text(label.toUpperCase(), x + 5, y + 9);

    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(colors.dark.r, colors.dark.g, colors.dark.b);
    pdf.text(value, x + 5, y + 20);

    pdf.setFontSize(7.5);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(colors.mid.r, colors.mid.g, colors.mid.b);
    pdf.text(sublabel, x + 5, y + 27);
  };

  drawBox(marginL, 'Af te dragen BTW', fmt(totaalAfdracht), 'BTW op verkopen (inkomend)', colors.red);
  drawBox(marginL + boxW + 5, 'Voorbelasting', fmt(totaalVoorbelasting), 'BTW op inkopen (uitgaand)', colors.green);
  drawBox(
    marginL + 2 * (boxW + 5),
    `${transactions.length} transacties`,
    `${transactions.length - zonderGb} gekoppeld`,
    zonderGb > 0 ? `${zonderGb} zonder grootboek` : 'Alle transacties gekoppeld',
    zonderGb > 0 ? colors.amber : colors.blue
  );

  y += boxH + 10;

  // --- Inkomend/Uitgaand row ---
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(colors.dark.r, colors.dark.g, colors.dark.b);
  pdf.text('Periode totalen', marginL, y);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(colors.green.r, colors.green.g, colors.green.b);
  pdf.text(`▲ Inkomend: ${fmt(totaalIn)}`, marginL + 40, y);
  pdf.setTextColor(colors.red.r, colors.red.g, colors.red.b);
  pdf.text(`▼ Uitgaand: ${fmt(totaalUit)}`, marginL + 100, y);
  y += 6;

  if (zonderGb > 0) {
    pdf.setFillColor(colors.amberBg.r, colors.amberBg.g, colors.amberBg.b);
    pdf.rect(marginL, y, contentWidth, 8, 'F');
    pdf.setDrawColor(colors.amber.r, colors.amber.g, colors.amber.b);
    pdf.setLineWidth(0.3);
    pdf.rect(marginL, y, contentWidth, 8);
    pdf.setFontSize(8);
    pdf.setTextColor(colors.amber.r, colors.amber.g, colors.amber.b);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`${zonderGb} transacties zonder grootboekrekening — niet meegerekend in BTW totalen`, marginL + 4, y + 5.2);
    y += 12;
  } else {
    y += 4;
  }

  // --- BTW PER TARIEF (2x2 grid) ---
  y += 4;
  pdf.setDrawColor(colors.bronze.r, colors.bronze.g, colors.bronze.b);
  pdf.setLineWidth(0.8);
  pdf.line(marginL, y, marginL + 40, y);
  y += 4;
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(colors.dark.r, colors.dark.g, colors.dark.b);
  pdf.text('BTW PER TARIEF', marginL, y);
  y += 5;

  const tarW = (contentWidth - 5) / 2;
  const tarH = 30;

  BTW_TARIEVEN.forEach(({ key, label, pct }, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const xPos = marginL + col * (tarW + 5);
    const yPos = y + row * (tarH + 4);
    const tarData = tariefMap.get(key);

    // Modern card: white bg, thin border, bronze top accent
    pdf.setFillColor(colors.white.r, colors.white.g, colors.white.b);
    pdf.rect(xPos, yPos, tarW, tarH, 'F');
    pdf.setFillColor(colors.bronze.r, colors.bronze.g, colors.bronze.b);
    pdf.rect(xPos, yPos, tarW, 2, 'F');
    pdf.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
    pdf.setLineWidth(0.3);
    pdf.rect(xPos, yPos, tarW, tarH);

    // Header: rate label
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(colors.dark.r, colors.dark.g, colors.dark.b);
    pdf.text(label, xPos + 6, yPos + 10);

    if (tarData && tarData.count > 0) {
      pdf.setFontSize(7.5);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(colors.mid.r, colors.mid.g, colors.mid.b);
      pdf.text(`${tarData.count} transacties`, xPos + tarW - 4, yPos + 10, { align: 'right' });

      // Values in 3 rows
      pdf.setFontSize(8);
      pdf.setTextColor(colors.mid.r, colors.mid.g, colors.mid.b);
      pdf.text('Netto', xPos + 6, yPos + 18);
      pdf.setTextColor(colors.dark.r, colors.dark.g, colors.dark.b);
      pdf.setFont('helvetica', 'bold');
      pdf.text(fmt(tarData.netto), xPos + tarW - 4, yPos + 18, { align: 'right' });

      if (pct > 0) {
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(colors.mid.r, colors.mid.g, colors.mid.b);
        pdf.text(`BTW ${pct}%`, xPos + 6, yPos + 23);
        pdf.setTextColor(tarData.btw >= 0 ? colors.red.r : colors.green.r, tarData.btw >= 0 ? colors.red.g : colors.green.g, tarData.btw >= 0 ? colors.red.b : colors.green.b);
        pdf.setFont('helvetica', 'bold');
        pdf.text(fmt(tarData.btw), xPos + tarW - 4, yPos + 23, { align: 'right' });
      }

      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(colors.mid.r, colors.mid.g, colors.mid.b);
      pdf.text('Bruto', xPos + 6, yPos + 28);
      pdf.setTextColor(tarData.bruto >= 0 ? colors.green.r : colors.red.r, tarData.bruto >= 0 ? colors.green.g : colors.red.g, tarData.bruto >= 0 ? colors.green.b : colors.red.b);
      pdf.setFont('helvetica', 'bold');
      pdf.text(fmt(tarData.bruto), xPos + tarW - 4, yPos + 28, { align: 'right' });
    } else {
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'italic');
      pdf.setTextColor(colors.mid.r, colors.mid.g, colors.mid.b);
      pdf.text('Geen transacties', xPos + 6, yPos + 20);
    }
  });

  y += 2 * (tarH + 4) + 6;

  // --- Specificatie tabel ---
  checkBreak(20);
  y += 4;
  pdf.setDrawColor(colors.bronze.r, colors.bronze.g, colors.bronze.b);
  pdf.setLineWidth(0.8);
  pdf.line(marginL, y, marginL + 40, y);
  y += 4;
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(colors.dark.r, colors.dark.g, colors.dark.b);
  pdf.text('SPECIFICATIE PER GROOTBOEKREKENING', marginL, y);
  y += 5;

  // Kolommen
  const cCode = 18;
  const cNetto = 32;
  const cBtwBedrag = 32;
  const cBruto = 32;
  const cCount = 16;
  const cName = contentWidth - cCode - cNetto - cBtwBedrag - cBruto - cCount;

  const drawSpecHeaders = () => {
    pdf.setFontSize(7.5);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(colors.mid.r, colors.mid.g, colors.mid.b);
    let x = marginL + 2;
    pdf.text('CODE', x, y + 4); x += cCode;
    pdf.text('REKENING', x, y + 4); x += cName;
    pdf.text('NETTO', x + cNetto - 4, y + 4, { align: 'right' }); x += cNetto;
    pdf.text('BTW BEDRAG', x + cBtwBedrag - 4, y + 4, { align: 'right' }); x += cBtwBedrag;
    pdf.text('BRUTO', x + cBruto - 4, y + 4, { align: 'right' }); x += cBruto;
    pdf.text('AANTAL', x + cCount - 4, y + 4, { align: 'right' });
    y += 6;
    // dunne bronze onderlijn
    pdf.setDrawColor(colors.bronze.r, colors.bronze.g, colors.bronze.b);
    pdf.setLineWidth(0.6);
    pdf.line(marginL, y, pageWidth - marginR, y);
    y += 3;
  };

  drawSpecHeaders();

  // Groepeer rows per BTW tarief
  const groepen: Array<{ key: string; label: string; rows: BtwRow[] }> = [
    { key: 'hoog', label: '21% Hoog tarief', rows: rows.filter(r => r.btwType === 'hoog') },
    { key: 'laag', label: '9% Laag tarief', rows: rows.filter(r => r.btwType === 'laag') },
    { key: 'geen', label: '0% Geen BTW', rows: rows.filter(r => r.btwType === 'geen') },
    { key: 'verlegd', label: 'Verlegd', rows: rows.filter(r => r.btwType === 'verlegd') },
    { key: '?', label: 'Zonder grootboek', rows: rows.filter(r => r.isUncat) },
  ].filter(g => g.rows.length > 0);

  let idx = 0;
  for (const groep of groepen) {
    // Groep header — minimalistisch: dunne bronze lijn + uppercase titel
    checkBreak(14);
    y += 4;
    pdf.setDrawColor(colors.bronze.r, colors.bronze.g, colors.bronze.b);
    pdf.setLineWidth(0.8);
    pdf.line(marginL, y, marginL + 40, y);
    y += 4;
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(colors.dark.r, colors.dark.g, colors.dark.b);
    pdf.text(groep.label.toUpperCase(), marginL, y);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(colors.mid.r, colors.mid.g, colors.mid.b);
    pdf.text(`${groep.rows.length} rekening${groep.rows.length !== 1 ? 'en' : ''}`, pageWidth - marginR, y, { align: 'right' });
    y += 4;

    let grpNetto = 0, grpBtw = 0, grpBruto = 0, grpCount = 0;
    for (const r of groep.rows) {
      checkBreak(7);
      if (y === 20) drawSpecHeaders();

      // Subtiele highlight voor uncat, anders geen fill
      if (r.isUncat) {
        pdf.setFillColor(colors.amberBg.r, colors.amberBg.g, colors.amberBg.b);
        pdf.rect(marginL, y, contentWidth, 6, 'F');
      }

      pdf.setFontSize(8.5);
      pdf.setTextColor(r.isUncat ? colors.amber.r : colors.bronze.r, r.isUncat ? colors.amber.g : colors.bronze.g, r.isUncat ? colors.amber.b : colors.bronze.b);
      pdf.setFont('helvetica', 'bold');
      let x = marginL + 2;
      pdf.text(r.code, x, y + 4); x += cCode;

      pdf.setTextColor(colors.dark.r, colors.dark.g, colors.dark.b);
      pdf.setFont('helvetica', r.isUncat ? 'italic' : 'normal');
      pdf.setFontSize(8.5);
      const nameTrunc = pdf.getTextWidth(r.naam) > cName - 2
        ? pdf.splitTextToSize(r.naam, cName - 2)[0]
        : r.naam;
      pdf.text(nameTrunc, x, y + 4); x += cName;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.5);
      pdf.setTextColor(colors.dark.r, colors.dark.g, colors.dark.b);
      pdf.text(r.isUncat ? '—' : fmt(r.netto), x + cNetto - 4, y + 4, { align: 'right' }); x += cNetto;

      if (r.isUncat || r.btw === 0) {
        pdf.setTextColor(colors.mid.r, colors.mid.g, colors.mid.b);
        pdf.text('—', x + cBtwBedrag - 4, y + 4, { align: 'right' });
      } else {
        pdf.setTextColor(r.btw > 0 ? colors.red.r : colors.green.r, r.btw > 0 ? colors.red.g : colors.green.g, r.btw > 0 ? colors.red.b : colors.green.b);
        pdf.setFont('helvetica', 'normal');
        pdf.text(fmt(r.btw), x + cBtwBedrag - 4, y + 4, { align: 'right' });
      }
      x += cBtwBedrag;

      pdf.setTextColor(r.bruto > 0 ? colors.green.r : r.bruto < 0 ? colors.red.r : colors.dark.r, r.bruto > 0 ? colors.green.g : r.bruto < 0 ? colors.red.g : colors.dark.g, r.bruto > 0 ? colors.green.b : r.bruto < 0 ? colors.red.b : colors.dark.b);
      pdf.setFont('helvetica', 'bold');
      pdf.text(fmt(r.bruto), x + cBruto - 4, y + 4, { align: 'right' }); x += cBruto;
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(colors.mid.r, colors.mid.g, colors.mid.b);
      pdf.text(String(r.count), x + cCount - 4, y + 4, { align: 'right' });

      // Zeer dunne rij scheiding
      pdf.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
      pdf.setLineWidth(0.1);
      pdf.line(marginL, y + 6, pageWidth - marginR, y + 6);

      grpNetto += r.netto; grpBtw += r.btw; grpBruto += r.bruto; grpCount += r.count;
      y += 6;
      idx++;
    }

    // Groep subtotaal — dunne lijn + bold text, geen fill
    checkBreak(8);
    y += 1;
    pdf.setDrawColor(colors.bronze.r, colors.bronze.g, colors.bronze.b);
    pdf.setLineWidth(0.4);
    pdf.line(marginL, y, pageWidth - marginR, y);
    y += 3;
    pdf.setFontSize(8.5);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(colors.dark.r, colors.dark.g, colors.dark.b);
    let sx = marginL + 2;
    pdf.text(`Subtotaal`, sx, y + 3); sx += cCode + cName;
    if (groep.key !== '?') {
      pdf.text(fmt(grpNetto), sx + cNetto - 4, y + 3, { align: 'right' });
    } else {
      pdf.setTextColor(colors.mid.r, colors.mid.g, colors.mid.b);
      pdf.text('—', sx + cNetto - 4, y + 3, { align: 'right' });
      pdf.setTextColor(colors.dark.r, colors.dark.g, colors.dark.b);
    }
    sx += cNetto;
    if (groep.key !== '?' && grpBtw !== 0) {
      pdf.setTextColor(grpBtw > 0 ? colors.red.r : colors.green.r, grpBtw > 0 ? colors.red.g : colors.green.g, grpBtw > 0 ? colors.red.b : colors.green.b);
      pdf.text(fmt(grpBtw), sx + cBtwBedrag - 4, y + 3, { align: 'right' });
    } else {
      pdf.setTextColor(colors.mid.r, colors.mid.g, colors.mid.b);
      pdf.text('—', sx + cBtwBedrag - 4, y + 3, { align: 'right' });
    }
    sx += cBtwBedrag;
    pdf.setTextColor(grpBruto > 0 ? colors.green.r : grpBruto < 0 ? colors.red.r : colors.dark.r, grpBruto > 0 ? colors.green.g : grpBruto < 0 ? colors.red.g : colors.dark.g, grpBruto > 0 ? colors.green.b : grpBruto < 0 ? colors.red.b : colors.dark.b);
    pdf.text(fmt(grpBruto), sx + cBruto - 4, y + 3, { align: 'right' }); sx += cBruto;
    pdf.setTextColor(colors.mid.r, colors.mid.g, colors.mid.b);
    pdf.setFont('helvetica', 'normal');
    pdf.text(String(grpCount), sx + cCount - 4, y + 3, { align: 'right' });
    y += 6;
    y += 4;
  }

  // Grand total — dikke bronze lijn + bold, geen fill
  checkBreak(12);
  y += 2;
  pdf.setDrawColor(colors.bronze.r, colors.bronze.g, colors.bronze.b);
  pdf.setLineWidth(1.2);
  pdf.line(marginL, y, pageWidth - marginR, y);
  y += 5;
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(colors.dark.r, colors.dark.g, colors.dark.b);
  let tx = marginL + 2;
  pdf.text('TOTAAL', tx, y); tx += cCode + cName;
  pdf.text(fmt(rows.reduce((s, r) => s + (r.isUncat ? 0 : r.netto), 0)), tx + cNetto - 4, y, { align: 'right' }); tx += cNetto;
  const totalBtw = rows.reduce((s, r) => s + (r.isUncat ? 0 : r.btw), 0);
  pdf.setTextColor(totalBtw > 0 ? colors.red.r : totalBtw < 0 ? colors.green.r : colors.dark.r, totalBtw > 0 ? colors.red.g : totalBtw < 0 ? colors.green.g : colors.dark.g, totalBtw > 0 ? colors.red.b : totalBtw < 0 ? colors.green.b : colors.dark.b);
  pdf.text(fmt(totalBtw), tx + cBtwBedrag - 4, y, { align: 'right' }); tx += cBtwBedrag;
  pdf.setTextColor(colors.dark.r, colors.dark.g, colors.dark.b);
  pdf.text(fmt(rows.reduce((s, r) => s + r.bruto, 0)), tx + cBruto - 4, y, { align: 'right' }); tx += cBruto;
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(colors.mid.r, colors.mid.g, colors.mid.b);
  pdf.text(String(rows.reduce((s, r) => s + r.count, 0)), tx + cCount - 4, y, { align: 'right' });
  y += 2;
  pdf.setDrawColor(colors.bronze.r, colors.bronze.g, colors.bronze.b);
  pdf.setLineWidth(0.3);
  pdf.line(marginL, y, pageWidth - marginR, y);
  y += 8;

  // --- Transacties overzicht (per maand gegroepeerd) ---
  if (transactions.length > 0) {
    checkBreak(25);
    y += 4;
    pdf.setDrawColor(colors.bronze.r, colors.bronze.g, colors.bronze.b);
    pdf.setLineWidth(0.8);
    pdf.line(marginL, y, marginL + 40, y);
    y += 4;
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(colors.dark.r, colors.dark.g, colors.dark.b);
    pdf.text(`TRANSACTIEDETAILS`, marginL, y);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(colors.mid.r, colors.mid.g, colors.mid.b);
    pdf.text(`${transactions.length} transactie${transactions.length !== 1 ? 's' : ''}`, marginL + 55, y);
    y += 5;

    // Kolommen transacties — schoner, minder cramped
    const tDate = 18;
    const tBen = 46;
    const tGb = 14;
    const tBtw = 12;
    const tBruto = 28;
    const tDesc = contentWidth - tDate - tBen - tGb - tBtw - tBruto;

    const drawTxHeaders = () => {
      pdf.setFontSize(7.5);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(colors.mid.r, colors.mid.g, colors.mid.b);
      let x = marginL + 2;
      pdf.text('DATUM', x, y + 4); x += tDate;
      pdf.text('BEGUNSTIGDE', x, y + 4); x += tBen;
      pdf.text('OMSCHRIJVING / FACTUUR', x, y + 4); x += tDesc;
      pdf.text('GB', x, y + 4); x += tGb;
      pdf.text('BTW%', x, y + 4); x += tBtw;
      pdf.text('BEDRAG', x + tBruto - 4, y + 4, { align: 'right' });
      y += 6;
      pdf.setDrawColor(colors.bronze.r, colors.bronze.g, colors.bronze.b);
      pdf.setLineWidth(0.6);
      pdf.line(marginL, y, pageWidth - marginR, y);
      y += 3;
    };

    drawTxHeaders();

    const sorted = [...transactions].sort((a, b) => {
      const da = safeDate(a.date);
      const db = safeDate(b.date);
      if (!isValid(da) && !isValid(db)) return 0;
      if (!isValid(da)) return 1;
      if (!isValid(db)) return -1;
      return da.getTime() - db.getTime();
    });

    // Groepeer per maand
    const maandGroepen = new Map<string, BankTransaction[]>();
    for (const t of sorted) {
      const d = safeDate(t.date);
      const key = isValid(d) ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : 'onbekend';
      if (!maandGroepen.has(key)) maandGroepen.set(key, []);
      maandGroepen.get(key)!.push(t);
    }

    let tIdx = 0;
    for (const [maandKey, maandTxs] of maandGroepen) {
      // Maand header — minimalistisch: bronze lijn + uppercase titel
      checkBreak(14);
      y += 4;
      pdf.setDrawColor(colors.bronze.r, colors.bronze.g, colors.bronze.b);
      pdf.setLineWidth(0.8);
      pdf.line(marginL, y, marginL + 40, y);
      y += 4;
      const maandLabel = maandKey !== 'onbekend'
        ? new Date(maandKey + '-01').toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })
        : 'Onbekende datum';
      const maandBruto = maandTxs.reduce((s, t) => s + t.amount, 0);

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(colors.dark.r, colors.dark.g, colors.dark.b);
      pdf.text(maandLabel.toUpperCase(), marginL, y);
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(colors.mid.r, colors.mid.g, colors.mid.b);
      pdf.text(`${maandTxs.length} transactie${maandTxs.length !== 1 ? 's' : ''}`, marginL + 70, y);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(maandBruto >= 0 ? colors.green.r : colors.red.r, maandBruto >= 0 ? colors.green.g : colors.red.g, maandBruto >= 0 ? colors.green.b : colors.red.b);
      pdf.text(fmt(maandBruto), pageWidth - marginR, y, { align: 'right' });
      y += 4;

      for (const t of maandTxs) {
        checkBreak(6);
        if (y === 20) drawTxHeaders();

        const { btw, pct } = deriveBtw(t);
        const isUncat = !t.grootboekrekening;
        const btwLabel = isUncat ? '—' : btw > 0 ? `${pct}%` : '0%';

        // Alleen voor uncat subtiele highlight
        if (isUncat) {
          pdf.setFillColor(colors.amberBg.r, colors.amberBg.g, colors.amberBg.b);
          pdf.rect(marginL, y, contentWidth, 5.5, 'F');
        }

        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        let x = marginL + 2;

        pdf.setTextColor(colors.mid.r, colors.mid.g, colors.mid.b);
        pdf.text(formatDutchDate(safeDate(t.date)), x, y + 3.8); x += tDate;

        pdf.setTextColor(colors.dark.r, colors.dark.g, colors.dark.b);
        pdf.setFont('helvetica', 'bold');
        const benTrunc = pdf.splitTextToSize(t.beneficiary || '-', tBen - 2)[0];
        pdf.text(benTrunc, x, y + 3.8); x += tBen;

        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(colors.mid.r, colors.mid.g, colors.mid.b);
        const descText = t.matchedInvoiceNumber || t.description?.substring(0, 60) || '-';
        const descTrunc = pdf.splitTextToSize(descText, tDesc - 2)[0];
        pdf.text(descTrunc, x, y + 3.8); x += tDesc;

        if (t.grootboekrekening) {
          pdf.setTextColor(colors.bronze.r, colors.bronze.g, colors.bronze.b);
          pdf.setFont('helvetica', 'bold');
          pdf.text(t.grootboekrekening, x, y + 3.8);
        } else {
          pdf.setTextColor(colors.amber.r, colors.amber.g, colors.amber.b);
          pdf.text('—', x, y + 3.8);
        }
        pdf.setFont('helvetica', 'normal');
        x += tGb;

        pdf.setTextColor(colors.mid.r, colors.mid.g, colors.mid.b);
        pdf.text(btwLabel, x, y + 3.8); x += tBtw;

        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(t.amount >= 0 ? colors.green.r : colors.red.r, t.amount >= 0 ? colors.green.g : colors.red.g, t.amount >= 0 ? colors.green.b : colors.red.b);
        pdf.text(fmt(t.amount), x + tBruto - 4, y + 3.8, { align: 'right' });
        pdf.setFont('helvetica', 'normal');

        // Dunne rij scheidingslijn
        pdf.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
        pdf.setLineWidth(0.1);
        pdf.line(marginL, y + 5.5, pageWidth - marginR, y + 5.5);

        y += 5.5;
        tIdx++;
      }

      y += 4;
    }

    // Grand totaal transacties — dikke bronze lijn, bold
    checkBreak(12);
    y += 2;
    const totalBruto = transactions.reduce((s, t) => s + t.amount, 0);
    pdf.setDrawColor(colors.bronze.r, colors.bronze.g, colors.bronze.b);
    pdf.setLineWidth(1.2);
    pdf.line(marginL, y, pageWidth - marginR, y);
    y += 5;
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(colors.dark.r, colors.dark.g, colors.dark.b);
    pdf.text(`TOTAAL`, marginL + 2, y);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(colors.mid.r, colors.mid.g, colors.mid.b);
    pdf.setFontSize(8);
    pdf.text(`${transactions.length} transactie${transactions.length !== 1 ? 's' : ''}`, marginL + 25, y);
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(totalBruto >= 0 ? colors.green.r : colors.red.r, totalBruto >= 0 ? colors.green.g : colors.red.g, totalBruto >= 0 ? colors.green.b : colors.red.b);
    pdf.text(fmt(totalBruto), pageWidth - marginR - 2, y, { align: 'right' });
    y += 2;
    pdf.setDrawColor(colors.bronze.r, colors.bronze.g, colors.bronze.b);
    pdf.setLineWidth(0.3);
    pdf.line(marginL, y, pageWidth - marginR, y);
    y += 8;
  }

  addFooter();

  const safeCompany = companyName.replace(/[^a-zA-Z0-9]+/g, '_');
  pdf.save(`BTW_Overzicht_${safeCompany}_${periodLabel.replace(/\s+/g, '_')}.pdf`);
};
