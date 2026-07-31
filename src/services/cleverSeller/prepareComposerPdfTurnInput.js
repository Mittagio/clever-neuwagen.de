/**
 * Slice 12: Klassifiziert Composer-PDFs vor dem sync Turn.
 * Extraktion bleibt async außerhalb (extractMagicOfferPdf) – hier nur Text → kind.
 */
import { isCustomerContractIntakeText } from './extractCustomerContractFromText.js';

/**
 * @param {string} [fileName]
 * @returns {boolean}
 */
export function fileNameSuggestsCustomerContract(fileName = '') {
  const n = String(fileName || '').toLowerCase();
  if (!n) return false;
  return /\b(vertrag|leasingvertrag|finanzierungsvertrag|mietkauf|kaufvertrag|ablöse|abloese|altvertrag)\b/i.test(n)
    || /vertrag|leasingvertrag|finanzierung|mietkauf|abloese|ablöse/.test(n);
}

/**
 * @param {string} [text]
 * @returns {boolean}
 */
export function textSuggestsOfferOrConfiguratorPdf(text = '') {
  const t = String(text || '');
  if (!t.trim()) return false;
  if (isCustomerContractIntakeText(t)) return false;
  return /\b(leasingangebot|kaufangebot|finanzierungsangebot|konfigurator|preisliste|angebotsübersicht|angebotsuebersicht)\b/i.test(t)
    || /\b(monatsrate|anzahlung|schlussrate)\b/i.test(t);
}

/**
 * @param {{
 *   text?: string,
 *   fileName?: string,
 *   ok?: boolean,
 *   needsManualDescribe?: boolean,
 * }} extracted
 * @returns {'contract_pdf'|'configurator_pdf'}
 */
export function classifyComposerPdfKind(extracted = {}) {
  const text = String(extracted.text || '').trim();
  const fileName = extracted.fileName || '';

  if (isCustomerContractIntakeText(text)) return 'contract_pdf';
  if (fileNameSuggestsCustomerContract(fileName)) return 'contract_pdf';
  if (textSuggestsOfferOrConfiguratorPdf(text)) return 'configurator_pdf';
  // Unklarer Scan / kurzer Text: Dateiname entscheidet, sonst Offer-Default (bisheriges Verhalten)
  if (fileNameSuggestsCustomerContract(fileName)) return 'contract_pdf';
  return 'configurator_pdf';
}

/**
 * Baut Turn-Payload aus bereits extrahiertem PDF (kein pdfjs hier).
 * @param {{
 *   extracted?: {
 *     ok?: boolean,
 *     text?: string,
 *     fileName?: string,
 *     needsManualDescribe?: boolean,
 *     mimeType?: string,
 *   },
 *   file?: { type?: string, name?: string },
 * }} params
 */
export function prepareComposerPdfTurnInput(params = {}) {
  const extracted = params.extracted || {};
  const file = params.file || {};
  const fileName = extracted.fileName || file.name || 'dokument.pdf';
  const fullText = String(extracted.text || '').trim();
  const ok = Boolean(extracted.ok && fullText.length > 20);
  const kind = classifyComposerPdfKind({
    text: fullText,
    fileName,
    ok,
    needsManualDescribe: !ok,
  });

  const interpretSeed = [
    `PDF: ${fileName}`,
    fullText || null,
  ].filter(Boolean).join('\n\n');

  const draftSeed = [
    `PDF: ${fileName}`,
    fullText ? fullText.slice(0, 4000) : null,
  ].filter(Boolean).join('\n\n');

  const attachment = {
    kind,
    mimeType: extracted.mimeType || file.type || 'application/pdf',
    fileName,
    extractedText: fullText || '',
    sourceType: kind === 'contract_pdf' ? 'contract_pdf' : undefined,
  };

  if (kind === 'contract_pdf') {
    return {
      kind,
      ok,
      needsManualDescribe: !ok,
      interpretSeed: ok ? interpretSeed : '',
      draftSeed: ok
        ? draftSeed
        : `Vertrags-PDF: ${fileName}`,
      attachment,
      workingContextLabel: fileName,
      feedbackOk: 'Vertrag gelesen – bitte prüfen',
      feedbackManual: 'PDF ohne lesbaren Text – bitte Vertrag manuell beschreiben.',
    };
  }

  return {
    kind,
    ok,
    needsManualDescribe: !ok,
    interpretSeed: ok ? interpretSeed : '',
    draftSeed: ok
      ? draftSeed
      : `Konfigurator-PDF: ${fileName}`,
    attachment: {
      kind: 'configurator_pdf',
      mimeType: attachment.mimeType,
      fileName,
    },
    workingContextLabel: fileName,
    feedbackOk: 'PDF gelesen – Kontext angehängt, bitte prüfen',
    feedbackManual: 'PDF übernommen – bitte kurz beschreiben, was drinsteht.',
  };
}
