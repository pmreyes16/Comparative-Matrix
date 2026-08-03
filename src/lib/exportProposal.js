/**
 * EXPORT — write the generated Proposal document to a real .pdf (jsPDF +
 * autoTable), A4 portrait, matching the on-screen ProposalView layout:
 * header, executive summary, recommended insurer, headline winners,
 * additional considerations, and the full comparison appendix.
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { nameOf } from './proposal.js';
import { toast, triggerDownload } from './exportMatrix.js';
import { svgUrlToPng } from './svgAsset.js';
import howdenLogoUrl from '../assets/Howden logo - Corporate.svg';

const COBALT = [0, 71, 171]; // cobalt-500
const COBALT_DARK = [0, 51, 122]; // cobalt-700
const COBALT_TINT = [233, 241, 251]; // cobalt-50
const SLATE_900 = [30, 41, 59];
const SLATE_500 = [100, 116, 139];
const SLATE_400 = [148, 163, 184];
const ROSEGOLD = [140, 74, 84]; // rosegold-700
const POPPY = [168, 23, 19]; // poppy-700

function pdfSafe(s) {
  return String(s == null ? '' : s).replace(/₱/g, 'PHP ').replace(/[✓✔]/g, '');
}

export function exportProposalFilename(data) {
  const client = String(data.insuredName || 'Client')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || 'Client';
  const d = new Date();
  const ymd = '' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  return client + '_Proposal_' + ymd + '.pdf';
}

export async function buildProposalPdfBlob(data) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 42;
  const contentW = pageW - margin * 2;
  let y = margin;

  const ensure = (h) => {
    if (y + h > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // ---- Header ----
  let logo = null;
  try {
    logo = await svgUrlToPng(howdenLogoUrl);
  } catch (e) {
    /* fall back to the text wordmark below */
  }
  if (logo) {
    const logoH = 22;
    doc.addImage(logo.dataUrl, 'PNG', margin, y - 12, logoH * logo.aspect, logoH);
  } else {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(...COBALT);
    doc.text('HOWDEN', margin, y + 4);
  }
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...SLATE_500);
  doc.text('Prepared by Howden Philippines', pageW - margin, y - 2, { align: 'right' });
  doc.text(data.generatedAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), pageW - margin, y + 10, { align: 'right' });
  y += 26;

  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, pageW - margin, y);
  y += 20;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...COBALT);
  doc.text('INSURANCE PLACEMENT RECOMMENDATION', margin, y);
  y += 18;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.setTextColor(...SLATE_900);
  // Long insured names (common on EAR slips: "X INC. &/OR CONTRACTORS &/OR
  // ALL OTHER INTERESTED PARTIES") must wrap rather than run off the page.
  const titleLines = doc.splitTextToSize(pdfSafe(data.insuredName || 'Comparative Insurance Proposal'), contentW);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 19;
  const subtitle = [data.policyType, [data.period.from, data.period.to].filter(Boolean).join(' – ')].filter(Boolean).join('   ·   ');
  if (subtitle) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...SLATE_500);
    doc.text(pdfSafe(subtitle), margin, y);
    y += 16;
  }
  y += 6;

  // ---- Executive summary ----
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...SLATE_400);
  doc.text('EXECUTIVE SUMMARY', margin, y);
  y += 14;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...SLATE_900);
  const recommended = data.recommended;
  let summary;
  if (data.proposals.length < 2) {
    summary = 'Only one proposal has been uploaded — comparison and recommendation become available once a second quotation slip is added.';
  } else {
    summary =
      'We compared ' + data.proposals.length + ' proposals' +
      (data.policyType ? ' for ' + data.policyType : '') + '. ' +
      (recommended
        ? 'Based on a balanced view of price, cover and terms, we recommend ' + nameOf(recommended.p) +
          (data.winCount > 0
            ? ' — it leads on ' + data.winCount + ' of the ' + data.winners.length + ' headline criteria below.'
            : ' as the strongest overall balance across price, cover and terms, though no single insurer swept every headline criterion.')
        : '');
  }
  const summaryLines = doc.splitTextToSize(pdfSafe(summary), contentW);
  doc.text(summaryLines, margin, y);
  y += summaryLines.length * 13 + 14;

  // ---- Recommended insurer callout ----
  if (recommended) {
    ensure(56);
    doc.setFillColor(...COBALT_TINT);
    doc.roundedRect(margin, y, contentW, 50, 6, 6, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...COBALT);
    doc.text('RECOMMENDED INSURER', margin + 14, y + 18);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...SLATE_900);
    doc.text(pdfSafe(nameOf(recommended.p)), margin + 14, y + 36);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(...COBALT_DARK);
    doc.text(Math.round(recommended.score) + '/100', pageW - margin - 14, y + 32, { align: 'right' });
    y += 50 + 20;
  }

  // ---- Headline winners ----
  ensure(20);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...SLATE_400);
  doc.text('WHERE EACH INSURER LEADS', margin, y);
  y += 14;
  data.winners.forEach((w) => {
    ensure(20);
    doc.setDrawColor(241, 245, 249);
    doc.line(margin, y, pageW - margin, y);
    y += 14;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...SLATE_900);
    doc.text(pdfSafe(w.criterion.label), margin, y);
    if (w.p) {
      // Some criteria (e.g. Premium Rate) can hold a multi-section value —
      // join on one compact line rather than letting jsPDF's own newline
      // handling silently desync our row-height math.
      const dispOneLine = String(w.disp || '').replace(/\s*\n\s*/g, '; ');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...COBALT_DARK);
      doc.text(pdfSafe(nameOf(w.p)), pageW - margin, y, { align: 'right' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...SLATE_500);
      doc.text(pdfSafe(dispOneLine), pageW - margin, y + 12, { align: 'right' });
      y += 10;
    } else {
      doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(...SLATE_400);
      doc.text('Not enough comparable data', pageW - margin, y, { align: 'right' });
    }
    y += 14;
  });
  y += 10;

  // ---- Additional considerations ----
  const hasSecondary = data.secondaryWinners.some((w) => w.p);
  const hasClauses = data.recommendedUniqueClauses.length > 0;
  const hasFlags = data.review.length > 0 || data.lapsed.length > 0;
  if (hasSecondary || hasClauses || hasFlags) {
    ensure(24);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...SLATE_400);
    doc.text('ADDITIONAL CONSIDERATIONS', margin, y);
    y += 16;

    if (hasSecondary) {
      ensure(14);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...SLATE_900);
      doc.text('Protection adequacy', margin, y);
      y += 13;
      data.secondaryWinners.forEach((w) => {
        if (!w.p) return;
        // w.disp can be multi-line (e.g. Sum Insured with Section I + II) —
        // join on one line, then wrap properly and advance y by however many
        // lines it actually took, instead of assuming a single line's height.
        const dispOneLine = String(w.disp || '').replace(/\s*\n\s*/g, '; ');
        const lines = doc.splitTextToSize(pdfSafe(w.criterion.label + ': ' + nameOf(w.p) + ' (' + dispOneLine + ')'), contentW);
        ensure(lines.length * 11 + 2);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...SLATE_500);
        doc.text(lines, margin, y);
        y += lines.length * 11 + 2;
      });
      y += 6;
    }

    if (hasClauses) {
      ensure(14);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...SLATE_900);
      doc.text(pdfSafe('What sets ' + nameOf(recommended.p) + ' apart'), margin, y);
      y += 13;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...SLATE_500);
      data.recommendedUniqueClauses.slice(0, 4).forEach((c) => {
        const lines = doc.splitTextToSize('• ' + pdfSafe(c), contentW - 10);
        ensure(lines.length * 11 + 2);
        doc.text(lines, margin + 4, y);
        y += lines.length * 11 + 2;
      });
      y += 6;
    }

    if (hasFlags) {
      ensure(14);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...SLATE_900);
      doc.text('Before you proceed', margin, y);
      y += 13;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      data.review.forEach((p) => {
        ensure(12);
        doc.setTextColor(...ROSEGOLD);
        doc.text(pdfSafe(nameOf(p) + ' — figures need manual verification before relying on them.'), margin, y);
        y += 12;
      });
      data.lapsed.forEach((p) => {
        ensure(12);
        doc.setTextColor(...POPPY);
        doc.text(pdfSafe(nameOf(p) + ' — quote validity has lapsed; ask for a refreshed quotation.'), margin, y);
        y += 12;
      });
      y += 6;
    }
  }

  // ---- Appendix: full comparison detail ----
  const allCriteria = [...data.winners, ...data.secondaryWinners];
  ensure(30);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...SLATE_400);
  doc.text('FULL COMPARISON DETAIL', margin, y);
  y += 10;

  const head = ['Insurer', ...allCriteria.map((w) => w.criterion.label)];
  const body = data.ranked.map((r) => [
    pdfSafe(nameOf(r.p)),
    ...allCriteria.map((w) => pdfSafe(w.criterion.disp(r.p) || '—')),
  ]);
  autoTable(doc, {
    head: [head],
    body,
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: contentW,
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 5, overflow: 'linebreak', valign: 'top', lineColor: [226, 232, 240], lineWidth: 0.5, textColor: SLATE_900 },
    headStyles: { fillColor: COBALT_DARK, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
    columnStyles: { 0: { cellWidth: 90, fontStyle: 'bold' } },
  });
  y = (doc.lastAutoTable ? doc.lastAutoTable.finalY : y) + 24;

  // ---- Footer disclaimer ----
  ensure(40);
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, pageW - margin, y);
  y += 16;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...SLATE_400);
  const disclaimer =
    'This recommendation is auto-generated from figures copied verbatim from each quotation slip. It is a ' +
    'comparison aid, not a binding recommendation or advice — always verify every figure against the original ' +
    'slips before making a decision. Prepared by Howden Philippines.';
  const discLines = doc.splitTextToSize(disclaimer, contentW);
  doc.text(discLines, margin, y);

  return doc.output('blob');
}

export async function exportProposalToPdf(data) {
  try {
    const pdf = await buildProposalPdfBlob(data);
    triggerDownload(exportProposalFilename(data), pdf, true);
    toast('Saved your proposal as a PDF — check your Downloads folder.');
  } catch (e) {
    toast('Sorry — the proposal PDF failed: ' + (e && e.message ? e.message : e));
  }
}
