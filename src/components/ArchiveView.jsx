import React, { useEffect, useMemo, useRef, useState } from 'react';
import { buildMatrixFromProposals } from '../lib/matrix.js';
import { exportMatrixToXlsx, exportMatrixToPdf, triggerDownload, toast } from '../lib/exportMatrix.js';
import { archivePolicyTypes, buildArchiveBackup, importArchive } from '../lib/archive.js';
import { storageAvailable } from '../lib/storage.js';

const PAGE = 8;

function fmtDate(iso) {
  try { return new Date(iso).toLocaleString(); } catch (e) { return iso || ''; }
}

// The Archive page: lists saved comparative matrices with search / filter / sort,
// per-row View / Restore / Export / Delete, pagination and an empty state.
export default function ArchiveView({ list, onView, onRestore, onDelete, onReload }) {
  const fileRef = useRef(null);
  const [q, setQ] = useState('');
  const [policy, setPolicy] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState(null); // record pending delete

  const policyOpts = useMemo(() => archivePolicyTypes(list), [list]);

  const filtered = useMemo(() => {
    let rows = (list || []).slice();
    if (q.trim()) {
      const k = q.toLowerCase();
      rows = rows.filter((r) => (r.client_name || '').toLowerCase().includes(k) || (r.title || '').toLowerCase().includes(k));
    }
    if (policy !== 'all') rows = rows.filter((r) => r.policy_type === policy);
    if (from) { const t = new Date(from + 'T00:00:00').getTime(); rows = rows.filter((r) => new Date(r.saved_at).getTime() >= t); }
    if (to) { const t = new Date(to + 'T23:59:59').getTime(); rows = rows.filter((r) => new Date(r.saved_at).getTime() <= t); }
    const time = (r) => new Date(r.saved_at).getTime() || 0;
    if (sort === 'newest') rows.sort((a, b) => time(b) - time(a));
    else if (sort === 'oldest') rows.sort((a, b) => time(a) - time(b));
    else if (sort === 'client') rows.sort((a, b) => (a.client_name || '').localeCompare(b.client_name || ''));
    return rows;
  }, [list, q, policy, from, to, sort]);

  useEffect(() => { setPage(1); }, [q, policy, from, to, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const clamped = Math.min(page, pages);
  const pageRows = filtered.slice((clamped - 1) * PAGE, clamped * PAGE);

  const doExport = (rec, kind) => {
    const m = buildMatrixFromProposals(rec.proposals || [], rec.baselineId || 'none');
    if (kind === 'xlsx') exportMatrixToXlsx(m); else exportMatrixToPdf(m);
  };

  const handleBackup = () => {
    const payload = buildArchiveBackup();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const stamp = new Date().toISOString().slice(0, 10);
    triggerDownload('howden-archive-' + stamp + '.json', blob);
    toast(payload.count ? ('Backed up ' + payload.count + ' comparison' + (payload.count === 1 ? '' : 's') + ' to a file — keep it to restore later.') : 'Nothing to back up yet.');
  };
  const handleRestoreFile = async (ev) => {
    const f = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!f) return;
    try {
      const text = await f.text();
      const res = importArchive(text, 'merge');
      if (onReload) onReload();
      toast(res.added ? ('Restored ' + res.added + ' comparison' + (res.added === 1 ? '' : 's') + ' from your file.') : 'Those comparisons are already in your archive.');
    } catch (e) {
      toast(e.message || 'Could not read that backup file.');
    }
  };

  const btn = 'text-[12px] rounded-md px-2.5 py-1 ring-1 transition-colors';

  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm overflow-hidden">
      {/* Title band */}
      <div className="bg-gradient-to-r from-cobalt-900 to-cobalt-700 text-white px-5 py-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cobalt-200">Archive</div>
        <div className="text-lg font-bold leading-tight mt-0.5">Saved comparative matrices</div>
        <div className="text-sm text-slate-300">{list.length} saved{list.length === 1 ? ' comparison' : ' comparisons'} on this device</div>
      </div>

      {/* Backup / restore + storage status */}
      <div className="flex flex-wrap items-center gap-2 px-5 py-2.5 bg-white border-b border-slate-200 text-[12px]">
        <button onClick={handleBackup} className={btn + ' ring-slate-200 text-slate-700 hover:bg-slate-100'}>⬇ Back up to file</button>
        <button onClick={() => fileRef.current && fileRef.current.click()} className={btn + ' ring-slate-200 text-slate-700 hover:bg-slate-100'}>⬆ Restore from file</button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={handleRestoreFile} />
        {storageAvailable
          ? <span className="ml-auto inline-flex items-center gap-1.5 text-teal-600"><span>●</span> Saved in this browser — stays until you delete it</span>
          : <span className="ml-auto inline-flex items-center gap-1.5 text-rosegold-700"><span>●</span> This preview can’t save to your browser — use Back up / Restore, or open the file in a browser tab</span>}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 px-5 py-3 bg-slate-50 border-b border-slate-200 text-[12px] text-slate-600">
        <input
          value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search client or title…"
          className="rounded-md ring-1 ring-slate-200 px-2.5 py-1.5 min-w-[200px]" />
        <label className="inline-flex items-center gap-1.5">Policy
          <select value={policy} onChange={(e) => setPolicy(e.target.value)} className="rounded-md ring-1 ring-slate-200 px-2 py-1.5">
            <option value="all">All</option>
            {policyOpts.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label className="inline-flex items-center gap-1.5">From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-md ring-1 ring-slate-200 px-2 py-1.5" />
        </label>
        <label className="inline-flex items-center gap-1.5">To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-md ring-1 ring-slate-200 px-2 py-1.5" />
        </label>
        <label className="inline-flex items-center gap-1.5 ml-auto">Sort
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-md ring-1 ring-slate-200 px-2 py-1.5">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="client">Client A–Z</option>
          </select>
        </label>
      </div>

      {/* Empty states */}
      {list.length === 0 ? (
        <div className="text-center text-slate-400 py-16 px-6">
          <div className="text-4xl mb-3">🗄️</div>
          <p className="text-sm">No archived matrices yet. Save a comparative matrix to see it here.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-slate-400 py-16 px-6">
          <p className="text-sm">No matrices match your filters.</p>
        </div>
      ) : (
        <>
          <div className="overflow-auto">
            <table className="min-w-full text-[13px]">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-2.5 font-semibold">Title</th>
                  <th className="px-4 py-2.5 font-semibold">Client</th>
                  <th className="px-4 py-2.5 font-semibold">Policy type</th>
                  <th className="px-4 py-2.5 font-semibold">Saved</th>
                  <th className="px-4 py-2.5 font-semibold">By</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/60 align-top">
                    <td className="px-4 py-2.5 font-medium text-slate-800 max-w-[260px]">{r.title}</td>
                    <td className="px-4 py-2.5 text-slate-600 max-w-[200px]">{r.client_name}</td>
                    <td className="px-4 py-2.5 text-slate-600">{r.policy_type || <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{fmtDate(r.saved_at)}</td>
                    <td className="px-4 py-2.5 text-slate-500">{r.saved_by}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1.5 justify-end">
                        <button onClick={() => onView(r)} className={btn + ' ring-slate-200 text-slate-700 hover:bg-slate-100'}>View</button>
                        <button onClick={() => onRestore(r)} className={btn + ' ring-cobalt-200 text-cobalt-600 hover:bg-cobalt-50'}>Restore</button>
                        <button onClick={() => doExport(r, 'xlsx')} className={btn + ' ring-slate-200 text-slate-700 hover:bg-slate-100'}>Excel</button>
                        <button onClick={() => doExport(r, 'pdf')} className={btn + ' ring-slate-200 text-slate-700 hover:bg-slate-100'}>PDF</button>
                        <button onClick={() => setConfirm(r)} className={btn + ' ring-poppy-200 text-poppy-600 hover:bg-poppy-50'}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 text-[12px] text-slate-500 border-t border-slate-200">
              <span>Showing {(clamped - 1) * PAGE + 1}–{Math.min(clamped * PAGE, filtered.length)} of {filtered.length}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={clamped <= 1}
                  className="rounded-md ring-1 ring-slate-200 px-2.5 py-1 disabled:opacity-40 hover:bg-slate-50">Prev</button>
                <span>Page {clamped} / {pages}</span>
                <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={clamped >= pages}
                  className="rounded-md ring-1 ring-slate-200 px-2.5 py-1 disabled:opacity-40 hover:bg-slate-50">Next</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Delete confirmation */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setConfirm(null)}>
          <div className="bg-white rounded-xl shadow-xl ring-1 ring-slate-200 max-w-sm w-full p-5" onClick={(e) => e.stopPropagation()}>
            <div className="text-base font-semibold text-slate-800 mb-1">Delete this archived matrix?</div>
            <p className="text-sm text-slate-500 mb-4">“{confirm.title}” will be permanently removed from the Archive on this device. This can’t be undone.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirm(null)} className="text-sm rounded-md ring-1 ring-slate-200 px-3 py-1.5 hover:bg-slate-50 text-slate-700">Cancel</button>
              <button onClick={() => { onDelete(confirm); setConfirm(null); }} className="text-sm rounded-md bg-poppy-600 hover:bg-poppy-700 text-white px-3 py-1.5">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
