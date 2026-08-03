/**
 * TEMPLATE FILL — the single entry point DocumentControlView uses to check
 * readiness and generate a filled document, regardless of whether the
 * template came pre-bundled (src/assets/templates/) or was uploaded and
 * persisted in IndexedDB (see templateStore.js).
 *
 * `templateMeta` here is the lightweight metadata map — { [filename]: {name,
 * size, type, uploadedAt} } — kept in React state and hydrated from the
 * store on load, so readiness checks stay synchronous for rendering. The
 * actual file bytes are only fetched from the store when generating.
 */
import { fillDocxTemplate } from './docxFill.js';
import { fillXlsxTemplate } from './xlsxFill.js';
import { hasTemplate as hasBundledTemplate, loadTemplateArrayBuffer as loadBundledTemplateArrayBuffer } from './templateAssets.js';
import { loadStoredTemplate } from './templateStore.js';

export const SUPPORTED_UPLOAD_EXT = ['docx', 'xlsx', 'pdf', 'doc', 'xls'];
export const FILLABLE_EXT = ['docx', 'xlsx']; // formats this app can actually auto-fill

export function extOf(filename) {
  const m = /\.([a-z0-9]+)$/i.exec(filename || '');
  return m ? m[1].toLowerCase() : '';
}

function metaFor(filename, templateMeta) {
  return templateMeta instanceof Map ? templateMeta.get(filename) : templateMeta && templateMeta[filename];
}

/** True once a template for this filename exists — bundled or uploaded. */
export function isTemplateReady(filename, templateMeta) {
  return hasBundledTemplate(filename) || !!metaFor(filename, templateMeta);
}

/** Where this row's template is coming from, for the UI's status text. */
export function templateSource(filename, templateMeta) {
  if (metaFor(filename, templateMeta)) return 'uploaded';
  if (hasBundledTemplate(filename)) return 'bundled';
  return null;
}

/**
 * The registry's `filename` is a lookup key, not a format guarantee — an
 * uploaded file can be a different type than the registry's nominal name
 * suggests (e.g. a .pdf dropped into a slot named "…EAR-2026.docx"). Format
 * is always taken from the ACTUAL file in play: the uploaded file's own
 * name, or the registry filename only when loading a bundled asset (which
 * is guaranteed to match, since it's fetched from that literal path).
 */
export function actualExtFor(filename, templateMeta) {
  const meta = metaFor(filename, templateMeta);
  return extOf(meta ? meta.name : filename);
}

async function loadTemplateBytes(filename, templateMeta) {
  if (metaFor(filename, templateMeta)) {
    const rec = await loadStoredTemplate(filename);
    if (!rec) throw new Error('That template was expected to be saved but could not be found — try re-uploading it.');
    return rec.blob.arrayBuffer();
  }
  return loadBundledTemplateArrayBuffer(filename);
}

/**
 * Generate a filled document for one registry row. `data` is a flat
 * {tagName: value} object — build it with docxFill.js's buildTemplateData
 * for one insurer's raw slip data, or proposal.js's
 * buildRecommendationTemplateData for the Generated Proposal's
 * recommendation across every compared proposal; the caller decides which.
 * Returns { blob, note } — `note` is set for formats this app can't
 * auto-fill (currently PDF: no general AcroForm-filling support), so the
 * caller can tell the user honestly instead of silently handing back an
 * unfilled file with no explanation.
 */
export async function generateFromTemplate(filename, data, templateMeta) {
  const ext = actualExtFor(filename, templateMeta);
  const buf = await loadTemplateBytes(filename, templateMeta);

  if (ext === 'docx') return { blob: fillDocxTemplate(buf, data), note: null };
  if (ext === 'xlsx') return { blob: fillXlsxTemplate(buf, data), note: null };
  if (ext === 'pdf') {
    return {
      blob: new Blob([buf], { type: 'application/pdf' }),
      note: 'PDF templates can’t be auto-filled yet — downloaded as uploaded, unchanged.',
    };
  }
  if (ext === 'doc' || ext === 'xls') {
    throw new Error('Legacy .' + ext + ' files can’t be filled in-browser — re-save the template as .' + (ext === 'doc' ? 'docx' : 'xlsx') + '.');
  }
  throw new Error('Unsupported template format: .' + ext);
}
