import React, { useState } from 'react';
import { isDeleted } from '../lib/matrix.js';
import { exportMatrixToXlsx, exportMatrixToPdf, toast } from '../lib/exportMatrix.js';
import howdenCorporateLogo from '../assets/Howden logo - Corporate.svg';

function MatrixCell({ cell }) {
  if (!cell || cell.t === 'empty') return <span className="text-slate-300">—</span>;
  if (cell.t === 'check') {
    return (
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-teal-100 text-teal-700 text-xs font-bold" title="As proposed">
        ✓
      </span>
    );
  }
  const deleted = isDeleted(cell.v);
  return (
    <div className="max-h-[24rem] overflow-y-auto cmp-scroll pr-1">
      <span className={'whitespace-pre-wrap break-words ' + (deleted ? 'text-poppy-600 font-medium' : 'text-slate-800')}>
        {cell.v}
      </span>
    </div>
  );
}

/** Click-to-edit matrix cell (multi-line). A blank value clears the override. */
function MatrixEditableCell({ cell, onCommit }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState('');

  if (editing) {
    const rows = Math.min(10, Math.max(1, (val.match(/\n/g) || []).length + 1));
    return (
      <textarea
        autoFocus
        value={val}
        rows={rows}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => { setEditing(false); onCommit(val); }}
        onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false); }}
        className="w-full text-[13px] rounded border border-cobalt-500 px-1.5 py-1 outline-none resize-y"
      />
    );
  }

  const deleted = cell && cell.t === 'text' && isDeleted(cell.v);
  return (
    <button
      type="button"
      title="Click to edit"
      onClick={() => { setVal(cell && cell.raw != null ? String(cell.raw) : ''); setEditing(true); }}
      className="group text-left w-full block max-h-[24rem] overflow-y-auto cmp-scroll pr-1"
    >
      {!cell || cell.t === 'empty' ? (
        <span className="text-slate-300">—</span>
      ) : cell.t === 'check' ? (
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-teal-100 text-teal-700 text-xs font-bold" title="As proposed">
          ✓
        </span>
      ) : (
        <span className={'whitespace-pre-wrap break-words ' + (deleted ? 'text-poppy-600 font-medium' : 'text-slate-800')}>
          {cell.v}
        </span>
      )}
      <span className="ml-1 align-top text-[10px] text-slate-300 group-hover:text-cobalt-500 no-print">✎</span>
    </button>
  );
}

/** Click-to-edit row label for user-added rows, with an on-hover remove button. */
function CustomRowLabel({ label, onRename, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState('');

  if (editing) {
    return (
      <input
        autoFocus
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => { setEditing(false); onRename(val); }}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditing(false); }}
        placeholder="Row label"
        className="w-full text-[13px] font-semibold rounded border border-cobalt-500 px-1.5 py-1 outline-none"
      />
    );
  }

  return (
    <div className="group/rowlabel flex items-center gap-1.5">
      <button
        type="button"
        title="Click to rename this row"
        onClick={() => { setVal(label || ''); setEditing(true); }}
        className="text-left flex-1 min-w-0 truncate"
      >
        {label ? label : <span className="text-slate-300 font-normal italic">Untitled row</span>}
      </button>
      <button
        type="button"
        title="Remove this row"
        onClick={onRemove}
        className="no-print shrink-0 text-slate-300 hover:text-poppy-600 opacity-0 group-hover/rowlabel:opacity-100 transition-opacity text-xs leading-none"
      >
        ✕
      </button>
    </div>
  );
}

function MatrixSpinner() {
  return (
    <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" className="opacity-90" />
    </svg>
  );
}

function MatrixArchiveIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
      <path d="M10 12h4" />
    </svg>
  );
}

/**
 * The comparative / compliance matrix: dark title band, legend, sticky first
 * column + header, section grouping and a per-insurer footnotes area. Pass
 * `onEdit` to make every cell click-to-edit; omit it for a read-only render.
 */
