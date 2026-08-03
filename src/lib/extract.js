/**
 * EXTRACTION — heuristic mapping of {text, pairs} -> proposal schema.
 * Deliberately conservative: it never fabricates a value. Anything recovered
 * from loose text (not a clean table row) is flagged for manual verification.
 */
import { parseMoney } from './money.js';
import { emptyProposal } from './schema.js';

const norm = (s) =>
  String(s || '').toLowerCase().replace(/[^a-z0-9 %]/g, ' ').replace(/\s+/g, ' ').trim();

export const FIELD_LABELS = {
  policyType: ['policy type', 'class of insurance', 'type of policy', 'line of business', 'class'],
  insured: ['name of insured', 'insured', 'assured', 'policyholder', 'name of assured'],
  natureOfBusiness: ['nature of business', 'business', 'occupation', 'trade'],
  project: ['project', 'vehicle', 'unit', 'subject matter', 'make and model', 'description of unit'],
  locationsOfRisks: ['locations of risk', 'location of risk', 'risk location', 'garaging address', 'location'],
  cover: ['scope of cover', 'cover', 'coverage', 'perils covered', 'perils insured'],
  sumInsured: ['total sum insured', 'sum insured', 'insured value', 'amount insured', 'tsi'],
  deductibles: ['deductibles', 'deductible', 'excess', 'franchise'],
  premiumRate: ['premium rate', 'rate'],
  brokerageRate: ['brokerage rate', 'brokerage', 'commission'],
  premiumPaymentTerms: ['premium payment terms', 'payment terms', 'terms of payment', 'mode of payment'],
  birReference: ['bir revenue', 'revenue memorandum order', 'revenue regulation', 'rmo', 'bir'],
  leadInsurerClause: ['lead insurer clause', 'lead insurer', 'lead underwriter'],
  severalLiabilityClause: ['several liability clause', 'several liability'],
  claimsInformation: ['claims information', 'claims experience', 'loss record', 'claims history', 'claims'],
  choiceOfJurisdiction: ['choice of jurisdiction', 'jurisdiction', 'law and practice', 'governing law'],
  policyForm: ['policy form', 'policy wording', 'wording', 'form'],
  validityOfQuote: ['validity of quote', 'validity of quotation', 'quotation valid', 'quote valid', 'valid until', 'validity'],
  insurerName: ['insurer', 'insurance company', 'underwriter', 'company', 'insurer / percentage share', 'security'],
  period: ['period of insurance', 'policy period', 'period'],
};

/** Find the best value for a set of candidate labels. Prefers hard table pairs. */
export function findField(candidates, pairs) {
  const hard = pairs.filter((p) => !p.soft);
  const soft = pairs.filter((p) => p.soft);
  for (const group of [hard, soft]) {
    for (const cand of candidates) {
      const nc = norm(cand);
      for (const p of group) {
        const nl = norm(p.label);
        if (nl === nc || nl.startsWith(nc + ' ') || nl === nc + 's') {
          if (p.value && norm(p.value)) return { value: p.value.trim(), soft: !!p.soft };
        }
      }
    }
  }
  return null;
}

const PREMIUM_ITEM_LABELS = [
  'basic premium', 'premium', 'documentary stamp tax', 'doc stamp tax', 'doc stamp',
  'dst', 'value added tax', 'v.a.t', 'vat', 'local government tax', 'lgt',
  'fire service tax', 'fst', "broker's fee", 'brokers fee', 'broker fee',
];
const PREMIUM_TOTAL_LABELS = [
  'net premium due', 'total premium due', 'total premium', 'gross premium',
  'net premium', 'amount due', 'premium due', 'total amount due', 'total',
];
const PREMIUM_EXCLUDE = ['premium rate', 'premium payment terms', 'premium payment', 'rate'];

