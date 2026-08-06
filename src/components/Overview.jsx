import React, { useState } from 'react';
import { analyze, valueRanking, formatComputed, clauseDiff } from '../lib/analyze.js';
import { formatSections, premiumTotalDisplay } from '../lib/money.js';
import { eff } from '../lib/bestfit.js';
import { Badge } from './common.jsx';
import PremiumChart from './PremiumChart.jsx';
import PremiumSharePie from './PremiumSharePie.jsx';

const TODAY = new Date('2026-07-01T00:00:00');

const nameOf = (p) => (p.insurers[0] && p.insurers[0].name) || p.fileName;

function KpiTile({ label, tone, icon, children }) {
  const iconBg = tone === 'good' ? 'bg-teal-500' : tone === 'warn' ? 'bg-rosegold-500' : 'bg-cobalt-500';
  return (
    <div className="rounded-xl ring-1 ring-slate-200 bg-white p-3.5 shadow-sm">
      <div className="flex items-center gap-2.5 mb-2">
        <span className={'inline-flex items-center justify-center w-8 h-8 rounded-lg text-white shrink-0 ' + iconBg}>
          {icon}
        </span>
        <div className="text-[11px] uppercase tracking-wide text-slate-400 leading-tight">{label}</div>
      </div>
      {children}
    </div>
  );
}

function KpiIcon({ children }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
      {children}
    </svg>
  );
}
const IconStack = () => (
  <KpiIcon>
    <path d="M4 7l8-4 8 4-8 4-8-4Z" />
    <path d="M4 12l8 4 8-4M4 17l8 4 8-4" />
  </KpiIcon>
);
const IconTrendDown = () => (
  <KpiIcon>
    <path d="M4 7l6 6 4-4 6 6" />
    <path d="M20 14v5h-5" />
  </KpiIcon>
);
const IconTrendUp = () => (
  <KpiIcon>
    <path d="M4 17l6-6 4 4 6-8" />
    <path d="M14 7h6v6" />
  </KpiIcon>
);
const IconPercent = () => (
  <KpiIcon>
    <circle cx="7" cy="7" r="2.3" />
    <circle cx="17" cy="17" r="2.3" />
    <path d="M18 6 6 18" />
  </KpiIcon>
);

