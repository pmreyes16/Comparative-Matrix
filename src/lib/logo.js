/**
 * LOGO fallbacks — when no image could be extracted from the slip (or assigned
 * manually), an insurer is shown as an initials badge in a stable colour.
 */

export function initials(name) {
  if (!name) return '?';
  const words = String(name).replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

const PALETTE = [
  'bg-cobalt-600',
  'bg-teal-600',
  'bg-rosegold-600',
  'bg-poppy-600',
  'bg-cobalt-800',
  'bg-teal-800',
];

/** Deterministic Tailwind background class for a given insurer name. */
export function colorFor(name) {
  const idx = String(name || '')
    .split('')
    .reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length;
  return PALETTE[idx];
}
