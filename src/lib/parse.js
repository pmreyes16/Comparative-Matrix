/**
 * PARSERS — turn an uploaded file into { text, pairs, images }.
 *   pairs  = [{label, value}] recovered from table rows (most reliable)
 *   text   = newline-joined lines (fallback for regex)
 *   images = data-URI candidates for logo auto-extraction (docx only)
 */
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/** "Label: value" recovery from loose text lines (marked `soft` = lower trust). */
export function linesToPairs(lines) {
  const pairs = [];
  for (const line of lines) {
    const colon = line.match(/^([A-Za-z][A-Za-z0-9 /&'().\-]{2,60}?)\s*[:\-–]\s+(.+)$/);
    if (colon) pairs.push({ label: colon[1].trim(), value: colon[2].trim(), soft: true });
  }
  return pairs;
}

const norm4 = (r) => [Math.min(r[0], r[2]), Math.min(r[1], r[3]), Math.max(r[0], r[2]), Math.max(r[1], r[3])];

/**
 * Renders a page once and returns `isColored(item)` — true for reviewer-
 * inserted red/orange ink (a struck value's replacement), false for the
 * slip's own black body text. Strike-out rectangles are often drawn loosely
 * around the old text and end up overlapping the colored replacement typed
 * next to it; without this, that replacement gets silently deleted along
 * with the text it was replacing. Only called when a page actually has
 * strike-out annotations, so normal (unmarked-up) slips never pay for it.
 */
async function buildColorClassifier(page) {
  const scale = 2;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  await page.render({ canvasContext: ctx, viewport }).promise;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const w = canvas.width, h = canvas.height;

  return (it) => {
    const iw = it.width || 4;
    const ih = it.height || Math.hypot(it.transform[2], it.transform[3]) || 10;
    const x0 = it.transform[4], y0 = it.transform[5];
    // Sample the glyph's mid-body band only: low enough to clear a nearby
    // superscript replacement placed just above, but high enough to clear
    // the strike-through line itself (drawn in the same ink near the
    // baseline) — either one bleeding in would misclassify this item.
    const p1 = viewport.convertToViewportPoint(x0 + iw * 0.15, y0 + ih * 0.28);
    const p2 = viewport.convertToViewportPoint(x0 + iw * 0.85, y0 + ih * 0.6);
    const x1 = Math.max(0, Math.min(p1[0], p2[0]));
    const x2 = Math.min(w, Math.max(p1[0], p2[0]));
    const y1 = Math.max(0, Math.min(p1[1], p2[1]));
    const y2 = Math.min(h, Math.max(p1[1], p2[1]));
    let rs = 0, gs = 0, bs = 0, n = 0;
    for (let yy = Math.floor(y1); yy < Math.ceil(y2); yy++) {
      for (let xx = Math.floor(x1); xx < Math.ceil(x2); xx++) {
        const idx = (yy * w + xx) * 4;
        const r = img[idx], g = img[idx + 1], b = img[idx + 2], a = img[idx + 3];
        if (a > 0 && (r < 235 || g < 235 || b < 235)) { rs += r; gs += g; bs += b; n++; }
      }
    }
    if (!n) return false;
    const r = rs / n, g = gs / n, b = bs / n;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    return sat > 0.2 && r > g + 15 && r > b + 15; // reddish/orange ink vs. black/gray body text
  };
}

/**
 * True when a line is page chrome (header / footer / classification banner /
 * reference code / reviewer initials) rather than slip content — so it can be
 * stripped from the extracted text. Applied to every file type.
 */
export function isBoilerplateLine(s) {
  const t = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  if (!t) return true;
  if (/\d\s*\|\s*p\s*a?\s*g\s*e\b/i.test(t)) return true; // "2 | Page" / "2 | P a g e"
  if (/\bpage\s*\d+\s*(?:of|\/)\s*\d+\b/i.test(t)) return true; // "Page 2 of 5"
  if (/^page\b/i.test(t) && t.length < 12) return true;
  if (/\blevel\s*\d+\s*\(?\s*(restricted|confidential|internal)/i.test(t)) return true; // "Level 2 (Restricted)"
  if (/^(?:private\s*&?\s*)?(?:strictly\s*)?(?:confidential|restricted)\b/i.test(t) && t.length < 40) return true;
  if (/\bR\d{2}\b\s*$/i.test(t) && /(?:19|20)\d{2}/.test(t) && t.length < 60) return true; // "…-2026-R00" ref code
  if (/^(?:[A-Za-z]\s+){1,5}[A-Za-z](?:\s*\|\s*(?:[A-Za-z]\s+)*[A-Za-z]\s*)+$/.test(t)) return true; // "F F L | M R J | R J E M"
  return false;
}

async function extractPdf(file) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const pageLineArrays = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();

    // Annotations first: strike-out regions (skip crossed-out text) + markup /
    // form-field text (red review notes, callouts, filled fields).
    const strikeRects = [];
    const markupLines = [];
    try {
      const annots = await page.getAnnotations();
      annots.forEach((a) => {
        if (a.subtype === 'StrikeOut' && a.rect) strikeRects.push(norm4(a.rect));
        let t = a.fieldValue != null && a.fieldValue !== '' ? String(a.fieldValue) : (a.contents ? String(a.contents) : '');
        t = t.replace(/\s+/g, ' ').trim();
        if (t) markupLines.push(t);
      });
    } catch (e) {
      /* annotations unavailable — ignore */
    }
    const inStrike = (x, y) => strikeRects.some((r) => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3]);

    let isColored = null;
    if (strikeRects.length) {
      try {
        isColored = await buildColorClassifier(page);
      } catch (e) {
        /* rendering unavailable — fall back to plain strike-rect removal */
      }
    }

    const rows = {};
    tc.items.forEach((it) => {
      if (!it.str || !it.str.trim()) return;
      const x = it.transform[4];
      const y = it.transform[5];
      // Skip crossed-out text — but never the colored replacement written
      // next to it, even if the strike rectangle happens to overlap it too.
      if (inStrike(x, y) && !(isColored && isColored(it))) return;
      const yk = Math.round(y);
      (rows[yk] = rows[yk] || []).push({ x, s: it.str });
    });
    const pageLines = [];
    Object.keys(rows)
      .map(Number)
      .sort((a, b) => b - a)
      .forEach((yk) => {
        const line = rows[yk].sort((a, b) => a.x - b.x).map((o) => o.s).join(' ').replace(/\s+/g, ' ').trim();
        if (line) pageLines.push(line);
      });
    markupLines.forEach((t) => { if (!pageLines.includes(t)) pageLines.push(t); });
    pageLineArrays.push(pageLines);
  }

  // Strip page chrome: lines repeated across pages (running headers/footers)
  // plus anything matching the boilerplate patterns above.
  const nrm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const freq = {};
  pageLineArrays.forEach((pl) => {
    const seen = new Set();
    pl.forEach((l) => { const k = nrm(l); if (!seen.has(k)) { seen.add(k); freq[k] = (freq[k] || 0) + 1; } });
  });
  const multi = pdf.numPages >= 2;
  const lines = [];
  pageLineArrays.forEach((pl) => pl.forEach((l) => {
    if (isBoilerplateLine(l)) return;
    if (multi && freq[nrm(l)] >= 2) return; // running header / footer
    lines.push(l);
  }));
  return { text: lines.join('\n'), pairs: linesToPairs(lines), images: [] };
}

async function extractXlsx(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const pairs = [];
  const lines = [];
  wb.SheetNames.forEach((name) => {
    const ws = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
    rows.forEach((r) => {
      const cells = r.map((c) => String(c == null ? '' : c).trim());
      const nonEmpty = cells.filter(Boolean);
      if (nonEmpty.length) lines.push(nonEmpty.join(' | '));
      if (cells.length >= 2 && cells[0]) {
        const val = cells.slice(1).filter(Boolean).join(' ');
        if (val) pairs.push({ label: cells[0], value: val });
      }
    });
  });
  const clean = lines.filter((l) => !isBoilerplateLine(l));
  return { text: clean.join('\n'), pairs: pairs.filter((p) => !isBoilerplateLine(p.value)), images: [] };
}

async function extractDocx(file) {
  const buf = await file.arrayBuffer();
  const images = [];
  const res = await mammoth.convertToHtml(
    { arrayBuffer: buf },
    {
      // Map strikethrough runs to <s> so we can drop crossed-out words below.
      styleMap: ['strike => s'],
      convertImage: mammoth.images.imgElement(async (img) => {
        try {
          const b64 = await img.read('base64');
          const src = 'data:' + img.contentType + ';base64,' + b64;
          images.push(src);
          return { src };
        } catch {
          return {};
        }
      }),
    }
  );
  const doc = new DOMParser().parseFromString(res.value, 'text/html');
  // Remove crossed-out / deleted text so it is not read.
  doc.querySelectorAll('s, strike, del').forEach((el) => el.remove());
  const pairs = [];
  const lines = [];
  doc.querySelectorAll('table tr').forEach((tr) => {
    const tds = [...tr.querySelectorAll('td,th')].map((td) => td.textContent.trim());
    const nonEmpty = tds.filter(Boolean);
    if (nonEmpty.length) lines.push(nonEmpty.join(' | '));
    if (tds.length >= 2 && tds[0]) {
      const val = tds.slice(1).filter(Boolean).join(' ');
      if (val) pairs.push({ label: tds[0], value: val });
    }
  });
  doc.querySelectorAll('p,li,h1,h2,h3,h4').forEach((el) => {
    const t = el.textContent.trim();
    if (t) lines.push(t);
  });
  const clean = lines.filter((l) => !isBoilerplateLine(l));
  return {
    text: clean.join('\n'),
    pairs: pairs.concat(linesToPairs(clean)).filter((p) => !isBoilerplateLine(p.value)),
    images,
  };
}

export async function parseFile(file) {
  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.pdf')) return extractPdf(file);
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) return extractXlsx(file);
  if (name.endsWith('.docx')) return extractDocx(file);
  if (name.endsWith('.doc')) {
    throw new Error('Legacy .doc is not supported in-browser — please re-save as .docx');
  }
  throw new Error('Unsupported file type');
}
