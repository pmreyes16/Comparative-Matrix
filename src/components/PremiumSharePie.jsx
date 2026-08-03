import React from 'react';
import { firstPct } from '../lib/bestfit.js';

const nameOf = (p) => (p.insurers[0] && p.insurers[0].name) || p.fileName;

// Brand palette, base tones first then lighter tints so extra insurers stay
// visually distinct without leaving the four-colour family.
const SLICE_COLORS = ['#0047AB', '#0D9488', '#B76E79', '#E4312B', '#6E9FE0', '#5EEAD4', '#DDA8A9', '#F08683'];

const R = 60;
const C = 70;

function arcPath(startDeg, sweepDeg) {
  if (sweepDeg >= 359.99) {
    // A full circle can't be drawn as one SVG arc — split it in two halves.
    return `M ${C - R} ${C} A ${R} ${R} 0 1 1 ${C + R} ${C} A ${R} ${R} 0 1 1 ${C - R} ${C} Z`;
  }
  const toXY = (deg) => {
    const rad = (deg * Math.PI) / 180;
    return [C + R * Math.cos(rad), C + R * Math.sin(rad)];
  };
  const [x1, y1] = toXY(startDeg);
  const [x2, y2] = toXY(startDeg + sweepDeg);
  const large = sweepDeg > 180 ? 1 : 0;
  return `M ${C} ${C} L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} Z`;
}

/**
 * The rate for one section (0 = Section I, 1 = Section II) of a proposal's
 * Premium Rate. Premium Rate has no PER-SECTION override — editing it in the
 * Matrix writes one combined multi-line string to `overrides.premiumRate`
 * (the same text the cell displays, "Section I – …: X%\nSection II – …: Y%").
 * That override always wins when present, matching every other view of this
 * field; we split it back into per-section lines positionally, since that's
 * exactly the shape the Matrix cell's textarea starts from and how a broker
 * editing it would naturally keep it.
 */
function sectionRate(p, idx) {
  const secs = (p.premiumRate && p.premiumRate.sections) || [];
  const s = secs[idx];
  const label = (s && s.label) || (idx === 0 ? 'Section I' : 'Section II');

  const override = p.overrides && p.overrides.premiumRate;
  if (override != null && String(override).trim() !== '') {
    const lines = String(override).split('\n').map((l) => l.trim()).filter(Boolean);
    const line = lines[idx];
    if (line == null) return { pct: null, disp: '', label };
    // Strip a leading "Section … – Label:" prefix, if the line still has one,
    // to leave just the value (works whether or not the user kept the label).
    const value = line.replace(/^[^:]*:\s*/, '');
    return { pct: firstPct(value), disp: value, label };
  }

  if (!s) return { pct: null, disp: '', label };
  return { pct: firstPct(s.value), disp: s.value || '', label };
}

function PieCard({ title, data }) {
  if (data.length < 2) {
    // Always render the card — even empty — so Section I and Section II stay
    // visibly two separate charts instead of one silently vanishing when it
    // doesn't (yet) have enough comparable numeric rates to draw slices.
    return (
      <div className="bg-white rounded-xl ring-1 ring-slate-200 p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">{title}</div>
        <div className="h-40 flex items-center justify-center text-[12px] text-slate-400 italic">
          Not enough comparable data for a chart
        </div>
        <div className="mt-2 text-[11px] text-slate-400">
          Share of combined premium rate across compared proposals — computed, not a slip figure.
        </div>
      </div>
    );
  }
  const total = data.reduce((s, d) => s + d.amt, 0);
  let angle = -90; // start at 12 o'clock
  const slices = data.map((d, i) => {
    const frac = d.amt / total;
    const sweep = frac * 360;
    const path = arcPath(angle, sweep);
    angle += sweep;
    return { ...d, path, pct: frac * 100, color: SLICE_COLORS[i % SLICE_COLORS.length] };
  });

  return (
    <div className="bg-white rounded-xl ring-1 ring-slate-200 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">{title}</div>
      <div className="flex items-center gap-6 flex-wrap">
        <svg viewBox="0 0 140 140" className="w-40 h-40 shrink-0" aria-hidden="true">
          {slices.map((s, i) => (
            <path key={i} d={s.path} fill={s.color} stroke="#fff" strokeWidth="1" />
          ))}
        </svg>
        <div className="flex-1 min-w-[180px] space-y-1.5">
          {slices.map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
              <span className="flex-1 truncate text-slate-700" title={s.name}>{s.name}</span>
              <span className="text-slate-500 tnum text-xs w-12 text-right">{s.pct.toFixed(1)}%</span>
              <span className="mono-amt tnum text-xs text-slate-800 truncate max-w-[120px]" title={s.disp}>{s.disp}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 text-[11px] text-slate-400">
        Share of combined premium rate across compared proposals — computed, not a slip figure.
      </div>
    </div>
  );
}

/**
 * Dependency-free SVG pie charts: one for Section I (Material Damage) and one
 * for Section II (Third Party Liability) Premium Rate, since the two sections
 * are usually different in kind (a real rate vs. "free of charge") and
 * conflating them into one number would be misleading.
 */
export default function PremiumSharePie({ proposals }) {
  const list = proposals || [];
  const section1 = list
    .map((p) => { const r = sectionRate(p, 0); return { name: nameOf(p), amt: r.pct, disp: r.disp, label: r.label }; })
    .filter((d) => d.amt != null && d.amt > 0);
  const section2 = list
    .map((p) => { const r = sectionRate(p, 1); return { name: nameOf(p), amt: r.pct, disp: r.disp, label: r.label }; })
    .filter((d) => d.amt != null && d.amt > 0);

  if (list.length < 2) return null;

  const label1 = (list.map((p) => sectionRate(p, 0).label).find(Boolean)) || 'Section I';
  const label2 = (list.map((p) => sectionRate(p, 1).label).find(Boolean)) || 'Section II';

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <PieCard title={`Premium rate by insurer — ${label1}`} data={section1} />
      <PieCard title={`Premium rate by insurer — ${label2}`} data={section2} />
    </div>
  );
}
