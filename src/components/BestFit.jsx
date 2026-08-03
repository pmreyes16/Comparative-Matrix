import React, { useMemo, useState } from 'react';
import { Badge } from './common.jsx';
import { CRITERIA, PRESETS, scoreProposals } from '../lib/bestfit.js';

const nameOf = (p) => (p.insurers[0] && p.insurers[0].name) || p.fileName;

export default function BestFit({ proposals }) {
  const [weights, setWeights] = useState(() => Object.fromEntries(CRITERIA.map((c) => [c.key, c.def])));
  const ranked = useMemo(() => scoreProposals(proposals, weights), [proposals, weights]);
  const max = Math.max(...ranked.map((r) => r.score), 0.0001);
  const best = ranked[0];
  const setW = (key, v) => setWeights((w) => ({ ...w, [key]: v }));

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl ring-1 ring-slate-200 shadow-sm p-4">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cobalt-600">Weighted Comparison</div>
            <h2 className="text-lg font-bold text-slate-800">Adjust the weighting to see how proposals rank</h2>
          </div>
          <div className="flex gap-1.5">
            {Object.keys(PRESETS).map((n) => (
              <button key={n} onClick={() => setWeights({ ...PRESETS[n] })} className="text-xs rounded-md ring-1 ring-slate-200 px-2.5 py-1 hover:bg-slate-50 text-slate-600">{n}</button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {CRITERIA.map((c) => (
            <div key={c.key} className="flex items-center gap-3">
              <div className="w-40 shrink-0">
                <div className="text-sm text-slate-700">{c.label}</div>
                <div className="text-[10px] text-slate-400">{c.dir === 'lower' ? '↓ ' : '↑ '}{c.hint}</div>
              </div>
              <input type="range" min="0" max="100" value={weights[c.key]} onChange={(e) => setW(c.key, Number(e.target.value))} className="flex-1 accent-cobalt-500" />
              <span className="w-8 text-right text-xs tnum text-slate-500">{weights[c.key]}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 text-[11px] text-slate-400">
          Drag to set how important each factor is (0 = ignore). This ranking reflects your weighting only — it is a
          comparison aid, not a recommendation; always verify against the original slips.
        </div>
      </div>

      <div className="bg-white rounded-xl ring-1 ring-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ranking on your weighting</div>
          {best && (
            <Badge tone="brand">
              Highest score: {nameOf(best.p)} · {Math.round(best.score)}/100
            </Badge>
          )}
        </div>
        <div className="space-y-2">
          {ranked.map((r, i) => (
            <div key={r.p.id} className="flex items-center gap-3">
              <span className="w-5 text-right text-xs text-slate-400 tnum">{i + 1}</span>
              <span className="w-44 truncate text-sm text-slate-700" title={nameOf(r.p)}>{nameOf(r.p)}</span>
              <div className="flex-1 bg-slate-100 rounded h-6 overflow-hidden">
                <div className={'h-6 rounded ' + (i === 0 ? 'bg-cobalt-500' : 'bg-cobalt-200')} style={{ width: Math.max(4, (r.score / max) * 100) + '%' }} />
              </div>
              <span className="w-10 text-right text-sm tnum text-slate-700">{Math.round(r.score)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl ring-1 ring-slate-200 shadow-sm overflow-auto cmp-scroll">
        <table className="min-w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50">
              <th className="text-left px-3 py-2 font-semibold text-slate-500 sticky left-0 bg-slate-50">Insurer</th>
              {CRITERIA.map((c) => (
                <th key={c.key} className="text-left px-3 py-2 font-semibold text-slate-500 min-w-[130px]">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ranked.map((r, i) => (
              <tr key={r.p.id} className={'border-t border-slate-100 ' + (i === 0 ? 'bg-cobalt-50/50' : '')}>
                <td className="px-3 py-2 font-medium text-slate-700 sticky left-0 bg-white">{nameOf(r.p)}</td>
                {CRITERIA.map((c) => (
                  <td key={c.key} className="px-3 py-2 text-slate-600 whitespace-pre-wrap break-words">{c.disp(r.p)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
