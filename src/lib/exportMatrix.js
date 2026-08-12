/**
 * EXPORT — write the comparative matrix out of the browser.
 *
 *   exportMatrixToXlsx  → a real .xlsx workbook (SheetJS), cells rendered as
 *                         ✓ / deviation / — exactly as shown on screen, money
 *                         strings preserved verbatim.
 *   exportMatrixToPdf   → a real .pdf (jsPDF + autoTable), A3 landscape. Falls
 *                         back to a printable HTML document if the PDF engine
 *                         fails for any reason.
 *
 * Also exports the small `toast` / `triggerDownload` helpers the UI uses so a
 * silent browser download is never mistaken for "nothing happened".
 */
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cellToText, isDeleted } from './matrix.js';
import { fetchSvgMarkup, svgUrlToPng } from './svgAsset.js';
import howdenLogoUrl from '../assets/Howden logo - Corporate.svg';

/* ---- user feedback + download ------------------------------------------- */

export function toast(msg) {
  try {
    let t = document.getElementById('cmp-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'cmp-toast';
      t.style.cssText =
        'position:fixed;z-index:99999;left:50%;bottom:24px;transform:translateX(-50%);max-width:88vw;' +
        'background:#211E24;color:#fff;padding:10px 16px;border-radius:8px;' +
        'font:13px/1.4 Arial,Helvetica,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.28);' +
        'opacity:0;transition:opacity .2s;text-align:center';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    clearTimeout(t._h);
    t._h = setTimeout(() => { t.style.opacity = '0'; }, 3200);
  } catch (e) { /* non-fatal */ }
}

/** Robust file download: Blob + anchor, with a data-URI fallback, and a toast. */
export function triggerDownload(filename, blob, quiet) {
  let ok = false;
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try { document.body.removeChild(a); } catch (e) { /* already gone */ }
      URL.revokeObjectURL(url);
    }, 400);
    ok = true;
  } catch (e) {
    try {
      const rd = new FileReader();
      rd.onload = () => {
        try {
          const w = window.open(rd.result, '_blank');
          if (!w) toast('Pop-up blocked — allow pop-ups or open this file in a browser tab to download.');
        } catch (er) { /* nothing more we can do */ }
      };
      rd.readAsDataURL(blob);
      ok = true;
    } catch (er) { /* fall through */ }
  }
  if (ok && !quiet) toast('Downloaded “' + filename + '” — check your Downloads folder.');
  return ok;
}

/* ---- shared shaping ------------------------------------------------------ */

/** Matrix → array-of-arrays (the shape both Excel and CSV want). */
export function matrixToAoa(matrix) {
  const hasBaseline = !!matrix.baseline;
  const header = ['Terms & Conditions'];
  if (hasBaseline) header.push(matrix.baseline.name + ' (Proposed)');
  matrix.columns.forEach((c) => header.push(c.name));

  const aoa = [];
  if (matrix.title) aoa.push([matrix.title]);
  if (matrix.subtitle) aoa.push([matrix.subtitle]);
  if (matrix.eyebrow) aoa.push([matrix.eyebrow]);
  aoa.push([]);
  aoa.push(header);

  matrix.rows.forEach((r) => {
    const row = [r.field || r.subLabel || ''];
    if (hasBaseline) row.push(r.howden || '');
    matrix.columns.forEach((c) => row.push(cellToText(r.cells[c.id])));
    aoa.push(row);
  });

  if (matrix.footnotes && matrix.footnotes.length) {
    aoa.push([]);
    aoa.push(['Additional clauses, warranties & subjectivities']);
    matrix.footnotes.forEach((f) => {
      aoa.push([f.name]);
      f.lines.forEach((l) => aoa.push(['', l]));
    });
  }
  return aoa;
}

/**
 * Filename convention: {ClientName}_ComparativeMatrix_{YYYYMMDD}[.ext].
 * Pass ext='' for the base name (used as the print document <title> so the
 * browser's "Save as PDF" dialog pre-fills the right filename).
 */
