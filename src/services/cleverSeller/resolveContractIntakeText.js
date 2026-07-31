/**
 * Slice 11: Contract-PDF-Intake – Text vor dem Turn (Magic-Offer-Pattern).
 * Kein pdfjs / OCR im sync Orchestrator.
 */

/**
 * @param {object} [attachment]
 * @returns {boolean}
 */
export function isContractPdfAttachment(attachment = {}) {
  if (!attachment || typeof attachment !== 'object') return false;
  if (attachment.kind === 'contract_pdf') return true;
  if (attachment.sourceType === 'contract_pdf') return true;
  return false;
}

/**
 * @param {object[]} [attachments]
 * @returns {boolean}
 */
export function hasContractPdfAttachment(attachments = []) {
  return (attachments || []).some((a) => isContractPdfAttachment(a));
}

/**
 * Entfernt optionales „PDF: dateiname“-Präfix vom Composer-Input.
 * @param {string} text
 * @returns {{ body: string, fileNameHint: string|null }}
 */
export function stripPdfComposerPrefix(text = '') {
  const raw = String(text || '').replace(/\r\n/g, '\n').trim();
  const m = raw.match(/^PDF\s*:\s*([^\n]+)\n+([\s\S]*)$/i);
  if (!m) {
    return { body: raw, fileNameHint: null };
  }
  return {
    body: String(m[2] || '').trim(),
    fileNameHint: String(m[1] || '').trim() || null,
  };
}

/**
 * Löst Vertragstext für Intake auf (sellerInput und/oder Attachment.extractedText).
 * @param {{
 *   sellerInput?: string,
 *   attachments?: object[],
 * }} params
 * @returns {{
 *   text: string,
 *   sourceType: 'pasted_contract_text'|'contract_pdf',
 *   sourceId: string|null,
 *   fileName: string|null,
 *   needsManualDescribe: boolean,
 *   fromAttachment: boolean,
 * }}
 */
export function resolveContractIntakeText(params = {}) {
  const attachments = Array.isArray(params.attachments) ? params.attachments : [];
  const contractPdf = attachments.find((a) => isContractPdfAttachment(a)) || null;
  const extractedFromAttachment = String(
    contractPdf?.extractedText
    || contractPdf?.text
    || '',
  ).trim();

  const stripped = stripPdfComposerPrefix(params.sellerInput);
  const fromSeller = stripped.body;

  // Bevorzugt Attachment-Text wenn als contract_pdf markiert
  if (contractPdf && extractedFromAttachment) {
    return {
      text: extractedFromAttachment,
      sourceType: 'contract_pdf',
      sourceId: contractPdf.sourceId
        || contractPdf.fileName
        || contractPdf.id
        || stripped.fileNameHint
        || null,
      fileName: contractPdf.fileName || stripped.fileNameHint || null,
      needsManualDescribe: extractedFromAttachment.length <= 20,
      fromAttachment: true,
    };
  }

  // contract_pdf ohne brauchbaren Text → manuell beschreiben
  if (contractPdf && !extractedFromAttachment) {
    return {
      text: fromSeller,
      sourceType: 'contract_pdf',
      sourceId: contractPdf.fileName || contractPdf.id || stripped.fileNameHint || null,
      fileName: contractPdf.fileName || stripped.fileNameHint || null,
      needsManualDescribe: true,
      fromAttachment: true,
    };
  }

  // Composer: „PDF: name.pdf\\n\\n…“ ohne Attachment-Kind → trotzdem contract_pdf wenn erkennbar
  if (stripped.fileNameHint && fromSeller) {
    const looksLikeContract = /\b(leasingvertrag|vertragsbeginn|vertragsende|finanzierungsvertrag)\b/i.test(fromSeller)
      || /\bvertrag\b/i.test(stripped.fileNameHint);
    if (looksLikeContract) {
      return {
        text: fromSeller,
        sourceType: 'contract_pdf',
        sourceId: stripped.fileNameHint,
        fileName: stripped.fileNameHint,
        needsManualDescribe: fromSeller.length <= 20,
        fromAttachment: false,
      };
    }
  }

  return {
    text: fromSeller || String(params.sellerInput || '').trim(),
    sourceType: 'pasted_contract_text',
    sourceId: null,
    fileName: null,
    needsManualDescribe: false,
    fromAttachment: false,
  };
}
