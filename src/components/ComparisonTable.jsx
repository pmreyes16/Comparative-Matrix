import React, { useMemo } from 'react';
import { formatMoney } from '../lib/money.js';
import { InsurerHeader } from './common.jsx';

const TABLE_ROWS = [
  { key: 'insurers', label: 'Insurer(s) / Share', get: (p) => p.insurers.map((i) => i.name + (i.percentageShare ? ' (' + i.percentageShare + ')' : '')).join('; ') },
  { key: 'policyType', label: 'Policy Type', get: (p) => p.policyType },
  { key: 'insured', label: 'Insured', get: (p) => p.insured },
  { key: 'natureOfBusiness', label: 'Nature of Business', get: (p) => p.natureOfBusiness },
  { key: 'project', label: 'Project / Asset', get: (p) => p.project },
  { key: 'period', label: 'Period of Insurance', get: (p) => [p.periodOfInsurance.from, p.periodOfInsurance.to].filter(Boolean).join(' – ') },
  { key: 'locationsOfRisks', label: 'Locations of Risks', get: (p) => p.locationsOfRisks },
  { key: 'cover', label: 'Cover', get: (p) => p.cover },
  { key: 'sumInsured', label: 'Sum Insured', money: true, get: (p) => p.sumInsured },
  { key: 'deductibles', label: 'Deductibles', money: true, get: (p) => p.deductibles },
  { key: 'premiumRate', label: 'Premium Rate', get: (p) => p.premiumRate },
  { key: 'brokerageRate', label: 'Brokerage Rate', get: (p) => p.brokerageRate },
  { key: 'premiumTotal', label: 'Total Premium', money: true, get: (p) => (p.premium && p.premium.total ? p.premium.total.money : null) },
  { key: 'premiumPaymentTerms', label: 'Premium Payment Terms', get: (p) => p.premiumPaymentTerms },
  { key: 'birReference', label: 'BIR RMO / RR Reference', get: (p) => p.birReference },
  { key: 'clausesAndWarranties', label: 'Clauses & Warranties', get: (p) => p.clausesAndWarranties.join('; ') },
  { key: 'leadInsurerClause', label: 'Lead Insurer Clause', get: (p) => p.leadInsurerClause },
  { key: 'severalLiabilityClause', label: 'Several Liability Clause', get: (p) => p.severalLiabilityClause },
  { key: 'claimsInformation', label: 'Claims Information', get: (p) => p.claimsInformation },
  { key: 'choiceOfJurisdiction', label: 'Jurisdiction, Law & Practice', get: (p) => p.choiceOfJurisdiction },
  { key: 'policyForm', label: 'Policy Form', get: (p) => p.policyForm },
  { key: 'validityOfQuote', label: 'Validity of Quote', get: (p) => p.validityOfQuote },
];

function cellText(row, p) {
  if (row.money) {
    const m = row.get(p);
    return m ? formatMoney(m) : '';
  }
  return row.get(p) || '';
}

export default function ComparisonTable({ proposals, onlyDiff, onAssignLogo }) {
  const rows = useMemo(
    () =>
      TABLE_ROWS.filter((row) => {
        if (!onlyDiff) return true;
        const vals = proposals.map((p) => cellText(row, p).trim());
        const uniq = new Set(vals.filter(Boolean));
        return uniq.size > 1;
      }),
    [proposals, onlyDiff]
  );

  return (
    <div className="cmp-scroll overflow-auto rounded-xl ring-1 ring-slate-200 bg-white">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 top-0 z-20 bg-slate-50 text-left px-3 py-3 font-semibold text-slate-500 w-56 border-b border-slate-200">
              Field
            </th>
            {proposals.map((p) => (
              <th
                key={p.id}
                className="sticky top-0 z-10 bg-slate-50 px-3 py-3 text-left border-b border-slate-200 min-w-[220px] align-top"
              >
                <InsurerHeader prop={p} onAssignLogo={onAssignLogo} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const vals = proposals.map((p) => cellText(row, p).trim());
            const uniq = new Set(vals.filter(Boolean));
            const differs = uniq.size > 1;
            return (
              <tr key={row.key} className={differs ? 'bg-rosegold-50/40' : ''}>
                <th className="sticky left-0 z-10 bg-white text-left align-top px-3 py-2 font-medium text-slate-500 border-b border-slate-100">
                  {row.label}
                </th>
                {proposals.map((p) => {
                  const m = row.money ? row.get(p) : null;
                  return (
                    <td key={p.id} className="px-3 py-2 align-top border-b border-slate-100">
                      {row.money ? (
                        m ? (
                          <span className="mono-amt tnum">{formatMoney(m)}</span>
                        ) : (
                          <span className="italic text-slate-400">—</span>
                        )
                      ) : row.get(p) ? (
                        <span className="whitespace-pre-wrap break-words text-slate-700">{row.get(p)}</span>
                      ) : (
                        <span className="italic text-slate-400">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