function extractPremium(pairs) {
  const items = [];
  let total = null;
  let currency = 'PHP';
  const seen = new Set();
  for (const p of pairs) {
    const nl = norm(p.label);
    if (!nl) continue;
    if (PREMIUM_EXCLUDE.some((x) => nl === norm(x) || nl.startsWith(norm(x) + ' '))) continue;

    const isTotal = PREMIUM_TOTAL_LABELS.some((x) => nl === norm(x) || nl.startsWith(norm(x) + ' '));
    const isItem = PREMIUM_ITEM_LABELS.some((x) => nl === norm(x) || nl.startsWith(norm(x) + ' '));
    if (!isTotal && !isItem) continue;

    const money = parseMoney(p.value);
    if (!money) continue;
    if (money.currency) currency = money.currency;

    if (isTotal && !total) {
      total = { label: p.label.trim(), money };
    } else if (isItem) {
      const key = nl + '|' + money.amountDisplay;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ label: p.label.trim(), money, nl });
    }
  }

  // Present the standard Applicable Premium Charges template (Basic Premium,
  // DST, VAT, LGT), overlaying any detected amounts. VAT defaults to EXEMPTED.
  const STD = [
    { label: 'Basic Premium', keys: ['basic premium', 'premium'] },
    { label: 'Documentary Stamps Tax (DST)', keys: ['documentary', 'doc stamp', 'dst'] },
    { label: 'Value Added Tax (VAT)', keys: ['value added', 'vat'] },
    { label: 'Local Government Tax (LGT)', keys: ['local government', 'lgt'] },
  ];
  const matched = new Set();
  const lineItems = STD.map((row) => {
    const hit = items.find((d) => row.keys.some((k) => d.nl.includes(norm(k))));
    if (hit) matched.add(hit);
    let money = hit ? hit.money : null;
    if (!money && row.label.includes('VAT')) money = { amountDisplay: '- EXEMPTED -', amount: null, currency: 'PHP', symbol: '' };
    return { label: row.label, money };
  });
  // keep any detected charges that don't map to a standard row
  items.forEach((d) => { if (!matched.has(d)) lineItems.push({ label: d.label, money: d.money }); });

  return { lineItems, total, currency };
}

/* ---------------------------------------------------------------
 * Insurer keyword list (editable) — used to decide whether a "…NN%"
 * line is a real insurer vs a clause fragment.
 *   INSURER_DESCRIPTOR — generic legal / industry terms.
 *   INSURER_BRANDS     — known carrier brand tokens (PH non-life market
 *                        + major international carriers). Add your own
 *                        carriers here so bare "<name> – NN%" lines are
 *                        recognised without a legal suffix.
 * ------------------------------------------------------------- */
const INSURER_DESCRIPTOR = /insur|assur|underwrit|reinsur|surety|mutual|takaful|lloyd|syndicate|indemnity|casualty|guarant|provident|fidelity|holdings|\bgroup\b|\bco\.?\b|\bcorp\.?\b|\bcompany\b|\bcompanies\b|\bltd\.?\b|\binc\.?\b|\bplc\b|\bpte\b|\bbhd\b|berhad|\bre\b|\bs\.?a\.?\b|\bn\.?v\.?\b|\ba\.?g\.?\b|\bse\b/i;
const INSURER_BRANDS = [
  // Philippine non-life market
  'malayan', 'pioneer', 'sterling', 'stronghold', 'prudential', 'prudentialife', 'cocolife',
  'mercantile', 'fpg', 'cibeles', 'ucpb', 'plaridel', 'paramount', 'milestone', 'charter',
  'ping an', 'etiqa', 'insular', 'visayan', 'iloilo', 'carguard', 'areza', 'bethel', 'phoenix',
  'oriental', 'pacific cross', 'intra strata', 'pga', 'bpi', 'standard insurance',
  'phil british', 'philippine british', 'malayan insurance',
  // Major international carriers / reinsurers
  'qbe', 'aig', 'chubb', 'allianz', 'axa', 'zurich', 'munich', 'swiss re', 'tokio', 'msig',
  'sompo', 'generali', 'aviva', 'mapfre', 'berkshire', 'markel', 'hiscox', 'beazley', 'scor',
  'everest', 'hdi', 'talanx',
];
const INSURER_BRAND_RX = new RegExp('\\b(' + INSURER_BRANDS.join('|') + ')\\b', 'i');

