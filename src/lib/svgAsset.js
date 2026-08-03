/**
 * SVG ASSET HELPERS — shared by the Matrix and Proposal PDF/HTML exporters,
 * both of which need to embed the Howden logo (an imported .svg → URL).
 */

/** Fetch an imported SVG asset's raw markup, for inline HTML embedding. */
export async function fetchSvgMarkup(url) {
  const res = await fetch(url);
  return res.text();
}

/**
 * Rasterize an SVG asset to a PNG data URL (upscaled for crisp print
 * resolution) — jsPDF can't embed SVGs directly, only raster images. Returns
 * null if rasterization fails for any reason, so callers can fall back
 * gracefully (e.g. to a text wordmark).
 */
export async function svgUrlToPng(url, scale = 4) {
  const svgText = await fetchSvgMarkup(url);
  const blobUrl = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml' }));
  try {
    const img = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error('logo failed to load'));
      im.src = blobUrl;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth * scale;
    canvas.height = img.naturalHeight * scale;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return { dataUrl: canvas.toDataURL('image/png'), aspect: img.naturalWidth / img.naturalHeight };
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}
