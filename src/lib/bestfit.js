/**
 * WEIGHTED SCORING — shared between the Best Fit view and the generated
 * Proposal, so both always agree on "who wins" per criterion and on the
 * overall recommended insurer. Every criterion reads the SAME effective
 * value shown in the Matrix (a manual edit/override wins over the extracted
 * figure), so the scoring never contradicts what's on screen elsewhere.
 */
import { formatMoney, formatSections } from './money.js';

export const firstPct = (s) => {
  const m = String(s || '').match(/(\d+(?:\.\d+)?)\s*%/);
  return m ? parseFloat(m[1]) : null;
};
export const firstAmt = (s) => {
  const m = String(s || '').replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
};
export const numberedClausesText = (p) =>
  (p.clausesAndWarranties || [])
    .map((c, i) => (/^\s*\d+[.)]/.test(String(c)) ? String(c).trim() : i + 1 + '. ' + String(c).trim()))
    .join('\n');

/** A manual edit (override) in the Matrix wins over the extracted value. */
export const eff = (p, key, fb) => {
  const o = p.overrides && p.overrides[key];
  return o != null && String(o).trim() !== '' ? String(o) : fb(p);
};
export const clauseCount = (p) => {
  const t = eff(p, 'clauses', (q) => numberedClausesText(q));
  return t && t.trim() ? t.split('\n').filter((l) => l.trim()).length : 0;
};

// disp = display string (aligns with the Matrix cell); num = comparable number.
export const CRITERIA = [
  {
    key: 'premium', label: 'Total Premium', hint: 'lower is better', dir: 'lower', def: 70,
    disp: (p) => eff(p, 'premiumTotal', (q) => (q.premium && q.premium.total ? formatMoney(q.premium.total.money) : '—')),
    num: (p) => firstAmt(eff(p, 'premiumTotal', (q) => (q.premium && q.premium.total ? formatMoney(q.premium.total.money) : ''))),
  },
  {
    key: 'premiumRate', label: 'Premium Rate', hint: 'lower is better', dir: 'lower', def: 50,
    disp: (p) => eff(p, 'premiumRate', (q) => formatSections(q.premiumRate)) || '—',
    num: (p) => firstPct(eff(p, 'premiumRate', (q) => formatSections(q.premiumRate))),
  },
  {
    key: 'brokerage', label: 'Brokerage Rate', hint: 'lower is better', dir: 'lower', def: 30,
    disp: (p) => p.brokerageRate || '—',
    num: (p) => firstPct(p.brokerageRate),
  },
  {
    key: 'clauses', label: 'Clauses & Warranties', hint: 'broader cover is better', dir: 'higher', def: 60,
    disp: (p) => clauseCount(p) + ' captured',
    num: (p) => clauseCount(p),
  },
  {
    key: 'sumInsured', label: 'Sum Insured', hint: 'higher is better', dir: 'higher', def: 40,
    disp: (p) => eff(p, 'sumInsured', (q) => formatSections(q.sumInsured)) || '—',
    num: (p) => firstAmt(eff(p, 'sumInsured', (q) => formatSections(q.sumInsured))),
  },
  {
    key: 'deductibles', label: 'Deductibles', hint: 'lower is better', dir: 'lower', def: 40,
    disp: (p) => eff(p, 'deductibles', (q) => formatSections(q.deductibles)) || '—',
    num: (p) => firstPct(eff(p, 'deductibles', (q) => formatSections(q.deductibles))),
  },
];

export const PRESETS = {
  Balanced: { premium: 70, premiumRate: 50, brokerage: 30, clauses: 60, sumInsured: 40, deductibles: 40 },
  'Lowest cost': { premium: 100, premiumRate: 80, brokerage: 60, clauses: 20, sumInsured: 20, deductibles: 60 },
  'Broadest cover': { premium: 30, premiumRate: 20, brokerage: 10, clauses: 100, sumInsured: 80, deductibles: 70 },
};

export function scoreProposals(proposals, weights) {
  const active = CRITERIA.filter((c) => weights[c.key] > 0);
  const per = active.map((c) => {
    const vals = proposals.map(c.num);
    const nums = vals.filter((v) => v != null && isFinite(v));
    return { c, vals, min: nums.length ? Math.min(...nums) : null, max: nums.length ? Math.max(...nums) : null };
  });
  const totalW = active.reduce((s, c) => s + weights[c.key], 0) || 1;
  return proposals
    .map((p, i) => {
      let sc = 0;
      per.forEach((pc) => {
        const v = pc.vals[i];
        let n = 0.5; // neutral when missing / all-equal
        if (v != null && isFinite(v) && pc.min != null) {
          n = pc.max === pc.min ? 0.5 : (v - pc.min) / (pc.max - pc.min);
          if (pc.c.dir === 'lower') n = 1 - n;
        }
        sc += n * weights[pc.c.key];
      });
      return { p, score: (sc / totalW) * 100 };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * The winning proposal for a single criterion (by key), or null if nothing
 * is comparable (fewer than 2 proposals with a detected value). Ties go to
 * whichever proposal appears first.
 */
export function criterionWinner(proposals, key) {
  const c = CRITERIA.find((x) => x.key === key);
  if (!c) return null;
  const withVal = proposals.map((p) => ({ p, v: c.num(p) })).filter((x) => x.v != null && isFinite(x.v));
  if (withVal.length < 2) return null;
  const best = withVal.reduce((a, b) => {
    if (c.dir === 'lower') return b.v < a.v ? b : a;
    return b.v > a.v ? b : a;
  });
  return { criterion: c, p: best.p, disp: c.disp(best.p) };
}
