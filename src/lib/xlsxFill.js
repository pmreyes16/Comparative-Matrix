/**
 * XLSX FILL — the Excel equivalent of docxFill.js: loads an uploaded .xlsx
 * template and replaces `{tagName}` placeholders found in cell text with
 * data from a proposal, using the same tag names documented in
 * src/assets/templates/README.md. Entirely client-side via SheetJS (already
 * a dependency for the Matrix export).
 */
import * as XLSX from 'xlsx';

const TAG_RX = /\{(\w+)\}/g;

/** Fill an .xlsx template's ArrayBuffer with data; returns a Blob. */
export function fillXlsxTemplate(templateArrayBuffer, data) {
  const wb = XLSX.read(templateArrayBuffer, { type: 'array' });
  wb.SheetNames.forEach((name) => {
    const ws = wb.Sheets[name];
    Object.keys(ws).forEach((ref) => {
      if (ref[0] === '!') return; // skip sheet metadata keys (!ref, !cols, …)
      const cell = ws[ref];
      if (!cell || typeof cell.v !== 'string' || !TAG_RX.test(cell.v)) return;
      TAG_RX.lastIndex = 0;
      const filled = cell.v.replace(TAG_RX, (m, key) => (data[key] != null ? String(data[key]) : ''));
      cell.v = filled;
      cell.t = 's';
      delete cell.f; // a formula cell can't also carry a literal value
      if (cell.w != null) cell.w = filled;
    });
  });
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
