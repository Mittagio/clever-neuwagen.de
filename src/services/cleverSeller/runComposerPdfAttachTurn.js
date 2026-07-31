/**
 * Slice 13: Global-/Akte-Composer – PDF-Attach → Turn (ohne pdfjs).
 * Extraktion bleibt async außerhalb; hier nur Prepare + runCleverSellerTurn.
 */
import { runCleverSellerTurn } from './runCleverSellerTurn.js';
import { prepareComposerPdfTurnInput } from './prepareComposerPdfTurnInput.js';

/**
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
  };
}
