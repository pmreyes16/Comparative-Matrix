import React, { useMemo, useState } from 'react';
import howdenCorporateLogo from '../assets/Howden logo - Corporate.svg';
import { buildProposalData, nameOf } from '../lib/proposal.js';
import { toast } from '../lib/exportMatrix.js';
import { exportProposalToPdf } from '../lib/exportProposal.js';
import { exportProposalToDocx } from '../lib/exportProposalDocx.js';

const TODAY = new Date();

function HowdenMarkCobalt({ className }) {
  return <img src={howdenCorporateLogo} alt="Howden" className={className} />;
}

function fmtDate(d) {
  try {
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch (e) {
    return '';
  }
}

function WinnerRow({ label, hint, winner }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-t border-slate-100 first:border-t-0">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-slate-800">{label}</div>
        <div className="text-[11px] text-slate-400">{hint}</div>
      </div>
      {winner.p ? (
        <div className="text-right min-w-0">
          <div className="text-sm font-semibold text-cobalt-600 truncate">{nameOf(winner.p)}</div>
          <div className="text-[12px] text-slate-500 truncate">{winner.disp}</div>
        </div>
      ) : (
        <div className="text-[12px] text-slate-400 italic">Not enough comparable data</div>
      )}
    </div>
  );
}

/**
 * A client-ready recommendation document generated from the comparison:
 * headline winners (Total Premium, Clauses & Warranties, Brokerage Rate,
 * Premium Rate), an overall recommended insurer, and an appendix with the
 * full criteria breakdown. Exportable as a PDF.
 */
