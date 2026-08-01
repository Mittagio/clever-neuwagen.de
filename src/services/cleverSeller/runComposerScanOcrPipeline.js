/**
 * Slice 16: Scan-OCR-Pipeline für Composer-PDFs.
 * Native PDF-Text zuerst; OCR nur bei echten Scans; Provider injizierbar.
 * Kein Fake-Text, kein Auto-Persist, kein zweiter Orchestrator.
 */
import { minimizeSensitiveOcrText } from './minimizeSensitiveOcrText.js';
import { fileNameSuggestsCustomerContract } from './prepareComposerPdfTurnInput.js';

export const OCR_PIPELINE_STATUS = {
  NATIVE_TEXT: 'native_text',
  OCR_COMPLETE: 'ocr_complete',
  OCR_UNAVAILABLE: 'ocr_unavailable',
  OCR_EMPTY: 'ocr_empty',
  OCR_FAILED: 'ocr_failed',
};

/**
 * @param {{
 *   ok?: boolean,
 *   text?: string,
 *   needsManualDescribe?: boolean,
 * }} [extracted]
 * @returns {boolean}
 */
export function isPdfScanCandidate(extracted = {}) {
  const text = String(extracted.text || '').trim();
  if (extracted.needsManualDescribe === true) return true;
  if (extracted.ok === false && text.length <= 20) return true;
  return text.length <= 20;
}

/**
 * @param {{
 *   extracted?: object,
 *   file?: object,
 *   fileName?: string,
 *   ocrProvider?: null|((ctx: object) => Promise<{ text?: string, confidence?: number, error?: string }|string>|{ text?: string, confidence?: number, error?: string }|string),
 * }} [params]
 * @returns {Promise<{
 *   status: string,
 *   usedOcr: boolean,
 *   text: string,
 *   confidence: number|null,
 *   needsManualDescribe: boolean,
 *   redacted: string[],
 *   fileName: string|null,
 *   suggestsContract: boolean,
 *   message: string,
 *   error?: string|null,
 * }>}
 */
export async function runComposerScanOcrPipeline(params = {}) {
  const extracted = params.extracted || {};
  const fileName = params.fileName
    || extracted.fileName
    || params.file?.name
    || null;
  const nativeText = String(extracted.text || '').trim();
  const suggestsContract = fileNameSuggestsCustomerContract(fileName || '')
    || /\b(vertrag|leasing|finanzierung)\b/i.test(nativeText);

  if (!isPdfScanCandidate(extracted)) {
    return {
      status: OCR_PIPELINE_STATUS.NATIVE_TEXT,
      usedOcr: false,
      text: nativeText,
      confidence: null,
      needsManualDescribe: false,
      redacted: [],
      fileName,
      suggestsContract,
      message: 'Nativer PDF-Text vorhanden – kein OCR nötig.',
      error: null,
    };
  }

  const provider = params.ocrProvider;
  if (typeof provider !== 'function') {
    return {
      status: OCR_PIPELINE_STATUS.OCR_UNAVAILABLE,
      usedOcr: false,
      text: '',
      confidence: null,
      needsManualDescribe: true,
      redacted: [],
      fileName,
      suggestsContract,
      message: suggestsContract
        ? 'Vertrags-Scan ohne Textschicht – OCR nicht angebunden. Bitte Vertrag manuell beschreiben oder Text einfügen.'
        : 'Scan ohne Textschicht – OCR nicht angebunden. Bitte Inhalt manuell beschreiben.',
      error: null,
    };
  }

  try {
    const raw = await provider({
      file: params.file || null,
      extracted,
      fileName,
    });
    const payload = typeof raw === 'string' ? { text: raw } : (raw || {});
    if (payload.error) {
      const engineMissing = /ocr_engine_not_configured/i.test(String(payload.error));
      return {
        status: OCR_PIPELINE_STATUS.OCR_FAILED,
        usedOcr: true,
        text: '',
        confidence: null,
        needsManualDescribe: true,
        redacted: [],
        fileName,
        suggestsContract,
        message: engineMissing
          ? 'OCR-Engine nicht konfiguriert (tesseract.js / Flag). Bitte Vertrag manuell beschreiben.'
          : 'OCR fehlgeschlagen – bitte Vertrag manuell beschreiben.',
        error: String(payload.error),
      };
    }
    const minimized = minimizeSensitiveOcrText(payload.text || '');
    if (minimized.text.length <= 20) {
      return {
        status: OCR_PIPELINE_STATUS.OCR_EMPTY,
        usedOcr: true,
        text: minimized.text,
        confidence: payload.confidence ?? null,
        needsManualDescribe: true,
        redacted: minimized.redacted,
        fileName,
        suggestsContract,
        message: 'OCR lieferte keinen brauchbaren Text – bitte manuell beschreiben.',
        error: null,
      };
    }
    return {
      status: OCR_PIPELINE_STATUS.OCR_COMPLETE,
      usedOcr: true,
      text: minimized.text,
      confidence: payload.confidence ?? null,
      needsManualDescribe: false,
      redacted: minimized.redacted,
      fileName,
      suggestsContract,
      message: 'Scan per OCR gelesen – bitte prüfen.',
      error: null,
    };
  } catch (err) {
    return {
      status: OCR_PIPELINE_STATUS.OCR_FAILED,
      usedOcr: true,
      text: '',
      confidence: null,
      needsManualDescribe: true,
      redacted: [],
      fileName,
      suggestsContract,
      message: 'OCR fehlgeschlagen – bitte Vertrag manuell beschreiben.',
      error: err?.message || 'ocr_provider_failed',
    };
  }
}

/**
 * Merged native Extract + OCR-Pipeline zu einem Extracted-Objekt für prepareComposerPdfTurnInput.
 * @param {object} extracted
 * @param {object} ocrPass
 */
export function mergeExtractedWithOcrPass(extracted = {}, ocrPass = {}) {
  if (ocrPass.status === OCR_PIPELINE_STATUS.OCR_COMPLETE && ocrPass.text) {
    return {
      ...extracted,
      ok: true,
      text: ocrPass.text,
      needsManualDescribe: false,
      extractionMethod: 'ocr',
      sourceTypeHint: 'contract_pdf_ocr',
      ocr: ocrPass,
    };
  }
  return {
    ...extracted,
    extractionMethod: isPdfScanCandidate(extracted) ? 'scan_pending' : 'native_pdf_text',
    ocr: ocrPass,
  };
}
