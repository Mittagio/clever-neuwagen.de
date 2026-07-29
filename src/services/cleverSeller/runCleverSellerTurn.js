/**
 * Clever Universal Seller Turn – Orchestrator v1.
 *
 * Deterministisch zuerst. OpenAI optional bei Eskalation (Flag).
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
import { SELLER_FACT_CLASS, SELLER_TURN_INTENTS } from './sellerFactTypes.js';
import {
  evaluateSellerInterpretEscalation,
  isCleverSellerOrchestratorEnabled,
} from './cleverSellerOrchestratorConfig.js';
import { buildSellerInterpretSafeContext } from './buildSellerInterpretSafeContext.js';
import { interpretSellerInputWithOpenAi } from './interpretSellerInputWithOpenAi.js';
import {
  mergeSellerIntents,
  mergeSellerInterpretation,
} from './mergeSellerInterpretation.js';

/**
 * @param {object} params
 */
function finalizeSellerTurn({
  lead = {},
  interpreted,
  facts,
  intents,
  env = {},
  warningsExtra = [],
  openaiEscalation = null,
  currentOfferContext = null,
}) {
  const enabled = isCleverSellerOrchestratorEnabled(env);
  const uniqueFacts = filterDuplicateFacts(facts, lead);
  const proposedUpdates = buildProposedUpdatesFromFacts(uniqueFacts);
  const missingInformation = resolveMissingInformation({
    intents,
    facts: uniqueFacts,
    lead,
    currentOfferContext,
  });

  let effectiveIntents = Array.isArray(intents) ? [...intents] : [];
  const hasCommercial = uniqueFacts.some(
    (f) => f.factClass === SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
  );
  // Angehängtes Angebot + Konditionsänderung → Angebots-Update auch bei „schreib …“
  if (
    currentOfferContext?.offerId
    && hasCommercial
    && !effectiveIntents.some((i) => i.type === SELLER_TURN_INTENTS.PREPARE_OFFER)
  ) {
    effectiveIntents.push({
      type: SELLER_TURN_INTENTS.PREPARE_OFFER,
      confidence: 0.9,
    });
  }

  const preparedActions = enabled
    ? planSellerActions({
      lead,
      sellerInput: interpreted.normalized,
      intents: effectiveIntents,
      inputMode: interpreted.inputMode,
      facts: uniqueFacts,
      missingInformation,
      currentOfferContext,
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

  const primaryIntent = effectiveIntents[0]?.type || SELLER_TURN_INTENTS.UNKNOWN;
  const warnings = [
    ...buildWarnings(uniqueFacts, interpreted.inputMode),
    ...warningsExtra,
  ];

  return buildCleverSellerTurnResult({
    ok: Boolean(interpreted.normalized) && enabled,
    intent: primaryIntent,
    intents: effectiveIntents,
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
      currentOffer: currentOfferContext || null,
    },
    preparedActions,
    warnings,
    assistantReply,
    confidence: interpreted.confidence,
    pendingAction,
    currentOfferContext: currentOfferContext || null,
    uiEffects: {
      capturedFacts: uniqueFacts
        .filter((f) => !f.needsConfirmation)
        .map((f) => ({ label: f.label, factClass: f.factClass })),
    },
    featureEnabled: enabled,
    openaiEscalation,
  });
}

/**
 * Sync / deterministisch (Default für UI-Debounce).
 * @param {object} params
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
  void sellerContext;

  const interpreted = interpretSellerInput(sellerInput, { attachments });
  return finalizeSellerTurn({
    lead,
    interpreted,
    facts: interpreted.facts,
    intents: interpreted.intents,
    env,
    openaiEscalation: null,
    currentOfferContext,
  });
}

/**
 * Async: deterministisch + optionale OpenAI-Eskalation.
 * @param {object} params
 * @param {{ fetchImpl?: typeof fetch, apiKey?: string|null, forceEscalate?: boolean }} [params.openAiOptions]
 */
export async function runCleverSellerTurnAsync({
  lead = {},
  sellerInput = '',
  attachments = [],
  env = typeof process !== 'undefined' ? process.env : {},
  openAiOptions = {},
} = {}) {
  const interpreted = interpretSellerInput(sellerInput, { attachments });
  const gate = openAiOptions.forceEscalate
    ? { shouldEscalate: true, reason: 'forced' }
    : evaluateSellerInterpretEscalation({
      ...interpreted,
      sellerInput,
      facts: interpreted.facts,
    }, env);

  if (!gate.shouldEscalate) {
    return finalizeSellerTurn({
      lead,
      interpreted,
      facts: interpreted.facts,
      intents: interpreted.intents,
      env,
      openaiEscalation: { used: false, reason: gate.reason },
    });
  }

  const safeContext = buildSellerInterpretSafeContext(lead, {
    sellerInput: interpreted.normalized || sellerInput,
    attachmentTypes: interpreted.attachmentTypes,
    deterministic: interpreted,
  });

  let ai;
  try {
    ai = await interpretSellerInputWithOpenAi(safeContext, openAiOptions);
  } catch (err) {
    return finalizeSellerTurn({
      lead,
      interpreted,
      facts: interpreted.facts,
      intents: interpreted.intents,
      env,
      warningsExtra: ['OpenAI-Eskalation fehlgeschlagen – nur Regel-Interpretation.'],
      openaiEscalation: {
        used: false,
        reason: gate.reason,
        error: err?.message || 'openai_error',
      },
    });
  }

  if (!ai?.ok) {
    return finalizeSellerTurn({
      lead,
      interpreted,
      facts: interpreted.facts,
      intents: interpreted.intents,
      env,
      warningsExtra: ['OpenAI nicht verfügbar – nur Regel-Interpretation.'],
      openaiEscalation: {
        used: false,
        reason: gate.reason,
        error: ai?.error || 'openai_failed',
      },
    });
  }

  const facts = mergeSellerInterpretation(interpreted.facts, ai.facts);
  const intents = mergeSellerIntents(interpreted.intents, ai.intents);
  const confidence = Math.max(interpreted.confidence || 0, ai.confidence || 0);

  return finalizeSellerTurn({
    lead,
    interpreted: { ...interpreted, confidence },
    facts,
    intents,
    env,
    warningsExtra: ['OpenAI hat ergänzt – bitte in der Review prüfen.'],
    openaiEscalation: {
      used: true,
      reason: gate.reason,
      aiFactCount: ai.facts.length,
    },
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
export {
  isCleverSellerOrchestratorEnabled,
  isCleverSellerOpenAiInterpretEnabled,
  evaluateSellerInterpretEscalation,
  shouldEscalateSellerInterpretation,
} from './cleverSellerOrchestratorConfig.js';
