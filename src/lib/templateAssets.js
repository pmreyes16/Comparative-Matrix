/**
 * TEMPLATE ASSETS — auto-detects whatever .docx files have been dropped into
 * src/assets/templates/ (see the README there). Uses Vite's import.meta.glob
 * so adding a real template later needs zero code changes: drop the file in
 * with the exact name the registry (src/data/documentControl.js) expects,
 * and it's picked up automatically.
 */
const templateLoaders = import.meta.glob('../assets/templates/*.docx', { query: '?url', import: 'default' });

const loaderByFilename = {};
for (const path in templateLoaders) {
  const filename = path.split('/').pop();
  loaderByFilename[filename] = templateLoaders[path];
}

/** True if this exact template filename has been added to the assets folder. */
export function hasTemplate(filename) {
  return !!loaderByFilename[filename];
}

/** Fetch a template's raw bytes, ready to hand to the docx fill engine. */
export async function loadTemplateArrayBuffer(filename) {
  const loader = loaderByFilename[filename];
  if (!loader) throw new Error('Template not found: ' + filename);
  const url = await loader();
  const res = await fetch(url);
  if (!res.ok) throw new Error('Could not load template file (' + res.status + ')');
  return res.arrayBuffer();
}
