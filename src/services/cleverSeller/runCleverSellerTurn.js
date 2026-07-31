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
import {
  resolveAssistantContext,
  buildInterpretedGoal,
} from './resolveAssistantContext.js';
import {
  buildUniversalReviewModel,
  shouldShowUniversalReview,
} from './buildUniversalReviewModel.js';

function createTurnId() {
  return `cst_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildEvidenceFromTurn({ facts = [], preparedActions = [], retrievedFacts = [] }) {
  const evidence = [];
  for (const f of facts) {
    if (!f?.label) continue;
    evidence.push({
      kind: 'extracted_fact',
      field: f.field,
      label: f.label,
      source: f.source || 'seller_input',
      confidence: f.confidence ?? null,
    });
  }
  for (const retrieved of retrievedFacts) {
    if (!retrieved) continue;
    evidence.push({
      kind: 'retrieved_fact',
      source: 'verified_vehicle_data',
      payload: retrieved,
    });
  }
  for (const action of preparedActions) {
    if (action?.toolId) {
      evidence.push({
        kind: 'tool',
        toolId: action.toolId,
        type: action.type,
        status: action.status,
      });
    }
  }
  return evidence;
}

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
  workingContextItems = [],
  customerName = '',
  attachments = [],
}) {
  const enabled = isCleverSellerOrchestratorEnabled(env);
  const uniqueFacts = filterDuplicateFacts(facts, lead);
  const proposedUpdates = buildProposedUpdatesFromFacts(uniqueFacts);
  const assistantContext = resolveAssistantContext({
    lead,
    sellerInput: interpreted.normalized || interpreted.raw,
    workingContextItems,
    currentOfferContext,
    customerName,
    attachments,
  });
  const offerCtx = currentOfferContext || assistantContext.offerContext || null;

  const missingInformation = resolveMissingInformation({
    intents,
    facts: uniqueFacts,
    lead,
    currentOfferContext: offerCtx,
  });

  let effectiveIntents = Array.isArray(intents) ? [...intents] : [];
  const hasCommercial = uniqueFacts.some(
    (f) => f.factClass === SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE
      || f.factClass === SELLER_FACT_CLASS.OFFER_INSTRUCTION,
  );
  // Angehängtes Angebot + Konditionsänderung → Angebots-Update auch bei „schreib …“
  if (
    offerCtx?.offerId
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
      currentOfferContext: offerCtx,
      resolvedCustomer: assistantContext.resolvedCustomer,
      workingContext: assistantContext.resolvedWorkingContext,
      goldenMoment: assistantContext.goldenMoment,
      attachments,
    })
    : [];

  const messageDraft = preparedActions.find((a) => a.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE)
    ?.payload?.messageDraft
    || null;

  const understanding = (() => {
    try {
      return buildCustomerUnderstanding(lead);
    } catch {
      return { verstaendnis: { labels: [], konditionen: [], openPoints: [], vehicles: [] } };
    }
  })();
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

  const interpretedGoal = buildInterpretedGoal({
    intents: effectiveIntents,
    facts: uniqueFacts,
    resolvedCustomer: assistantContext.resolvedCustomer,
  });

  const retrievedFacts = preparedActions
    .filter((a) => a.payload?.retrieved)
    .map((a) => a.payload.retrieved);

  const turnPartial = {
    ok: Boolean(interpreted.normalized) && enabled,
    turnId: createTurnId(),
    intent: primaryIntent,
    intents: effectiveIntents,
    inputMode: interpreted.inputMode,
    interpretedInput: {
      raw: interpreted.raw,
      normalized: interpreted.normalized,
      attachmentTypes: interpreted.attachmentTypes,
    },
    interpretedGoal,
    resolvedCustomer: assistantContext.resolvedCustomer,
    resolvedWorkingContext: assistantContext.resolvedWorkingContext,
    usedCustomerContext: assistantContext.usedCustomerContext,
    extractedFacts: uniqueFacts,
    retrievedFacts,
    proposedUpdates,
    missingInformation,
    relevantCustomerContext: {
      knownLabels: knownLabels.slice(0, 12),
      commercialPreferences: (understanding?.verstaendnis?.konditionen ?? []).slice?.(0, 6)
        || [],
      vehicleInterest: uniqueFacts
        .filter((f) => f.field === 'vehicleInterest' || f.field === 'vehicleInterestMulti')
        .map((f) => f.label),
      currentOffer: offerCtx || null,
      notepadLabels: assistantContext.usedCustomerContext?.notepadLabels ?? [],
    },
    preparedActions,
    messageDraft,
    warnings,
    assistantReply,
    confidence: interpreted.confidence,
    evidence: buildEvidenceFromTurn({
      facts: uniqueFacts,
      preparedActions,
      retrievedFacts,
    }),
    pendingAction,
    currentOfferContext: offerCtx || null,
    homepageInquiry: interpreted.homepageInquiry ?? null,
    goldenMoment: assistantContext.goldenMoment ?? null,
    uiEffects: {
      capturedFacts: uniqueFacts
        .filter((f) => !f.needsConfirmation)
        .map((f) => ({ label: f.label, factClass: f.factClass })),
      progressLines: [
        assistantContext.resolvedCustomer?.name || assistantContext.resolvedCustomer?.namedInInput
          ? `Kunde erkannt: ${assistantContext.resolvedCustomer.name || assistantContext.resolvedCustomer.namedInInput}`
          : null,
        uniqueFacts.find((f) => f.field === 'vehicleInterest')?.label
          ? `Fahrzeug erkannt: ${uniqueFacts.find((f) => f.field === 'vehicleInterest').label}`
          : null,
        uniqueFacts.find((f) => f.field === 'purchasePrice')?.label || null,
        assistantContext.usedCustomerContext?.notepadLabels?.length
          ? 'Kundenakte berücksichtigt'
          : null,
        preparedActions.some((a) => a.type === SELLER_TURN_INTENTS.PREPARE_OFFER)
          ? 'Angebot vorbereitet'
          : null,
        messageDraft ? 'Nachricht vorbereitet' : null,
        preparedActions.some((a) => a.type === SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT)
          ? 'Termin vorbereitet'
          : null,
        assistantContext.resolvedWorkingContext?.attachedDocument?.label
          ? `Dokument: ${assistantContext.resolvedWorkingContext.attachedDocument.label}`
          : null,
        assistantContext.goldenMoment?.headline
          ? 'Nächster Schritt erkannt'
          : null,
      ].filter(Boolean),
    },
    featureEnabled: enabled,
    openaiEscalation,
  };

  const reviewModel = shouldShowUniversalReview(turnPartial)
    ? buildUniversalReviewModel(turnPartial)
    : null;

  return buildCleverSellerTurnResult({
    ...turnPartial,
    reviewModel,
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
  workingContextItems = [],
  customerName = '',
  env = typeof process !== 'undefined' ? process.env : {},
} = {}) {
  void conversationContext;
  void sellerContext;

  const interpreted = interpretSellerInput(sellerInput, { attachments, lead });
  return finalizeSellerTurn({
    lead,
    interpreted,
    facts: interpreted.facts,
    intents: interpreted.intents,
    env,
    openaiEscalation: null,
    currentOfferContext,
    workingContextItems,
    customerName,
    attachments,
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
      attachments,
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
