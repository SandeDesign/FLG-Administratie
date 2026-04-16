import jsPDF from 'jspdf';
import { Grootboekrekening } from '../types/supplier';
import { grootboekCategoryLabels } from '../utils/grootboekTemplate';

const colors = {
  bronze: { r: 205, g: 133, b: 63 },   // #cd853f - FLG brand
  dark: { r: 31, g: 41, b: 55 },        // #1f2937
  mid: { r: 107, g: 114, b: 128 },      // #6b7280
  light: { r: 249, g: 250, b: 251 },    // #f9fafb
  white: { r: 255, g: 255, b: 255 },
  catBg: { r: 240, g: 244, b: 255 },    // lichtblauw categorie header
  catText: { r: 37, g: 99, b: 235 },    // blauw categorie tekst
  debet: { r: 234, g: 88, b: 12 },      // oranje debet
  credit: { r: 22, g: 163, b: 74 },     // groen credit
  border: { r: 229, g: 231, b: 235 },   // #e5e7eb
};

export const generateGrootboekPDF = (
  grootboekrekeningen: Grootboekrekening[],
  companyName: string
) => {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const marginL = 15;
  const marginR = 15;
  const contentWidth = pageWidth - marginL - marginR;
  let y = 0;
  let pageNum = 1;

  // Kolom breedtes
  const colCode = 18;
  const colType = 14;
  const colBtw = 16;
  const colName = contentWidth - colCode - colType - colBtw;

  const addPage = () => {
    addFooter();
    pdf.addPage();
    pageNum++;
    y = 20;
    addColumnHeaders();
  };

  const checkPageBreak = (needed: number) => {
    if (y + needed > pageHeight - 18) addPage();
  };

  const addFooter = () => {
    const footerY = pageHeight - 10;
    pdf.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
    pdf.setLineWidth(0.3);
    pdf.line(marginL, footerY - 3, pageWidth - marginR, footerY - 3);
    pdf.setFontSize(8);
    pdf.setTextColor(colors.mid.r, colors.mid.g, colors.mid.b);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`${companyName} — Rekeningschema`, marginL, footerY);
    pdf.text(
      `Pagina ${pageNum}`,
      pageWidth - marginR,
      footerY,
      { align: 'right' }
    );
    const date = new Date().toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    pdf.text(date, pageWidth / 2, footerY, { align: 'center' });
  };

  const addColumnHeaders = () => {
    pdf.setFillColor(colors.dark.r, colors.dark.g, colors.dark.b);
    pdf.rect(marginL, y, contentWidth, 7, 'F');
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(colors.white.r, colors.white.g, colors.white.b);
    pdf.text('Code', marginL + 2, y + 5);
    pdf.text('Naam grootboekrekening', marginL + colCode + 2, y + 5);
    pdf.text('Type', marginL + colCode + colName + 2, y + 5);
    pdf.text('BTW', marginL + colCode + colName + colType + 2, y + 5);
    y += 7;
  };

  // ── COVER ──
  pdf.setFillColor(colors.bronze.r, colors.bronze.g, colors.bronze.b);
  pdf.rect(0, 0, pageWidth, 45, 'F');

  pdf.setTextColor(colors.white.r, colors.white.g, colors.white.b);
  pdf.setFontSize(22);
  pdf.setFont('helvetica', 'bold');
  pdf.text('REKENINGSCHEMA', marginL, 22);

  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');
  pdf.text(companyName, marginL, 33);

  const date = new Date().toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  pdf.text(date, pageWidth - marginR, 33, { align: 'right' });

  // Samenvatting blok
  y = 55;
  const grouped = grootboekrekeningen.reduce((acc, gb) => {
    const label = grootboekCategoryLabels[gb.category as keyof typeof grootboekCategoryLabels] || gb.category;
    if (!acc[label]) acc[label] = [];
    acc[label].push(gb);
    return acc;
  }, {} as Record<string, Grootboekrekening[]>);

  const categories = Object.entries(grouped);

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(colors.mid.r, colors.mid.g, colors.mid.b);
  pdf.text(`Totaal ${grootboekrekeningen.length} rekeningen in ${categories.length} categorieën`, marginL, y);
  y += 5;

  // Samenvatting tabel
  const halfW = (contentWidth - 5) / 2;
  pdf.setFontSize(8);
  categories.forEach(([label, accounts], i) => {
    const col = i % 2;
    const xPos = marginL + col * (halfW + 5);
    if (col === 0 && i > 0) y += 5;
    if (i === 0) y += 2;

    checkPageBreak(6);
    pdf.setFillColor(colors.catBg.r, colors.catBg.g, colors.catBg.b);
    pdf.rect(xPos, y, halfW, 5, 'F');
    pdf.setTextColor(colors.catText.r, colors.catText.g, colors.catText.b);
    pdf.setFont('helvetica', 'bold');
    const shortLabel = label.replace(/\s*\(\d+xxx\)/, '');
    pdf.text(shortLabel, xPos + 2, y + 3.5);
    pdf.setTextColor(colors.dark.r, colors.dark.g, colors.dark.b);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`${accounts.length}`, xPos + halfW - 2, y + 3.5, { align: 'right' });
    if (col === 1 || i === categories.length - 1) y += 5;
  });

  // Scheidingslijn voor rekeningen
  y += 10;
  pdf.setDrawColor(colors.bronze.r, colors.bronze.g, colors.bronze.b);
  pdf.setLineWidth(0.5);
  pdf.line(marginL, y, pageWidth - marginR, y);
  y += 8;

  // Kolom headers op eerste pagina
  addColumnHeaders();

  // ── REKENINGEN PER CATEGORIE ──
  let rowIndex = 0;
  for (const [label, accounts] of categories) {
    // Categorie header
    checkPageBreak(12);
    y += 2;
    pdf.setFillColor(colors.catBg.r, colors.catBg.g, colors.catBg.b);
    pdf.rect(marginL, y, contentWidth, 6, 'F');
    pdf.setFontSize(8.5);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(colors.catText.r, colors.catText.g, colors.catText.b);
    pdf.text(label, marginL + 2, y + 4.2);
    pdf.setTextColor(colors.mid.r, colors.mid.g, colors.mid.b);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.text(`${accounts.length} rekeningen`, pageWidth - marginR - 2, y + 4.2, { align: 'right' });
    y += 6;

    // Rekeningen in categorie
    for (const gb of accounts) {
      checkPageBreak(6);

      // Afwisselende rijkleuren
      if (rowIndex % 2 === 0) {
        pdf.setFillColor(colors.light.r, colors.light.g, colors.light.b);
        pdf.rect(marginL, y, contentWidth, 5.5, 'F');
      }

      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(colors.dark.r, colors.dark.g, colors.dark.b);
      pdf.text(gb.code, marginL + 2, y + 3.8);

      pdf.setFont('helvetica', 'normal');
      const maxNameWidth = colName - 4;
      const nameTrunc = pdf.getTextWidth(gb.name) > maxNameWidth
        ? pdf.splitTextToSize(gb.name, maxNameWidth)[0] + '...'
        : gb.name;
      pdf.text(nameTrunc, marginL + colCode + 2, y + 3.8);

      // Type badge
      if (gb.type === 'debet') {
        pdf.setTextColor(colors.debet.r, colors.debet.g, colors.debet.b);
        pdf.setFont('helvetica', 'bold');
        pdf.text('D', marginL + colCode + colName + 2, y + 3.8);
      } else {
        pdf.setTextColor(colors.credit.r, colors.credit.g, colors.credit.b);
        pdf.setFont('helvetica', 'bold');
        pdf.text('C', marginL + colCode + colName + 2, y + 3.8);
      }

      // BTW
      if (gb.btw) {
        pdf.setTextColor(colors.mid.r, colors.mid.g, colors.mid.b);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7);
        pdf.text(gb.btw, marginL + colCode + colName + colType + 2, y + 3.8);
      }

      // Rij scheiding
      pdf.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
      pdf.setLineWidth(0.1);
      pdf.line(marginL, y + 5.5, pageWidth - marginR, y + 5.5);

      y += 5.5;
      rowIndex++;
    }

    y += 3; // ruimte tussen categorieën
  }

  // Legenda onderaan
  checkPageBreak(18);
  y += 5;
  pdf.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
  pdf.setLineWidth(0.3);
  pdf.line(marginL, y, pageWidth - marginR, y);
  y += 5;
  pdf.setFontSize(7.5);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(colors.dark.r, colors.dark.g, colors.dark.b);
  pdf.text('Legenda:', marginL, y);
  y += 4;
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(colors.debet.r, colors.debet.g, colors.debet.b);
  pdf.text('D = Debet (activa / kosten)', marginL, y);
  pdf.setTextColor(colors.credit.r, colors.credit.g, colors.credit.b);
  pdf.text('C = Credit (passiva / opbrengsten)', marginL + 55, y);
  pdf.setTextColor(colors.mid.r, colors.mid.g, colors.mid.b);
  pdf.text('BTW: hoog = 21%, laag = 9%, geen = 0%, verlegd', marginL + 120, y);

  addFooter();

  pdf.save(`Rekeningschema_${companyName.replace(/\s+/g, '_')}_${date.replace(/\//g, '-')}.pdf`);
};
