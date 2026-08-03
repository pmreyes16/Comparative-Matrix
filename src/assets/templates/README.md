# Quotation Slip templates

This folder is where the real `.docx` templates listed in the Document
Control register (`src/data/documentControl.js`) live. It ships empty — drop
your firm's actual template files in here using the **exact filename** from
that register's `file` column, for example:

```
src/assets/templates/
  Template_Quotation Slip_Aviation Hull-2026.docx
  Template_Quotation Slip_EAR-2026.docx
  Template_Quotation Slip_CAR-2026.docx
  ... (27 total — see src/data/documentControl.js for every filename)
```

The app picks up any file placed here automatically (via `import.meta.glob`)
— no code changes needed. In the **Document Control** tab, a row shows a
working "Generate" button once its file is present, and "Template not added
yet" until then.

## Filling a template

In the **Document Control** tab, once a line's template is ready, the "Fill
with…" dropdown offers two kinds of data source:

- **One uploaded proposal** — that insurer's raw slip fields, verbatim.
- **★ Generated Proposal (recommendation summary)** — the same
  recommendation the "Generate a Proposal" tab produces: which insurer is
  recommended and why, plus the per-criterion winners across every compared
  proposal. Use this when the slip should reflect the *comparison result*
  rather than one specific insurer.

Both sources fill the same `{tagName}` placeholders — a template can freely
mix tags from either table below; whichever weren't supplied by the chosen
data source just render blank.

## Placeholder tags

Fill-in is done with [docxtemplater](https://docxtemplater.com/) for `.docx`
and a plain `{tag}` text/cell replacement for `.xlsx` — type these directly
in Word or Excel, no special formatting needed, just literal curly braces.
`.pdf` templates can't be auto-filled (no general form-field support yet);
they download as uploaded, unchanged.

### From one proposal

| Tag | Source field |
| --- | --- |
| `{insured}` | Insured |
| `{insurerName}` | Insurer (from the selected proposal) |
| `{percentageShare}` | Co-insurance share, if any |
| `{policyType}` | Policy Type |
| `{natureOfBusiness}` | Nature of Business |
| `{project}` | Project |
| `{periodFrom}` / `{periodTo}` | Period of Insurance |
| `{locationsOfRisks}` | Locations of Risks |
| `{cover}` | Cover |
| `{sumInsured}` | Sum Insured (all sections, verbatim) |
| `{deductibles}` | Deductibles (all sections, verbatim) |
| `{premiumRate}` | Premium Rate (all sections, verbatim) |
| `{brokerageRate}` | Brokerage Rate |
| `{premiumTotal}` | Total Premium |
| `{premiumPaymentTerms}` | Premium Payment Terms |
| `{birReference}` | BIR RMO/RR Reference |
| `{leadInsurerClause}` | Lead Insurer Clause |
| `{severalLiabilityClause}` | Several Liability Clause |
| `{claimsInformation}` | Claims Information |
| `{choiceOfJurisdiction}` | Choice of Jurisdiction |
| `{policyForm}` | Policy Form |
| `{validityOfQuote}` | Validity of Quote |
| `{clausesAndWarranties}` | Clauses & Warranties (numbered list, one per line) |
| `{date}` | Today's date, e.g. "29 July 2026" |

### From the Generated Proposal (recommendation)

Also includes `{insured}`, `{policyType}`, `{periodFrom}`, `{periodTo}` and
`{date}` above (aggregated across every compared proposal), plus:

| Tag | Source field |
| --- | --- |
| `{proposalsCompared}` | Count of proposals compared |
| `{recommendedInsurer}` | The recommended insurer's name |
| `{recommendedScore}` | Its Balanced Best Fit score, 0–100 |
| `{executiveSummary}` | The auto-written summary sentence |
| `{premiumWinner}` / `{premiumWinnerValue}` | Total Premium: who leads, and their figure |
| `{clausesWinner}` / `{clausesWinnerValue}` | Clauses & Warranties: who leads, and their figure |
| `{brokerageWinner}` / `{brokerageWinnerValue}` | Brokerage Rate: who leads, and their figure |
| `{premiumRateWinner}` / `{premiumRateWinnerValue}` | Premium Rate: who leads, and their figure |
| `{sumInsuredWinner}` / `{sumInsuredWinnerValue}` | Sum Insured: who leads, and their figure |
| `{deductiblesWinner}` / `{deductiblesWinnerValue}` | Deductibles: who leads, and their figure |

If your real templates use different tag names (e.g. `{INSURED_NAME}` or a
Word MERGEFIELD instead of `{curlyBraces}`), tell me the exact tags one
template uses and I'll remap `buildTemplateData` (`src/lib/docxFill.js`) or
`buildRecommendationTemplateData` (`src/lib/proposal.js`) to match — or
rename the tags in the templates to the ones above.
