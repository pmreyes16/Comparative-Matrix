/**
 * ASSISTANT — plain-language summaries, a coverage explainer, document
 * differences and a client recommendation draft, all built from the
 * proposals already extracted in the browser. Deterministic: every sentence
 * traces back to a field on the slip, so nothing is invented. (An optional
 * AI endpoint can be layered on top — see askAI below.)
 */
import { formatSections, premiumTotalDisplay } from './money.js';
import { quoteStatus } from './schema.js';
import { buildMatrixFromProposals } from './matrix.js';
import { buildProposalData, nameOf } from './proposal.js';
import { clauseDiff } from './analyze.js';
import { clauseCount } from './bestfit.js';

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const short = (s, n = 220) => { const t = clean(s); return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : t; };
const eff = (p, key, fb) => {
  const o = p.overrides && p.overrides[key];
  return o != null && String(o).trim() !== '' ? String(o) : fb;
};

/* -------------------------------- glossary ------------------------------- */

// term → plain-English meaning. `rx` finds it in the slip text.
export const GLOSSARY = [
  { term: 'Contractors’ All Risks (CAR)', rx: /contractor'?s'?\s*all\s*risks?|\bCAR\b/i, plain: 'Covers a building project while it is being built — damage to the works, materials and equipment on site, plus injury or damage the project causes to other people.' },
  { term: 'Erection All Risks (EAR)', rx: /erection\s*all\s*risks?|\bEAR\b/i, plain: 'Like CAR, but for installing machinery, plant or steel structures — covers damage during installation and testing.' },
  { term: 'All Risks', rx: /\ball\s*risks?\b/i, plain: 'Everything is covered unless the policy specifically excludes it. Read the exclusions — that is where the limits are.' },
  { term: 'Material Damage', rx: /material\s*damage/i, plain: 'Physical loss or damage to the insured property itself (the building, works or equipment).' },
  { term: 'Third Party Liability (TPL)', rx: /third\s*party\s*liability|\bTPL\b/i, plain: 'Pays others (not you) if your project or business injures them or damages their property, and you are legally responsible.' },
  { term: 'Sum Insured', rx: /sum\s*insured/i, plain: 'The most the insurer will pay. It should match the full replacement value — if it is too low, claims can be cut proportionally.' },
  { term: 'Deductible / Excess', rx: /deductible|excess/i, plain: 'The part of each claim you pay yourself before the insurer pays the rest.' },
  { term: 'Premium Rate', rx: /premium\s*rate|per\s*mille|‰/i, plain: 'The price of cover, shown as a percentage or per mille (‰ = per ₱1,000) of the sum insured.' },
  { term: 'Brokerage', rx: /brokerage|commission/i, plain: 'The broker’s fee, normally a percentage of the premium paid by the insurer — it does not usually add to what you pay.' },
  { term: 'Warranty', rx: /warrant/i, plain: 'A condition you promise to keep (e.g. working fire extinguishers on site). Breaking it can let the insurer refuse a claim, so warranties matter.' },
  { term: 'Subjectivity', rx: /subject(?:ivit|\s*to)/i, plain: 'A condition the insurer needs met before the cover or price is final (e.g. a satisfactory survey).' },
  { term: 'Strike, Riot & Civil Commotion (SRCC)', rx: /\bSRCC\b|strike,?\s*riot/i, plain: 'Damage caused by strikes, riots or public unrest.' },
  { term: 'Natural catastrophe (Earthquake, Typhoon, Flood)', rx: /earthquake|typhoon|flood|volcanic|\bnat\s*cat|act\s*of\s*god|windstorm/i, plain: 'Damage from natural events. These are often subject to a separate, larger deductible or a limit — check the figures.' },
  { term: 'Maintenance Period', rx: /maintenance\s*(?:visit|period)/i, plain: 'Cover after the project is handed over, while the contractor fixes defects.' },
  { term: 'Testing & Commissioning', rx: /testing|commissioning/i, plain: 'Cover while machinery is being tested and started up — a high-risk stage, often limited in time.' },
  { term: 'Debris Removal', rx: /debris/i, plain: 'Pays to clear the site after an insured loss.' },
  { term: 'Professional Fees', rx: /professional\s*fees/i, plain: 'Pays architects’ or engineers’ fees to redesign or reinstate after a loss.' },
  { term: 'Cross Liability', rx: /cross\s*liabilit/i, plain: 'Treats each insured party as if insured separately, so one contractor can claim against another on the same policy.' },
  { term: 'Several Liability', rx: /several\s*liabilit/i, plain: 'When several insurers share a risk, each is only responsible for its own share — not for another insurer’s.' },
  { term: 'Lead Insurer', rx: /lead\s*insurer/i, plain: 'The insurer that handles the policy and claims for the whole group of insurers sharing the risk.' },
  { term: 'Average / Underinsurance', rx: /\baverage\b|under-?insur/i, plain: 'If the sum insured is lower than the true value, claims are reduced in the same proportion.' },
  { term: 'Waiver of Subrogation', rx: /subrogation/i, plain: 'The insurer agrees not to recover its payout from a named party (e.g. the project owner).' },
  { term: '72 Hours Clause', rx: /72\s*hours?/i, plain: 'Damage from one natural event within 72 hours counts as one claim — so you pay only one deductible.' },
  { term: 'Escalation', rx: /escalation/i, plain: 'Automatically raises the sum insured during the policy to keep up with rising costs.' },
  { term: 'Business Interruption / Loss of Profits', rx: /business\s*interruption|loss\s*of\s*profit|advance\s*loss/i, plain: 'Pays lost income or extra costs when an insured loss stops or delays the business or project.' },
  { term: 'Machinery Breakdown', rx: /machinery\s*breakdown/i, plain: 'Sudden mechanical or electrical failure of machines.' },
  { term: 'Extended Cover / Endorsement', rx: /endorsement|extension/i, plain: 'An add-on that widens (or sometimes limits) the standard policy wording.' },
  { term: 'Policy Form / Wording', rx: /policy\s*form|wording/i, plain: 'The standard policy document the cover is based on — it holds the full terms and exclusions.' },
  { term: 'Claims Cooperation / Control', rx: /claims?\s*(?:co-?operation|control)/i, plain: 'Sets which insurer decides on claims — it affects how quickly claims are settled.' },
  { term: 'Jurisdiction', rx: /jurisdiction/i, plain: 'Which country’s courts and laws apply if there is a dispute.' },
];

