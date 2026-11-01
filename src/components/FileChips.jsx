import React from 'react';

const STATUS = {
  processing: { t: 'Processing…', c: 'bg-cobalt-50 text-cobalt-600 ring-cobalt-200', dot: 'bg-cobalt-400 animate-pulse' },
  parsed: { t: 'Parsed', c: 'bg-teal-50 text-teal-700 ring-teal-200', dot: 'bg-teal-500' },
  review: { t: 'Needs review', c: 'bg-rosegold-50 text-rosegold-800 ring-rosegold-200', dot: 'bg-rosegold-500' },
  error: { t: 'Error', c: 'bg-poppy-50 text-poppy-700 ring-poppy-200', dot: 'bg-poppy-500' },
};

/** One chip per uploaded file: name, detected insurer, parse status, remove. */
export function FileChip({ f, onRemove }) {
  const st = STATUS[f.status] || STATUS.processing;
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-white border border-slate-200/80 shadow-card pl-3 pr-1.5 py-1.5 text-sm">
      <svg viewBox="0 0 24 24" className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
        <path d="M15 3v4h4" />
      </svg>
      <div className="min-w-0 leading-tight">
        <div className="truncate max-w-[200px] text-[13px] font-medium text-slate-800" title={f.name}>{f.name}</div>
        {f.insurer && <div className="text-[11px] text-slate-500 truncate max-w-[200px]">{f.insurer}</div>}
      </div>
      <span className={'pill ' + st.c}>
        <span className={'w-1.5 h-1.5 rounded-full ' + st.dot} aria-hidden="true" />
        {st.t}
      </span>
      <button
        className="w-6 h-6 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        title="Remove this file"
        onClick={() => onRemove(f.id)}
      >
        ×
      </button>
    </div>
  );
}

export default function FileChips({ files, onRemove }) {
  if (!files || !files.length) return null;
  return (
    <div className="flex flex-wrap gap-2 mb-5">
      {files.map((f) => (
        <FileChip key={f.id} f={f} onRemove={onRemove} />
      ))}
    </div>
  );
}
