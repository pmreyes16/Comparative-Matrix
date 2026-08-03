/**
 * SCHEMA — an empty proposal, mirroring the source slip field names, plus the
 * quote-lapse check used by the analytics and the "Quote lapsed" badge.
 */

export function emptyProposal(fileName) {
  return {
    id: 'p_' + Math.random().toString(36).slice(2, 9),
    fileName: fileName || '',
    insurers: [],                 // [{ name, logoUrl, percentageShare }]
    policyType: '',
    insured: '',
    natureOfBusiness: '',
    project: '',
    periodOfInsurance: { from: '', to: '' },
    locationsOfRisks: '',
    cover: '',
    sumInsured: {
      sections: [
        { label: 'Section I – Material Damage', money: null },
        { label: 'Section II – Third Party Liability', money: null },
      ],
    },
    deductibles: {
      sections: [
        { label: 'Section I – Material Damage', value: '' },
        { label: 'Section II – Third Party Liability', value: '' },
      ],
    },
    clausesAndWarranties: [],     // string[]
    premiumRate: {
      sections: [
        { label: 'Section I – Material Damage', value: '' },
        { label: 'Section II – Third Party Liability', value: 'free of charge' },
      ],
    },
    brokerageRate: '',
    premium: { lineItems: [], total: null, currency: 'PHP' }, // lineItems: [{label, money}]
    premiumPaymentTerms: '',
    birReference: '',
    leadInsurerClause: '',
    severalLiabilityClause: '',
    claimsInformation: '',
    choiceOfJurisdiction: '',
    policyForm: '',
    validityOfQuote: '',
    extractionConfidence: 'low',  // high | medium | low
    flaggedFields: [],
    overrides: {},                // per-field manual edits made in the Matrix
    rawText: '',
  };
}

/**
 * Validity-of-quote lapse check against a reference date (defaults to today).
 * Returns { known: false } when no explicit date could be read — the app never
 * guesses a lapse.
 */
export function quoteStatus(validityText, refDate) {
  if (!validityText) return { known: false };
  const ref = refDate || new Date();
  const t = String(validityText).trim();
  const dateMatch = t.match(
    /(\d{4}-\d{2}-\d{2})|(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})|([A-Za-z]{3,9}\.?\s+\d{1,2},?\s+\d{4})|(\d{1,2}\s+[A-Za-z]{3,9}\.?\s+\d{4})/
  );
  if (dateMatch) {
    const d = new Date(dateMatch[0]);
    if (!isNaN(d)) return { known: true, date: d, lapsed: d < ref };
  }
  return { known: false };
}
