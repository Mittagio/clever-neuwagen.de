/**
 * CleverSellerTurnResult – strukturierter Output des Universal Orchestrators.
 * OpenAI interpretiert (optional); Clever validiert und entscheidet Persistenz.
 */

import { SELLER_INPUT_MODE, SELLER_TURN_INTENTS } from './sellerFactTypes.js';

/**
 * @returns {object}
 */
export function createEmptyCleverSellerTurnResult() {
  return {
    ok: false,
    intent: SELLER_TURN_INTENTS.UNKNOWN,
    intents: [],
    inputMode: SELLER_INPUT_MODE.CLEVER_WORK_INPUT,
    interpretedInput: {
      raw: '',
      normalized: '',
      attachmentTypes: [],
    },
    extractedFacts: [],
    proposedUpdates: [],
    missingInformation: [],
    relevantCustomerContext: {
      knownLabels: [],
      commercialPreferences: [],
      vehicleInterest: [],
    },
    preparedActions: [],
    warnings: [],
    assistantReply: null,
    confidence: 0,
    pendingAction: null,
    uiEffects: {
      capturedFacts: [],
    },
    legacy: null,
    openaiEscalation: null,
  };
}

/**
 * @param {object} partial
 */
export function buildCleverSellerTurnResult(partial = {}) {
  const base = createEmptyCleverSellerTurnResult();
  return {
    ...base,
    ...partial,
    interpretedInput: {
      ...base.interpretedInput,
      ...(partial.interpretedInput ?? {}),
    },
    relevantCustomerContext: {
      ...base.relevantCustomerContext,
      ...(partial.relevantCustomerContext ?? {}),
    },
    uiEffects: {
      ...base.uiEffects,
      ...(partial.uiEffects ?? {}),
    },
    extractedFacts: partial.extractedFacts ?? base.extractedFacts,
    proposedUpdates: partial.proposedUpdates ?? base.proposedUpdates,
    missingInformation: partial.missingInformation ?? base.missingInformation,
    preparedActions: partial.preparedActions ?? base.preparedActions,
    warnings: partial.warnings ?? base.warnings,
    intents: partial.intents ?? base.intents,
  };
}

/**
 * @param {object} fact
 */
export function createExtractedFact({
  factClass,
  field,
  value = null,
  label,
  source = 'seller_input',
  confidence = 0.9,
  needsConfirmation = false,
} = {}) {
  return {
    factClass,
    field: field || null,
    value,
    label: String(label ?? value ?? '').trim(),
    source,
    confidence: Number(confidence) || 0,
    needsConfirmation: Boolean(needsConfirmation),
  };
}

/**
 * @param {object} update
 */
export function createProposedUpdate({
  target,
  field,
  value,
  source = 'seller_input',
  confidence = 0.9,
  factClass = null,
  autoApply = false,
} = {}) {
  return {
    target,
    field,
    value,
    source,
    confidence: Number(confidence) || 0,
    factClass,
    autoApply: Boolean(autoApply),
  };
}
