/**
 * TEMPLATE STORE — persists uploaded Quotation Slip templates in IndexedDB,
 * so they survive a page refresh or browser restart (unlike the rest of this
 * app's state, which is intentionally session-only). IndexedDB is used
 * instead of localStorage because templates are binary files that can run
 * into the tens of MB across 27 lines of insurance — well past what
 * localStorage's string-only, ~5-10MB-per-origin quota comfortably holds.
 *
 * Falls back to an in-memory Map if IndexedDB is unavailable (some sandboxed
 * preview frames block it, same class of restriction storage.js works around
 * for localStorage) — uploads still work for the session, they just won't
 * survive a reload in that case. `templateStoreAvailable()` lets the UI be
 * honest about which mode is active.
 */

const DB_NAME = 'howden-doc-control';
const STORE = 'templates';
const DB_VERSION = 1;

let indexedDbOk = typeof indexedDB !== 'undefined';
const memoryFallback = new Map();

function openDB() {
  return new Promise((resolve, reject) => {
    if (!indexedDbOk) { reject(new Error('IndexedDB unavailable')); return; }
    let req;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (e) {
      reject(e);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'filename' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Could not open template storage'));
    req.onblocked = () => reject(new Error('Template storage is blocked (another tab may be using an older version)'));
  });
}

export function templateStoreAvailable() {
  return indexedDbOk;
}

function record(filename, file) {
  return {
    filename,
    blob: file,
    name: file.name,
    size: file.size,
    type: file.type,
    uploadedAt: new Date().toISOString(),
  };
}

/** Save (or overwrite) the template for one registry filename. */
export async function saveStoredTemplate(filename, file) {
  const rec = record(filename, file);
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(rec);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('Could not save template'));
    });
  } catch (e) {
    indexedDbOk = false;
    memoryFallback.set(filename, rec);
  }
  return { name: rec.name, size: rec.size, type: rec.type, uploadedAt: rec.uploadedAt };
}

/** Load one stored template's full record (including the Blob). */
export async function loadStoredTemplate(filename) {
  if (indexedDbOk) {
    try {
      const db = await openDB();
      const rec = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(filename);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error || new Error('Could not load template'));
      });
      if (rec) return rec;
    } catch (e) {
      indexedDbOk = false;
    }
  }
  return memoryFallback.get(filename) || null;
}

/** List every stored template's metadata (no Blob — cheap, for UI status). */
export async function listStoredTemplates() {
  const out = new Map();
  if (indexedDbOk) {
    try {
      const db = await openDB();
      const recs = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error || new Error('Could not list templates'));
      });
      recs.forEach((r) => out.set(r.filename, { name: r.name, size: r.size, type: r.type, uploadedAt: r.uploadedAt }));
      return out;
    } catch (e) {
      indexedDbOk = false;
    }
  }
  memoryFallback.forEach((r, filename) => out.set(filename, { name: r.name, size: r.size, type: r.type, uploadedAt: r.uploadedAt }));
  return out;
}

/** Remove a stored template, freeing that registry slot back to "not added". */
export async function deleteStoredTemplate(filename) {
  if (indexedDbOk) {
    try {
      const db = await openDB();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(filename);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error || new Error('Could not delete template'));
      });
      return;
    } catch (e) {
      indexedDbOk = false;
    }
  }
  memoryFallback.delete(filename);
}