/** True when a string reads like an insurer's legal name / known brand, not a clause fragment. */
function looksLikeInsurer(name) {
  return INSURER_DESCRIPTOR.test(name) || INSURER_BRAND_RX.test(name);
}

/** Last-resort insurer name derived from the file name. */
function insurerFromFileName(fileName) {
  if (!fileName) return '';
  let s = fileName.replace(/\.[a-z0-9]+$/i, '').replace(/[_\-]+/g, ' ');
  s = s.replace(/\b(quotation|quote|proposal|slip|comparative|matrix|final|draft|copy|rev\d*|r\d+|v\d+)\b/gi, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  return s.length >= 3 ? s : '';
}

/**
 * Co-insurance: "ABC Insurance Co. — 60%" style rows. A "…NN%" line is only
 * treated as an insurer when the name actually reads like one — otherwise the
 * parser would grab clause fragments ("Existing Property … 25%"). Falls back to
 * an explicit "Insurer" field, then to the file name.
 */
function extractInsurers(pairs, text, fileName) {
  const insurers = [];
  const shareRx = /([A-Za-z][A-Za-z0-9 .,&'()\-]{2,80}?)\s*[-–—:]?\s*(\d{1,3}(?:\.\d+)?)\s*%/g;
  let m;
  while ((m = shareRx.exec(text)) !== null) {
    const name = m[1].replace(/\s+/g, ' ').trim();
    const share = m[2] + '%';
    if (/premium|brokerage|rate|tax|vat|discount|loading|deductible|excess|share|aggregate|limit|\bloi\b/i.test(name)) continue;
    if (name.length < 3 || !looksLikeInsurer(name)) continue;
    if (!insurers.some((i) => norm(i.name) === norm(name))) {
      insurers.push({ name, percentageShare: share, logoUrl: '' });
    }
  }
  if (insurers.length) return insurers;

  // fallback 1: an explicit "Insurer" / "Insurance Company" field
  const single = findField(FIELD_LABELS.insurerName, pairs);
  if (single && single.value && !/%/.test(single.value)) {
    const nm = single.value.replace(/\s+/g, ' ').trim();
    if (nm && !/^insurer\b/i.test(nm) && !/percentage share/i.test(nm)) {
      return [{ name: nm, percentageShare: '', logoUrl: '' }];
    }
  }

  // fallback 2: derive from the file name
  const fromFile = insurerFromFileName(fileName);
  if (fromFile) return [{ name: fromFile, percentageShare: '', logoUrl: '' }];

  return [];
}

function extractPeriod(pairs) {
  const raw = findField(FIELD_LABELS.period, pairs);
  if (!raw) return { from: '', to: '' };
  const v = raw.value;
  const parts = v.split(/\s+(?:to|until|thru|through|–|—)\s+|\s*-\s*(?=\d)/i);
  if (parts.length >= 2) return { from: parts[0].trim(), to: parts.slice(1).join(' ').trim() };
  return { from: v.trim(), to: '' };
}

// Field headers that mark the END of the Clauses & Warranties block in text.
const NEXT_SECTION_RX = /\n\s*(premium\s+rate|applicable\s+premium|brokerage\s+rate|premium\s+payment|bir\b|revenue\s+memorandum|revenue\s+regulation|insurer\s*\/|percentage\s+share|lead\s+insurer|several\s+liability|claims\s+information|choice\s+of\s+jurisdiction|policy\s+form|validity\s+of\s+quote)/i;

/**
 * Capture the FULL Clauses & Warranties list — every wording, no caps. Prefers
 * a table cell if it holds the whole list, otherwise the text block from the
 * "Clauses & Warranties" header to the next field header. Splits on numbered
 * items ("1." "2." …) when present, else on newlines / bullets / semicolons.
 */
function extractClauses(pairs, text) {
  let src = '';
  const hit = findField(['clauses and warranties', 'clauses & warranties', 'clauses', 'warranties'], pairs);
  if (hit && hit.value) src = hit.value;
  const m = (text || '').match(/clauses\s*(?:&|and)?\s*warranties/i);
  if (m) {
    const rest = text.slice(m.index).replace(/^[^\n]*\n?/, ''); // drop the header line
    const stop = rest.search(NEXT_SECTION_RX);
    const block = stop >= 0 ? rest.slice(0, stop) : rest;
    if (block.trim().length > src.length) src = block; // prefer the fuller source
  }
  if (!src) return [];
  src = src.replace(/clauses\s*(?:&|and)?\s*warranties\s*[:\-]?/i, ' ');
  let items;
  if (/(?:^|\s)\d{1,3}[.)]\s/.test(src)) {
    items = src.split(/\s+(?=\d{1,3}[.)]\s)/); // split before each "N." / "N)"
  } else {
    items = src.split(/\s*[;\n•·]\s*|\s{2,}(?=[A-Z])/);
  }
  return items
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s && s.length > 2 && !/^(clauses|warranties|&|and)$/i.test(s));
}

