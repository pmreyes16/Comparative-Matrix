/**
 * Archive of saved comparative matrices, persisted in the browser's
 * localStorage (there is no backend). Each record stores the full `proposals`
 * snapshot taken at save time, so the matrix can be rebuilt EXACTLY for
 * viewing, exporting, or restoring — no stale cache, no drift.
 *
 * localStorage key: `archived_matrices` → array of records (newest first).
 */

import { storageGet, storageSet } from './storage.js';

const KEY = 'archived_matrices';

// Timestamp + random — unique enough for a single browser, no crypto dependency.
function rid() {
  return 'arc_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

export function loadArchive() {
  try {
    const raw = storageGet(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

// Persists via safe storage — falls back to an in-memory store when the browser
// blocks localStorage (sandboxed preview), so this never throws.
function persist(list) {
  storageSet(KEY, JSON.stringify(list));
}

export function buildArchiveRecord(proposals, baselineId, customRows, meta) {
  const p0 = (proposals && proposals[0]) || {};
  const clientName =
    (p0.insured || '').trim() ||
    (meta && meta.title) ||
    'Untitled comparison';
  const policyType =
    (p0.policyType || '').trim() ||
    (proposals || []).map((p) => p.policyType).filter(Boolean)[0] ||
    '';
  const title = policyType ? clientName + ' — ' + policyType : clientName;
  const nowIso = new Date().toISOString();
  return {
    id: rid(),
    title,
    client_name: clientName,
    policy_type: policyType,
    created_at: nowIso,
    saved_at: nowIso,
    saved_by: (meta && meta.saved_by) || 'You',
    baselineId: baselineId || 'none',
    proposals: JSON.parse(JSON.stringify(proposals || [])), // deep-copied snapshot
    customRows: JSON.parse(JSON.stringify(customRows || [])),
  };
}

// Save a NEW archive record (prepended → newest first). Returns the record.
export function saveMatrixToArchive(proposals, baselineId, customRows, meta) {
  if (!proposals || !proposals.length) {
    throw new Error('Nothing to save yet — upload some slips first.');
  }
  const rec = buildArchiveRecord(proposals, baselineId, customRows, meta);
  const list = loadArchive();
  list.unshift(rec);
  persist(list);
  return rec;
}

// Remove one record by id; returns the updated list.
export function deleteFromArchive(id) {
  const list = loadArchive().filter((r) => r.id !== id);
  persist(list);
  return list;
}

// Distinct policy types across the archive (for the filter dropdown).
export function archivePolicyTypes(list) {
  return [...new Set((list || []).map((r) => r.policy_type).filter(Boolean))];
}

/* ---- Durable, sandbox-proof archive backup: export/import to a JSON file -----
   Browser storage is blocked in sandboxed previews, so this lets the user keep
   the whole archive as a file that survives closing, moving machines, or sharing
   with a colleague — and restore it anywhere. */
const ARCHIVE_FILE_VERSION = 1;

// Build the backup payload (records + metadata) for the current archive.
export function buildArchiveBackup() {
  const records = loadArchive();
  return {
    app: 'howden-comparator',
    kind: 'archive-backup',
    version: ARCHIVE_FILE_VERSION,
    exported_at: new Date().toISOString(),
    count: records.length,
    records,
  };
}

// Merge ('merge', default — dedup by id) or overwrite ('replace') the archive
// from a backup file's text. Returns { list, added }.
export function importArchive(text, mode = 'merge') {
  let data;
  try { data = JSON.parse(text); } catch (e) { throw new Error('That file isn’t a valid archive backup.'); }
  const incoming = Array.isArray(data) ? data : (data && Array.isArray(data.records) ? data.records : null);
  if (!incoming) throw new Error('That file isn’t a valid archive backup.');
  const clean = incoming.filter((r) => r && r.id && Array.isArray(r.proposals));
  if (!clean.length) throw new Error('No saved comparisons found in that file.');
  let list, added;
  if (mode === 'replace') {
    list = clean.slice();
    added = clean.length;
  } else {
    const existing = loadArchive();
    const seen = new Set(existing.map((r) => r.id));
    const fresh = clean.filter((r) => !seen.has(r.id));
    added = fresh.length;
    list = fresh.concat(existing);
  }
  list.sort((a, b) => String(b.saved_at || '').localeCompare(String(a.saved_at || '')));
  persist(list);
  return { list, added };
}

/* ---- Single comparison as a file: Save downloads it, Open re-loads it --------
   The durable "Save" for sandboxed use — the whole working comparison
   (proposals + baseline + every manual edit) is written to a .json file the user
   keeps and re-opens later to continue exactly where they left off. */
const COMPARISON_FILE_VERSION = 1;

export function comparisonFilename(proposals) {
  const p0 = (proposals && proposals[0]) || {};
  const slug = (s) => (s || '').trim().replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-').replace(/^-+|-+$/g, '');
  const client = slug(p0.insured) || 'comparison';
  const policy = slug(p0.policyType);
  const stamp = new Date().toISOString().slice(0, 10);
  return [client, policy, stamp].filter(Boolean).join('-') + '.comparison.json';
}

export function buildComparisonPayload(proposals, baselineId, customRows) {
  const p0 = (proposals && proposals[0]) || {};
  return {
    app: 'howden-comparator',
    kind: 'comparison',
    version: COMPARISON_FILE_VERSION,
    saved_at: new Date().toISOString(),
    client_name: (p0.insured || '').trim(),
    policy_type: (p0.policyType || '').trim(),
    baselineId: baselineId || 'none',
    proposals: JSON.parse(JSON.stringify(proposals || [])),
    customRows: JSON.parse(JSON.stringify(customRows || [])),
  };
}