export function exportFilename(matrix, ext) {
  const client =
    String((matrix && matrix.title) || 'Client')
      .replace(/[^A-Za-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 60) || 'Client';
  const d = new Date();
  const ymd = '' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  const base = client + '_ComparativeMatrix_' + ymd;
  return ext ? base + '.' + ext : base;
}

/* ---- Excel --------------------------------------------------------------- */

export function exportMatrixToXlsx(matrix, filename) {
  try {
    const aoa = matrixToAoa(matrix);
    const hasBaseline = !!matrix.baseline;
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 34 }]
      .concat(hasBaseline ? [{ wch: 46 }] : [])
      .concat(matrix.columns.map(() => ({ wch: 32 })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'CRS Comparative System');
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    triggerDownload(filename || exportFilename(matrix, 'xlsx'), new Blob([out], { type: 'application/octet-stream' }));
  } catch (e) {
    toast('Sorry — the Excel export failed: ' + (e && e.message ? e.message : e));
  }
}

/* ---- PDF ----------------------------------------------------------------- */

export function escHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/** Printable HTML fallback — A3 landscape, colour-accurate, matrix only. */
export async function matrixToPrintableHtml(matrix, autoPrint) {
  const E = escHtml;
  const hasBaseline = !!matrix.baseline;
  const cols = matrix.columns || [];
  let logoMarkup = '';
  try {
    // HTML can embed the SVG's real markup directly — no rasterization
    // needed here (that's only required for the jsPDF path below).
    logoMarkup = await fetchSvgMarkup(howdenLogoUrl);
  } catch (e) {
    /* logo is decorative — proceed without it if it can't be fetched */
  }
  const cellHtml = (cell) => {
    if (!cell || cell.t === 'empty') return '<span style="color:#cbd5e1">—</span>';
    if (cell.t === 'check') return '<span style="color:#0D9488;font-weight:700">✓</span>';
    const deleted = isDeleted(cell.v);
    return '<span style="' + (deleted ? 'color:#C81E19;font-weight:600' : '') + '">' + E(cell.v) + '</span>';
  };

  let thead = '<th class="lbl">Terms &amp; Conditions</th>';
  if (hasBaseline) thead += '<th class="base">' + E(matrix.baseline.name) + ' (Proposed)</th>';
  cols.forEach((c) => { thead += '<th>' + E(c.name) + '</th>'; });

  let tbody = '';
  (matrix.rows || []).forEach((r) => {
    tbody += '<tr' + (r.newField ? ' class="nf"' : '') + '>';
    tbody += '<th class="lbl">' + E(r.field || '') + '</th>';
    if (hasBaseline) tbody += '<td class="base">' + E(r.howden || '') + '</td>';
    cols.forEach((c) => { tbody += '<td>' + cellHtml(r.cells[c.id]) + '</td>'; });
    tbody += '</tr>';
  });

  let foot = '';
  if (matrix.footnotes && matrix.footnotes.length) {
    foot = '<div class="foot"><h3>Additional clauses, warranties &amp; subjectivities</h3>';
    matrix.footnotes.forEach((f) => {
      foot += '<div><strong>' + E(f.name) + '</strong><ul>' + f.lines.map((l) => '<li>' + E(l) + '</li>').join('') + '</ul></div>';
    });
    foot += '</div>';
  }

  return (
    '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + E(exportFilename(matrix, '')) + '</title><style>' +
    '*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;margin:14px;color:#0f172a;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
    '.band{background:#001F4D;color:#fff;padding:14px 16px;border-radius:8px 8px 0 0;display:flex;align-items:flex-start;gap:12px}' +
    '.logo-chip{background:#fff;border-radius:6px;padding:6px 10px;flex-shrink:0}' +
    '.logo-chip svg{display:block;height:20px;width:auto}' +
    '.eyebrow{font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:#A6C6EF;font-weight:700}' +
    '.title{font-size:18px;font-weight:700}.sub{font-size:13px;color:#cbd5e1}' +
    'table{border-collapse:collapse;width:100%;font-size:11px;table-layout:fixed}' +
    'th,td{border:1px solid #cbd5e1;padding:5px 7px;text-align:left;vertical-align:top;word-wrap:break-word;overflow-wrap:anywhere}' +
    'thead th{background:#f1f5f9}.lbl{background:#f8fafc;font-weight:700;width:170px}.base{background:#E9F1FB}' +
    'tr.nf td,tr.nf th{border-top:2px solid #94a3b8}' +
    '.foot{margin-top:12px;font-size:11px}.foot h3{font-size:12px;text-transform:uppercase;color:#475569}.foot ul{margin:2px 0 8px 16px;padding:0}' +
    '.bar{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:12px;background:#001F4D;color:#fff;padding:10px 14px;margin:-14px -14px 14px;border-radius:0 0 8px 8px}' +
    '.bar button{background:#0047AB;color:#fff;border:0;border-radius:6px;padding:8px 16px;font-size:13px;font-weight:700;cursor:pointer}' +
    '.bar button:hover{background:#00337A}.bar span{font-size:12px;color:#e2e8f0}' +
    '@media print{.no-print{display:none!important}}' +
    '@page{size:A3 landscape;margin:10mm}' +
    '</style></head><body>' +
    '<div class="bar no-print"><button type="button" onclick="window.print()">Save as PDF</button>' +
    '<span>Choose “Save as PDF” as the destination in the print dialog.</span></div>' +
    '<div class="band">' +
    (logoMarkup ? '<div class="logo-chip">' + logoMarkup.replace(/<\?xml[^>]*\?>/, '') + '</div>' : '') +
    '<div>' +
    (matrix.eyebrow ? '<div class="eyebrow">' + E(matrix.eyebrow) + '</div>' : '') +
    '<div class="title">' + E(matrix.title || '') + '</div>' +
    (matrix.subtitle ? '<div class="eyebrow" style="margin-top:3px">' + E(matrix.subtitle) + '</div>' : '') +
    '</div>' +
    '</div>' +
    '<table><thead><tr>' + thead + '</tr></thead><tbody>' + tbody + '</tbody></table>' + foot +
    (autoPrint ? '<scr' + 'ipt>window.onload=function(){setTimeout(function(){try{window.focus();window.print();}catch(e){}},350);};</scr' + 'ipt>' : '') +
    '</body></html>'
  );
}

