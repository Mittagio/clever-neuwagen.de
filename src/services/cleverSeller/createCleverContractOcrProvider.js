/**
 * Slice 17/19: Clever Contract OCR Provider (Produkt-Engine-Anbindung).
 * Rendert Scan-Seiten und erkennt Text über injizierbare Engine (Tesseract / Cloud-Hook).
 * Kein Fake-Text, keine Persistenz ohne Confirm.
 */
import { renderPdfPagesForOcr } from './renderPdfPagesForOcr.js';

/**
 * @param {{
 *   engine?: null|{
 *     id?: string,
 *     recognize: (page: { dataUrl: string, page: number }) => Promise<{ text?: string, confidence?: number }|string>,
 *   },
 *   renderPages?: typeof renderPdfPagesForOcr,
 *   maxPages?: number,
 *   scale?: number,
 * }} [options]
 * @returns {(ctx: object) => Promise<{ text: string, confidence: number|null, pageCount?: number, engine?: string, error?: string }>}
 */
export function createCleverContractOcrProvider(options = {}) {
  const engine = options.engine || null;
  const renderPages = options.renderPages || renderPdfPagesForOcr;
  const maxPages = options.maxPages ?? 2;
  const scale = options.scale ?? 1.5;

  return async function cleverContractOcrProvider(ctx = {}) {
    if (!engine || typeof engine.recognize !== 'function') {
      return {
        text: '',
        confidence: null,
        error: engine?.error || 'ocr_engine_not_configured',
      };
    }

    const file = ctx.file || null;
    if (!file) {
      return {
        text: '',
        confidence: null,
        error: 'missing_pdf_file',
      };
    }

    let pages = [];
    try {
      pages = await renderPages(file, { maxPages, scale });
    } catch (err) {
      return {
        text: '',
        confidence: null,
        error: err?.message || 'pdf_render_failed',
      };
    }

    if (!pages.length) {
      return {
        text: '',
        confidence: null,
        error: 'no_ocr_pages',
      };
    }

    const parts = [];
    let confSum = 0;
    let confCount = 0;
    try {
      for (const page of pages) {
        const raw = await engine.recognize(page);
        const payload = typeof raw === 'string' ? { text: raw } : (raw || {});
        const text = String(payload.text || '').trim();
        if (text) parts.push(text);
        if (payload.confidence != null && Number.isFinite(Number(payload.confidence))) {
          confSum += Number(payload.confidence);
          confCount += 1;
        }
      }
    } catch (err) {
      return {
        text: '',
        confidence: null,
        error: err?.message || 'ocr_recognize_failed',
      };
    }

    return {
      text: parts.join('\n\n').trim(),
      confidence: confCount ? confSum / confCount : null,
      pageCount: pages.length,
      engine: engine.id || 'custom',
    };
  };
}

/**
 * Marker-Engine wenn Cloud gewählt, aber kein Provider injiziert wurde.
 * Ohne recognize → Provider liefert kontrollierten Fehler (kein Fake-Text).
 * @returns {{ id: string, error: string }}
 */
export function createCloudOcrEnginePlaceholder() {
  return {
    id: 'cloud',
    error: 'ocr_cloud_provider_not_configured',
  };
}

/**
 * Tesseract.js laden (Slice 19: Dependency vorhanden; createWorker injizierbar für Tests).
 * @param {{
 *   lang?: string,
 *   createWorker?: Function,
 *   importTesseract?: () => Promise<object>,
 * }} [options]
 * @returns {Promise<object|null>}
 */
export async function tryCreateTesseractOcrEngine(options = {}) {
  const lang = options.lang || 'deu';
  try {
    let createWorker = options.createWorker;
    if (typeof createWorker !== 'function') {
      const importer = options.importTesseract
        || (() => import('tesseract.js'));
      const mod = await importer();
      createWorker = mod.createWorker || mod.default?.createWorker;
    }
    if (typeof createWorker !== 'function') return null;
    let workerPromise = null;
    const getWorker = () => {
      if (!workerPromise) {
        workerPromise = (async () => {
          const worker = await createWorker(lang);
          return worker;
        })();
      }
      return workerPromise;
    };
    return {
      id: 'tesseract.js',
      async recognize(page) {
        const worker = await getWorker();
        const result = await worker.recognize(page.dataUrl);
        const text = result?.data?.text || '';
        const confidence = result?.data?.confidence != null
          ? Number(result.data.confidence) / 100
          : null;
        return { text, confidence };
      },
      async terminate() {
        if (!workerPromise) return;
        const worker = await workerPromise;
        await worker.terminate?.();
        workerPromise = null;
      },
    };
  } catch {
    return null;
  }
}
