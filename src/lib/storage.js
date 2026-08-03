/**
 * Safe storage wrapper.
 *
 * Some environments — sandboxed file previews, or iframes embedded without the
 * `allow-same-origin` flag — throw a SecurityError on ANY access to
 * `window.localStorage` (even reading the property). That would crash Save /
 * Archive with "Failed to read the 'localStorage' property from 'Window'".
 *
 * We probe once at load. If localStorage is usable we pass through to it; if
 * not, we transparently fall back to an in-memory store for the session, so the
 * app never errors. Data saved in the fallback simply doesn't survive a reload.
 *
 * `available` lets the UI tell the user when saves are session-only.
 */

let ok = false;
const mem = {};

try {
  const t = '__cmp_test__';
  window.localStorage.setItem(t, '1');
  window.localStorage.removeItem(t);
  ok = true;
} catch (e) {
  ok = false;
}

export const storageAvailable = ok;

export function storageGet(key) {
  if (ok) {
    try { return window.localStorage.getItem(key); } catch (e) { /* fall through */ }
  }
  return Object.prototype.hasOwnProperty.call(mem, key) ? mem[key] : null;
}

export function storageSet(key, val) {
  if (ok) {
    try { window.localStorage.setItem(key, val); return; } catch (e) { /* fall through */ }
  }
  mem[key] = String(val);
}

export function storageRemove(key) {
  if (ok) {
    try { window.localStorage.removeItem(key); return; } catch (e) { /* fall through */ }
  }
  delete mem[key];
}
