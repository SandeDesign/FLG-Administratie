import jsPDF from 'jspdf';
import { BankTransaction } from '../types/bankImport';
import { Grootboekrekening } from '../types/supplier';
import { OutgoingInvoice } from '../services/outgoingInvoiceService';
import { IncomingInvoice } from '../services/incomingInvoiceService';

const colors = {
  bronze: { r: 205, g: 133, b: 63 },
  dark: { r: 31, g: 41, b: 55 },
  mid: { r: 107, g: 114, b: 128 },
  light: { r: 249, g: 250, b: 251 },
  white: { r: 255, g: 255, b: 255 },
  red: { r: 220, g: 38, b: 38 },
  green: { r: 22, g: 163, b: 74 },
  blue: { r: 37, g: 99, b: 235 },
  amber: { r: 180, g: 83, b: 9 },
  amberBg: { r: 254, g: 243, b: 199 },
  catBg: { r: 240, g: 244, b: 255 },
  border: { r: 229, g: 231, b: 235 },
  headerBg: { r: 55, g: 65, b: 81 },
};

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
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
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

  // BTW afgeleid per transactie: factuur > grootboek
  const deriveBtw = (t: BankTransaction): { netto: number; btw: number; pct: number } => {
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
          return { netto, btw, pct };
        }
      }
    }
    const gb = t.grootboekrekening ? gbMap.get(t.grootboekrekening) : undefined;
    const btwType = gb?.btw || 'geen';
    const pct = BTW_PERCENTAGES[btwType] ?? 0;
    const netto = pct > 0 ? abs / (1 + pct / 100) : abs;
    const btw = abs - netto;
    return { netto, btw, pct };
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
    const { netto, btw } = deriveBtw(t);
    let key: string, code: string, naam: string, btwType: string, pct: number;

    if (t.grootboekrekening) {
      const gb = gbMap.get(t.grootboekrekening);
      btwType = gb?.btw || 'geen';
      pct = BTW_PERCENTAGES[btwType] ?? 0;
      key = t.grootboekrekening;
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

  // --- Cover / header ---
  pdf.setFillColor(colors.bronze.r, colors.bronze.g, colors.bronze.b);
  pdf.rect(0, 0, pageWidth, 45, 'F');
  pdf.setTextColor(colors.white.r, colors.white.g, colors.white.b);
  pdf.setFontSize(22);
  pdf.setFont('helvetica', 'bold');
  pdf.text('BTW OVERZICHT', marginL, 22);
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');
  pdf.text(companyName, marginL, 33);
  pdf.text(periodLabel, pageWidth - marginR, 22, { align: 'right' });
  pdf.setFontSize(9);
  pdf.text(`Gegenereerd: ${generatedDate}`, pageWidth - marginR, 33, { align: 'right' });

  // --- 3 summary boxes ---
  y = 55;
  const boxW = (contentWidth - 10) / 3;
  const boxH = 28;

  const drawBox = (x: number, label: string, value: string, sublabel: string, accent: { r: number; g: number; b: number }) => {
    pdf.setFillColor(colors.light.r, colors.light.g, colors.light.b);
    pdf.rect(x, y, boxW, boxH, 'F');
    pdf.setFillColor(accent.r, accent.g, accent.b);
    pdf.rect(x, y, 3, boxH, 'F');
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(colors.mid.r, colors.mid.g, colors.mid.b);
    pdf.text(label, x + 6, y + 6);
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(accent.r, accent.g, accent.b);
    pdf.text(value, x + 6, y + 15);
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(colors.mid.r, colors.mid.g, colors.mid.b);
    pdf.text(sublabel, x + 6, y + 22);
  };

  drawBox(marginL, 'Af te dragen BTW', fmt(totaalAfdracht), 'BTW op verkopen', colors.red);
  drawBox(marginL + boxW + 5, 'Voorbelasting', fmt(totaalVoorbelasting), 'BTW op inkopen', colors.green);
  drawBox(
    marginL + 2 * (boxW + 5),
    saldo >= 0 ? 'Te betalen' : 'Terug te ontvangen',
    fmt(Math.abs(saldo)),
    `${transactions.length} transacties`,
    saldo >= 0 ? colors.red : colors.green
  );

  y += boxH + 8;

  // --- Overall info row ---
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(colors.dark.r, colors.dark.g, colors.dark.b);
  pdf.text('Totaal periode', marginL, y);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(colors.green.r, colors.green.g, colors.green.b);
  pdf.text(`Inkomend: ${fmt(totaalIn)}`, marginL + 35, y);
  pdf.setTextColor(colors.red.r, colors.red.g, colors.red.b);
  pdf.text(`Uitgaand: ${fmt(totaalUit)}`, marginL + 85, y);
  pdf.setTextColor(colors.mid.r, colors.mid.g, colors.mid.b);
  pdf.text(`Transacties: ${transactions.length}`, marginL + 135, y);
  y += 5;

  if (zonderGb > 0) {
    pdf.setFillColor(colors.amberBg.r, colors.amberBg.g, colors.amberBg.b);
    pdf.rect(marginL, y, contentWidth, 7, 'F');
    pdf.setFontSize(8);
    pdf.setTextColor(colors.amber.r, colors.amber.g, colors.amber.b);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`⚠  ${zonderGb} transacties zonder grootboekrekening — niet meegerekend in BTW totalen`, marginL + 2, y + 4.8);
    y += 10;
  } else {
    y += 3;
  }

  // --- Specificatie tabel ---
  checkBreak(20);
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(colors.dark.r, colors.dark.g, colors.dark.b);
  pdf.text('Specificatie per grootboekrekening', marginL, y);
  y += 6;

  // Kolommen
  const cCode = 16;
  const cBtw = 20;
  const cNetto = 28;
  const cBtwBedrag = 28;
  const cBruto = 28;
  const cCount = 10;
  const cName = contentWidth - cCode - cBtw - cNetto - cBtwBedrag - cBruto - cCount;

  const drawSpecHeaders = () => {
    pdf.setFillColor(colors.headerBg.r, colors.headerBg.g, colors.headerBg.b);
    pdf.rect(marginL, y, contentWidth, 7, 'F');
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(colors.white.r, colors.white.g, colors.white.b);
    let x = marginL + 2;
    pdf.text('Code', x, y + 4.8); x += cCode;
    pdf.text('Rekening', x, y + 4.8); x += cName;
    pdf.text('BTW', x, y + 4.8); x += cBtw;
    pdf.text('Netto', x + cNetto - 2, y + 4.8, { align: 'right' }); x += cNetto;
    pdf.text('BTW bedrag', x + cBtwBedrag - 2, y + 4.8, { align: 'right' }); x += cBtwBedrag;
    pdf.text('Bruto', x + cBruto - 2, y + 4.8, { align: 'right' }); x += cBruto;
    pdf.text('#', x + cCount - 2, y + 4.8, { align: 'right' });
    y += 7;
  };

  drawSpecHeaders();

  let idx = 0;
  for (const r of rows) {
    checkBreak(7);
    if (y === 20) drawSpecHeaders();

    if (r.isUncat) {
      pdf.setFillColor(colors.amberBg.r, colors.amberBg.g, colors.amberBg.b);
      pdf.rect(marginL, y, contentWidth, 6, 'F');
    } else if (idx % 2 === 0) {
      pdf.setFillColor(colors.light.r, colors.light.g, colors.light.b);
      pdf.rect(marginL, y, contentWidth, 6, 'F');
    }

    pdf.setFontSize(8);
    pdf.setTextColor(r.isUncat ? colors.amber.r : colors.blue.r, r.isUncat ? colors.amber.g : colors.blue.g, r.isUncat ? colors.amber.b : colors.blue.b);
    pdf.setFont('helvetica', 'bold');
    let x = marginL + 2;
    pdf.text(r.code, x, y + 4); x += cCode;

    pdf.setTextColor(colors.dark.r, colors.dark.g, colors.dark.b);
    pdf.setFont(r.isUncat ? 'helvetica' : 'helvetica', r.isUncat ? 'italic' : 'normal');
    const nameTrunc = pdf.getTextWidth(r.naam) > cName - 2
      ? pdf.splitTextToSize(r.naam, cName - 2)[0]
      : r.naam;
    pdf.text(nameTrunc, x, y + 4); x += cName;

    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(colors.mid.r, colors.mid.g, colors.mid.b);
    const btwLabel = r.isUncat ? 'onbekend' : `${r.btwType}${r.btwPct > 0 ? ` ${r.btwPct}%` : ''}`;
    pdf.text(btwLabel, x, y + 4); x += cBtw;

    pdf.setTextColor(colors.dark.r, colors.dark.g, colors.dark.b);
    pdf.text(fmt(r.netto), x + cNetto - 2, y + 4, { align: 'right' }); x += cNetto;

    if (r.isUncat) {
      pdf.setTextColor(colors.mid.r, colors.mid.g, colors.mid.b);
      pdf.text('—', x + cBtwBedrag - 2, y + 4, { align: 'right' });
    } else {
      pdf.setTextColor(r.btw > 0 ? colors.red.r : r.btw < 0 ? colors.green.r : colors.mid.r, r.btw > 0 ? colors.red.g : r.btw < 0 ? colors.green.g : colors.mid.g, r.btw > 0 ? colors.red.b : r.btw < 0 ? colors.green.b : colors.mid.b);
      pdf.setFont('helvetica', 'bold');
      pdf.text(fmt(r.btw), x + cBtwBedrag - 2, y + 4, { align: 'right' });
      pdf.setFont('helvetica', 'normal');
    }
    x += cBtwBedrag;

    pdf.setTextColor(colors.dark.r, colors.dark.g, colors.dark.b);
    pdf.text(fmt(r.bruto), x + cBruto - 2, y + 4, { align: 'right' }); x += cBruto;
    pdf.setTextColor(colors.mid.r, colors.mid.g, colors.mid.b);
    pdf.text(String(r.count), x + cCount - 2, y + 4, { align: 'right' });

    y += 6;
    idx++;
  }

  // Totaal regel
  checkBreak(8);
  pdf.setFillColor(colors.headerBg.r, colors.headerBg.g, colors.headerBg.b);
  pdf.rect(marginL, y, contentWidth, 7, 'F');
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(colors.white.r, colors.white.g, colors.white.b);
  let tx = marginL + 2;
  pdf.text('TOTAAL', tx, y + 4.8); tx += cCode + cName + cBtw;
  pdf.text(fmt(rows.reduce((s, r) => s + r.netto, 0)), tx + cNetto - 2, y + 4.8, { align: 'right' }); tx += cNetto;
  pdf.text(fmt(rows.reduce((s, r) => s + r.btw, 0)), tx + cBtwBedrag - 2, y + 4.8, { align: 'right' }); tx += cBtwBedrag;
  pdf.text(fmt(rows.reduce((s, r) => s + r.bruto, 0)), tx + cBruto - 2, y + 4.8, { align: 'right' }); tx += cBruto;
  pdf.text(String(rows.reduce((s, r) => s + r.count, 0)), tx + cCount - 2, y + 4.8, { align: 'right' });
  y += 11;

  // --- Transacties overzicht ---
  if (transactions.length > 0) {
    checkBreak(20);
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(colors.dark.r, colors.dark.g, colors.dark.b);
    pdf.text(`Transacties (${transactions.length})`, marginL, y);
    y += 6;

    // Kolommen transacties
    const tDate = 20;
    const tGb = 15;
    const tBtw = 16;
    const tNetto = 22;
    const tBtwBedrag = 22;
    const tBruto = 22;
    const tBen = 35;
    const tDesc = contentWidth - tDate - tBen - tGb - tBtw - tNetto - tBtwBedrag - tBruto;

    const drawTxHeaders = () => {
      pdf.setFillColor(colors.headerBg.r, colors.headerBg.g, colors.headerBg.b);
      pdf.rect(marginL, y, contentWidth, 7, 'F');
      pdf.setFontSize(7.5);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(colors.white.r, colors.white.g, colors.white.b);
      let x = marginL + 2;
      pdf.text('Datum', x, y + 4.8); x += tDate;
      pdf.text('Begunstigde', x, y + 4.8); x += tBen;
      pdf.text('Omschrijving', x, y + 4.8); x += tDesc;
      pdf.text('GB', x, y + 4.8); x += tGb;
      pdf.text('BTW', x, y + 4.8); x += tBtw;
      pdf.text('Netto', x + tNetto - 2, y + 4.8, { align: 'right' }); x += tNetto;
      pdf.text('BTW', x + tBtwBedrag - 2, y + 4.8, { align: 'right' }); x += tBtwBedrag;
      pdf.text('Bruto', x + tBruto - 2, y + 4.8, { align: 'right' });
      y += 7;
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

    let tIdx = 0;
    for (const t of sorted) {
      checkBreak(6);
      if (y === 20) drawTxHeaders();

      const { netto, btw, pct } = deriveBtw(t);
      const sign = t.amount >= 0 ? 1 : -1;
      const isUncat = !t.grootboekrekening;
      const btwLabel = isUncat
        ? '?'
        : btw > 0
          ? (t.matchedInvoiceId ? `factuur ${pct}%` : `${pct}%`)
          : 'geen';

      if (isUncat) {
        pdf.setFillColor(colors.amberBg.r, colors.amberBg.g, colors.amberBg.b);
        pdf.rect(marginL, y, contentWidth, 5.5, 'F');
      } else if (tIdx % 2 === 0) {
        pdf.setFillColor(colors.light.r, colors.light.g, colors.light.b);
        pdf.rect(marginL, y, contentWidth, 5.5, 'F');
      }

      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'normal');
      let x = marginL + 2;

      pdf.setTextColor(colors.mid.r, colors.mid.g, colors.mid.b);
      pdf.text(formatDutchDate(safeDate(t.date)), x, y + 3.8); x += tDate;

      pdf.setTextColor(colors.dark.r, colors.dark.g, colors.dark.b);
      const benTrunc = pdf.splitTextToSize(t.beneficiary || '-', tBen - 2)[0];
      pdf.text(benTrunc, x, y + 3.8); x += tBen;

      pdf.setTextColor(colors.mid.r, colors.mid.g, colors.mid.b);
      const descText = t.matchedInvoiceNumber || t.description?.substring(0, 40) || '-';
      const descTrunc = pdf.splitTextToSize(descText, tDesc - 2)[0];
      pdf.text(descTrunc, x, y + 3.8); x += tDesc;

      if (t.grootboekrekening) {
        pdf.setTextColor(colors.blue.r, colors.blue.g, colors.blue.b);
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

      pdf.setTextColor(colors.dark.r, colors.dark.g, colors.dark.b);
      pdf.text(isUncat ? '—' : fmt(sign * netto), x + tNetto - 2, y + 3.8, { align: 'right' }); x += tNetto;

      if (isUncat || btw === 0) {
        pdf.setTextColor(colors.mid.r, colors.mid.g, colors.mid.b);
        pdf.text('—', x + tBtwBedrag - 2, y + 3.8, { align: 'right' });
      } else {
        pdf.setTextColor(sign > 0 ? colors.red.r : colors.green.r, sign > 0 ? colors.red.g : colors.green.g, sign > 0 ? colors.red.b : colors.green.b);
        pdf.text(fmt(sign * btw), x + tBtwBedrag - 2, y + 3.8, { align: 'right' });
      }
      x += tBtwBedrag;

      pdf.setTextColor(t.amount >= 0 ? colors.green.r : colors.red.r, t.amount >= 0 ? colors.green.g : colors.red.g, t.amount >= 0 ? colors.green.b : colors.red.b);
      pdf.setFont('helvetica', 'bold');
      pdf.text(fmt(t.amount), x + tBruto - 2, y + 3.8, { align: 'right' });
      pdf.setFont('helvetica', 'normal');

      y += 5.5;
      tIdx++;
    }
  }

  addFooter();

  const safeCompany = companyName.replace(/[^a-zA-Z0-9]+/g, '_');
  pdf.save(`BTW_Overzicht_${safeCompany}_${periodLabel.replace(/\s+/g, '_')}.pdf`);
};
