/**
 * COMMISSION — broker commission & premium build-up calculator engine.
 *
 * Every charge is a user-editable FORMULA (not a hard-coded rate) so a broker
 * can match whatever their market, insurer or line of business requires:
 *
 *   basic * 12.5%          → Documentary Stamp Tax on the basic premium
 *   commission * 12%       → VAT on the brokerage commission
 *   max(basic * 0.2%, 50)  → a rate with a minimum amount
 *
 * Formulas are evaluated by a tiny safe parser (numbers, %, + - * / ( ),
 * variables and min/max/round/abs) — never eval(), so nothing a user types
 * can run code.
 *
 * Default rates are the common Philippine non-life figures, provided as a
 * starting point only — always confirm against current BIR / LGU rules and
 * the insurer's own computation.
 */

/* ---------------------------- safe evaluator ---------------------------- */

const FUNCS = {
  min: (...a) => Math.min(...a),
  max: (...a) => Math.max(...a),
  abs: (x) => Math.abs(x),
  round: (x, d = 2) => { const f = Math.pow(10, d); return Math.round(x * f) / f; },
};

function tokenize(src) {
  const out = [];
  let i = 0;
  const s = String(src || '');
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i;
      // No thousands separators here — a comma separates function arguments.
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      const num = parseFloat(s.slice(i, j));
      if (!isFinite(num)) throw new Error('Bad number "' + s.slice(i, j) + '"');
      out.push({ t: 'num', v: num });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < s.length && /[A-Za-z0-9_]/.test(s[j])) j++;
      out.push({ t: 'id', v: s.slice(i, j) });
      i = j;
      continue;
    }
    if ('+-*/(),%'.includes(c)) { out.push({ t: c }); i++; continue; }
    if (c === '×') { out.push({ t: '*' }); i++; continue; }
    if (c === '÷') { out.push({ t: '/' }); i++; continue; }
    throw new Error('Unexpected "' + c + '"');
  }
  return out;
}

/** Evaluate a formula against `vars`. Returns { value } or { error }. */
export function evaluate(formula, vars) {
  try {
    const toks = tokenize(formula);
    if (!toks.length) return { value: 0 };
    let pos = 0;
    const peek = () => toks[pos];
    const take = (t) => {
      const k = toks[pos];
      if (!k || (t && k.t !== t)) throw new Error('Expected "' + t + '"');
      pos++;
      return k;
    };
    function primary() {
      const k = peek();
      if (!k) throw new Error('Formula ends too early');
      if (k.t === '-') { pos++; return -postfix(); }
      if (k.t === '+') { pos++; return postfix(); }
      if (k.t === 'num') { pos++; return k.v; }
      if (k.t === '(') { pos++; const v = expr(); take(')'); return v; }
      if (k.t === 'id') {
        pos++;
        const name = k.v;
        if (peek() && peek().t === '(') {
          const fn = FUNCS[name.toLowerCase()];
          if (!fn) throw new Error('Unknown function "' + name + '"');
          pos++;
          const args = [];
          if (peek() && peek().t !== ')') {
            args.push(expr());
            while (peek() && peek().t === ',') { pos++; args.push(expr()); }
          }
          take(')');
          return fn(...args);
        }
        if (!Object.prototype.hasOwnProperty.call(vars, name)) throw new Error('Unknown name "' + name + '"');
        return Number(vars[name]) || 0;
      }
      throw new Error('Unexpected "' + k.t + '"');
    }
    function postfix() {
      let v = primary();
      while (peek() && peek().t === '%') { pos++; v = v / 100; }
      return v;
    }
    function term() {
      let v = postfix();
      while (peek() && (peek().t === '*' || peek().t === '/')) {
        const op = take().t;
        const r = postfix();
        v = op === '*' ? v * r : r === 0 ? 0 : v / r;
      }
      return v;
    }
    function expr() {
      let v = term();
      while (peek() && (peek().t === '+' || peek().t === '-')) {
        const op = take().t;
        const r = term();
        v = op === '+' ? v + r : v - r;
      }
      return v;
    }
    const v = expr();
    if (pos < toks.length) throw new Error('Unexpected "' + (toks[pos].v || toks[pos].t) + '"');
    if (!isFinite(v)) throw new Error('Result is not a number');
    return { value: v };
  } catch (e) {
    return { error: e.message || String(e) };
  }
}

/* ------------------------------- presets -------------------------------- */

const L = (id, label, formula, on, note, effect) => ({ id, label, formula, on: on !== false, note: note || '', effect: effect || 'add' });

const PH_BUILDUP = () => [
  L('dst', 'Documentary Stamp Tax', 'basic * 12.5%', true, '₱0.50 for every ₱4.00 of premium (NIRC Sec. 184).'),
  L('vat', 'VAT on premium', 'basic * 12%', true, 'Non-life premiums. Life insurance is VAT-exempt.'),
  L('lgt', 'Local Government Tax', 'basic * 0.2%', true, 'Varies by city / municipality; commonly 0.2%–0.75%. Confirm the LGU rate.'),
  L('fst', 'Fire Service Tax', 'basic * 2%', false, 'Fire lines only (RA 9514). Switch on for fire / property policies.'),
];

const PH_COMMISSION = () => [
  L('vatComm', 'VAT on commission', 'commission * 12%', true, 'Added if the broker is VAT-registered.', 'add'),
  L('ewt', 'Withholding tax on commission', 'commission * 10%', true, 'Withheld by the insurer — 10% or 15% depending on the payee and income threshold (RR 11-2018).', 'deduct'),
  L('producer', 'Producer / sub-agent share', 'commission * 0%', false, 'Share passed to a referring producer or sub-broker.', 'deduct'),
];

