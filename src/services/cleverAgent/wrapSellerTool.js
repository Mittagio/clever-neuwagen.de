/**
 * Adapter: Legacy CLEVER_SELLER_TOOLS → Agent-Tool-Ergebnisform.
 * Keine zweite Business-Engine – nur Normalisierung.
 */
import { runTool } from '../cleverSeller/toolRegistry.js';

/**
 * @param {string} sellerToolId
 * @param {object} ctx – Kontext für runTool
 * @param {{
 *   confirmationRequired?: boolean,
 *   pendingType?: string,
 *   message?: string,
 *   mapResult?: (result: object|null, run: object) => object,
 * }} [opts]
 */
export function wrapSellerTool(sellerToolId, ctx = {}, opts = {}) {
  const run = runTool(sellerToolId, ctx);
  if (!run.ok) {
    return {
      ok: false,
      error: run.error || 'tool_failed',
      message: opts.message
        || (run.error?.startsWith('missing_input:')
          ? `Es fehlt noch: ${run.error.replace('missing_input:', '')}.`
          : 'Die Aktion konnte nicht ausgeführt werden.'),
      sellerToolId,
    };
  }

  const result = run.result;
  if (typeof opts.mapResult === 'function') {
    return opts.mapResult(result, run);
  }

  const needsConfirm = opts.confirmationRequired ?? run.needsSellerConfirmation;
  const message = opts.message
    || result?.message
    || result?.summaryLine
    || result?.headline
    || result?.body
    || (needsConfirm ? 'Bitte prüfen und freigeben.' : 'Erledigt.');

  return {
    ok: true,
    status: needsConfirm ? 'prepared' : 'ok',
    confirmationRequired: Boolean(needsConfirm),
    pendingAction: needsConfirm
      ? {
        type: opts.pendingType || sellerToolId,
        status: 'needs_confirmation',
        sellerToolId,
        payload: result,
      }
      : null,
    result,
    sellerToolId,
    artifacts: result
      ? [{ type: sellerToolId, label: opts.label || sellerToolId, data: summarizeForArtifact(result) }]
      : [],
    message: String(message).slice(0, 800),
  };
}

function summarizeForArtifact(result) {
  if (!result || typeof result !== 'object') return result;
  const copy = { ...result };
  // Keine riesigen PDF-/Lead-Dumps in Artifacts
  if (copy.lead) delete copy.lead;
  if (copy.rawText) copy.rawText = String(copy.rawText).slice(0, 400);
  if (copy.extractedText) copy.extractedText = String(copy.extractedText).slice(0, 400);
  return copy;
}

/**
 * Runtime → Seller-Tool-Kontext.
 */
export function buildSellerToolContext(runtime = {}, args = {}) {
  return {
    lead: runtime.lead || {},
    sellerInput: String(
      args.sellerInput
      || args.query
      || args.instruction
      || args.note
      || runtime.sellerMessage
      || '',
    ).trim(),
    leadsSnapshot: Array.isArray(runtime.leadsSnapshot) ? runtime.leadsSnapshot : [],
    currentOfferContext: runtime.currentOffer || runtime.workingContext || null,
    workingContext: runtime.workingContext || null,
    attachments: Array.isArray(runtime.attachments) ? runtime.attachments : [],
    customerName: args.customerName
      || runtime.lead?.contact?.name
      || runtime.lead?.name
      || null,
    modelKey: args.modelKey || null,
    trim: args.trim || args.trimLabel || null,
    packageName: args.packageName || null,
    factKey: args.factKey || null,
  };
}
