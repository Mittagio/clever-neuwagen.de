/**
 * Slice 17: PDF-Seiten für OCR rendern (pdfjs → Canvas/DataURL).
 * Nur bei echten Scans aufrufen; max. wenige Seiten (Datenschutz/Perf).
 */

/**
 * @param {File|Blob} file
 * @param {{ maxPages?: number, scale?: number }} [options]
 * @returns {Promise<Array<{ page: number, dataUrl: string, width: number, height: number }>>}
 */
export async function renderPdfPagesForOcr(file, options = {}) {
  const maxPages = Math.max(1, Math.min(Number(options.maxPages) || 2, 4));
  const scale = Number(options.scale) || 1.5;
  if (!file || typeof file.arrayBuffer !== 'function') {
    return [];
  }
  if (typeof document === 'undefined' || !document.createElement) {
    return [];
  }

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  if (pdfjs.GlobalWorkerOptions && !pdfjs.GlobalWorkerOptions.workerSrc) {
    try {
      const worker = await import('pdfjs-dist/legacy/build/pdf.worker.mjs?url');
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    } catch {
      // Worker optional
    }
  }

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  const pageCount = Math.min(doc.numPages || 0, maxPages);
  const pages = [];

  for (let i = 1; i <= pageCount; i += 1) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(viewport.width));
    canvas.height = Math.max(1, Math.ceil(viewport.height));
    const ctx = canvas.getContext('2d');
    if (!ctx) break;
    await page.render({ canvasContext: ctx, viewport }).promise;
    pages.push({
      page: i,
      dataUrl: canvas.toDataURL('image/png'),
      width: canvas.width,
      height: canvas.height,
    });
  }

  return pages;
}