function ValueRanker({ proposals }) {
  const [weight, setWeight] = useState(0.5);
  const ranked = valueRanking(proposals, weight);
  const max = Math.max(...ranked.map((r) => r.score), 0.0001);
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-xs text-slate-500 whitespace-nowrap">Prioritise price</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={weight}
          onChange={(e) => setWeight(Number(e.target.value))}
          className="flex-1"
        />
        <span className="text-xs text-slate-500 whitespace-nowrap">Prioritise coverage</span>
      </div>
      <div className="space-y-2">
        {ranked.map((r, i) => (
          <div key={r.p.id} className="flex items-center gap-3">
            <span className="w-5 text-right text-xs text-slate-400 tnum">{i + 1}</span>
            <span className="w-40 truncate text-sm text-slate-700" title={nameOf(r.p)}>{nameOf(r.p)}</span>
            <div className="flex-1 bg-slate-100 rounded h-5 overflow-hidden">
              <div
                className={'h-5 rounded ' + (i === 0 ? 'bg-cobalt-500' : 'bg-cobalt-200')}
                style={{ width: Math.max(4, (r.score / max) * 100) + '%' }}
              />
            </div>
            <span className="w-9 text-right text-xs tnum text-slate-500">{Math.round(r.score * 100)}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 text-[11px] text-slate-400">
        Automated value score blending your price/coverage weighting — a comparison aid, not a recommendation. Always
        verify against the slips.
      </div>
    </div>
  );
}

/**
 * Clauses & Warranties are a list per proposal, not a single value. Shown as
 * one column per insurer — its clauses NOT shared by every proposal — so
 * columns can be scanned side by side instead of reading a stacked list.
 */
function ClauseDifferences({ proposals }) {
  if (!proposals || proposals.length < 2) return null;
  const d = clauseDiff(proposals);
  const anyDiffer = d.perProposal.some((x) => x.unique.length > 0);
  return (
    <div className="mt-4 pt-3 border-t border-slate-100">
      <div className="flex items-center gap-2 text-sm mb-2">
        <span className={'w-2 h-2 rounded-full shrink-0 ' + (anyDiffer ? 'bg-rosegold-500' : 'bg-teal-500')} />
        <span className="text-slate-600 font-medium">Clauses &amp; Warranties</span>
        <span className="text-slate-500">
          {anyDiffer
            ? d.commonCount + ' clause' + (d.commonCount !== 1 ? 's' : '') + ' shared by all — differences below'
            : 'All ' + d.commonCount + ' clause' + (d.commonCount !== 1 ? 's' : '') + ' shared by every proposal'}
        </span>
      </div>
      {anyDiffer && (
        // Auto-fit grid: cards stretch to fill the full width at any viewport/
        // zoom level, and reflow onto new rows instead of needing a horizontal
        // scrollbar once they'd get too narrow to read.
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          {d.perProposal.map((x) => (
            <div key={x.p.id} className="rounded-lg bg-slate-50 ring-1 ring-slate-200 p-2.5 min-w-0">
              <div className="text-[11px] font-semibold text-slate-600 truncate mb-1.5" title={nameOf(x.p)}>
                {nameOf(x.p)} <span className="text-slate-400 font-normal">({x.unique.length} unique)</span>
              </div>
              {x.unique.length ? (
                <ul className="text-[12px] text-slate-600 list-disc list-inside space-y-1 max-h-48 overflow-y-auto cmp-scroll pr-1">
                  {x.unique.map((c, i) => (
                    <li key={i} className="break-words">{c}</li>
                  ))}
                </ul>
              ) : (
                <div className="text-[12px] text-slate-400 italic">No unique clauses</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * One column per insurer, one row per field — scan across a row to compare
 * that field side by side. A cell is highlighted when the field differs
 * across the proposals shown.
 */
function DiffAtAGlance({ proposals }) {
  const rows = [
    { label: 'Policy Type', get: (p) => p.policyType },
    { label: 'Period', get: (p) => [p.periodOfInsurance.from, p.periodOfInsurance.to].filter(Boolean).join(' – ') },
    { label: 'Sum Insured', get: (p) => eff(p, 'sumInsured', (q) => formatSections(q.sumInsured)) },
    { label: 'Deductibles', get: (p) => eff(p, 'deductibles', (q) => formatSections(q.deductibles)) },
    { label: 'Total Premium', get: (p) => premiumTotalDisplay(p) },
    { label: 'Premium Rate', get: (p) => eff(p, 'premiumRate', (q) => formatSections(q.premiumRate)) },
  ];
  // table-fixed + colgroup: the Field column stays a fixed width and the
  // insurer columns share the rest EQUALLY, stretching to fill the full width
  // when they fit. The min-width on the table (not the columns) only kicks in
  // once that would squeeze columns unreadably thin — e.g. zoomed way in, or
  // many insurers — at which point cmp-scroll takes over horizontally instead
  // of columns collapsing.
  const minWidth = 130 + proposals.length * 160;
  return (
    <div className="overflow-x-auto cmp-scroll">
      <table className="w-full text-[12px] border-collapse table-fixed" style={{ minWidth: minWidth + 'px' }}>
        <colgroup>
          <col style={{ width: '130px' }} />
          {proposals.map((p) => (
            <col key={p.id} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th className="text-left text-slate-400 font-medium pb-1.5 pr-3 whitespace-nowrap">Field</th>
            {proposals.map((p) => (
              <th key={p.id} className="text-left text-slate-700 font-semibold pb-1.5 px-2.5 truncate" title={nameOf(p)}>
                {nameOf(p)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const vals = proposals.map((p) => (r.get(p) || '').trim());
            const nonEmpty = vals.filter(Boolean);
            const allBlank = nonEmpty.length === 0;
            // "Same" means every proposal has a value AND they all match — a
            // value present on one slip and missing on another is a real
            // difference (or a gap worth checking), never treated as "same".
            const allSame = !allBlank && nonEmpty.length === vals.length && new Set(nonEmpty).size === 1;
            const differ = !allBlank && !allSame;
            return (
              <tr key={i} className="border-t border-slate-100">
                <td className="py-1.5 pr-3 align-top whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5 text-slate-500">
                    <span className={'w-1.5 h-1.5 rounded-full shrink-0 ' + (differ ? 'bg-rosegold-500' : allSame ? 'bg-teal-500' : 'bg-slate-300')} />
                    {r.label}
                  </span>
                </td>
                {vals.map((v, j) => (
                  <td
                    key={j}
                    className={'py-1.5 px-2.5 align-top whitespace-pre-wrap break-words ' + (differ && v ? 'bg-rosegold-50 text-rosegold-900' : 'text-slate-600')}
                  >
                    {v || <span className="text-slate-300">—</span>}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function Overview({ proposals, onView }) {
  const A = analyze(proposals, TODAY);
  const lowName = A.lowest ? nameOf(A.lowest.p) : null;
  const covName = A.mostCoverage ? nameOf(A.mostCoverage.p) : null;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <KpiTile label="Proposals compared" icon={<IconStack />}>
          <div className="text-2xl font-bold text-slate-800 tnum">{A.count}</div>
          <div className="text-[11px] text-slate-400 truncate">{A.policyTypes.join(', ') || '—'}</div>
          <div className="text-[11px] text-slate-400 truncate">
            {['Commercial', 'Personal', 'Uncategorized']
              .filter((k) => A.categoryMix.counts[k] > 0)
              .map((k) => A.categoryMix.counts[k] + ' ' + k)
              .join(' · ')}
          </div>
        </KpiTile>
        <KpiTile label="Lowest total premium" tone={A.lowest ? 'good' : undefined} icon={<IconTrendDown />}>
          {A.lowest ? (
            <div>
              <div className="mono-amt tnum text-lg font-bold text-teal-700">{A.lowest.disp}</div>
              <div className="text-[11px] text-slate-500 truncate">{lowName}</div>
            </div>
          ) : (
            <span className="text-sm italic text-slate-400">Not detected</span>
          )}
        </KpiTile>
        <KpiTile label="Highest total premium" icon={<IconTrendUp />}>
          {A.highest ? (
            <div>
              <div className="mono-amt tnum text-lg font-bold text-slate-700">{A.highest.disp}</div>
              <div className="text-[11px] text-slate-500 truncate">{nameOf(A.highest.p)}</div>
            </div>
          ) : (
            <span className="text-sm italic text-slate-400">Not detected</span>
          )}
        </KpiTile>
        <KpiTile label="Potential saving (computed)" tone={A.spread ? 'good' : undefined} icon={<IconPercent />}>
          {A.spread != null ? (
            <div>
              <div className="mono-amt tnum text-lg font-bold text-slate-800">{formatComputed(A.spread, A.symbol)}</div>
              <div className="text-[11px] text-slate-400">≈ {A.savingsPct.toFixed(1)}% vs highest · computed</div>
            </div>
          ) : (
            <span className="text-sm italic text-slate-400">Need 2+ premiums</span>
          )}
        </KpiTile>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 bg-white rounded-xl ring-1 ring-slate-200 shadow-sm p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Overall analysis</div>
          <p className="text-sm text-slate-700 leading-relaxed">
            You're comparing <strong>{A.count}</strong> proposal{A.count !== 1 ? 's' : ''}
            {A.policyTypes.length ? (
              <>
                {' '}
                for <strong>{A.policyTypes.join(', ')}</strong>
              </>
            ) : null}
            .
            {A.lowest ? (
              <>
                {' '}
                The lowest total premium is <strong>{A.lowest.disp}</strong> from{' '}
                <strong>{lowName}</strong>
                {A.spread > 0 ? (
                  <>
                    {' '}
                    — about <strong>{formatComputed(A.spread, A.symbol)}</strong> ({A.savingsPct.toFixed(1)}%) below the
                    highest quote (computed)
                  </>
                ) : null}
                .
              </>
            ) : null}
            {covName ? (
              <>
                {' '}
                <strong>{covName}</strong> shows the broadest cover ({A.mostCoverage.clauses} clause
                {A.mostCoverage.clauses !== 1 ? 's' : ''} captured).
              </>
            ) : null}
            {A.lapsed.length > 0 ? (
              <>
                {' '}
                <strong className="text-poppy-600">{A.lapsed.length}</strong> quote
                {A.lapsed.length !== 1 ? 's have' : ' has'} already lapsed and should be refreshed.
              </>
            ) : null}
            {A.review.length > 0 ? (
              <>
                {' '}
                <strong className="text-rosegold-700">{A.review.length}</strong> proposal
                {A.review.length !== 1 ? 's need' : ' needs'} manual review before you rely on the figures.
              </>
            ) : null}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {A.lowest && <Badge tone="price">Best price: {lowName}</Badge>}
            {covName && <Badge tone="cover">Most coverage: {covName}</Badge>}
            {A.lapsed.map((p, i) => (
              <Badge key={i} tone="lapse">Lapsed: {nameOf(p)}</Badge>
            ))}
            {A.review.map((p, i) => (
              <Badge key={'r' + i} tone="review">Review: {nameOf(p)}</Badge>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl ring-1 ring-slate-200 shadow-sm p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Data quality</div>
          <div className="space-y-1.5">
            {A.completeness.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-28 truncate text-sm text-slate-600" title={nameOf(c.p)}>{nameOf(c.p)}</span>
                <div className="flex-1 bg-slate-100 rounded h-3 overflow-hidden">
                  <div
                    className={'h-3 ' + (c.pct >= 75 ? 'bg-teal-500' : c.pct >= 45 ? 'bg-rosegold-500' : 'bg-poppy-500')}
                    style={{ width: c.pct + '%' }}
                  />
                </div>
                <span className="w-9 text-right text-[11px] tnum text-slate-500">{c.pct}%</span>
              </div>
            ))}
          </div>
          <div className="mt-2 text-[11px] text-slate-400">Share of key fields detected per slip.</div>
        </div>
      </div>

      <div className="bg-white rounded-xl ring-1 ring-slate-200 shadow-sm p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Interactive value ranking</div>
        <ValueRanker proposals={proposals} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 items-start">
        <PremiumChart proposals={proposals} />
        <PremiumSharePie proposals={proposals} />
      </div>

      <div className="bg-white rounded-xl ring-1 ring-slate-200 shadow-sm p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Differences at a glance</div>
        <DiffAtAGlance proposals={proposals} />
        <ClauseDifferences proposals={proposals} />
        <button className="mt-3 text-xs text-cobalt-600 hover:underline" onClick={() => onView('table')}>
          Open full comparison table →
        </button>
      </div>
    </div>
  );
}
