import React from 'react';

function Group({ label, children, grow }) {
  return (
    <label className={'flex flex-col gap-1 ' + (grow ? 'flex-1 min-w-[200px]' : '')}>
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

export default function Controls({
  view, sortKey, setSortKey, policyTypes, policyFilter, setPolicyFilter,
  premiumBounds, premiumMax, setPremiumMax, clauseKeyword, setClauseKeyword,
  search, setSearch, onlyDiff, setOnlyDiff,
}) {
  return (
    <div className="card px-4 py-3.5 mb-5 flex flex-wrap items-end gap-x-4 gap-y-3">
      <Group label="Search" grow>
        <div className="relative">
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m20 20-4-4" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Keyword across all slips…"
            className="field field-sm w-full pl-8"
          />
        </div>
      </Group>

      <Group label="Sort">
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value)} className="field field-sm">
          <option value="none">—</option>
          <option value="premiumAsc">Total premium (low → high)</option>
          <option value="premiumDesc">Total premium (high → low)</option>
          <option value="sumDesc">Sum insured (high → low)</option>
          <option value="name">Insurer name (A → Z)</option>
        </select>
      </Group>

      {policyTypes.length > 0 && (
        <Group label="Policy type">
          <select value={policyFilter} onChange={(e) => setPolicyFilter(e.target.value)} className="field field-sm">
            <option value="all">All</option>
            {policyTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </Group>
      )}

      <Group label="Clause / add-on">
        <input
          value={clauseKeyword}
          onChange={(e) => setClauseKeyword(e.target.value)}
          placeholder="e.g. acts of nature"
          className="field field-sm w-44"
        />
      </Group>

      {premiumBounds && (
        <div className="flex flex-col gap-1">
          <span className="field-label flex items-center gap-2">
            Max premium
            {premiumMax != null && (
              <button className="normal-case tracking-normal font-medium text-cobalt-500 hover:underline" onClick={() => setPremiumMax(null)}>
                reset
              </button>
            )}
          </span>
          <div className="flex items-center gap-2.5 h-[34px]">
            <input
              type="range"
              min={premiumBounds.min}
              max={premiumBounds.max}
              value={premiumMax == null ? premiumBounds.max : premiumMax}
              onChange={(e) => setPremiumMax(Number(e.target.value))}
              className="w-36"
            />
            <span className="text-[12px] mono-amt tnum text-slate-600 rounded-md bg-slate-100 px-2 py-1">
              ≤ {(premiumMax == null ? premiumBounds.max : premiumMax).toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {view === 'table' && (
        <label className="flex items-center gap-1.5 text-xs text-slate-600 h-[34px]">
          <input type="checkbox" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} />
          Show only differences
        </label>
      )}
    </div>
  );
}
