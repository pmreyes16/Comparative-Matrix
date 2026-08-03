import React from 'react';

export default function Controls({
  view, sortKey, setSortKey, policyTypes, policyFilter, setPolicyFilter,
  premiumBounds, premiumMax, setPremiumMax, clauseKeyword, setClauseKeyword,
  search, setSearch, onlyDiff, setOnlyDiff,
}) {
  return (
    <div className="bg-white rounded-xl ring-1 ring-slate-200 p-3 mb-4 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">Sort</span>
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value)} className="text-sm rounded-md ring-1 ring-slate-200 px-2 py-1">
          <option value="none">—</option>
          <option value="premiumAsc">Total premium (low → high)</option>
          <option value="premiumDesc">Total premium (high → low)</option>
          <option value="sumDesc">Sum insured (high → low)</option>
          <option value="name">Insurer name (A → Z)</option>
        </select>
      </div>

      {policyTypes.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Policy type</span>
          <select value={policyFilter} onChange={(e) => setPolicyFilter(e.target.value)} className="text-sm rounded-md ring-1 ring-slate-200 px-2 py-1">
            <option value="all">All</option>
            {policyTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      )}

      {premiumBounds && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Max premium</span>
          <input
            type="range"
            min={premiumBounds.min}
            max={premiumBounds.max}
            value={premiumMax == null ? premiumBounds.max : premiumMax}
            onChange={(e) => setPremiumMax(Number(e.target.value))}
            className="w-40"
          />
          <span className="text-xs mono-amt tnum text-slate-600">
            ≤ {(premiumMax == null ? premiumBounds.max : premiumMax).toLocaleString()}
          </span>
          {premiumMax != null && (
            <button className="text-[11px] text-cobalt-600 hover:underline" onClick={() => setPremiumMax(null)}>
              reset
            </button>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">Clause/add-on</span>
        <input
          value={clauseKeyword}
          onChange={(e) => setClauseKeyword(e.target.value)}
          placeholder="e.g. acts of nature"
          className="text-sm rounded-md ring-1 ring-slate-200 px-2 py-1 w-40"
        />
      </div>

      <div className="flex items-center gap-2 flex-1 min-w-[180px]">
        <span className="text-xs text-slate-500">Search</span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="keyword across all slips…"
          className="text-sm rounded-md ring-1 ring-slate-200 px-2 py-1 flex-1"
        />
      </div>

      {view === 'table' && (
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          <input type="checkbox" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} />
          Show only differences
        </label>
      )}
    </div>
  );
}
