import React, { useMemo, useState } from 'react';
import howdenCorporateLogo from '../assets/Howden logo - Corporate.svg';
import { buildProposalData, nameOf } from '../lib/proposal.js';
import { toast } from '../lib/exportMatrix.js';
import { exportProposalToPdf } from '../lib/exportProposal.js';

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
    <div className="flex items-center justify-between gap-4 py-2.5 border-t border-slate-100 first:border-t-0">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-slate-700">{label}</div>
        <div className="text-[11px] text-slate-400">{hint}</div>
      </div>
      {winner.p ? (
        <div className="text-right min-w-0">
          <div className="text-sm font-semibold text-cobalt-700 truncate">{nameOf(winner.p)}</div>
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
  const [busy, setBusy] = useState(false);

  const run = async (fn) => {
    if (busy) return;
    setBusy(true);
    await new Promise((res) => setTimeout(res, 0));
    try {
      await fn();
    } catch (e) {
      toast('Sorry — that action failed: ' + (e && e.message ? e.message : e));
    } finally {
      setBusy(false);
    }
  };

  const { recommended, winners, secondaryWinners, review, lapsed, recommendedUniqueClauses } = data;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 no-print">
        {onBack && (
          <button onClick={onBack} className="text-sm text-cobalt-600 hover:underline">
            ← Back
          </button>
        )}
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => run(() => exportProposalToPdf(data))}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md bg-cobalt-600 hover:bg-cobalt-700 disabled:opacity-60 text-white text-sm px-4 py-2 font-medium transition-colors"
          >
            {busy ? 'Preparing…' : 'Export PDF'}
          </button>
        </div>
      </div>

      <div id="proposal-print" className="rounded-2xl ring-1 ring-slate-200 shadow-sm bg-white overflow-hidden">
        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-slate-100 flex items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            <HowdenMarkCobalt className="h-9 w-auto mb-3" />
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cobalt-600">
              Insurance Placement Recommendation
            </div>
            <h1 className="text-2xl font-bold text-slate-800 mt-1 break-words">
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
        <div className="px-8 py-6 border-b border-slate-100">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
            Executive Summary
          </div>
          {data.proposals.length < 2 ? (
            <p className="text-sm text-slate-600">
              Only one proposal has been uploaded — comparison and recommendation become available once a second
              quotation slip is added.
            </p>
          ) : (
            <p className="text-sm text-slate-700 leading-relaxed">
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
          <div className="mx-8 mt-6 rounded-xl bg-cobalt-50 ring-1 ring-cobalt-200 p-5 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wide text-cobalt-600 font-semibold">
                Recommended Insurer
              </div>
              <div className="text-xl font-bold text-slate-800 truncate">{nameOf(recommended.p)}</div>
              <div className="text-[12px] text-slate-500 mt-0.5">
                Balanced score across price, cover and terms — a comparison aid, not a guarantee.
              </div>
            </div>
            <div className="text-3xl font-bold text-cobalt-700 tnum shrink-0">
              {Math.round(recommended.score)}
              <span className="text-sm text-cobalt-400">/100</span>
            </div>
          </div>
        )}

        {/* Headline winners */}
        <div className="px-8 py-6">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
            Where Each Insurer Leads
          </div>
          <div className="text-[12px] text-slate-400 mb-2">
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
          <div className="px-8 py-6 border-t border-slate-100 bg-slate-50">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-3">
              Additional Considerations
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {secondaryWinners.some((w) => w.p) && (
                <div>
                  <div className="text-[12px] font-semibold text-slate-600 mb-1">Protection adequacy</div>
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
                  <div className="text-[12px] font-semibold text-slate-600 mb-1">
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
                  <div className="text-[12px] font-semibold text-slate-600 mb-1">Before you proceed</div>
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
        <div className="px-8 py-6 border-t border-slate-100 overflow-x-auto cmp-scroll">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-3">
            Full Comparison Detail
          </div>
          <table className="w-full text-[12px] border-collapse">
            <thead>
              <tr>
                <th className="text-left text-slate-400 font-medium pb-1.5 pr-3 whitespace-nowrap">Insurer</th>
                {[...winners, ...secondaryWinners].map((w) => (
                  <th key={w.key} className="text-left text-slate-600 font-semibold pb-1.5 px-2.5 min-w-[120px]">
                    {w.criterion.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.ranked.map((r) => (
                <tr key={r.p.id} className="border-t border-slate-100">
                  <td className="py-1.5 pr-3 font-medium text-slate-700 whitespace-nowrap">{nameOf(r.p)}</td>
                  {[...winners, ...secondaryWinners].map((w) => (
                    <td key={w.key} className="py-1.5 px-2.5 text-slate-600 whitespace-pre-wrap break-words">
                      {w.criterion.disp(r.p) || <span className="text-slate-300">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-slate-100 text-[11px] text-slate-400 leading-relaxed">
          This recommendation is auto-generated from figures copied verbatim from each quotation slip. It is a
          comparison aid, not a binding recommendation or advice — always verify every figure against the original
          slips before making a decision. Prepared by Howden Philippines.
        </div>
      </div>
    </div>
  );
}
