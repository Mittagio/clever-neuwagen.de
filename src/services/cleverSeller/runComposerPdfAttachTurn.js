/**
 * Slice 13/16: Global-/Akte-Composer – PDF-Attach → optional OCR → Turn.
 * Extraktion/OCR bleiben async außerhalb des sync Orchestrators.
 */
import { runCleverSellerTurn } from './runCleverSellerTurn.js';
import { prepareComposerPdfTurnInput } from './prepareComposerPdfTurnInput.js';
import {
  mergeExtractedWithOcrPass,
  runComposerScanOcrPipeline,
} from './runComposerScanOcrPipeline.js';

/**
 * Sync-Pfad (nach bereits gemergtem Extract / ohne OCR).
 * @param {{
 *   extracted: object,
 *   file?: object,
 *   lead?: object,
 *   leadsSnapshot?: object[],
 *   scopeHint?: string,
 *   customerName?: string,
 *   workingContextItems?: object[],
 *   currentOfferContext?: object|null,
 *   appContext?: object|null,
 * }} params
 */
export function runComposerPdfAttachTurn(params = {}) {
  const prepared = prepareComposerPdfTurnInput({
    extracted: params.extracted,
    file: params.file,
  });

  const sellerInput = prepared.ok
    ? prepared.interpretSeed
    : (prepared.draftSeed
      || (prepared.kind === 'contract_pdf'
        ? `Lies den Vertrag ${prepared.attachment?.fileName || ''} ein.`
        : ''));

  if (!sellerInput && prepared.kind !== 'contract_pdf') {
    return {
      prepared,
      turn: null,
      skipped: true,
      reason: 'needs_manual_describe',
      ocr: prepared.ocr || params.extracted?.ocr || null,
    };
  }

  const turn = runCleverSellerTurn({
    lead: params.lead || {},
    sellerInput: sellerInput || `Lies den Vertrag ein.`,
    leadsSnapshot: Array.isArray(params.leadsSnapshot) ? params.leadsSnapshot : [],
    scopeHint: params.scopeHint || 'dashboard',
    attachments: prepared.attachment ? [prepared.attachment] : [],
    customerName: params.customerName || '',
    workingContextItems: params.workingContextItems || [],
    currentOfferContext: params.currentOfferContext || null,
    appContext: params.appContext || null,
  });

  return {
    prepared,
    turn,
    skipped: false,
    ocr: prepared.ocr || params.extracted?.ocr || null,
  };
}

/**
 * Async-Pfad: natives PDF → Scan-OCR-Pipeline (Provider optional) → Turn.
 * @param {object} params – wie runComposerPdfAttachTurn + ocrProvider?
 */
export async function runComposerPdfAttachTurnWithOcr(params = {}) {
  const ocrPass = await runComposerScanOcrPipeline({
    extracted: params.extracted,
    file: params.file,
    fileName: params.extracted?.fileName || params.file?.name,
    ocrProvider: params.ocrProvider ?? null,
  });
  const merged = mergeExtractedWithOcrPass(params.extracted || {}, ocrPass);
  return {
    ...runComposerPdfAttachTurn({
      ...params,
      extracted: merged,
    }),
    ocr: ocrPass,
  };
}
