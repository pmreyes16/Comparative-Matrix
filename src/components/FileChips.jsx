import React from 'react';

const STATUS = {
  processing: { t: 'Processing…', c: 'bg-cobalt-100 text-cobalt-700' },
  parsed: { t: 'Parsed', c: 'bg-teal-100 text-teal-700' },
  review: { t: 'Needs review', c: 'bg-rosegold-100 text-rosegold-800' },
  error: { t: 'Error', c: 'bg-poppy-100 text-poppy-700' },
};

/** One chip per uploaded file: name, detected insurer, parse status, remove. */
export function FileChip({ f, onRemove }) {
  const st = STATUS[f.status] || STATUS.processing;
  return (
    <div className="flex items-center gap-2 rounded-full bg-white ring-1 ring-slate-200 pl-3 pr-1.5 py-1 text-sm">
      <span className="truncate max-w-[180px] text-slate-700" title={f.name}>{f.name}</span>
      {f.insurer && <span className="text-slate-400">·</span>}
      {f.insurer && <span className="text-slate-500 truncate max-w-[120px]">{f.insurer}</span>}
      <span className={'rounded-full px-2 py-0.5 text-[11px] ' + st.c}>{st.t}</span>
      <button
        className="w-5 h-5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700"
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
    <div className="flex flex-wrap gap-2 mb-4">
      {files.map((f) => (
        <FileChip key={f.id} f={f} onRemove={onRemove} />
      ))}
    </div>
  );
}
