import React, { useMemo, useState } from 'react';
import { Logo } from './common.jsx';
import { CRITERIA, PRESETS, scoreProposals, criterionWinner } from '../lib/bestfit.js';

const nameOf = (p) => (p.insurers[0] && p.insurers[0].name) || p.fileName;
const money0 = (n) => '₱' + Math.round(n).toLocaleString('en-US');

export default function BestFit({ proposals }) {
  const [weights, setWeights] = useState(() => Object.fromEntries(CRITERIA.map((c) => [c.key, c.def])));
  const ranked = useMemo(() => scoreProposals(proposals, weights), [proposals, weights]);
  const max = Math.max(...ranked.map((r) => r.score), 0.0001);
  const best = ranked[0];
  const runnerUp = ranked[1];
  const setW = (key, v) => setWeights((w) => ({ ...w, [key]: v }));

  // What the recommendation is actually based on: which of the criteria the
  // AE is currently weighting does the top pick win outright, and how much
  // cheaper is it than the priciest quote on the table.
  const wins = useMemo(() => {
    if (!best) return [];
    return CRITERIA.filter((c) => weights[c.key] > 0).filter((c) => {
      const w = criterionWinner(proposals, c.key);
      return w && w.p.id === best.p.id;
    });
  }, [proposals, weights, best]);

  const savings = useMemo(() => {
    if (!best) return null;
    const premiumC = CRITERIA.find((c) => c.key === 'premium');
    const nums = ranked.map((r) => premiumC.num(r.p)).filter((v) => v != null && isFinite(v));
    const bestAmt = premiumC.num(best.p);
    if (bestAmt == null || nums.length < 2) return null;
    const highest = Math.max(...nums);
    if (highest <= bestAmt) return null;
    const diff = highest - bestAmt;
    return { diff, pct: Math.round((diff / highest) * 100) };
  }, [ranked, best]);

  const bestLogo = best && best.p.insurers[0];

  return (
    <div className="space-y-5">
      {best && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-ink-900 via-cobalt-800 to-cobalt-600 text-white shadow-lift p-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <Logo name={nameOf(best.p)} url={bestLogo && bestLogo.logoUrl} size={48} />
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-300">Recommended quotation</div>
                <div className="text-2xl font-bold text-white truncate mt-0.5">{nameOf(best.p)}</div>
                <div className="text-sm text-cobalt-100/80 mt-1">
                  {Math.round(best.score)}/100 on your current weighting
                  {runnerUp && ranked.length > 1 && (
                    <> · {Math.round(best.score - runnerUp.score)} pts ahead of {nameOf(runnerUp.p)}</>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cobalt-200">Total Premium</div>
              <div className="text-[28px] leading-tight font-bold text-white mono-amt tnum">{CRITERIA.find((c) => c.key === 'premium').disp(best.p)}</div>
              {savings && (
                <div className="text-xs text-teal-300 font-medium mt-0.5">
                  {money0(savings.diff)} lower than the highest quote ({savings.pct}%)
                </div>
              )}
            </div>
          </div>
          {wins.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-1.5">
              {wins.map((c) => (
                <span key={c.key} className="inline-flex items-center gap-1 rounded-full bg-white/10 ring-1 ring-inset ring-white/20 text-white text-[11px] font-medium px-2.5 py-1">
                  ✓ Best {c.label}
                </span>
              ))}
            </div>
          )}
          <div className="mt-4 text-[11px] text-cobalt-100/60">
            Reflects your weighting below — a comparison aid, not a final recommendation; always verify against the original slips.
          </div>
        </div>
      )}

      <div className="card card-pad">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="kicker text-cobalt-500">Weighted Comparison</div>
            <h2 className="text-lg font-bold text-slate-900 mt-0.5">Adjust the weighting to see how proposals rank</h2>
          </div>
          <div className="seg">
            {Object.keys(PRESETS).map((n) => (
              <button key={n} onClick={() => setWeights({ ...PRESETS[n] })} className="seg-item text-[12px] py-1 hover:bg-white">{n}</button>
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-x-5 gap-y-3 sm:grid-cols-2">
          {CRITERIA.map((c) => (
            <div key={c.key} className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50/60 px-3 py-2.5">
              <div className="w-40 shrink-0">
                <div className="text-sm font-medium text-slate-800">{c.label}</div>
                <div className="text-[10px] text-slate-400">{c.dir === 'lower' ? '↓ ' : '↑ '}{c.hint}</div>
              </div>
              <input type="range" min="0" max="100" value={weights[c.key]} onChange={(e) => setW(c.key, Number(e.target.value))} className="flex-1" />
              <span className="w-10 text-center text-[12px] font-semibold tnum text-slate-700 rounded-md bg-white border border-slate-200 py-0.5">{weights[c.key]}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 hint">
          Drag to set how important each factor is (0 = ignore). This ranking reflects your weighting only — it is a
          comparison aid, not a recommendation; always verify against the original slips.
        </div>
      </div>

      <div className="card card-pad">
        <div className="mb-4 card-title">Ranking on your weighting</div>
        <div className="space-y-3">
          {ranked.map((r, i) => (
            <div key={r.p.id} className="flex items-center gap-3">
              <span className={'w-6 h-6 inline-flex items-center justify-center rounded-full text-[11px] font-semibold tnum shrink-0 ' + (i === 0 ? 'bg-cobalt-500 text-white' : 'bg-slate-100 text-slate-500')}>{i + 1}</span>
              <span className="w-44 truncate text-sm text-slate-700" title={nameOf(r.p)}>{nameOf(r.p)}</span>
              <div className="bar-track h-3">
                <div className={'h-3 rounded-full transition-[width] duration-300 ' + (i === 0 ? 'bg-cobalt-500' : 'bg-cobalt-200')} style={{ width: Math.max(4, (r.score / max) * 100) + '%' }} />
              </div>
              <span className="w-10 text-right text-sm font-semibold tnum text-slate-800">{Math.round(r.score)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card overflow-auto cmp-scroll">
        <table className="min-w-full text-sm border-collapse data-table">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-3 sticky left-0 bg-slate-50">Insurer</th>
              {CRITERIA.map((c) => (
                <th key={c.key} className="px-4 py-3 min-w-[130px]">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ranked.map((r, i) => (
              <tr key={r.p.id} className={'border-t border-slate-100 ' + (i === 0 ? 'bg-cobalt-50/40' : 'hover:bg-slate-50/60')}>
                <td className={'px-4 py-3 font-semibold text-slate-800 sticky left-0 ' + (i === 0 ? 'bg-cobalt-50' : 'bg-white')}>{nameOf(r.p)}</td>
                {CRITERIA.map((c) => (
                  <td key={c.key} className="px-4 py-3 text-slate-600 whitespace-pre-wrap break-words">{c.disp(r.p)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
