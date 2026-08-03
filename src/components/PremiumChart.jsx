import React from 'react';
import { premiumTotalAmount, premiumTotalDisplay } from '../lib/money.js';

/** Dependency-free horizontal bar chart of total premiums (override-aware). */
export default function PremiumChart({ proposals }) {
  const data = proposals
    .map((p) => ({
      name: (p.insurers[0] && p.insurers[0].name) || p.fileName,
      amt: premiumTotalAmount(p),
      disp: premiumTotalDisplay(p),
    }))
    .filter((d) => d.amt != null);
  if (data.length < 2) return null;
  const max = Math.max(...data.map((d) => d.amt));
  const min = Math.min(...data.map((d) => d.amt));
  return (
    <div className="bg-white rounded-xl ring-1 ring-slate-200 p-4 mb-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
        Total premium comparison
      </div>
      <div className="space-y-2">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-40 truncate text-sm text-slate-600" title={d.name}>
              {d.name}
            </div>
            <div className="flex-1 bg-slate-100 rounded h-6 relative overflow-hidden">
              <div
                className={
                  'h-6 rounded ' +
                  (d.amt === min ? 'bg-teal-500' : d.amt === max ? 'bg-slate-400' : 'bg-cobalt-500')
                }
                style={{ width: Math.max(6, (d.amt / max) * 100) + '%' }}
              />
            </div>
            <div className="w-36 text-right mono-amt tnum text-sm text-slate-800">{d.disp}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 text-[11px] text-slate-400">
        Lowest total shown in teal. Bars scale to the highest total. Figures are copied verbatim from each slip.
      </div>
    </div>
  );
}
