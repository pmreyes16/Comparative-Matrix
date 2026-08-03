/**
 * MONEY — the single shared money helper used for EVERY monetary field
 * (premium line items, premium total, sum insured, deductibles).
 *
 * CRITICAL: a monetary value is NEVER stored in a JS number for display. The
 * exact source substring (incl. trailing zeros like "500,000.00") is preserved
 * verbatim in `amountDisplay`. The numeric `amount` is derived ONLY for sorting
 * / range filtering and is never rendered. This is the guard against the
 * "native number input strips .00" bug.
 */

const CURRENCIES = [
  { code: 'PHP', symbol: '₱', rx: /₱|\bphp\b|\bpeso/i },
  { code: 'USD', symbol: '$', rx: /\bus\$|\busd\b/i },
  { code: 'EUR', symbol: '€', rx: /€|\beur\b/i },
  { code: 'GBP', symbol: '£', rx: /£|\bgbp\b/i },
  { code: 'JPY', symbol: '¥', rx: /¥|\bjpy\b/i },
];

function detectCurrency(s) {
  for (const c of CURRENCIES) if (c.rx.test(s)) return c;
  if (/\$/.test(s)) return CURRENCIES[1]; // bare "$" → USD
  return CURRENCIES[0];                   // PHP default (Philippine market)
}

/** Parse ONE amount out of a free-text value. Returns null if no number found. */
export function parseMoney(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  // Digits with optional thousands separators and optional decimals, keeping
  // the exact written form (including trailing zeros).
  const m = s.match(
    /(?:₱|php|us\$|usd|eur|gbp|jpy|\$|€|£|¥)?\s*([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]+)?|[0-9]+(?:\.[0-9]+)?)/i
  );
  if (!m) return null;
  const display = m[1]; // e.g. "24,580.00" — verbatim
  const numeric = Number(display.replace(/,/g, ''));
  const cur = detectCurrency(s);
  return {
    amountDisplay: display,
    amount: Number.isFinite(numeric) ? numeric : null,
    currency: cur.code,
    symbol: cur.symbol,
  };
}

/** Render a money object EXACTLY as captured; otherwise flag for manual check. */
export function formatMoney(mo) {
  if (!mo || !mo.amountDisplay) return 'Not detected — verify manually';
  return (mo.symbol || '') + ' ' + mo.amountDisplay;
}

/* ---- Sectioned money (Sum Insured / Deductibles with Section I, II, …) ---- */

export function sectionsOf(field) {
  if (!field) return [];
  if (Array.isArray(field.sections)) return field.sections;
  if (field.amountDisplay) return [{ label: '', money: field }];
  return [];
}

export function primaryMoney(field) {
  const s = sectionsOf(field).find((x) => x.money && x.money.amountDisplay);
  return s ? s.money : null;
}

export function primaryAmount(field) {
  const m = primaryMoney(field);
  return m ? m.amount : null;
}

export function sectionValue(sec) {
  if (!sec) return '';
  if (sec.money && sec.money.amountDisplay) return formatMoney(sec.money);
  return sec.value != null ? String(sec.value) : '';
}

export function formatSections(field) {
  const secs = sectionsOf(field).filter((x) => sectionValue(x));
  if (!secs.length) return '';
  if (secs.length === 1 && !secs[0].label) return sectionValue(secs[0]);
  return secs.map((x) => (x.label ? x.label + ': ' : '') + sectionValue(x)).join('\n');
}

/* ---- Total premium, aligned with the Matrix (manual override wins) ---- */

export function premiumTotalDisplay(p) {
  const o = p && p.overrides && p.overrides.premiumTotal;
  if (o != null && String(o).trim() !== '') return String(o);
  return p && p.premium && p.premium.total ? formatMoney(p.premium.total.money) : '';
}

export function premiumTotalAmount(p) {
  const o = p && p.overrides && p.overrides.premiumTotal;
  if (o != null && String(o).trim() !== '') {
    const m = String(o).replace(/,/g, '').match(/\d+(?:\.\d+)?/);
    return m ? parseFloat(m[0]) : null;
  }
  return p && p.premium && p.premium.total ? p.premium.total.money.amount : null;
}

/**
 * Normalise a hand-typed money value to "<symbol> 1,234,567.89". Only plain
 * numbers are reformatted; text with extra words is left as typed. Idempotent.
 */
export function formatMoneyInput(text) {
  const s = String(text == null ? '' : text).trim();
  if (!s) return '';
  const sym = (s.match(/[₱$€£¥]/) || [''])[0];
  const core = s.replace(/[₱$€£¥,\s]/g, '');
  if (/^-?\d+(\.\d+)?$/.test(core)) {
    const n = parseFloat(core);
    if (isFinite(n)) {
      return (sym || '₱') + ' ' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
  }
  return s;
}

/**
 * Reformat only the money AMOUNTS inside mixed text (Sum Insured / Deductibles),
 * leaving section labels, percentages ("2%") and time excesses ("72 hours") intact.
 */
export function formatMoneyInText(text) {
  const s = String(text == null ? '' : text);
  if (!s) return '';
  const re = /([₱$€£¥]\s*)?(\d[\d,]*(?:\.\d+)?)/g;
  return s.replace(re, function (m, sym, num, offset, full) {
    const after = full.slice(offset + m.length);
    if (/^\s*%/.test(after)) return m;
    if (/^\s*(hours?|hrs?|days?|months?|mos?|weeks?|wks?|years?|yrs?)\b/i.test(after)) return m;
    const core = num.replace(/,/g, '');
    const hasComma = num.indexOf(',') >= 0;
    const hasDot = num.indexOf('.') >= 0;
    const intDigits = core.split('.')[0].length;
    const yearLike = !sym && !hasComma && !hasDot && /^(19|20)\d{2}$/.test(core);
    const isMoney = !!sym || hasComma || hasDot || (intDigits >= 4 && !yearLike);
    if (!isMoney) return m;
    const n = parseFloat(core);
    if (!isFinite(n)) return m;
    return (sym ? sym.trim() + ' ' : '') + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  });
}
