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
    <div className="card card-pad">
      <div className="card-title mb-4">
        Total premium comparison
      </div>
      <div className="space-y-3">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-36 truncate text-sm text-slate-700" title={d.name}>
              {d.name}
            </div>
            <div className="bar-track h-3 relative">
              <div
                className={
                  'h-3 rounded-full ' +
                  (d.amt === min ? 'bg-teal-500' : d.amt === max ? 'bg-slate-300' : 'bg-cobalt-500')
                }
                style={{ width: Math.max(6, (d.amt / max) * 100) + '%' }}
              />
            </div>
            <div className="w-36 text-right mono-amt tnum text-[13px] font-medium text-slate-800">{d.disp}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 hint">
        Lowest total shown in teal. Bars scale to the highest total. Figures are copied verbatim from each slip.
      </div>
    </div>
  );
}
