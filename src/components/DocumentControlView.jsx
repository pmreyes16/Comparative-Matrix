import React, { useMemo, useRef, useState } from 'react';
import { DOCUMENT_CONTROL, suggestTemplate } from '../data/documentControl.js';
import { isTemplateReady, templateSource, generateFromTemplate, actualExtFor, SUPPORTED_UPLOAD_EXT, extOf } from '../lib/templateFill.js';
import { templateStoreAvailable } from '../lib/templateStore.js';
import { buildTemplateData } from '../lib/docxFill.js';
import { buildRecommendationTemplateData } from '../lib/proposal.js';
import { toast, triggerDownload } from '../lib/exportMatrix.js';

const nameOf = (p) => (p.insurers[0] && p.insurers[0].name) || p.fileName;
const ACCEPT = SUPPORTED_UPLOAD_EXT.map((e) => '.' + e).join(',');
const RECOMMENDATION = '__recommendation__';

function outputFilename(row, who, ext) {
  const base = row.file.replace(/\.[a-z0-9]+$/i, '');
  const safeWho = String(who || '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return base + (safeWho ? '_' + safeWho : '') + '.' + ext;
}

function formatSize(bytes) {
  if (bytes == null) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatUploadedAt(iso) {
  try { return new Date(iso).toLocaleString(); } catch (e) { return ''; }
}

/**
 * Document Control register: the firm's standard Quotation Slip templates,
 * one per line of insurance. A dropdown keeps this to one line's worth of
 * screen instead of a 27-row table — pick a line, upload/replace/remove its
 * template (saved permanently in this browser via IndexedDB), pick which
 * uploaded proposal to pull data from, generate.
 */
export default function DocumentControlView({ proposals, templateMeta, onUploadTemplate, onRemoveTemplate }) {
  const list = proposals || [];
  const [selectedFile, setSelectedFile] = useState(DOCUMENT_CONTROL[0].file);
  const [proposalId, setProposalId] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkUnmatched, setBulkUnmatched] = useState([]);
  const bulkDropRef = useRef();

  const row = useMemo(() => DOCUMENT_CONTROL.find((r) => r.file === selectedFile) || DOCUMENT_CONTROL[0], [selectedFile]);
  const ready = isTemplateReady(row.file, templateMeta);
  const source = templateSource(row.file, templateMeta);
  const meta = templateMeta instanceof Map ? templateMeta.get(row.file) : templateMeta && templateMeta[row.file];
  const readyRows = useMemo(() => DOCUMENT_CONTROL.filter((r) => isTemplateReady(r.file, templateMeta)), [templateMeta]);
  const readyCount = readyRows.length;
  const persistent = templateStoreAvailable();

  const suggestions = useMemo(() => {
    return list.filter((p) => {
      const m = suggestTemplate(p.policyType);
      return m && m.file === row.file;
    });
  }, [list, row.file]);

  const handleUpload = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const ext = extOf(f.name);
    if (!SUPPORTED_UPLOAD_EXT.includes(ext)) {
      toast('That file type isn’t supported — use .docx, .xlsx or .pdf.');
      return;
    }
    setBusy(true);
    try {
      await onUploadTemplate(row.file, f);
      toast(
        (persistent ? 'Saved “' : 'Attached “') + f.name + '” to ' + row.title +
        (persistent ? '” — stored in this browser, ready anytime.' : '” for this session only (this preview can’t save permanently).')
      );
    } catch (e) {
      toast('Sorry — could not save that file: ' + (e && e.message ? e.message : e));
    } finally {
      setBusy(false);
    }
  };

  /**
   * Bulk upload: pick or drop MANY files at once — each is matched to its
   * line of insurance by exact filename against the registry (the same
   * `file` column shown next to "Accepts .docx…" below), and saved
   * independently. This is the fast path for attaching a whole batch of
   * templates in one go instead of selecting a line at a time.
   */
  const handleBulkFiles = async (fileList) => {
    const files = [...(fileList || [])];
    if (!files.length) return;
    setBulkBusy(true);
    let savedCount = 0;
    const unmatched = [];
    for (const f of files) {
      const match = DOCUMENT_CONTROL.find((r) => r.file.toLowerCase() === f.name.toLowerCase());
      if (!match) {
        unmatched.push(f.name);
        continue;
      }
      const ext = extOf(f.name);
      if (!SUPPORTED_UPLOAD_EXT.includes(ext)) {
        unmatched.push(f.name + ' (unsupported file type)');
        continue;
      }
      try {
        await onUploadTemplate(match.file, f);
        savedCount += 1;
      } catch (e) {
        unmatched.push(f.name + ' (save failed)');
      }
    }
    setBulkBusy(false);
    setBulkUnmatched(unmatched);
    if (savedCount > 0) {
      toast(
        'Saved ' + savedCount + ' template' + (savedCount !== 1 ? 's' : '') + '.' +
        (unmatched.length ? ' ' + unmatched.length + ' file' + (unmatched.length !== 1 ? 's' : '') + ' didn’t match — see below.' : '')
      );
    } else {
      toast('None of those files matched a known line of insurance filename.');
    }
  };

  const handleRemove = async () => {
    setBusy(true);
    try {
      await onRemoveTemplate(row.file);
      toast('Removed the template for ' + row.title + '.');
    } finally {
      setBusy(false);
      setConfirmRemove(false);
    }
  };

  const generate = async () => {
    let data, who;
    if (proposalId === RECOMMENDATION) {
      if (!list.length) return;
      data = buildRecommendationTemplateData(list);
      who = 'Recommendation';
    } else {
      const proposal = list.find((p) => p.id === proposalId);
      if (!proposal) return;
      data = buildTemplateData(proposal);
      who = nameOf(proposal);
    }
    setBusy(true);
    try {
      const ext = actualExtFor(row.file, templateMeta);
      const { blob, note } = await generateFromTemplate(row.file, data, templateMeta);
      const filename = outputFilename(row, who, ext);
      triggerDownload(filename, blob, true);
      toast(note || 'Downloaded “' + filename + '”.');
    } catch (e) {
      toast('Sorry — ' + (e && e.message ? e.message : 'could not generate this document.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200/80 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="kicker text-cobalt-500">Document Control</div>
          <div className="text-lg font-bold leading-tight mt-0.5 text-slate-900">Quotation Slip templates</div>
          <div className="text-sm text-slate-500">{readyCount} of {DOCUMENT_CONTROL.length} templates ready</div>
        </div>
        <div className="w-48 bar-track h-2 flex-none" aria-hidden="true">
          <div className="h-2 rounded-full bg-teal-500 transition-[width] duration-300" style={{ width: (readyCount / DOCUMENT_CONTROL.length) * 100 + '%' }} />
        </div>
      </div>

      {!persistent && (
        <div className="px-5 py-2.5 bg-rosegold-50 border-b border-rosegold-200 text-[12px] font-medium text-rosegold-800">
          This preview can’t save permanently — uploaded templates will be lost on refresh.
        </div>
      )}

      <div className="p-5 space-y-5">
        <div
          ref={bulkDropRef}
          onDragOver={(e) => { e.preventDefault(); bulkDropRef.current.classList.add('border-cobalt-400', 'bg-cobalt-50/60'); }}
          onDragLeave={() => bulkDropRef.current.classList.remove('border-cobalt-400', 'bg-cobalt-50/60')}
          onDrop={(e) => {
            e.preventDefault();
            bulkDropRef.current.classList.remove('border-cobalt-400', 'bg-cobalt-50/60');
            if (e.dataTransfer.files) handleBulkFiles(e.dataTransfer.files);
          }}
          className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/50 px-5 py-6 text-center transition-colors"
        >
          <p className="text-slate-700 text-sm font-medium">
            Drag &amp; drop multiple templates here to save them all at once, or
          </p>
          <label className="btn btn-primary mt-3 cursor-pointer">
            {bulkBusy ? 'Saving…' : 'Choose files'}
            <input
              type="file"
              multiple
              accept={ACCEPT}
              className="hidden"
              disabled={bulkBusy}
              onChange={(e) => { handleBulkFiles(e.target.files); e.target.value = ''; }}
            />
          </label>
          <p className="mt-3 hint">
            Each file is matched to its line of insurance by its exact filename (e.g. “{DOCUMENT_CONTROL[0].file}”) — see
            src/data/documentControl.js for every expected name.
          </p>
          {bulkUnmatched.length > 0 && (
            <div className="mt-3 text-left text-[12px] text-poppy-700 bg-poppy-50 border border-poppy-200 rounded-xl p-3">
              <div className="font-medium mb-1">Didn’t match a known line of insurance:</div>
              <ul className="list-disc list-inside">
                {bulkUnmatched.map((name, i) => <li key={i}>{name}</li>)}
              </ul>
            </div>
          )}
        </div>

        {/* At-a-glance list of everything already saved — with 27 lines
            collapsed into one dropdown, there's otherwise no way to see
            which ones you've uploaded without clicking through all 27. */}
        {readyRows.length > 0 && (
          <div>
            <span className="field-label">
              Ready templates ({readyRows.length})
            </span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {readyRows.map((r) => (
                <button
                  key={r.file}
                  onClick={() => { setSelectedFile(r.file); setConfirmRemove(false); }}
                  title={r.file}
                  className={
                    'inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12px] font-medium ring-1 ring-inset transition-colors ' +
                    (r.file === selectedFile
                      ? 'bg-teal-600 text-white ring-teal-600 shadow-sm'
                      : 'bg-teal-50 text-teal-700 ring-teal-200 hover:bg-teal-100')
                  }
                >
                  {r.title.replace(/^QUOTATION SLIP - /, '')}
                </button>
              ))}
            </div>
          </div>
        )}

        <label className="block">
          <span className="field-label">Line of insurance</span>
          <select
            value={selectedFile}
            onChange={(e) => { setSelectedFile(e.target.value); setConfirmRemove(false); }}
            className="field mt-1.5 w-full"
          >
            {DOCUMENT_CONTROL.map((r) => (
              <option key={r.file} value={r.file}>
                {r.title}{isTemplateReady(r.file, templateMeta) ? '' : ' (no template yet)'}
              </option>
            ))}
          </select>
        </label>

        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-5">
          <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 text-sm">
            <div><span className="text-slate-400">Purpose:</span> <span className="text-slate-700">{row.purpose}</span></div>
            <div><span className="text-slate-400">Owner/Issuer:</span> <span className="text-slate-700">{row.owner}</span></div>
            <div><span className="text-slate-400">Control No.:</span> <span className="font-mono text-[12px] text-slate-700">{row.controlNo}</span></div>
            <div><span className="text-slate-400">Classification:</span> <span className="text-slate-700">{row.classification}</span></div>
          </div>

          {suggestions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {suggestions.map((p) => (
                <span key={p.id} className="pill bg-cobalt-50 text-cobalt-700 ring-cobalt-200">
                  Suggested for {nameOf(p)}
                </span>
              ))}
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-slate-200">
            <div className="flex flex-wrap items-center gap-3">
              {ready ? (
                <span className="pill bg-teal-50 text-teal-800 ring-teal-200 py-1 text-[12px]">
                  Ready{source === 'uploaded' ? (persistent ? ' — saved' : ' — this session') : ' — built in'}
                </span>
              ) : (
                <span className="pill bg-white text-slate-500 ring-slate-200 py-1 text-[12px]">
                  Not added yet
                </span>
              )}
              <label className="btn btn-secondary btn-sm cursor-pointer">
                {ready ? 'Replace template…' : 'Upload template…'}
                <input type="file" accept={ACCEPT} className="hidden" onChange={handleUpload} disabled={busy} />
              </label>
              {source === 'uploaded' && (
                confirmRemove ? (
                  <span className="inline-flex items-center gap-2 text-[12px]">
                    <span className="text-slate-500">Remove this template?</span>
                    <button onClick={handleRemove} disabled={busy} className="btn btn-danger btn-sm">Yes, remove</button>
                    <button onClick={() => setConfirmRemove(false)} className="btn btn-ghost btn-sm">Cancel</button>
                  </span>
                ) : (
                  <button onClick={() => setConfirmRemove(true)} disabled={busy} className="btn btn-danger-soft btn-sm">
                    Remove
                  </button>
                )
              )}
              <span className="hint">Accepts .docx, .xlsx or .pdf ({row.file})</span>
            </div>
            {meta && (
              <div className="mt-2 hint">
                {meta.name} · {formatSize(meta.size)} · uploaded {formatUploadedAt(meta.uploadedAt)}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <select
            value={proposalId}
            onChange={(e) => setProposalId(e.target.value)}
            disabled={!ready || !list.length}
            className="field min-w-[260px]"
          >
            <option value="">{list.length ? 'Fill with…' : 'Upload proposals first'}</option>
            {list.length > 0 && (
              <option value={RECOMMENDATION}>★ Generated Proposal (recommendation summary)</option>
            )}
            {list.map((p) => (
              <option key={p.id} value={p.id}>{nameOf(p)}</option>
            ))}
          </select>
          <button
            onClick={generate}
            disabled={!ready || !proposalId || busy}
            className="btn btn-primary"
          >
            {busy ? 'Working…' : 'Generate'}
          </button>
        </div>
      </div>
    </div>
  );
}
