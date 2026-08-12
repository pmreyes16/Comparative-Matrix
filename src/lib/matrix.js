/**
 * COMPARATIVE MATRIX — build a broker-style compliance matrix from extracted
 * proposals: a baseline ("proposed terms") column plus one column per insurer,
 * where each cell is a ✓ (as proposed) when it matches the baseline, or the
 * specific deviation text otherwise.
 */
import { formatMoney, formatSections } from './money.js';

/** True for cells that state the cover is NOT offered (shown in red). */
export function isDeleted(s) {
  return /^\s*(deleted|not applicable|n\/?a|nil)\b/i.test(String(s || ''));
}

/** Flatten one matrix cell to plain text (used by the Excel / CSV exports). */
export function cellToText(cell) {
  if (!cell || cell.t === 'empty') return '—';
  if (cell.t === 'check') return '✓ As proposed';
  return cell.v || '';
}

export function buildMatrixFromProposals(proposals, baselineId, customRows, rowOrder) {
  const list = proposals || [];
  const nm = (p) => (p.insurers[0] && p.insurers[0].name) || p.fileName;
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  const baseline = baselineId && baselineId !== 'none' ? list.find((p) => p.id === baselineId) : null;
  const colProps = baseline ? list.filter((p) => p.id !== baseline.id) : list;
  const columns = colProps.map((p) => ({
    id: p.id,
    name: nm(p),
    logoUrl: (p.insurers[0] && p.insurers[0].logoUrl) || '',
    p,
  }));

  function makeRow(field, getter, opts) {
    opts = opts || {};
    const key = opts.key || '';
    // A manual edit (override) always wins over the extracted value.
    const g = (p) => {
      if (key && p && p.overrides && p.overrides[key] != null && p.overrides[key] !== '') return p.overrides[key];
      return getter(p);
    };
    const bt = baseline ? g(baseline) : (opts.howden || '');
    const cells = {};
    columns.forEach((c) => {
      const ct = g(c.p);
      if (!ct) cells[c.id] = { t: 'empty', raw: '' };
      else if (baseline && bt && norm(ct) === norm(bt)) cells[c.id] = { t: 'check', raw: ct };
      else cells[c.id] = { t: 'text', v: ct, raw: ct, dev: !!(baseline && bt && norm(ct) !== norm(bt)) };
    });
    return {
      field,
      howden: baseline ? bt : (opts.howden || ''),
      cells,
      newField: opts.newField !== false,
      total: !!opts.total,
      key,
      subLabel: opts.subLabel,
      custom: !!opts.custom,
      rowId: opts.rowId,
    };
  }

  const rows = [];

  // Sum Insured / Deductibles / Premium Rate — each shown in ONE box, sections
  // listed line by line, just like the quotation slip field.
  const core = [
    ['POLICY TYPE', (p) => p.policyType, 'policyType'],
    ['INSURED', (p) => p.insured, 'insured'],
    ['NATURE OF BUSINESS', (p) => p.natureOfBusiness, 'natureOfBusiness'],
    ['PROJECT', (p) => p.project, 'project'],
    ['PERIOD OF INSURANCE', (p) => [p.periodOfInsurance.from, p.periodOfInsurance.to].filter(Boolean).join(' – '), 'periodOfInsurance'],
    ['LOCATIONS OF RISKS', (p) => p.locationsOfRisks, 'locationsOfRisks'],
    ['COVER', (p) => p.cover, 'cover'],
    ['SUM INSURED', (p) => formatSections(p.sumInsured), 'sumInsured'],
    ['DEDUCTIBLES', (p) => formatSections(p.deductibles), 'deductibles'],
    ['PREMIUM RATE', (p) => formatSections(p.premiumRate), 'premiumRate'],
    ['BROKERAGE RATE', (p) => p.brokerageRate, 'brokerageRate'],
  ];
  core.forEach((f) => rows.push(makeRow(f[0], f[1], { key: f[2] })));

  // Applicable Premium Charges — the union of every line-item label seen.
  const seen = new Map();
  list.forEach((p) =>
    (p.premium && p.premium.lineItems ? p.premium.lineItems : []).forEach((li) => {
      const k = norm(li.label);
      if (!seen.has(k)) seen.set(k, li.label);
    })
  );
  const premLabels = [...seen.values()];
  const compVal = (p, label) => {
    const items = p.premium && p.premium.lineItems ? p.premium.lineItems : [];
    const li = items.find((x) => norm(x.label) === norm(label));
    return li ? formatMoney(li.money) : '';
  };
  premLabels.forEach((lab, i) =>
    rows.push(
      makeRow(i === 0 ? 'APPLICABLE PREMIUM CHARGES' : '', (p) => compVal(p, lab), {
        howden: lab,
        newField: i === 0,
        subLabel: lab,
        key: 'premium:' + lab,
      })
    )
  );
  rows.push(
    makeRow('', (p) => (p.premium && p.premium.total ? formatMoney(p.premium.total.money) : ''), {
      howden: 'TOTAL PREMIUM',
      newField: premLabels.length === 0,
      total: true,
      subLabel: 'TOTAL PREMIUM',
      key: 'premiumTotal',
    })
  );

  // Clauses & Warranties — the FULL numbered list in one box per insurer, just
  // like the quotation slip (every wording captured, numbered).
  const numberedClauses = (p) =>
    (p.clausesAndWarranties || [])
      .map((c, i) => (/^\s*\d+[.)]/.test(String(c)) ? String(c).trim() : i + 1 + '. ' + String(c).trim()))
      .join('\n');

  const tail = [
    ['PREMIUM PAYMENT TERMS', (p) => p.premiumPaymentTerms, 'premiumPaymentTerms'],
    ['CLAUSES & WARRANTIES', numberedClauses, 'clauses'],
    ['LEAD INSURER CLAUSE', (p) => p.leadInsurerClause, 'leadInsurerClause'],
    ['SEVERAL LIABILITY CLAUSE', (p) => p.severalLiabilityClause, 'severalLiabilityClause'],
    ['CLAIMS INFORMATION', (p) => p.claimsInformation, 'claimsInformation'],
    ['CHOICE OF JURISDICTION, LAW & PRACTICE', (p) => p.choiceOfJurisdiction, 'choiceOfJurisdiction'],
    ['POLICY FORM', (p) => p.policyForm, 'policyForm'],
    ['VALIDITY OF QUOTE', (p) => p.validityOfQuote, 'validityOfQuote'],
  ];
  tail.forEach((f) => rows.push(makeRow(f[0], f[1], { key: f[2] })));

  // User-added rows — free-text label plus per-column values, both stored as
  // overrides (there is no extracted source for them), appended after the tail.
  (customRows || []).forEach((cr) =>
    rows.push(makeRow(cr.label || '', () => '', { key: 'custom:' + cr.id, custom: true, rowId: cr.id }))
  );

  // Every row (built-in fields included) is drag-reorderable in the Matrix —
  // `rowOrder` is the user's saved arrangement, by row key. Anything not in
  // it yet (a brand-new premium line item, a row added since) keeps its
  // natural position, appended after the ordered ones.
  let orderedRows = rows;
  if (rowOrder && rowOrder.length) {
    const byKey = new Map(rows.map((r) => [r.key, r]));
    orderedRows = [];
    rowOrder.forEach((k) => {
      const r = byKey.get(k);
      if (r) { orderedRows.push(r); byKey.delete(k); }
    });
    rows.forEach((r) => { if (byKey.has(r.key)) orderedRows.push(r); });
  }

  const insuredName = [...new Set(list.map((p) => (p.insured || '').trim()).filter(Boolean))][0] || '';
  return {
    // Header reads: insured name (heading) with "CRS Comparative System" below it.
    eyebrow: '',
    title: insuredName || 'CRS Comparative System',
    subtitle: insuredName ? 'CRS Comparative System' : '',
    baseline: baseline ? { id: baseline.id, name: nm(baseline), role: 'Selected baseline' } : null,
    columns: columns.map((c) => ({ id: c.id, name: c.name, logoUrl: c.logoUrl })),
    rows: orderedRows,
    footnotes: [],
  };
}
