/**
 * OVERALL ANALYSIS — aggregate analytics across all proposals.
 *
 * Verbatim slip figures are surfaced as-is; anything the app derives (spread,
 * average, saving %, value score) is labelled "computed" in the UI so it is
 * never confused with a figure copied from a slip.
 */
import { premiumTotalAmount, premiumTotalDisplay, primaryMoney } from './money.js';
import { quoteStatus } from './schema.js';

/*
 * Commercial vs. personal-lines classification (heuristic, computed — not a
 * slip figure). Commercial placements (Erection All Risks, Fire, Marine,
 * Directors & Officers, etc.) are formal risk-transfer documents a broker
 * markets to underwriters; personal lines (private motor, homeowners,
 * personal accident) are individual retail covers. This broker tool is
 * corporate-focused, so an empty/ambiguous read is left "Uncategorized"
 * rather than guessed — consistent with never fabricating a value.
 */
const PERSONAL_KEYWORDS = [
  'personal auto', 'private car', 'private motor', 'homeowner', 'household',
  'personal accident', 'ctpl', 'individual', 'personal line', 'pink slip',
];
const COMMERCIAL_KEYWORDS = [
  'erection all risk', 'ear', 'fire', 'marine', 'cargo', 'liability', 'directors',
  'officers', 'bond', 'surety', 'property all risk', 'business interruption',
  'commercial', 'fleet', 'industrial', 'contractors', 'engineering', 'cash in transit',
  "contractor's all risk", 'car policy', 'comprehensive general liability',
];

function classifySlipCategory(p) {
  const text = ((p.policyType || '') + ' ' + (p.cover || '')).toLowerCase();
  if (!text.trim()) return 'Uncategorized';
  const isPersonal = PERSONAL_KEYWORDS.some((k) => text.includes(k));
  const isCommercial = COMMERCIAL_KEYWORDS.some((k) => text.includes(k));
  if (isPersonal && !isCommercial) return 'Personal';
  if (isCommercial) return 'Commercial'; // corporate-broking context wins on overlap
  return 'Uncategorized';
}

/** Commercial / Personal / Uncategorized mix across the compared proposals. */
export function slipCategoryMix(proposals) {
  const list = proposals || [];
  const counts = { Commercial: 0, Personal: 0, Uncategorized: 0 };
  const perProposal = list.map((p) => {
    const category = classifySlipCategory(p);
    counts[category]++;
    return { p, category };
  });
  return { counts, perProposal };
}

export function analyze(proposals, refDate) {
  const list = proposals || [];
  const A = { count: list.length };
  A.categoryMix = slipCategoryMix(list);

  const withTotal = list
    .map((p) => ({ p, amt: premiumTotalAmount(p), disp: premiumTotalDisplay(p) }))
    .filter((x) => x.amt != null);
  A.withTotalCount = withTotal.length;

  if (withTotal.length) {
    A.lowest = withTotal.reduce((a, b) => (a.amt <= b.amt ? a : b));
    A.highest = withTotal.reduce((a, b) => (a.amt >= b.amt ? a : b));
    const amts = withTotal.map((x) => x.amt);
    A.avg = amts.reduce((s, x) => s + x, 0) / amts.length;
    A.spread = A.highest.amt - A.lowest.amt;
    A.savingsPct = A.highest.amt > 0 ? (A.spread / A.highest.amt) * 100 : 0;
    A.symbol = (A.lowest.disp.match(/[₱$€£¥]/) || ['₱'])[0];
  }

  const cov = (p) => p.clausesAndWarranties.length + ((p.cover || '').length / 200);
  A.coverage = list.map((p) => ({ p, score: cov(p), clauses: p.clausesAndWarranties.length }));
  if (list.length) A.mostCoverage = A.coverage.reduce((a, b) => (a.score >= b.score ? a : b));

  A.lapsed = list.filter((p) => {
    const q = quoteStatus(p.validityOfQuote, refDate);
    return q.known && q.lapsed;
  });
  A.review = list.filter((p) => p.extractionConfidence === 'low' || (p.flaggedFields && p.flaggedFields.length));
  A.policyTypes = [...new Set(list.map((p) => p.policyType).filter(Boolean))];

  A.completeness = list.map((p) => {
    const total = 8;
    let filled = 0;
    if (p.insurers.length) filled++;
    if (p.policyType) filled++;
    if (p.insured) filled++;
    if (primaryMoney(p.sumInsured)) filled++;
    if (p.cover) filled++;
    if (premiumTotalAmount(p) != null || (p.premium && p.premium.lineItems.length)) filled++;
    if (p.periodOfInsurance && (p.periodOfInsurance.from || p.periodOfInsurance.to)) filled++;
    if (p.clausesAndWarranties.length) filled++;
    return { p, pct: Math.round((filled / total) * 100) };
  });

  return A;
}

/** Interactive value ranking. weight 0 = all price, 1 = all coverage. */
export function valueRanking(proposals, weight) {
  const list = proposals || [];
  const totals = list.map((p) => premiumTotalAmount(p));
  const priced = totals.filter((x) => x != null);
  const minP = priced.length ? Math.min(...priced) : null;
  const maxP = priced.length ? Math.max(...priced) : null;
  const cov = list.map((p) => p.clausesAndWarranties.length + ((p.cover || '').length / 200));
  const minC = Math.min(...cov);
  const maxC = Math.max(...cov);
  return list
    .map((p, i) => {
      const amt = totals[i];
      let priceScore = 0.5;
      if (amt == null) priceScore = 0;
      else if (maxP === minP) priceScore = 1;
      else priceScore = (maxP - amt) / (maxP - minP);
      const covScore = maxC === minC ? 1 : (cov[i] - minC) / (maxC - minC);
      return {
        p,
        score: (1 - weight) * priceScore + weight * covScore,
        priceScore,
        covScore,
        hasPrice: amt != null,
      };
    })
    .sort((a, b) => b.score - a.score);
}

/** Format an app-COMPUTED amount (not a verbatim slip figure) with 2 decimals. */
export function formatComputed(amount, symbol) {
  if (amount == null || !isFinite(amount)) return '—';
  return (symbol || '') + ' ' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const normClause = (s) =>
  String(s || '').toLowerCase().replace(/^\s*\d+[.)]\s*/, '').replace(/\s+/g, ' ').trim();

/**
 * Clauses & Warranties differences across proposals: which clauses are shared
 * by every proposal, and which ones are unique to a given proposal (present
 * there but not in all the others). Compares on normalised text (numbering
 * prefix / case / whitespace stripped) but returns the original wording.
 */
export function clauseDiff(proposals) {
  const list = proposals || [];
  const sets = list.map((p) => new Set((p.clausesAndWarranties || []).map(normClause).filter(Boolean)));
  const common = sets.length ? [...sets[0]].filter((c) => sets.every((s) => s.has(c))) : [];
  const commonSet = new Set(common);
  const perProposal = list.map((p) => {
    const raw = p.clausesAndWarranties || [];
    const unique = raw.filter((c) => !commonSet.has(normClause(c)));
    return { p, count: raw.length, unique };
  });
  return { commonCount: common.length, perProposal };
}