// jsPDF's built-in fonts use WinAnsi encoding, which lacks the peso sign and the
// check glyph — swap them for readable ASCII so amounts never garble.
function pdfSafe(s) {
  return String(s == null ? '' : s).replace(/₱/g, 'PHP ').replace(/[✓✔]/g, '');
}

function pdfCellFor(cell) {
  if (!cell || cell.t === 'empty') return { content: '—', styles: { textColor: [148, 163, 184], halign: 'center' } };
  if (cell.t === 'check') return { content: 'As proposed', styles: { textColor: [13, 148, 136], fontStyle: 'bold' } };
  const v = cell.v || '';
  if (isDeleted(v)) return { content: pdfSafe(v), styles: { textColor: [200, 30, 25], fontStyle: 'bold' } };
  return { content: pdfSafe(v) };
}

/** Build a real PDF document from the matrix (no pop-up, no print dialog). */
export async function buildMatrixPdfBlob(matrix) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a3' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 28;
  let y = margin + 4;

  let logo = null;
  try {
    logo = await svgUrlToPng(howdenLogoUrl);
  } catch (e) {
    /* logo is decorative — proceed without it if rasterization fails */
  }
  const logoH = 40;
  const logoW = logo ? logoH * logo.aspect : 0;
  const textX = logo ? margin + logoW + 14 : margin;

  if (matrix.eyebrow) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(0, 63, 153);
    doc.text(pdfSafe(matrix.eyebrow).toUpperCase(), textX, y);
    y += 14;
  }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(33, 30, 36);
  const titleBaselineY = y;
  doc.text(pdfSafe(matrix.title || 'CRS Comparative System'), textX, titleBaselineY);
  y += 18;

  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(100, 116, 139);
  doc.text('Comparative Matrix', textX, y);
  y += 14;

  // Vertically center the logo on the title line (the insured's name), not
  // the whole eyebrow+title block, so it visually lines up with the name.
  const logoY = titleBaselineY - 6 - logoH / 2;
  if (logo) doc.addImage(logo.dataUrl, 'PNG', margin, logoY, logoW, logoH);
  // The title block might be shorter than the logo — don't let the table
  // start before the logo's bottom edge.
  y = Math.max(y, logoY + logoH + 10);
  y += 6;

  const hasBaseline = !!matrix.baseline;
  const head = ['Terms & Conditions'];
  if (hasBaseline) head.push(pdfSafe(matrix.baseline.name || 'Proposed') + ' (Proposed)');
  matrix.columns.forEach((c) => head.push(pdfSafe(c.name || '')));

  const body = matrix.rows.map((r) => {
    const cells = [{ content: pdfSafe(r.field || r.subLabel || ''), styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } }];
    if (hasBaseline) cells.push({ content: pdfSafe(r.howden || ''), styles: { fillColor: [233, 241, 251] } });
    matrix.columns.forEach((c) => cells.push(pdfCellFor(r.cells ? r.cells[c.id] : null)));
    return cells;
  });

  // Equal-width data columns: the "Terms & Conditions" label column keeps a
  // fixed width, and every insurer (+ baseline, if any) column splits the
  // remaining table width evenly — otherwise autoTable sizes columns by
  // content, which can make them visibly uneven.
  const labelColWidth = 150;
  const dataColCount = matrix.columns.length + (hasBaseline ? 1 : 0);
  const dataColWidth = dataColCount > 0 ? (pageW - margin * 2 - labelColWidth) / dataColCount : 0;
  const columnStyles = { 0: { cellWidth: labelColWidth } };
  for (let i = 1; i <= dataColCount; i++) columnStyles[i] = { cellWidth: dataColWidth };

  autoTable(doc, {
    head: [head],
    body,
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: pageW - margin * 2,
    styles: {
      font: 'helvetica', fontSize: 8, cellPadding: 4, overflow: 'linebreak',
      valign: 'top', lineColor: [226, 232, 240], lineWidth: 0.5, textColor: [33, 30, 36],
    },
    headStyles: { fillColor: [0, 31, 77], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
    columnStyles,
  });

  if (matrix.footnotes && matrix.footnotes.length) {
    let fy = (doc.lastAutoTable ? doc.lastAutoTable.finalY : y) + 22;
    const ensure = (h) => { if (fy + (h || 0) > pageH - margin) { doc.addPage(); fy = margin + 4; } };
    ensure(16);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(33, 30, 36);
    doc.text('Additional clauses, warranties & subjectivities', margin, fy);
    fy += 16;
    matrix.footnotes.forEach((f) => {
      ensure(14);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(33, 30, 36);
      doc.text(pdfSafe(f.name || ''), margin, fy);
      fy += 13;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(71, 85, 105);
      (f.lines || []).forEach((l) => {
        doc.splitTextToSize(pdfSafe(l), pageW - margin * 2 - 12).forEach((ln) => {
          ensure(12);
          doc.text(ln, margin + 12, fy);
          fy += 12;
        });
      });
      fy += 6;
    });
  }

  return doc.output('blob');
}

/**
 * Preferred path: build a REAL .pdf and download it — no pop-up and no print
 * dialog, so it works even inside sandboxed preview frames. If the PDF engine
 * fails, fall back to a printable HTML file the user can open and print.
 */
export async function exportMatrixToPdf(matrix) {
  try {
    const pdf = await buildMatrixPdfBlob(matrix);
    if (pdf) {
      triggerDownload(exportFilename(matrix, 'pdf'), pdf, true);
      toast('Saved your comparison as a PDF — check your Downloads folder.');
      return;
    }
  } catch (e) { /* fall through to the printable-HTML path */ }

  const html = await matrixToPrintableHtml(matrix, true);
  try {
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    const w = window.open(url, '_blank');
    if (w && !w.closed) {
      try { w.focus(); } catch (e) { /* focus is best-effort */ }
      toast('Opened your comparison in a new tab — choose “Save as PDF” in the print dialog.');
      return;
    }
  } catch (e) { /* pop-up blocked — fall through */ }

  triggerDownload(exportFilename(matrix, 'html'), new Blob([html], { type: 'text/html' }));
  toast('Your browser blocked the new tab — I saved a printable file. Open it, then print to PDF.');
}