function slipText(p) {
  return [p.policyType, p.cover, p.project, ...(p.clausesAndWarranties || []), p.leadInsurerClause, p.severalLiabilityClause, p.claimsInformation, p.choiceOfJurisdiction, p.policyForm, formatSections(p.deductibles), formatSections(p.premiumRate)].join('\n');
}

/** Glossary terms that actually appear in this proposal. */
export function explainCoverage(p) {
  const t = slipText(p);
  return GLOSSARY.filter((g) => g.rx.test(t));
}

/* --------------------------------- summary ------------------------------- */

/** A short plain-English summary of one proposal + things to watch. */
export function summarizeProposal(p, refDate) {
  const who = nameOf(p);
  const policy = clean(eff(p, 'policyType', p.policyType)) || 'insurance';
  const insured = clean(eff(p, 'insured', p.insured));
  const period = [p.periodOfInsurance && p.periodOfInsurance.from, p.periodOfInsurance && p.periodOfInsurance.to].filter(Boolean).join(' to ');
  const premium = premiumTotalDisplay(p);
  const si = eff(p, 'sumInsured', formatSections(p.sumInsured));
  const ded = eff(p, 'deductibles', formatSections(p.deductibles));
  const rate = eff(p, 'premiumRate', formatSections(p.premiumRate));
  const nClauses = clauseCount(p);

  const lines = [];
  let first = who + ' is offering ' + policy + ' cover';
  if (insured) first += ' for ' + short(insured, 90);
  if (p.project) first += ', for the project “' + short(p.project, 90) + '”';
  if (period) first += ', running ' + period;
  lines.push(first + '.');
  if (p.cover) lines.push('What is covered: ' + short(p.cover, 260));
  if (si) lines.push('The most the insurer will pay (sum insured): ' + clean(si).replace(/\s*Section/g, '; Section').replace(/^;\s*/, '') + '.');
  if (premium) lines.push('Total premium: ' + premium + (rate ? ' (rate: ' + clean(rate) + ')' : '') + (p.brokerageRate ? ', brokerage ' + clean(p.brokerageRate) : '') + '.');
  if (ded) lines.push('You would pay the first part of each claim yourself (deductible): ' + short(ded, 220) + '.');
  if (nClauses) lines.push('It comes with ' + nClauses + ' clause' + (nClauses === 1 ? '' : 's') + ' and warranties — conditions and extensions that shape the cover.');
  if (p.premiumPaymentTerms) lines.push('Payment terms: ' + short(p.premiumPaymentTerms, 140) + '.');

  const watch = [];
  const q = quoteStatus(p.validityOfQuote, refDate);
  if (q.known && q.lapsed) watch.push('The quote validity has lapsed — ask for a refreshed quotation.');
  else if (p.validityOfQuote) watch.push('Quote valid: ' + short(p.validityOfQuote, 100) + '.');
  if (!premium) watch.push('No total premium was found on the slip — check it manually.');
  if (!si) watch.push('No sum insured was found — confirm the amount of cover.');
  if (p.extractionConfidence === 'low' || (p.flaggedFields && p.flaggedFields.length)) watch.push('Some figures were hard to read — verify them against the original slip.');
  if (/earthquake|typhoon|flood|nat\s*cat|act\s*of\s*god/i.test(ded)) watch.push('Natural-catastrophe losses carry their own deductible — compare it carefully.');

  return { who, headline: who + ' — ' + policy, lines, watch };
}

