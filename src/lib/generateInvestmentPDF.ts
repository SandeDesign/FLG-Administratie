import jsPDF from 'jspdf';

interface PitchData {
  companyName: string;
  elevatorPitch: string;
  currentARR: number;
  currentMargin: number;
  problemStatement: string;
  solutionStatement: string;
  differentiator: string;
  targetMarket: string;
  tam: number;
  sam: number;
  som: number;
  askingAmount: number;
  runway: number;
  projectedYear1Revenue: number;
  projectedYear2Revenue: number;
  projectedYear3Revenue: number;
}

const colors = {
  primary: { r: 30, g: 58, b: 138 }, // #1e3a8a
  secondary: { r: 59, g: 130, b: 246 }, // #3b82f6
  accent: { r: 34, g: 197, b: 94 }, // #22c55e
  text: { r: 31, g: 41, b: 55 }, // #1f2937
  lightText: { r: 107, g: 114, b: 128 }, // #6b7280
  lightBg: { r: 249, g: 250, b: 251 }, // #f9fafb
};

const formatCurrency = (amount: number) => {
  return `€${(amount / 1000).toFixed(0)}k`;
};

const formatCurrencyM = (amount: number) => {
  return `€${(amount / 1000000).toFixed(1)}M`;
};

export const generateInvestmentPDF = (data: PitchData) => {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  let yPosition = 20;

  // ========== PAGE 1: COVER ==========
  // Background gradient effect (simulate with color)
  pdf.setFillColor(colors.primary.r, colors.primary.g, colors.primary.b);
  pdf.rect(0, 0, pageWidth, pageHeight, 'F');

  // Title
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(48);
  pdf.setFont('helvetica', 'bold');
  pdf.text(data.companyName, 20, 80);

  // Elevator Pitch
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'normal');
  const pitchLines = pdf.splitTextToSize(data.elevatorPitch, pageWidth - 40);
  pdf.text(pitchLines, 20, 110);

  // Metrics Grid
  const metrics = [
    { label: 'Investment Ask', value: formatCurrency(data.askingAmount) },
    { label: 'Year 1 Revenue', value: formatCurrencyM(data.projectedYear1Revenue) },
    { label: '3-Year ROI', value: '840%' },
    { label: 'Break-Even', value: '8 months' },
  ];

  const metricsY = 180;
  const colWidth = (pageWidth - 40) / 2;

  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(224, 231, 255); // light blue

  metrics.forEach((metric, idx) => {
    const row = Math.floor(idx / 2);
    const col = idx % 2;
    const x = 20 + col * colWidth;
    const y = metricsY + row * 60;

    // Value
    pdf.setFontSize(28);
    pdf.text(metric.value, x, y);

    // Label
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'normal');
    pdf.text(metric.label, x, y + 12);
  });

  // Footer
  pdf.setFontSize(10);
  pdf.setTextColor(199, 210, 254);
  pdf.text(new Date().toLocaleDateString('nl-NL'), 20, pageHeight - 20);

  // ========== PAGE 2: PROBLEM & SOLUTION ==========
  pdf.addPage();
  yPosition = 20;

  pdf.setTextColor(colors.text.r, colors.text.g, colors.text.b);
  pdf.setFillColor(colors.primary.r, colors.primary.g, colors.primary.b);

  // Title background
  pdf.rect(0, yPosition, pageWidth, 15, 'F');

  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);
  pdf.text('🎯 The Problem', 20, yPosition + 11);

  yPosition += 25;

  // Problem text
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(colors.text.r, colors.text.g, colors.text.b);
  const problemLines = pdf.splitTextToSize(data.problemStatement, pageWidth - 40);
  pdf.text(problemLines, 20, yPosition);
  yPosition += problemLines.length * 7 + 15;

  // Solution Section
  pdf.setFillColor(colors.primary.r, colors.primary.g, colors.primary.b);
  pdf.rect(0, yPosition, pageWidth, 15, 'F');

  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);
  pdf.text('💡 Our Solution', 20, yPosition + 11);

  yPosition += 25;

  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(colors.text.r, colors.text.g, colors.text.b);
  const solutionLines = pdf.splitTextToSize(data.solutionStatement, pageWidth - 40);
  pdf.text(solutionLines, 20, yPosition);
  yPosition += solutionLines.length * 7 + 15;

  // Differentiator box
  pdf.setFillColor(colors.lightBg.r, colors.lightBg.g, colors.lightBg.b);
  pdf.rect(20, yPosition - 2, pageWidth - 40, 30, 'F');

  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(colors.primary.r, colors.primary.g, colors.primary.b);
  pdf.text('Why Us?', 23, yPosition + 3);

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(colors.text.r, colors.text.g, colors.text.b);
  const diffLines = pdf.splitTextToSize(data.differentiator, pageWidth - 46);
  pdf.text(diffLines, 23, yPosition + 10);

  // ========== PAGE 3: FINANCIALS & MARKET ==========
  pdf.addPage();
  yPosition = 20;

  // Financial Overview
  pdf.setFillColor(colors.primary.r, colors.primary.g, colors.primary.b);
  pdf.rect(0, yPosition, pageWidth, 15, 'F');

  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);
  pdf.text('📊 Financial Projections & Impact', 20, yPosition + 11);

  yPosition += 30;

  // Highlight box
  pdf.setFillColor(254, 243, 199); // yellow
  pdf.rect(20, yPosition - 2, pageWidth - 40, 25, 'F');
  pdf.setDrawColor(245, 158, 11); // orange
  pdf.rect(20, yPosition - 2, 4, 25, 'F');

  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(120, 53, 15); // dark orange
  pdf.text('Investment Thesis', 24, yPosition + 4);

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(107, 114, 128);
  const thesisText = `With €${(data.askingAmount / 1000).toFixed(0)}k, we achieve €${(data.projectedYear1Revenue / 1000000).toFixed(1)}M revenue in Year 1, representing an 840% 3-year ROI. Break-even in 8 months.`;
  const thesisLines = pdf.splitTextToSize(thesisText, pageWidth - 48);
  pdf.text(thesisLines, 24, yPosition + 12);

  yPosition += 35;

  // Financial table
  const tableData = [
    ['Period', 'Revenue', 'Growth'],
    ['Current', formatCurrency(data.currentARR), 'Baseline'],
    ['Year 1', formatCurrencyM(data.projectedYear1Revenue), `+${(((data.projectedYear1Revenue - data.currentARR) / data.currentARR) * 100).toFixed(0)}%`],
    ['Year 2', formatCurrencyM(data.projectedYear2Revenue), `+${(((data.projectedYear2Revenue - data.projectedYear1Revenue) / data.projectedYear1Revenue) * 100).toFixed(0)}%`],
    ['Year 3', formatCurrencyM(data.projectedYear3Revenue), `+${(((data.projectedYear3Revenue - data.projectedYear2Revenue) / data.projectedYear2Revenue) * 100).toFixed(0)}%`],
  ];

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');

  // Table header
  pdf.setFillColor(243, 244, 246);
  pdf.rect(20, yPosition, pageWidth - 40, 7, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.text('Period', 25, yPosition + 5);
  pdf.text('Revenue', 80, yPosition + 5);
  pdf.text('Growth', 150, yPosition + 5);

  yPosition += 10;

  // Table rows
  pdf.setFont('helvetica', 'normal');
  tableData.slice(1).forEach((row) => {
    pdf.text(row[0], 25, yPosition);
    pdf.text(row[1], 80, yPosition);
    pdf.text(row[2], 150, yPosition);
    yPosition += 8;
  });

  yPosition += 10;

  // Market Opportunity
  pdf.setFillColor(colors.primary.r, colors.primary.g, colors.primary.b);
  pdf.rect(0, yPosition, pageWidth, 15, 'F');

  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);
  pdf.text('🌍 Market Opportunity (TAM/SAM/SOM)', 20, yPosition + 11);

  yPosition += 25;

  // Market boxes
  const boxHeight = 20;
  const boxWidth = (pageWidth - 50) / 3;

  const markets = [
    { label: 'TAM', value: formatCurrencyM(data.tam), desc: 'Total' },
    { label: 'SAM', value: formatCurrencyM(data.sam), desc: 'Serviceable' },
    { label: 'SOM', value: formatCurrencyM(data.som), desc: 'Obtainable' },
  ];

  markets.forEach((market, idx) => {
    const x = 20 + idx * (boxWidth + 5);
    pdf.setFillColor(colors.lightBg.r, colors.lightBg.g, colors.lightBg.b);
    pdf.rect(x, yPosition, boxWidth, boxHeight, 'F');

    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(colors.primary.r, colors.primary.g, colors.primary.b);
    pdf.text(market.value, x + 5, yPosition + 8);

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(colors.lightText.r, colors.lightText.g, colors.lightText.b);
    pdf.text(market.label, x + 5, yPosition + 15);
  });

  // Save PDF
  pdf.save(`Pitch-${data.companyName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`);
};