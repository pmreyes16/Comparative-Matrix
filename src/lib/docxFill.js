/**
 * DOCX FILL — loads a Word template (.docx) and fills its `{tagName}`
 * placeholders with data from a proposal, entirely in the browser
 * (docxtemplater + pizzip; no server, nothing uploaded).
 *
 * `buildTemplateData` is the single mapping from the proposal schema to the
 * tag names a template can use — see src/assets/templates/README.md for the
 * full list. Money/section fields are formatted the same way they're shown
 * everywhere else in the app (verbatim slip figures, never re-rounded).
 */
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { formatSections, premiumTotalDisplay } from './money.js';

export function buildTemplateData(p) {
  const primary = (p.insurers && p.insurers[0]) || {};
  return {
    insured: p.insured || '',
    insurerName: primary.name || '',
    percentageShare: primary.percentageShare || '',
    policyType: p.policyType || '',
    natureOfBusiness: p.natureOfBusiness || '',
    project: p.project || '',
    periodFrom: (p.periodOfInsurance && p.periodOfInsurance.from) || '',
    periodTo: (p.periodOfInsurance && p.periodOfInsurance.to) || '',
    locationsOfRisks: p.locationsOfRisks || '',
    cover: p.cover || '',
    sumInsured: formatSections(p.sumInsured) || '',
    deductibles: formatSections(p.deductibles) || '',
    premiumRate: formatSections(p.premiumRate) || '',
    brokerageRate: p.brokerageRate || '',
    premiumTotal: premiumTotalDisplay(p) || '',
    premiumPaymentTerms: p.premiumPaymentTerms || '',
    birReference: p.birReference || '',
    leadInsurerClause: p.leadInsurerClause || '',
    severalLiabilityClause: p.severalLiabilityClause || '',
    claimsInformation: p.claimsInformation || '',
    choiceOfJurisdiction: p.choiceOfJurisdiction || '',
    policyForm: p.policyForm || '',
    validityOfQuote: p.validityOfQuote || '',
    clausesAndWarranties: (p.clausesAndWarranties || []).join('\n'),
    date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
  };
}

/** Fill a template's ArrayBuffer with data; returns a Blob of the finished .docx. */
export function fillDocxTemplate(templateArrayBuffer, data) {
  const zip = new PizZip(templateArrayBuffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    // A template referencing a tag we don't have data for renders as blank
    // rather than throwing — a broker's template may reasonably use tags
    // beyond this app's schema (letterhead boilerplate, signature blocks…).
    nullGetter: () => '',
  });
  try {
    doc.render(data);
  } catch (e) {
    const detail =
      e && e.properties && Array.isArray(e.properties.errors)
        ? e.properties.errors.map((er) => er.properties && er.properties.explanation).filter(Boolean).join('; ')
        : e && e.message;
    throw new Error('Could not fill this template' + (detail ? ' — ' + detail : ''));
  }
  return doc.getZip().generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}
