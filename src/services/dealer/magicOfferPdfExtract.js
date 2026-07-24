/**
 * PDF-Text für Magic Offer – natives PDF lesen, kein OCR-Stack.
 * Scan ohne Text → leerer Text + needsManualDescribe.
 */

/**
 * @param {File|Blob} file
 * @returns {Promise<{
 *   ok: boolean,
 *   text: string,
 *   pageCount: number,
 *   needsManualDescribe: boolean,
 *   fileName: string,
 *   sizeBytes: number,
 *   dataUrl: string|null,
 *   error?: string,
 * }>}
 */
export async function extractMagicOfferPdf(file) {
  const fileName = file?.name ?? 'angebot.pdf';
  const sizeBytes = file?.size ?? 0;
  const dataUrl = await readFileAsDataUrl(file);

  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    if (pdfjs.GlobalWorkerOptions && !pdfjs.GlobalWorkerOptions.workerSrc) {
      try {
        const worker = await import('pdfjs-dist/legacy/build/pdf.worker.mjs?url');
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      } catch {
        // Worker optional – getDocument kann ohne Worker laufen
      }
    }

    const data = new Uint8Array(await file.arrayBuffer());
    const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
    const pageCount = doc.numPages ?? 0;
    const chunks = [];
    for (let i = 1; i <= pageCount; i += 1) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const line = (content.items ?? [])
        .map((item) => item?.str ?? '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (line) chunks.push(line);
    }

    const text = chunks.join('\n').trim();
    return {
      ok: text.length > 20,
      text,
      pageCount,
      needsManualDescribe: text.length <= 20,
      fileName,
      sizeBytes,
      dataUrl,
    };
  } catch (err) {
    return {
      ok: false,
      text: '',
      pageCount: 0,
      needsManualDescribe: true,
      fileName,
      sizeBytes,
      dataUrl,
      error: err?.message ?? 'pdf_extract_failed',
    };
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
