import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { parseFile } from './lib/parse.js';
import { extract, extractWithAI, AI_ENABLED } from './lib/extract.js';
import { buildMatrixFromProposals } from './lib/matrix.js';
import { toast, triggerDownload } from './lib/exportMatrix.js';
import { saveMatrixToArchive, loadArchive, deleteFromArchive, comparisonFilename, buildComparisonPayload } from './lib/archive.js';
import { storageGet, storageSet, storageAvailable } from './lib/storage.js';
import { primaryAmount, premiumTotalAmount, formatMoneyInput, formatMoneyInText } from './lib/money.js';
import UploadZone from './components/UploadZone.jsx';
import FileChips from './components/FileChips.jsx';
import Controls from './components/Controls.jsx';
import MatrixView from './components/MatrixView.jsx';
import Overview from './components/Overview.jsx';
import BestFit from './components/BestFit.jsx';
import ArchiveView from './components/ArchiveView.jsx';
import ProposalView from './components/ProposalView.jsx';
import DocumentControlView from './components/DocumentControlView.jsx';
import Sidebar from './components/Sidebar.jsx';
import { saveStoredTemplate, deleteStoredTemplate, listStoredTemplates } from './lib/templateStore.js';

// Per-view heading shown at the top of the main card.
const VIEW_META = {
  overview: { eyebrow: 'CRS Comparative System', title: 'Overview', subtitle: 'Upload quotation slips from multiple insurers — compare premiums, cover and terms side by side.' },
  bestfit: { eyebrow: 'CRS Comparative System', title: 'Best Fit', subtitle: 'Weighted, multi-criteria ranking across price, cover and terms.' },
  matrix: { eyebrow: 'Dashboard', title: 'CRS Comparative System', subtitle: 'Baseline vs. insurer terms, side by side.' },
  proposal: { eyebrow: 'Recommendation', title: 'Generate a Proposal', subtitle: 'A client-ready recommendation document built from your comparison.' },
  doccontrol: { eyebrow: 'Templates', title: 'Document Control', subtitle: 'Your standard Quotation Slip templates, one per line of insurance.' },
  archive: { eyebrow: 'History', title: 'Archive', subtitle: 'Matrices you’ve saved in this browser.' },
  archiveItem: { eyebrow: 'History', title: 'Archive', subtitle: 'Viewing a saved matrix (read-only).' },
};

// Simple string fields edit the value directly (so analytics stay in sync);
// structured fields (money / sections / clauses) store a display override.
const DIRECT_FIELDS = new Set([
  'policyType', 'insured', 'natureOfBusiness', 'project', 'locationsOfRisks', 'cover',
  'brokerageRate', 'premiumPaymentTerms', 'birReference', 'leadInsurerClause',
  'severalLiabilityClause', 'claimsInformation', 'choiceOfJurisdiction', 'policyForm', 'validityOfQuote',
]);