export default function ProposalView({ proposals, onBack }) {
  const data = useMemo(() => buildProposalData(proposals, TODAY), [proposals]);
  const [busy, setBusy] = useState(null); // which export is running: 'pdf' | 'docx'

  const run = async (kind, fn) => {
    if (busy) return;
    setBusy(kind);
    await new Promise((res) => setTimeout(res, 0));
    try {
      await fn();
    } catch (e) {
      toast('Sorry — that action failed: ' + (e && e.message ? e.message : e));
    } finally {
      setBusy(null);
    }
  };

  const { recommended, winners, secondaryWinners, review, lapsed, recommendedUniqueClauses } = data;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 no-print">
        {onBack && (
          <button onClick={onBack} className="btn btn-ghost btn-sm -ml-2.5">
            ← Back
          </button>
        )}
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => run('docx', () => exportProposalToDocx(data))}
            disabled={!!busy}
            title="Download an editable Word document"
            className="btn btn-secondary"
          >
            {busy === 'docx' ? 'Preparing…' : 'Download Word (.docx)'}
          </button>
          <button
            onClick={() => run('pdf', () => exportProposalToPdf(data))}
            disabled={!!busy}
            className="btn btn-primary"
          >
            {busy === 'pdf' ? 'Preparing…' : 'Export PDF'}
          </button>
        </div>
      </div>

      <div id="proposal-print" className="card overflow-hidden max-w-5xl mx-auto">
        <div className="h-1.5 bg-gradient-to-r from-cobalt-700 via-cobalt-500 to-teal-500" aria-hidden="true" />
        {/* Header */}
        <div className="px-6 sm:px-10 pt-9 pb-7 border-b border-slate-100 flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            <HowdenMarkCobalt className="h-9 w-auto mb-3" />
            <div className="kicker text-cobalt-500">
              Insurance Placement Recommendation
            </div>
            <h1 className="text-[28px] font-bold tracking-tight text-slate-900 mt-1 break-words leading-tight">
              {data.insuredName || 'Comparative Insurance Proposal'}
            </h1>
            <div className="text-sm text-slate-500 mt-1">
              {[data.policyType, [data.period.from, data.period.to].filter(Boolean).join(' – ')]
                .filter(Boolean)
                .join(' · ') || 'Policy details to be confirmed'}
            </div>
          </div>
          <div className="text-right text-[12px] text-slate-400 shrink-0">
            <div>Prepared by Howden Philippines</div>
            <div>{fmtDate(data.generatedAt)}</div>
          </div>
        </div>

        {/* Executive summary */}
        <div className="px-6 sm:px-10 py-7 border-b border-slate-100">
          <div className="kicker mb-2">
            Executive Summary
          </div>
          {data.proposals.length < 2 ? (
            <p className="text-sm text-slate-600">
              Only one proposal has been uploaded — comparison and recommendation become available once a second
              quotation slip is added.
            </p>
          ) : (
            <p className="text-[15px] text-slate-600 leading-relaxed [&_strong]:text-slate-900">
              We compared <strong>{data.proposals.length}</strong> proposal{data.proposals.length !== 1 ? 's' : ''}
              {data.policyType ? (
                <>
                  {' '}
                  for <strong>{data.policyType}</strong>
                </>
              ) : null}
              .{' '}
              {recommended ? (
                <>
                  Based on a balanced view of price, cover and terms, we recommend{' '}
                  <strong>{nameOf(recommended.p)}</strong>
                  {data.winCount > 0 ? (
                    <>
                      {' '}
                      — it leads on {data.winCount} of the {winners.length} headline criteria below
                    </>
                  ) : (
                    <> as the strongest overall balance across price, cover and terms, though no single insurer swept every headline criterion</>
                  )}
                  .
                </>
              ) : null}
            </p>
          )}
        </div>

        {/* Recommended insurer callout */}
        {recommended && (
          <div className="mx-6 sm:mx-10 mt-7 rounded-2xl bg-gradient-to-br from-ink-900 via-cobalt-800 to-cobalt-600 text-white p-6 flex items-center justify-between gap-4 shadow-lift">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-[0.16em] text-teal-300 font-semibold">
                Recommended Insurer
              </div>
              <div className="text-2xl font-bold text-white truncate mt-0.5">{nameOf(recommended.p)}</div>
              <div className="text-[12px] text-cobalt-100/70 mt-1">
                Balanced score across price, cover and terms — a comparison aid, not a guarantee.
              </div>
            </div>
            <div className="text-4xl font-bold text-white tnum shrink-0">
              {Math.round(recommended.score)}
              <span className="text-sm text-cobalt-200">/100</span>
            </div>
          </div>
        )}

        {/* Headline winners */}
        <div className="px-6 sm:px-10 py-7">
          <div className="kicker mb-1">
            Where Each Insurer Leads
          </div>
          <div className="text-[12px] text-slate-400 mb-3">
            The straight winner per criterion, independent of any weighting.
          </div>
          <div>
            {winners.map((w) => (
              <WinnerRow key={w.key} label={w.criterion.label} hint={w.criterion.hint} winner={w} />
            ))}
          </div>
        </div>

        {/* Additional considerations */}
        {(secondaryWinners.some((w) => w.p) || recommendedUniqueClauses.length > 0 || review.length > 0 || lapsed.length > 0) && (
          <div className="px-6 sm:px-10 py-7 border-t border-slate-100 bg-slate-50/70">
            <div className="kicker mb-4">
              Additional Considerations
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {secondaryWinners.some((w) => w.p) && (
                <div>
                  <div className="text-[12px] font-semibold text-slate-800 mb-1.5">Protection adequacy</div>
                  {secondaryWinners.map((w) =>
                    w.p ? (
                      <div key={w.key} className="text-[12px] text-slate-600 mb-1">
                        {w.criterion.label}: <strong>{nameOf(w.p)}</strong>
                        <div className="text-slate-500 whitespace-pre-line pl-2">{w.disp}</div>
                      </div>
                    ) : null
                  )}
                </div>
              )}
              {recommendedUniqueClauses.length > 0 && (
                <div>
                  <div className="text-[12px] font-semibold text-slate-800 mb-1.5">
                    What sets {nameOf(recommended.p)} apart
                  </div>
                  <ul className="text-[12px] text-slate-600 list-disc list-inside space-y-0.5">
                    {recommendedUniqueClauses.slice(0, 4).map((c, i) => (
                      <li key={i} className="truncate" title={c}>
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {(review.length > 0 || lapsed.length > 0) && (
                <div className="sm:col-span-2">
                  <div className="text-[12px] font-semibold text-slate-800 mb-1.5">Before you proceed</div>
                  <ul className="text-[12px] text-rosegold-800 space-y-0.5">
                    {review.map((p, i) => (
                      <li key={'r' + i}>{nameOf(p)} — figures need manual verification before relying on them.</li>
                    ))}
                    {lapsed.map((p, i) => (
                      <li key={'l' + i} className="text-poppy-700">
                        {nameOf(p)} — quote validity has lapsed; ask for a refreshed quotation.
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Appendix: full comparison detail */}
        <div className="px-6 sm:px-10 py-7 border-t border-slate-100 overflow-x-auto cmp-scroll">
          <div className="kicker mb-3">
            Full Comparison Detail
          </div>
          <table className="w-full text-[12px] border-collapse data-table">
            <thead>
              <tr>
                <th className="pb-2 pr-3 whitespace-nowrap">Insurer</th>
                {[...winners, ...secondaryWinners].map((w) => (
                  <th key={w.key} className="pb-2 px-2.5 min-w-[120px]">
                    {w.criterion.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.ranked.map((r) => (
                <tr key={r.p.id} className="border-t border-slate-100">
                  <td className="py-2 pr-3 font-semibold text-slate-800 whitespace-nowrap">{nameOf(r.p)}</td>
                  {[...winners, ...secondaryWinners].map((w) => (
                    <td key={w.key} className="py-2 px-2.5 text-slate-600 whitespace-pre-wrap break-words">
                      {w.criterion.disp(r.p) || <span className="text-slate-300">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 sm:px-10 py-6 border-t border-slate-100 text-[11px] text-slate-400 leading-relaxed">
          This recommendation is auto-generated from figures copied verbatim from each quotation slip. It is a
          comparison aid, not a binding recommendation or advice — always verify every figure against the original
          slips before making a decision. Prepared by Howden Philippines.
        </div>
      </div>
    </div>
  );
}