export default function MatrixView({ matrix, controls, onEdit, onSave, onArchive, onAddRow, onRenameRow, onRemoveRow }) {
  const hasBaseline = !!matrix.baseline;
  const cols = matrix.columns;
  const editable = typeof onEdit === 'function';
  const [busy, setBusy] = useState(null);

  // Run an action with a disabled + spinner state; catch failures → error toast.
  const run = async (kind, fn) => {
    if (busy) return;
    setBusy(kind);
    await new Promise((res) => setTimeout(res, 0)); // let the spinner paint before sync work
    try {
      await fn();
    } catch (e) {
      toast('Sorry — that action failed: ' + (e && e.message ? e.message : e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div id="matrix-print" className="rounded-2xl ring-1 ring-slate-200 shadow-sm bg-white overflow-hidden">
      <div className="bg-gradient-to-r from-cobalt-900 to-cobalt-700 text-white px-5 py-4 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          {/* White chip behind the logo — its native blue fill has poor
              contrast directly on this dark cobalt band otherwise. */}
          <div className="bg-white rounded-md px-2.5 py-1.5 shrink-0">
            <img src={howdenCorporateLogo} alt="Howden" className="h-5 w-auto" />
          </div>
          <div className="min-w-0">
            {matrix.eyebrow && (
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cobalt-200">{matrix.eyebrow}</div>
            )}
            <div className="text-lg font-bold leading-tight">{matrix.title}</div>
            {matrix.subtitle && (
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cobalt-200 mt-1">{matrix.subtitle}</div>
            )}
          </div>
        </div>
        <div className="no-print flex items-center gap-2 shrink-0">
          {onSave && (
            <button
              onClick={() => run('save', async () => {
                const res = await onSave();
                if (res && res.name) toast('Saved “' + res.name + '” to your downloads — open it later to resume.');
              })}
              disabled={!!busy}
              title="Save this comparison as a file you can reopen later"
              className="inline-flex items-center gap-1.5 rounded-md bg-white/15 hover:bg-white/25 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs px-3 py-1.5 ring-1 ring-white/25 font-medium"
            >
              {busy === 'save' && <MatrixSpinner />}
              {busy === 'save' ? 'Saving…' : 'Save'}
            </button>
          )}
          <button
            onClick={() => run('xlsx', () => exportMatrixToXlsx(matrix))}
            disabled={!!busy}
            className="inline-flex items-center gap-1.5 rounded-md bg-white/10 hover:bg-white/20 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs px-3 py-1.5 ring-1 ring-white/20"
          >
            {busy === 'xlsx' && <MatrixSpinner />}
            {busy === 'xlsx' ? 'Exporting…' : 'Export Excel'}
          </button>
          <button
            onClick={() => run('pdf', () => exportMatrixToPdf(matrix))}
            disabled={!!busy}
            className="inline-flex items-center gap-1.5 rounded-md bg-white/10 hover:bg-white/20 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs px-3 py-1.5 ring-1 ring-white/20"
          >
            {busy === 'pdf' && <MatrixSpinner />}
            {busy === 'pdf' ? 'Preparing…' : 'Export PDF'}
          </button>
          {onArchive && (
            <button
              onClick={onArchive}
              disabled={!!busy}
              title="Open the Archive"
              className="inline-flex items-center gap-1.5 rounded-md bg-cobalt-500 hover:bg-cobalt-700 disabled:opacity-60 text-white text-xs px-3 py-1.5 ring-1 ring-white/10 font-medium"
            >
              <MatrixArchiveIcon /> Archive
            </button>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-2.5 bg-slate-50 border-b border-slate-200 text-[12px] text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-teal-100 text-teal-700 text-[10px] font-bold">✓</span>
          As proposed
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-rosegold-100 ring-1 ring-rosegold-300" />
          Deviation from proposed terms
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="text-poppy-600 font-medium">DELETED</span> Not offered
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="text-slate-300">—</span> Not addressed
        </span>
        {controls && <span className="ml-auto">{controls}</span>}
      </div>

      <div className="overflow-auto cmp-scroll max-h-[85vh]">
        <table className="min-w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-30 bg-slate-100 text-left px-3 py-3 font-semibold text-slate-500 border-b border-r border-slate-200 w-52 min-w-[13rem]">
                Terms &amp; Conditions
              </th>
              {hasBaseline && (
                <th className="sticky top-0 z-20 bg-cobalt-50 text-left px-3 py-3 border-b border-slate-200 min-w-[220px] align-bottom">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-cobalt-600">
                    {matrix.baseline.role || 'Proposed'}
                  </div>
                  <div className="font-bold text-slate-800 leading-tight">{matrix.baseline.name}</div>
                </th>
              )}
              {cols.map((c) => (
                <th key={c.id} className="sticky top-0 z-20 bg-slate-100 px-3 py-3 text-left border-b border-slate-200 min-w-[200px] align-bottom">
                  <span className="font-semibold text-slate-700 leading-tight">{c.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((row, ri) => {
              const rowTop = row.newField ? 'border-t-2 border-slate-200' : 'border-t border-slate-100';
              return (
                <tr key={ri} className={'align-top hover:bg-slate-50/70 ' + (row.total ? 'font-bold bg-slate-50' : '')}>
                  <th className={'sticky left-0 z-10 bg-white text-left px-3 py-2 font-semibold text-slate-700 border-r border-slate-200 ' + rowTop + (row.total ? ' bg-slate-50' : '')}>
                    {row.custom && editable ? (
                      <CustomRowLabel
                        label={row.field}
                        onRename={(text) => onRenameRow && onRenameRow(row.rowId, text)}
                        onRemove={() => onRemoveRow && onRemoveRow(row.rowId)}
                      />
                    ) : (
                      row.field || (row.subLabel && !hasBaseline ? <span className="text-slate-500 font-medium">{row.subLabel}</span> : '')
                    )}
                  </th>
                  {hasBaseline && (
                    <td className={'px-3 py-2 bg-cobalt-50/60 text-slate-800 ' + rowTop}>
                      {editable ? (
                        <MatrixEditableCell
                          cell={{ t: row.howden ? 'text' : 'empty', v: row.howden, raw: row.howden }}
                          onCommit={(t) => onEdit(matrix.baseline.id, row.key, t)}
                        />
                      ) : (
                        <div className="max-h-[24rem] overflow-y-auto cmp-scroll pr-1">
                          <span className="whitespace-pre-wrap break-words">
                            {row.howden || <span className="text-slate-300">—</span>}
                          </span>
                        </div>
                      )}
                    </td>
                  )}
                  {cols.map((c) => {
                    const cell = row.cells[c.id];
                    const dev = cell && cell.t === 'text' && (cell.dev || hasBaseline);
                    return (
                      <td
                        key={c.id}
                        className={
                          'px-3 py-2 ' + rowTop + ' ' +
                          (cell && cell.t === 'check' ? 'bg-teal-50/40' : dev ? 'bg-rosegold-50 border-l-2 border-l-rosegold-400' : '')
                        }
                      >
                        {editable ? (
                          <MatrixEditableCell cell={cell} onCommit={(t) => onEdit(c.id, row.key, t)} />
                        ) : (
                          <MatrixCell cell={cell} />
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editable && onAddRow && (
        <div className="no-print px-5 py-3 bg-slate-50 border-t border-slate-200">
          <button
            type="button"
            onClick={onAddRow}
            className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-slate-300 hover:border-cobalt-400 hover:text-cobalt-600 text-slate-500 text-xs font-medium px-3 py-1.5 transition-colors"
          >
            <span className="text-sm leading-none">+</span> Add a row
          </button>
        </div>
      )}

      {matrix.footnotes && matrix.footnotes.length > 0 && (
        <div className="px-5 py-4 bg-slate-50 border-t border-slate-200">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
            Additional clauses, warranties &amp; subjectivities
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {matrix.footnotes.map((f) => (
              <div key={f.colId}>
                <div className="text-sm font-semibold text-slate-700 mb-1">{f.name}</div>
                <ul className="text-[12px] text-slate-600 space-y-0.5">
                  {f.lines.map((l, i) => (
                    <li key={i} className="whitespace-pre-wrap break-words">{l}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