export default function App() {
  const [files, setFiles] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [view, setView] = useState('overview');
  const [sortKey, setSortKey] = useState('none');
  const [policyFilter, setPolicyFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [onlyDiff, setOnlyDiff] = useState(false);
  const [premiumMax, setPremiumMax] = useState(null);
  const [clauseKeyword, setClauseKeyword] = useState('');
  const [baselineId, setBaselineId] = useState('none');
  const [customRows, setCustomRows] = useState([]); // user-added matrix rows: [{ id, label }]
  const [rowOrder, setRowOrder] = useState([]); // drag-and-drop arrangement of ALL matrix rows, by row key
  const [archiveList, setArchiveList] = useState([]);   // saved matrices (localStorage)
  const [archiveItem, setArchiveItem] = useState(null); // record being viewed read-only
  const [justSaved, setJustSaved] = useState(null);     // last saved record → confirmation banner
  // Uploaded Quotation Slip templates (Document Control) — metadata only,
  // keyed by registry filename; the actual file bytes live in IndexedDB
  // (templateStore.js) so they survive a refresh. Hydrated once on mount.
  const [templateMeta, setTemplateMeta] = useState(new Map());
  useEffect(() => {
    listStoredTemplates().then(setTemplateMeta);
  }, []);
  const uploadTemplate = useCallback(async (filename, file) => {
    const meta = await saveStoredTemplate(filename, file);
    setTemplateMeta((prev) => new Map(prev).set(filename, meta));
  }, []);
  const removeTemplate = useCallback(async (filename) => {
    await deleteStoredTemplate(filename);
    setTemplateMeta((prev) => { const next = new Map(prev); next.delete(filename); return next; });
  }, []);

  const addFiles = useCallback(async (fileList) => {
    for (const file of [...fileList]) {
      const id = 'f_' + Math.random().toString(36).slice(2, 9);
      setFiles((prev) => [...prev, { id, name: file.name, status: 'processing', insurer: '' }]);
      try {
        const parsed = await parseFile(file);
        let prop;
        if (AI_ENABLED) {
          try {
            prop = await extractWithAI(parsed, file.name);
          } catch {
            prop = extract(parsed, file.name);
          }
        } else {
          prop = extract(parsed, file.name);
        }
        prop.id = id;
        const insurerName = (prop.insurers[0] && prop.insurers[0].name) || '';
        const status = prop.extractionConfidence === 'low' || prop.flaggedFields.length ? 'review' : 'parsed';
        setProposals((prev) => [...prev, prop]);
        setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, status, insurer: insurerName } : f)));
      } catch (err) {
        setFiles((prev) =>
          prev.map((f) => (f.id === id ? { ...f, status: 'error', error: String(err.message || err) } : f))
        );
      }
    }
  }, []);

  const removeFile = useCallback((id) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    setProposals((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const assignLogo = useCallback((propId, dataUrl) => {
    setProposals((prev) =>
      prev.map((p) => {
        if (p.id !== propId) return p;
        const insurers = p.insurers.length ? p.insurers.slice() : [{ name: p.fileName, percentageShare: '', logoUrl: '' }];
        insurers[0] = { ...insurers[0], logoUrl: dataUrl };
        return { ...p, insurers };
      })
    );
  }, []);

  // Matrix column headers — the insurer name doesn't always get detected
  // cleanly from the slip, so it's editable straight from the header.
  const renameInsurer = useCallback((propId, name) => {
    setProposals((prev) =>
      prev.map((p) => {
        if (p.id !== propId) return p;
        const insurers = p.insurers.length ? p.insurers.slice() : [{ name: '', percentageShare: '', logoUrl: '' }];
        insurers[0] = { ...insurers[0], name };
        return { ...p, insurers };
      })
    );
  }, []);

  // Apply a manual edit (typed figure) to one proposal; Matrix/Overview recompute.
  const editProposal = useCallback((id, updater) => {
    setProposals((prev) => prev.map((p) => (p.id === id ? updater(p) : p)));
  }, []);

  // Edit any Matrix cell → update that proposal's field (direct) or override.
  const editMatrixCell = useCallback((id, key, text) => {
    if (!key) return;
    // Auto-format money cells: single-amount cells (Total Premium, Premium
    // Charges) get a full ₱ + comma + cents; mixed cells (Sum Insured,
    // Deductibles) only reformat the amounts inside their text.
    const wholeMoney = key === 'premiumTotal' || key.indexOf('premium:') === 0;
    const inTextMoney = key === 'sumInsured' || key === 'deductibles';
    const val = wholeMoney ? formatMoneyInput(text) : inTextMoney ? formatMoneyInText(text) : text;
    editProposal(id, (p) => {
      if (DIRECT_FIELDS.has(key)) return { ...p, [key]: val };
      const overrides = { ...(p.overrides || {}) };
      if (val && val.trim()) overrides[key] = val;
      else delete overrides[key];
      return { ...p, overrides };
    });
  }, [editProposal]);

  const renameCustomRow = useCallback((id, label) => {
    setCustomRows((prev) => prev.map((r) => (r.id === id ? { ...r, label } : r)));
  }, []);

  const removeCustomRow = useCallback((id) => {
    setCustomRows((prev) => prev.filter((r) => r.id !== id));
    setRowOrder((prev) => prev.filter((k) => k !== 'custom:' + id));
    const key = 'custom:' + id;
    setProposals((prev) =>
      prev.map((p) => {
        if (!p.overrides || !(key in p.overrides)) return p;
        const overrides = { ...p.overrides };
        delete overrides[key];
        return { ...p, overrides };
      })
    );
  }, []);

  // "Unused" = never labeled AND no insurer has a value in it — i.e. added by
  // mistake or left over from testing, not a row someone is mid-filling-in.
  const isCustomRowEmpty = useCallback(
    (row) => {
      if ((row.label || '').trim()) return false;
      const key = 'custom:' + row.id;
      return !proposals.some((p) => p.overrides && String(p.overrides[key] || '').trim());
    },
    [proposals]
  );

  const emptyCustomRowCount = useMemo(
    () => customRows.filter(isCustomRowEmpty).length,
    [customRows, isCustomRowEmpty]
  );

  const removeEmptyCustomRows = useCallback(() => {
    const emptyKeys = new Set(customRows.filter(isCustomRowEmpty).map((r) => 'custom:' + r.id));
    setCustomRows((prev) => prev.filter((r) => !isCustomRowEmpty(r)));
    setRowOrder((prev) => prev.filter((k) => !emptyKeys.has(k)));
  }, [customRows, isCustomRowEmpty]);

  // ---- Save / open the whole comparison (matrix + all manual edits) ----
  const restoreSnapshot = useCallback((d) => {
    if (!d || !Array.isArray(d.proposals)) { alert('That file is not a saved CRS comparison.'); return false; }
    setProposals(d.proposals);
    setBaselineId(d.baselineId || 'none');
    setCustomRows(Array.isArray(d.customRows) ? d.customRows : []);
    setRowOrder(Array.isArray(d.rowOrder) ? d.rowOrder : []);
    setFiles(d.proposals.map((p) => ({
      id: p.id,
      name: p.fileName || 'Restored proposal',
      status: p.extractionConfidence === 'low' || (p.flaggedFields && p.flaggedFields.length) ? 'review' : 'parsed',
      insurer: (p.insurers[0] && p.insurers[0].name) || '',
    })));
    return true;
  }, []);

  // "Save" downloads the whole comparison as a .json file the user keeps and
  // re-opens later. It also keeps a best-effort in-browser Archive entry (which
  // persists in a real browser tab). Throws only if there's nothing to save —
  // MatrixView catches and shows an error state.
  const saveComparison = useCallback(async () => {
    if (!proposals.length) throw new Error('Nothing to save yet — upload some slips first.');
    const name = comparisonFilename(proposals);
    triggerDownload(name, new Blob([JSON.stringify(buildComparisonPayload(proposals, baselineId, customRows, rowOrder), null, 2)], { type: 'application/json' }));
    let rec = null;
    try { rec = saveMatrixToArchive(proposals, baselineId, customRows, rowOrder); setArchiveList(loadArchive()); } catch (e) { /* storage blocked */ }
    setJustSaved({ name, title: (rec && rec.title) || name, archived: !!(rec && storageAvailable) });
    return { name, rec };
  }, [proposals, baselineId, customRows, rowOrder]);

  const openComparison = useCallback((file) => {
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const ok = restoreSnapshot(JSON.parse(rd.result));
        if (ok) { setRestorable(null); setView('overview'); toast('Opened your comparison — pick up where you left off.'); }
      } catch (e) { alert('Could not read that file — is it a saved comparison (.json)?'); }
    };
    rd.readAsText(file);
  }, [restoreSnapshot]);

  const restoreFromArchive = useCallback((rec) => {
    restoreSnapshot({ proposals: rec.proposals, baselineId: rec.baselineId, customRows: rec.customRows, rowOrder: rec.rowOrder });
    setView('matrix');
    setJustSaved(null);
    toast('Restored “' + (rec.title || 'comparison') + '” — you can edit and re-save.');
  }, [restoreSnapshot]);

  const deleteArchive = useCallback((rec) => {
    setArchiveList(deleteFromArchive(rec.id));
    setArchiveItem((cur) => (cur && cur.id === rec.id ? null : cur));
  }, []);

  // Auto-save to the browser so a refresh doesn't lose work.
  useEffect(() => {
    try {
      if (proposals.length) storageSet('crs-comparison', JSON.stringify({ version: 1, savedAt: new Date().toISOString(), baselineId, proposals, customRows, rowOrder }));
    } catch (e) { /* storage unavailable / full */ }
  }, [proposals, baselineId, customRows, rowOrder]);

  const [restorable, setRestorable] = useState(null);
  useEffect(() => {
    try {
      const raw = storageGet('crs-comparison');
      if (raw) { const d = JSON.parse(raw); if (d && Array.isArray(d.proposals) && d.proposals.length) setRestorable(d); }
    } catch (e) { /* ignore */ }
  }, []);

  // Load the saved-matrix archive once on mount.
  useEffect(() => { setArchiveList(loadArchive()); }, []);

  const policyTypes = useMemo(() => [...new Set(proposals.map((p) => p.policyType).filter(Boolean))], [proposals]);
  const premiumBounds = useMemo(() => {
    const amts = proposals.map((p) => premiumTotalAmount(p)).filter((n) => n != null);
    if (!amts.length) return null;
    return { min: Math.min(...amts), max: Math.max(...amts) };
  }, [proposals]);

  const shown = useMemo(() => {
    let list = proposals.slice();
    if (policyFilter !== 'all') list = list.filter((p) => p.policyType === policyFilter);
    if (clauseKeyword.trim()) {
      const k = clauseKeyword.toLowerCase();
      list = list.filter(
        (p) => p.clausesAndWarranties.join(' ').toLowerCase().includes(k) || (p.cover || '').toLowerCase().includes(k)
      );
    }
    if (search.trim()) {
      const k = search.toLowerCase();
      list = list.filter((p) => (p.rawText || '').toLowerCase().includes(k) || JSON.stringify(p).toLowerCase().includes(k));
    }
    if (premiumMax != null) {
      list = list.filter((p) => { const a = premiumTotalAmount(p); return a == null ? true : a <= premiumMax; });
    }
    const amt = (p) => { const a = premiumTotalAmount(p); return a == null ? Infinity : a; };
    const si = (p) => { const a = primaryAmount(p.sumInsured); return a == null ? -Infinity : a; };
    if (sortKey === 'premiumAsc') list.sort((a, b) => amt(a) - amt(b));
    else if (sortKey === 'premiumDesc') list.sort((a, b) => amt(b) - amt(a));
    else if (sortKey === 'sumDesc') list.sort((a, b) => si(b) - si(a));
    else if (sortKey === 'name')
      list.sort((a, b) =>
        ((a.insurers[0] || {}).name || a.fileName).localeCompare((b.insurers[0] || {}).name || b.fileName)
      );
    return list;
  }, [proposals, policyFilter, clauseKeyword, search, premiumMax, sortKey]);

  const badgeMap = useMemo(() => {
    const map = {};
    const withPrem = shown.map((p) => ({ p, a: premiumTotalAmount(p) })).filter((x) => x.a != null);
    if (withPrem.length > 1) {
      const cheapest = withPrem.reduce((a, b) => (a.a <= b.a ? a : b));
      map[cheapest.p.id] = { ...(map[cheapest.p.id] || {}), bestPrice: true };
    }
    if (shown.length > 1) {
      const broadest = shown.reduce((a, b) => {
        const av = a.clausesAndWarranties.length + (a.cover ? a.cover.length / 200 : 0);
        const bv = b.clausesAndWarranties.length + (b.cover ? b.cover.length / 200 : 0);
        return av >= bv ? a : b;
      });
      map[broadest.id] = { ...(map[broadest.id] || {}), mostCoverage: true };
    }
    return map;
  }, [shown]);

  const builtMatrix = useMemo(
    () => buildMatrixFromProposals(shown, baselineId, customRows, rowOrder),
    [shown, baselineId, customRows, rowOrder]
  );

  // The row-key sequence currently on screen — the base to reorder/insert
  // against until the user has actually dragged something (rowOrder empty).
  const currentRowKeys = useCallback(
    () => (rowOrder.length ? rowOrder : builtMatrix.rows.map((r) => r.key)),
    [rowOrder, builtMatrix]
  );

  // Add a blank custom row — its label and every column value are free text,
  // stored the same way as any other manual edit. Pass afterKey (any row's
  // key, built-in or custom) to insert right below it instead of appending
  // to the very bottom of the whole table.
  const addCustomRow = useCallback((afterKey) => {
    const id = 'row_' + Math.random().toString(36).slice(2, 9);
    const newKey = 'custom:' + id;
    setCustomRows((prev) => [...prev, { id, label: '' }]);
    setRowOrder(() => {
      const base = currentRowKeys().slice();
      const idx = afterKey ? base.indexOf(afterKey) : -1;
      if (idx === -1) base.push(newKey);
      else base.splice(idx + 1, 0, newKey);
      return base;
    });
  }, [currentRowKeys]);

  // Drag-and-drop reordering — move the row keyed `draggedKey` to sit right
  // where `targetKey` currently is. Works across ALL rows, not just custom
  // ones, so the whole Matrix can be rearranged to taste.
  const moveRow = useCallback((draggedKey, targetKey) => {
    setRowOrder(() => {
      const base = currentRowKeys().slice();
      const from = base.indexOf(draggedKey);
      const to = base.indexOf(targetKey);
      if (from === -1 || to === -1 || from === to) return base;
      base.splice(from, 1);
      base.splice(to, 0, draggedKey);
      return base;
    });
  }, [currentRowKeys]);

  const errorFiles = files.filter((f) => f.status === 'error');
  const hasData = proposals.length > 0;
  const isArchive = view === 'archive' || view === 'archiveItem';

  const baselineSelect = (
    <label className="inline-flex items-center gap-2 text-slate-500">
      <span className="text-[12px] font-medium">Benchmark against</span>
      <select value={baselineId} onChange={(e) => setBaselineId(e.target.value)} className="field field-sm py-1">
        <option value="none">No baseline (show all values)</option>
        {shown.map((p) => (
          <option key={p.id} value={p.id}>{(p.insurers[0] && p.insurers[0].name) || p.fileName}</option>
        ))}
      </select>
    </label>
  );

  const meta = VIEW_META[isArchive ? (view === 'archiveItem' ? 'archiveItem' : 'archive') : view] || VIEW_META.overview;

  return (
    <div className="min-h-screen bg-canvas lg:pl-64">
      <Sidebar view={view} setView={setView} hasData={hasData} isArchive={isArchive} />

      <div className="w-full max-w-[104rem] mx-auto px-4 sm:px-6 xl:px-10">
        <header className="pt-6 lg:pt-9 pb-6 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="kicker text-cobalt-500">{meta.eyebrow}</div>
            <h1 className="mt-1 text-2xl sm:text-[28px] font-bold tracking-tight text-slate-900 leading-tight">{meta.title}</h1>
            <p className="text-sm text-slate-500 mt-1 max-w-2xl">{meta.subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {!isArchive && (
              <label title="Open a comparison you saved earlier (.json)" className="btn btn-secondary cursor-pointer">
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 7.2A2.2 2.2 0 0 1 5.2 5h3.6l1.8 2H18.8A2.2 2.2 0 0 1 21 9.2v7.6A2.2 2.2 0 0 1 18.8 19H5.2A2.2 2.2 0 0 1 3 16.8V7.2Z" />
                </svg>
                Open
                <input type="file" accept="application/json,.json" className="hidden"
                  onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) openComparison(f); }} />
              </label>
            )}
            {hasData && !isArchive && view !== 'proposal' && (
              <button
                onClick={() => setView('proposal')}
                title="Generate a client-ready recommendation document"
                className="btn btn-primary">
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
                </svg>
                Generate a Proposal
              </button>
            )}
          </div>
        </header>

        <main className="pb-10">
          {isArchive ? (
            view === 'archiveItem' && archiveItem ? (
              <>
                <div className="mb-4">
                  <button onClick={() => setView('archive')} className="btn btn-ghost btn-sm -ml-2.5">← Back to Archive</button>
                </div>
                <MatrixView matrix={buildMatrixFromProposals(archiveItem.proposals || [], archiveItem.baselineId || 'none', archiveItem.customRows || [], archiveItem.rowOrder || [])} />
              </>
            ) : (
              <ArchiveView
                list={archiveList}
                onView={(rec) => { setArchiveItem(rec); setView('archiveItem'); }}
                onRestore={restoreFromArchive}
                onDelete={deleteArchive}
                onReload={() => setArchiveList(loadArchive())}
              />
            )
          ) : (
            <>
              <UploadZone onFiles={addFiles} compact={hasData} />

              {!hasData && files.length === 0 && (
                <div className="-mt-1 mb-5 text-center">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer text-sm link">
                    ↩ Open a comparison you saved earlier (.json)
                    <input type="file" accept="application/json,.json" className="hidden"
                      onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) openComparison(f); }} />
                  </label>
                </div>
              )}

              {restorable && !hasData && files.length === 0 && (
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white border border-cobalt-200 shadow-card px-4 py-3 text-sm text-slate-700">
                  <span className="flex items-center gap-3">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-cobalt-50 text-cobalt-500 shrink-0" aria-hidden="true">↺</span>
                    <span>
                      You have a saved comparison — <strong>{restorable.proposals.length}</strong> proposal{restorable.proposals.length !== 1 ? 's' : ''}
                      {restorable.savedAt ? ', saved ' + new Date(restorable.savedAt).toLocaleString() : ''}.
                    </span>
                  </span>
                  <span className="flex gap-2 shrink-0">
                    <button className="btn btn-ghost btn-sm" onClick={() => setRestorable(null)}>Dismiss</button>
                    <button className="btn btn-primary btn-sm" onClick={() => { restoreSnapshot(restorable); setRestorable(null); }}>Restore</button>
                  </span>
                </div>
              )}

              <FileChips files={files} onRemove={removeFile} />

              {errorFiles.length > 0 && (
                <div className="mb-5 rounded-xl bg-poppy-50 border border-poppy-200 px-4 py-3">
                  <div className="text-sm font-semibold text-poppy-800 mb-1">Some files couldn't be read</div>
                  <ul className="text-sm text-poppy-700 list-disc list-inside space-y-0.5">
                    {errorFiles.map((f) => (
                      <li key={f.id}>{f.name} — {f.error || 'could not be parsed (it may be corrupted, password-protected, or an unsupported format).'}</li>
                    ))}
                  </ul>
                </div>
              )}

              {justSaved && (
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-teal-50 border border-teal-200 px-4 py-3 text-sm text-teal-900">
                  <span className="flex items-start gap-2.5">
                    <span className="mt-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-teal-600 text-white text-[11px] font-bold shrink-0" aria-hidden="true">✓</span>
                    <span>Saved — downloaded <strong>{justSaved.name}</strong>. Next time, use <strong>Open</strong> to pick up where you left off.{justSaved.archived && <span className="text-teal-800/70"> Also kept in this browser’s Archive.</span>}</span>
                  </span>
                  <span className="flex gap-2 shrink-0">
                    <button className="btn btn-ghost btn-sm" onClick={() => setJustSaved(null)}>Dismiss</button>
                    {justSaved.archived && <button className="btn btn-accent btn-sm" onClick={() => setView('archive')}>View in Archive</button>}
                  </span>
                </div>
              )}

              {view === 'doccontrol' ? (
                <DocumentControlView
                  proposals={shown}
                  templateMeta={templateMeta}
                  onUploadTemplate={uploadTemplate}
                  onRemoveTemplate={removeTemplate}
                />
              ) : !hasData ? (
                files.length === 0 && (
                  <div className="card px-6 py-14 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-cobalt-50 text-cobalt-500">
                      <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
                        <path d="M15 3v4h4" />
                        <path d="M8 13h7M8 16h7M8 10h3" />
                      </svg>
                    </div>
                    <div className="card-title">No proposals yet</div>
                    <p className="text-sm text-slate-500 mt-1">Upload two or more quotation slips to start comparing.</p>
                    <div className="mt-8 grid gap-3 sm:grid-cols-3 max-w-3xl mx-auto text-left">
                      {[
                        ['1', 'Upload slips', 'PDF, Excel or Word quotation slips from each insurer.'],
                        ['2', 'Review & compare', 'Overview, Best Fit ranking and an editable Matrix.'],
                        ['3', 'Recommend', 'Export the Matrix or generate a client-ready proposal.'],
                      ].map(([n, t, d]) => (
                        <div key={n} className="rounded-xl bg-slate-50 border border-slate-200/80 p-4">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white border border-slate-200 text-[12px] font-semibold text-cobalt-500 tnum">{n}</span>
                            <span className="text-sm font-semibold text-slate-800">{t}</span>
                          </div>
                          <p className="mt-1.5 text-[12px] text-slate-500 leading-relaxed">{d}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              ) : view === 'proposal' ? (
                <ProposalView proposals={shown} onBack={() => setView('overview')} />
              ) : (
                <>
                  <Controls
                    view={view}
                    sortKey={sortKey}
                    setSortKey={setSortKey}
                    policyTypes={policyTypes}
                    policyFilter={policyFilter}
                    setPolicyFilter={setPolicyFilter}
                    premiumBounds={premiumBounds}
                    premiumMax={premiumMax}
                    setPremiumMax={setPremiumMax}
                    clauseKeyword={clauseKeyword}
                    setClauseKeyword={setClauseKeyword}
                    search={search}
                    setSearch={setSearch}
                    onlyDiff={onlyDiff}
                    setOnlyDiff={setOnlyDiff}
                  />

                  {shown.length === 0 ? (
                    <div className="card text-center text-slate-500 py-12 text-sm">No proposals match the current filters.</div>
                  ) : view === 'overview' ? (
                    <Overview proposals={shown} onView={setView} />
                  ) : view === 'bestfit' ? (
                    <BestFit proposals={shown} />
                  ) : (
                    <MatrixView
                      matrix={builtMatrix}
                      controls={baselineSelect}
                      onEdit={editMatrixCell}
                      onSave={saveComparison}
                      onArchive={() => setView('archive')}
                      onAddRow={addCustomRow}
                      onRenameRow={renameCustomRow}
                      onRemoveRow={removeCustomRow}
                      onMoveRow={moveRow}
                      onRemoveEmptyRows={removeEmptyCustomRows}
                      emptyRowCount={emptyCustomRowCount}
                      onRenameInsurer={renameInsurer}
                    />
                  )}
                </>
              )}
            </>
          )}
        </main>

        <footer className="pb-8 pt-5 border-t border-slate-200/80 text-[12px] text-slate-500 leading-relaxed">
          Auto-extracted for comparison purposes. Figures are copied verbatim from each slip and may be incomplete or
          mis-read — <strong className="text-slate-700">always verify figures against the original quotation slip before making a decision.</strong>
          <span className="block mt-1 text-slate-400">
            In the matrix, ✓ means the insurer matches the proposed terms; shaded cells show a deviation. Slip figures are
            shown verbatim; analytics the app derives are labelled “computed”.
          </span>
        </footer>
      </div>
    </div>
  );
}
