/**
 * DOCUMENT CONTROL — the register of standard Quotation Slip templates, one
 * per line of insurance. Transcribed from the firm's document control sheet;
 * double-check Control No. / Classification against the master register
 * before relying on this for compliance purposes — this is a working copy,
 * not the source of truth.
 *
 * `file` is the exact filename the app looks for in `src/assets/templates/`
 * (see the README there). A row with no matching file shows as "not added
 * yet" in the UI rather than failing silently.
 *
 * `match` is a list of lowercase keyword fragments used to suggest a
 * template from an extracted proposal's Policy Type — best-effort only, the
 * user always picks the final template themselves.
 */

const PURPOSE = 'Broking Process';
const CLASSIFICATION = 'Level 2 (Restricted)';
const OWNER = 'CRS';

function row(title, controlNo, file, match) {
  return {
    title: 'QUOTATION SLIP - ' + title,
    purpose: PURPOSE,
    controlNo,
    classification: CLASSIFICATION,
    owner: OWNER,
    file,
    match,
  };
}

export const DOCUMENT_CONTROL = [
  row('AVIATION HULL', 'HCRS-QSAVI-05-2026-R00', 'Template_Quotation Slip_Aviation Hull-2026.docx', ['aviation']),
  row('BANKERS BLANKET BOND', 'HCRS-QSBBB-05-2026-R00', 'Template_Quotation Slip_BBB-2026.docx', ['bankers blanket bond', 'bbb']),
  row('BOND (PERFORMANCE / SURETY / BID / HEIRS, ETC.)', 'HCRS-QSBON-05-2026-R00', 'Template_Quotation Slip_Bond-2026.docx', ['bond', 'surety']),
  row('CONSTRUCTION ALL RISK', 'HCRS-QSCAR-05-2026-R00', 'Template_Quotation Slip_CAR-2026.docx', ['construction all risk', 'car']),
  row('COMPREHENSIVE GENERAL LIABILITY', 'HCRS-QSCGL-05-2026-R00', 'Template_Quotation Slip_CGL-2026.docx', ['comprehensive general liability', 'cgl']),
  row('CYBER', 'HCRS-QSCYB-05-2026-R00', 'Template_Quotation Slip_CYBER-2026.docx', ['cyber']),
  row('DIRECTOR & OFFICERS', 'HCRS-QSD&O-05-2026-R00', 'Template_Quotation Slip_Directors & Officers-2026.docx', ['director', 'officers', 'd&o']),
  row('ERRORS & OMISSIONS', 'HCRS-QSE&O-05-2026-R00', 'Template_Quotation Slip_Errors & Omissions-2026.docx', ['errors & omissions', 'errors and omissions', 'e&o']),
  row('ERECTION ALL RISK', 'HCRS-QSEAR-05-2026-R00', 'Template_Quotation Slip_EAR-2026.docx', ['erection all risk', 'ear']),
  row('ELECTRONIC EQUIPMENT INSURANCE', 'HCRS-QSEEI-05-2026-R00', 'Template_Quotation Slip_EEI-2026.docx', ['electronic equipment', 'eei']),
  row('EMPLOYERS LIABILITY', 'HCRS-QSEMP-05-2026-R00', 'Template_Quotation Slip_Employers Liability-2026.docx', ['employers liability']),
  row('ENERGY', 'HCRS-QSENE-05-2026-R00', 'Template_Quotation Slip_ENERGY-2026.docx', ['energy']),
  row('FIDELITY GUARANTEE', 'HCRS-QSFGI-05-2026-R00', 'Template_Quotation Slip_Fidelity Guarantee-2026.docx', ['fidelity guarantee', 'fidelity']),
  row('FIRE RESIDENTIAL', 'HCRS-QSFIR-05-2026-R00', 'Template_Quotation Slip_Fire Residential-2026.docx', ['fire residential', 'fire']),
  row('PROPERTY FLOATER', 'HCRS-QSFLO-05-2026-R00', 'Template_Quotation Slip_Property Floater-2026.docx', ['property floater']),
  row('GOODS IN TRANSIT', 'HCRS-QSGIT-05-2026-R00', 'Template_Quotation Slip_Goods-In-Transit-2026.docx', ['goods in transit', 'goods-in-transit']),
  row('GROUP PERSONAL ACCIDENT', 'HCRS-QSGPA-05-2026-R00', 'Template_Quotation Slip_GPA-2026.docx', ['group personal accident', 'gpa']),
  row('MARINE CARGO / HULL', 'HCRS-QSMAR-05-2026-R00', 'Template_Quotation Slip_Marine-2026.docx', ['marine cargo', 'marine hull', 'marine']),
  row('MOTOR CAR (FLEET / PRIVATE / COMMERCIAL / MOTORCYCLE)', 'HCRS-QSMOT-05-2026-R00', 'Template_Quotation Slip_Motor-2026.docx', ['motor car', 'motor', 'comprehensive motor']),
  row('MONEY, SECURITY AND PAYROLL ROBBERY', 'HCRS-QSMON-05-2026-R00', 'Template_Quotation Slip_MSPR-2026.docx', ['money, security', 'payroll robbery', 'mspr']),
  row('PROFESSIONAL INDEMNITY', 'HCRS-QSPLI-05-2026-R00', 'Template_Quotation Slip_Professional Indemnity-2026.docx', ['professional indemnity']),
  row('PROPERTY ALL RISK', 'HCRS-QSPAR-05-2026-R00', 'Template_Quotation Slip_Property All Risk-2026.docx', ['property all risk', 'par']),
  row('SABOTAGE AND TERRORISM', 'HCRS-QSS&T-05-2026-R00', 'Template_Quotation Slip_Sabotage&Terrorism-2026.docx', ['sabotage', 'terrorism']),
  row('TRADE CREDIT', 'HCRS-QSTCI-05-2026-R00', 'Template_Quotation Slip_Trade Credit-2026.docx', ['trade credit']),
  row('TRAVEL ACCIDENT', 'HCRS-QSTPA-05-2026-R00', 'Template_Quotation Slip_Travel Accident-2026.docx', ['travel accident', 'travel']),
  row('WORKS OF ART', 'HCRS-QSWOA-05-2026-R00', 'Template_Quotation Slip_Works of Art-2026.docx', ['works of art']),
  row('OTHER LINES', 'HCRS-QSOTH-05-2026-R00', 'Template_Quotation Slip_Other Lines-2026.docx', ['other']),
];

/** Best-effort template suggestion from a proposal's extracted Policy Type. */
export function suggestTemplate(policyType) {
  const pt = String(policyType || '').toLowerCase();
  if (!pt) return null;
  return DOCUMENT_CONTROL.find((row) => row.match.some((m) => pt.includes(m))) || null;
}