/* ------------------------------- differences ----------------------------- */

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Where the uploaded documents disagree: every Matrix row whose value is not
 * the same for every insurer, plus clauses only some insurers include.
 */
export function differences(proposals) {
  const list = proposals || [];
  if (list.length < 2) return { rows: [], same: [], clauses: null };
  const m = buildMatrixFromProposals(list, 'none', [], []);
  const rows = [];
  const same = [];
  m.rows.forEach((r) => {
    if (r.custom || /^clause:/.test(r.key)) return;
    const label = r.subLabel ? (/^premium:/.test(r.key) ? 'Premium charge — ' + r.subLabel : r.subLabel) : r.field;
    const vals = m.columns.map((c) => {
      const cell = r.cells[c.id];
      return { name: c.name, v: cell && cell.raw ? String(cell.raw) : '' };
    });
    const filled = vals.filter((v) => v.v.trim());
    if (!filled.length) return;
    const distinct = new Set(vals.map((v) => norm(v.v)));
    if (distinct.size > 1) rows.push({ label, vals, missing: vals.filter((v) => !v.v.trim()).map((v) => v.name) });
    else same.push(label);
  });
  const cd = clauseDiff(list);
  return {
    rows,
    same,
    clauses: { commonCount: cd.commonCount, perProposal: cd.perProposal.map((x) => ({ name: nameOf(x.p), count: x.count, unique: x.unique })) },
  };
}

/* ---------------------------- recommendation draft ----------------------- */

