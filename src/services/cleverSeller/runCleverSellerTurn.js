/**
 * Clever Universal Seller Turn – Orchestrator v1.
 *
 * OpenAI interpretiert (optional später). Clever validiert und plant.
 * Persistenz / Versand nur über definierte Pfade nach Seller-Review.
 */
import { buildCustomerUnderstanding } from '../dealer/customerUnderstanding.js';
import { buildUnderstoodLabels, getNeedProfileFromLead } from '../consultation/needProfileService.js';
import { buildCleverSellerTurnResult } from './cleverSellerTurnResultSchema.js';
import { interpretSellerInput } from './interpretSellerInput.js';
import {
  buildProposedUpdatesFromFacts,
  filterDuplicateFacts,
} from './proposeSellerUpdates.js';
import { resolveMissingInformation } from './resolveMissingInformation.js';
import {
  buildSellerAssistantReply,
  planSellerActions,
} from './planSellerActions.js';
import { SELLER_TURN_INTENTS } from './sellerFactTypes.js';
import { isCleverSellerOrchestratorEnabled } from './cleverSellerOrchestratorConfig.js';

/**
 * @param {object} params
 * @param {object} params.lead
 * @param {string} params.sellerInput
 * @param {object[]} [params.attachments]
 * @param {object} [params.conversationContext]
 * @param {object} [params.currentOfferContext]
 * @param {object} [params.sellerContext]
 * @param {object} [params.env]
 */
export function runCleverSellerTurn({
  lead = {},
  sellerInput = '',
  attachments = [],
  conversationContext = null,
  currentOfferContext = null,
  sellerContext = null,
  env = typeof process !== 'undefined' ? process.env : {},
} = {}) {
  void conversationContext;
  void currentOfferContext;
  void sellerContext;

  const enabled = isCleverSellerOrchestratorEnabled(env);
  const interpreted = interpretSellerInput(sellerInput, { attachments });
  const uniqueFacts = filterDuplicateFacts(interpreted.facts, lead);
  const proposedUpdates = buildProposedUpdatesFromFacts(uniqueFacts);
  const missingInformation = resolveMissingInformation({
    intents: interpreted.intents,
    facts: uniqueFacts,
    lead,
  });

  const preparedActions = enabled
    ? planSellerActions({
      lead,
      sellerInput: interpreted.normalized,
      intents: interpreted.intents,
      inputMode: interpreted.inputMode,
      facts: uniqueFacts,
      missingInformation,
    })
    : [];

  const understanding = buildCustomerUnderstanding(lead);
  const profile = getNeedProfileFromLead(lead) || {};
  const knownLabels = buildUnderstoodLabels(profile);

  const pendingAction = preparedActions.find((a) => (
    a.type === SELLER_TURN_INTENTS.PREPARE_OFFER && a.status === 'prepared'
  ))
    ? {
      type: SELLER_TURN_INTENTS.PREPARE_OFFER,
      gatheredInputs: uniqueFacts
        .filter((f) => f.factClass === 'offer_instruction' || f.field === 'vehicleInterest')
        .map((f) => ({ field: f.field, value: f.value })),
      missingInputs: missingInformation
        .filter((m) => m.forIntent === SELLER_TURN_INTENTS.PREPARE_OFFER)
        .map((m) => m.field),
      createdAt: new Date().toISOString(),
    }
    : null;

  const assistantReply = buildSellerAssistantReply({
    facts: uniqueFacts,
    missingInformation,
    preparedActions,
    inputMode: interpreted.inputMode,
  });

  const primaryIntent = interpreted.intents[0]?.type || SELLER_TURN_INTENTS.UNKNOWN;

  return buildCleverSellerTurnResult({
    ok: Boolean(interpreted.normalized) && enabled,
    intent: primaryIntent,
    intents: interpreted.intents,
    inputMode: interpreted.inputMode,
    interpretedInput: {
      raw: interpreted.raw,
      normalized: interpreted.normalized,
      attachmentTypes: interpreted.attachmentTypes,
    },
    extractedFacts: uniqueFacts,
    proposedUpdates,
    missingInformation,
    relevantCustomerContext: {
      knownLabels: knownLabels.slice(0, 12),
      commercialPreferences: (understanding?.verstaendnis?.konditionen ?? []).slice?.(0, 6)
        || [],
      vehicleInterest: uniqueFacts
        .filter((f) => f.field === 'vehicleInterest' || f.field === 'vehicleInterestMulti')
        .map((f) => f.label),
    },
    preparedActions,
    warnings: buildWarnings(uniqueFacts, interpreted.inputMode),
    assistantReply,
    confidence: interpreted.confidence,
    pendingAction,
    uiEffects: {
      capturedFacts: uniqueFacts
        .filter((f) => !f.needsConfirmation)
        .map((f) => ({ label: f.label, factClass: f.factClass })),
    },
    featureEnabled: enabled,
  });
}

function buildWarnings(facts, inputMode) {
  const warnings = [];
  if (facts.some((f) => f.needsConfirmation)) {
    warnings.push('Mindestens ein Wert braucht kurze Bestätigung.');
  }
  if (inputMode === 'ambiguous') {
    warnings.push('Unklar, ob Kundennachricht oder interne Arbeitsnotiz.');
  }
  if (facts.some((f) => f.field === 'vehicleInterestMulti')) {
    warnings.push('Mehrere Modellinteressen – nicht automatisch auf eines reduziert.');
  }
  return warnings;
}

export { interpretSellerInput } from './interpretSellerInput.js';
export { isCleverSellerOrchestratorEnabled } from './cleverSellerOrchestratorConfig.js';