/* ---------------------------------------------------------------
 * FULL-BLOCK CAPTURE — grab a field's entire detail (all lines) from its
 * header to the next field header, so nothing is truncated to one line.
 * ------------------------------------------------------------- */
const escapeRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Distinctive next-field headers that mark where a captured block must STOP.
// Curated to avoid ambiguous single words (e.g. "cover", "insured", "rate")
// that appear inside field values and would cut a block short.
const BOUNDARY_HEADERS = [
  'policy type', 'nature of business', 'period of insurance', 'locations of risk', 'location of risk',
  'sum insured', 'total sum insured', 'deductibles', 'clauses and warranties', 'clauses',
  'premium rate', 'brokerage rate', 'applicable premium', 'premium charges', 'premium payment',
  'revenue memorandum', 'revenue regulation', 'lead insurer', 'several liability', 'claims information',
  'choice of jurisdiction', 'policy form', 'validity of quote', 'percentage share',
];
const BOUNDARY_RX = new RegExp('\\b(?:' + BOUNDARY_HEADERS.map(escapeRx).join('|') + ')\\b', 'i');

/** Capture the full detail block for a field (its header → next field). '' if none. */
function grabBlock(candidates, text) {
  if (!text) return '';
  let best = null;
  for (const c of candidates) {
    const rx = new RegExp('(?:^|\\n)\\s*' + escapeRx(c) + '\\s*[:\\-–]', 'i');
    const m = rx.exec(text);
    if (m && (best === null || m.index < best.i)) best = { i: m.index, e: m.index + m[0].length };
  }
  if (!best) return '';
  const rest = text.slice(best.e);
  const n = rest.search(BOUNDARY_RX);
  let block = n >= 0 ? rest.slice(0, n) : rest;
  if (block.length > 1500) block = block.slice(0, 1500); // safety cap
  return block.replace(/\s+/g, ' ').trim();
}

/** Split a block into Section I / Section II (Material Damage / Third Party). */
function splitSectioned(block) {
  const m = String(block).match(/section\s*(?:ii|2)\b|third\s*party/i);
  if (m && m.index > 0) return { s1: block.slice(0, m.index).trim(), s2: block.slice(m.index).trim() };
  return { s1: String(block).trim(), s2: '' };
}
/** Strip a leading "Section I – … :" label from a section chunk, leaving the value. */
function sectionVal(chunk) {
  if (!chunk) return '';
  return String(chunk).replace(/^\s*section\s*(?:i{1,2}|1|2)\b[^:]*:?\s*/i, '').trim() || String(chunk).trim();
}