export function recommendationDraft(proposals, opts = {}) {
  const d = buildProposalData(proposals, opts.refDate || new Date());
  const client = opts.clientName || d.insuredName || 'Client';
  const out = [];
  out.push('Dear ' + client + ',');
  out.push('');
  out.push(
    'Thank you for the opportunity to place your ' + (d.policyType || 'insurance') + ' programme' +
      (d.period.from || d.period.to ? ' for the period ' + [d.period.from, d.period.to].filter(Boolean).join(' to ') : '') +
      '. We approached the market and received ' + d.proposals.length + ' quotation' + (d.proposals.length === 1 ? '' : 's') + '.'
  );
  out.push('');
  if (d.recommended && d.proposals.length > 1) {
    out.push('Our recommendation: ' + nameOf(d.recommended.p));
    out.push(
      'Looking at price, breadth of cover and terms together, ' + nameOf(d.recommended.p) + ' offers the best overall balance' +
        (d.winCount ? ', leading on ' + d.winCount + ' of the ' + d.winners.length + ' key criteria.' : '.')
    );
    out.push('');
    out.push('How the quotations compare:');
    [...d.winners, ...d.secondaryWinners].forEach((w) => {
      if (w.p) out.push('• ' + w.criterion.label + ': ' + nameOf(w.p) + ' (' + clean(w.disp) + ')');
    });
    if (d.recommendedUniqueClauses.length) {
      out.push('');
      out.push('Cover only ' + nameOf(d.recommended.p) + ' includes:');
      d.recommendedUniqueClauses.slice(0, 5).forEach((c) => out.push('• ' + short(c, 140)));
    }
  } else if (d.proposals.length === 1) {
    out.push('We received one quotation, from ' + nameOf(d.proposals[0]) + '. Its key terms are summarised below.');
    summarizeProposal(d.proposals[0]).lines.forEach((l) => out.push('• ' + l));
  }
  const notes = [];
  d.lapsed.forEach((p) => notes.push(nameOf(p) + '’s quotation validity has lapsed; we will request a refreshed quote.'));
  d.review.forEach((p) => notes.push('Some figures in ' + nameOf(p) + '’s quotation are being double-checked against the original slip.'));
  if (notes.length) {
    out.push('');
    out.push('Points to note:');
    notes.forEach((n) => out.push('• ' + n));
  }
  out.push('');
  out.push('Next steps: please confirm you would like to proceed, and we will arrange binding and issuance of the policy. We are happy to walk you through any of the terms.');
  out.push('');
  out.push('Kind regards,');
  out.push(opts.signOff || 'Howden Philippines');
  out.push('');
  out.push('This summary is a comparison aid prepared from the insurers’ quotation slips; the policy wording governs. Please review the full terms before deciding.');
  return out.join('\n');
}

/* ------------------------------ search the slips ------------------------- */

/** Sentences across the uploaded slips that mention every word of `q`. */
export function searchSlips(proposals, q) {
  const words = clean(q).toLowerCase().split(' ').filter((w) => w.length > 1);
  if (!words.length) return { glossary: [], hits: [] };
  const glossary = GLOSSARY.filter((g) => words.some((w) => g.term.toLowerCase().includes(w)) || g.rx.test(q));
  const hits = (proposals || []).map((p) => {
    const source = String(p.rawText || slipText(p));
    const chunks = source.split(/(?<=[.;:])\s+|\n+/).map(clean).filter((s) => s.length > 3);
    const found = chunks.filter((s) => { const l = s.toLowerCase(); return words.every((w) => l.includes(w)); });
    return { name: nameOf(p), found: [...new Set(found)].slice(0, 6) };
  });
  return { glossary, hits };
}

/* ------------------------------- optional AI ------------------------------ */

export const AI_ASSIST_ENDPOINT = import.meta.env.VITE_AI_ASSIST_ENDPOINT || '';

/**
 * Optional: send a question plus the extracted proposal fields (not the
 * files) to your own AI endpoint. Expects JSON back: { text }. Only active
 * when VITE_AI_ASSIST_ENDPOINT is set at build time.
 */
export async function askAI(question, proposals) {
  if (!AI_ASSIST_ENDPOINT) throw new Error('AI assistant endpoint not configured');
  const context = (proposals || []).map((p) => ({
    insurer: nameOf(p), policyType: p.policyType, insured: p.insured, cover: p.cover,
    sumInsured: formatSections(p.sumInsured), deductibles: formatSections(p.deductibles),
    premiumRate: formatSections(p.premiumRate), brokerageRate: p.brokerageRate, totalPremium: premiumTotalDisplay(p),
    clauses: p.clausesAndWarranties, validity: p.validityOfQuote,
  }));
  const r = await fetch(AI_ASSIST_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, proposals: context }),
  });
  if (!r.ok) throw new Error('AI service returned ' + r.status);
  const d = await r.json();
  return String(d.text || d.answer || '');
}