export const PRESETS = {
  phNonLife: {
    label: 'PH Non-Life (Engineering, Motor, Liability…)',
    commission: 'basic * rate',
    buildup: () => PH_BUILDUP(),
    adjustments: () => PH_COMMISSION(),
  },
  phFire: {
    label: 'PH Fire / Property (adds Fire Service Tax)',
    commission: 'basic * rate',
    buildup: () => PH_BUILDUP().map((l) => (l.id === 'fst' ? { ...l, on: true } : l)),
    adjustments: () => PH_COMMISSION(),
  },
  simple: {
    label: 'Commission only (no taxes)',
    commission: 'basic * rate',
    buildup: () => [],
    adjustments: () => [],
  },
};

export function defaultConfig(presetKey = 'phNonLife') {
  const p = PRESETS[presetKey] || PRESETS.phNonLife;
  return {
    preset: presetKey,
    basic: '',
    ratePct: '15',
    si: '',
    inputMode: 'basic', // 'basic' | 'gross' (work back from the all-in premium)
    gross: '',
    commission: p.commission,
    buildup: p.buildup(),
    adjustments: p.adjustments(),
  };
}

/** A variable name from a label, unique among `taken`. */
export function slugId(label, taken) {
  let base = String(label || 'item')
    .replace(/[^A-Za-z0-9 ]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join('') || 'item';
  if (/^[0-9]/.test(base)) base = 'x' + base;
  let id = base;
  let n = 2;
  while (taken.has(id) || RESERVED.has(id)) id = base + n++;
  return id;
}

export const RESERVED = new Set(['basic', 'rate', 'si', 'gross', 'commission', 'netCommission', 'min', 'max', 'round', 'abs']);

/* ------------------------------ calculation ----------------------------- */

const num = (s) => {
  const v = parseFloat(String(s == null ? '' : s).replace(/[^0-9.\-]/g, ''));
  return isFinite(v) ? v : 0;
};

/** Run the whole calculation for a given basic premium. */
function runFor(cfg, basic) {
  const vars = { basic, rate: num(cfg.ratePct) / 100, si: num(cfg.si) };
  const errors = {};
  const buildup = (cfg.buildup || []).map((l) => {
    const r = evaluate(l.formula, vars);
    const amount = l.on && !r.error ? r.value : 0;
    vars[l.id] = amount;
    if (r.error && l.on) errors[l.id] = r.error;
    return { ...l, amount, error: r.error };
  });
  const gross = basic + buildup.reduce((s, l) => s + l.amount, 0);
  vars.gross = gross;

  const c = evaluate(cfg.commission, vars);
  if (c.error) errors.commission = c.error;
  const commission = c.error ? 0 : c.value;
  vars.commission = commission;

  const adjustments = (cfg.adjustments || []).map((l) => {
    const r = evaluate(l.formula, vars);
    const amount = l.on && !r.error ? r.value : 0;
    vars[l.id] = amount;
    if (r.error && l.on) errors[l.id] = r.error;
    return { ...l, amount, signed: l.effect === 'deduct' ? -amount : amount, error: r.error };
  });
  const netCommission = commission + adjustments.reduce((s, l) => s + l.signed, 0);

  return {
    basic,
    rate: vars.rate,
    buildup,
    gross,
    commission,
    adjustments,
    netCommission,
    // What the broker forwards when commission is deducted at source.
    remitToInsurer: gross - commission,
    effectiveRate: gross > 0 ? netCommission / gross : 0,
    errors,
  };
}

/**
 * Calculate. In 'gross' mode the basic premium is worked back from the
 * all-in amount — taxes are normally linear in the basic premium, so two
 * probes solve it exactly (a non-linear formula, e.g. with max(), is refined
 * with a few secant steps).
 */
export function calculate(cfg) {
  if (cfg.inputMode !== 'gross') return runFor(cfg, num(cfg.basic));
  const target = num(cfg.gross);
  const f = (b) => runFor(cfg, b).gross - target;
  let b0 = 0, b1 = target || 1;
  let f0 = f(b0), f1 = f(b1);
  for (let i = 0; i < 12 && Math.abs(f1) > 0.005 && f1 !== f0; i++) {
    const b2 = b1 - (f1 * (b1 - b0)) / (f1 - f0);
    b0 = b1; f0 = f1; b1 = b2; f1 = f(b1);
  }
  return { ...runFor(cfg, Math.max(0, b1)), solvedFromGross: true };
}

export function fmtAmt(n, sym = '₱') {
  const v = Number(n) || 0;
  const s = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (v < 0 ? '−' : '') + sym + ' ' + s;
}

/* -------------------------- read from a proposal ------------------------- */

/**
 * Best-effort basic premium / brokerage rate / sum insured from an uploaded
 * proposal. Prefers a "basic" / "net" premium line; otherwise falls back to
 * the total and flags it as gross so the calculator works backwards.
 */
export function figuresFromProposal(p) {
  const items = (p.premium && p.premium.lineItems) || [];
  const basicLine = items.find((li) => /basic|net\s*premium|premium\s*\(net\)/i.test(li.label || '') && li.money && li.money.amount != null);
  const ov = p.overrides && p.overrides.premiumTotal;
  const totalAmt = ov ? num(ov) : p.premium && p.premium.total && p.premium.total.money ? p.premium.total.money.amount : null;
  const rateM = String(p.brokerageRate || '').match(/(\d+(?:\.\d+)?)\s*%/);
  const siSec = ((p.sumInsured && p.sumInsured.sections) || []).find((s) => s.money && s.money.amount != null);
  return {
    basic: basicLine ? basicLine.money.amount : null,
    gross: totalAmt,
    ratePct: rateM ? rateM[1] : null,
    si: siSec ? siSec.money.amount : null,
  };
}
