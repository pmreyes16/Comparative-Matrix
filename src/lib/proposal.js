/**
 * PROPOSAL — shapes one client-facing recommendation document out of the
 * compared proposals. Single source of truth consumed by both the on-screen
 * ProposalView and the PDF export, so they never disagree.
 *
 * The "recommended insurer" is the Balanced-weighted Best Fit score (same
 * scoring used in the Best Fit tab). The four headline criteria (Total
 * Premium, Clauses & Warranties, Brokerage Rate, Premium Rate) are reported
 * as straight per-criterion winners, independent of any weighting, so a
 * broker can see exactly why the recommendation was made — or wasn't
 * unanimous — rather than trusting one blended score blindly.
 */
import { CRITERIA, PRESETS, scoreProposals, criterionWinner } from './bestfit.js';
import { analyze, clauseDiff } from './analyze.js';

export const nameOf = (p) => (p.insurers[0] && p.insurers[0].name) || p.fileName;

const HEADLINE_KEYS = ['premium', 'clauses', 'brokerage', 'premiumRate'];
const SECONDARY_KEYS = ['sumInsured', 'deductibles'];

function winnersFor(proposals, keys) {
  return keys.map((key) => {
    const w = criterionWinner(proposals, key);
    const criterion = CRITERIA.find((c) => c.key === key);
    return w ? { key, criterion, p: w.p, disp: w.disp } : { key, criterion, p: null, disp: null };
  });
}

export function buildProposalData(proposals, refDate) {
  const list = proposals || [];
  const ranked = scoreProposals(list, PRESETS.Balanced);
  const recommended = ranked[0] || null;

  const insuredName = [...new Set(list.map((p) => (p.insured || '').trim()).filter(Boolean))][0] || '';
  const policyType = [...new Set(list.map((p) => (p.policyType || '').trim()).filter(Boolean))][0] || '';
  const period = list.map((p) => p.periodOfInsurance).find((pd) => pd && (pd.from || pd.to)) || { from: '', to: '' };

  const winners = winnersFor(list, HEADLINE_KEYS);
  const secondaryWinners = winnersFor(list, SECONDARY_KEYS);

  // How many of the 4 headline criteria the recommended insurer actually
  // wins outright — an honest tell for the summary line, since a Balanced
  // weighted score can still come out on top without sweeping every category.
  const winCount = recommended ? winners.filter((w) => w.p && w.p.id === recommended.p.id).length : 0;

  const A = analyze(list, refDate);
  const clauses = list.length >= 2 ? clauseDiff(list) : null;
  const recommendedUnique =
    recommended && clauses ? clauses.perProposal.find((x) => x.p.id === recommended.p.id) : null;

  return {
    generatedAt: refDate || new Date(),
    insuredName,
    policyType,
    period,
    proposals: list,
    ranked,
    recommended,
    winCount,
    winners,
    secondaryWinners,
    review: A.review,
    lapsed: A.lapsed,
    recommendedUniqueClauses: recommendedUnique ? recommendedUnique.unique : [],
  };
}

function summaryText(data) {
  if (data.proposals.length < 2) {
    return 'Only one proposal has been uploaded — comparison and recommendation become available once a second quotation slip is added.';
  }
  let s = 'We compared ' + data.proposals.length + ' proposals' + (data.policyType ? ' for ' + data.policyType : '') + '. ';
  if (data.recommended) {
    s += 'Based on a balanced view of price, cover and terms, we recommend ' + nameOf(data.recommended.p);
    s += data.winCount > 0
      ? ' — it leads on ' + data.winCount + ' of the ' + data.winners.length + ' headline criteria.'
      : ' as the strongest overall balance across price, cover and terms, though no single insurer swept every headline criterion.';
  }
  return s;
}

/**
 * Flattens the Generated Proposal (the recommendation across ALL compared
 * proposals — see buildProposalData above) into the same {tagName} shape
 * docxFill.js's buildTemplateData uses, so a Quotation Slip template can be
 * filled from "who we recommend and why" instead of one insurer's raw slip
 * fields. Field names that mean the same thing (insured, policyType, period)
 * intentionally match buildTemplateData's tags, so either data source works
 * in the same template; the winner/recommendation tags are additional.
 */
export function buildRecommendationTemplateData(proposals, refDate) {
  const data = buildProposalData(proposals, refDate);
  const allWinners = [...data.winners, ...data.secondaryWinners];
  const winner = (key) => allWinners.find((w) => w.key === key);
  const winnerName = (key) => { const w = winner(key); return w && w.p ? nameOf(w.p) : ''; };
  const winnerValue = (key) => { const w = winner(key); return w && w.p ? w.disp : ''; };

  return {
    insured: data.insuredName,
    policyType: data.policyType,
    periodFrom: data.period.from || '',
    periodTo: data.period.to || '',
    proposalsCompared: String(data.proposals.length),
    recommendedInsurer: data.recommended ? nameOf(data.recommended.p) : '',
    recommendedScore: data.recommended ? String(Math.round(data.recommended.score)) : '',
    premiumWinner: winnerName('premium'),
    premiumWinnerValue: winnerValue('premium'),
    clausesWinner: winnerName('clauses'),
    clausesWinnerValue: winnerValue('clauses'),
    brokerageWinner: winnerName('brokerage'),
    brokerageWinnerValue: winnerValue('brokerage'),
    premiumRateWinner: winnerName('premiumRate'),
    premiumRateWinnerValue: winnerValue('premiumRate'),
    sumInsuredWinner: winnerName('sumInsured'),
    sumInsuredWinnerValue: winnerValue('sumInsured'),
    deductiblesWinner: winnerName('deductibles'),
    deductiblesWinnerValue: winnerValue('deductibles'),
    executiveSummary: summaryText(data),
    date: (refDate || new Date()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
  };
}