export function extract(parsed, fileName) {
  const prop = emptyProposal(fileName);
  prop.rawText = parsed.text || '';
  const pairs = parsed.pairs || [];
  const flagged = [];
  // Single-value fields take their own cell value (no block) so they never bleed
  // into the next field.
  const grab = (key, cands) => {
    const hit = findField(cands || FIELD_LABELS[key], pairs);
    if (hit) { if (hit.soft) flagged.push(key); return String(hit.value).trim(); }
    return '';
  };
  // Multi-line fields (Cover + the sectioned fields) take the FULLER of the cell
  // value or the whole detail block, bounded by the next distinctive field.
  const fullSrc = (list) => {
    const hit = findField(list, pairs);
    const pairVal = hit ? String(hit.value).trim() : '';
    const block = grabBlock(list, parsed.text || '');
    return block.length > pairVal.length ? block : pairVal;
  };

  prop.insurers = extractInsurers(pairs, parsed.text || '', fileName);
  prop.policyType = grab('policyType');
  prop.insured = grab('insured');
  prop.natureOfBusiness = grab('natureOfBusiness');
  prop.project = grab('project');
  prop.periodOfInsurance = extractPeriod(pairs);
  prop.locationsOfRisks = grab('locationsOfRisks');
  prop.cover = fullSrc(FIELD_LABELS.cover);

  const siSrc = fullSrc(FIELD_LABELS.sumInsured);
  if (siSrc) {
    const { s1, s2 } = splitSectioned(siSrc);
    const m1 = parseMoney(s1);
    if (m1) prop.sumInsured.sections[0].money = m1; else flagged.push('sumInsured');
    const m2 = parseMoney(s2);
    if (m2) prop.sumInsured.sections[1].money = m2;
  }

  const deSrc = fullSrc(FIELD_LABELS.deductibles);
  if (deSrc) {
    const { s1, s2 } = splitSectioned(deSrc);
    prop.deductibles.sections[0].value = sectionVal(s1);
    if (s2) prop.deductibles.sections[1].value = sectionVal(s2);
  }

  prop.clausesAndWarranties = extractClauses(pairs, parsed.text || '');
  const prSrc = fullSrc(FIELD_LABELS.premiumRate);
  if (prSrc) {
    const { s1, s2 } = splitSectioned(prSrc);
    prop.premiumRate.sections[0].value = sectionVal(s1);
    if (s2) prop.premiumRate.sections[1].value = sectionVal(s2);
  }
  prop.brokerageRate = grab('brokerageRate');
  prop.premium = extractPremium(pairs);
  if (!prop.premium.total && prop.premium.lineItems.length === 0) flagged.push('premium');
  prop.premiumPaymentTerms = grab('premiumPaymentTerms');
  prop.birReference = grab('birReference');
  prop.leadInsurerClause = grab('leadInsurerClause');
  prop.severalLiabilityClause = grab('severalLiabilityClause');
  prop.claimsInformation = grab('claimsInformation');
  prop.choiceOfJurisdiction = grab('choiceOfJurisdiction');
  prop.policyForm = grab('policyForm');
  prop.validityOfQuote = grab('validityOfQuote');

  const core = [
    prop.insurers.length,
    prop.policyType,
    prop.insured,
    prop.sumInsured,
    prop.premium.total || prop.premium.lineItems.length,
  ];
  const got = core.filter(Boolean).length;
  prop.extractionConfidence = got >= 4 ? 'high' : got >= 2 ? 'medium' : 'low';
  prop.flaggedFields = [...new Set(flagged)];
  return prop;
}

/**
 * AI-EXTRACTION HOOK (optional, off by default).
 *
 * A browser-only app has nowhere safe to hold an API key, so the heuristic
 * engine above is the working default. To enable AI extraction, host a small
 * proxy that forwards {text} to Claude with the schema prompt and returns JSON,
 * then set VITE_AI_ENDPOINT in a .env file. The proxy — not the browser —
 * holds the API key. Instruct the model to copy premium / sum-insured /
 * deductible figures CHARACTER-FOR-CHARACTER and return insurers as an array.
 */
export async function extractWithAI(parsed, fileName) {
  const endpoint = import.meta.env.VITE_AI_ENDPOINT;
  if (!endpoint) throw new Error('AI extraction not configured');
  const r = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: parsed.text }),
  });
  if (!r.ok) throw new Error('AI endpoint error ' + r.status);
  const json = await r.json();
  return { ...emptyProposal(fileName), ...json, rawText: parsed.text };
}

export const AI_ENABLED = !!import.meta.env.VITE_AI_ENDPOINT;
