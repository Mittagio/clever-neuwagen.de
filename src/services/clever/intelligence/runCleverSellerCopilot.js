/**
 * Surface Adapter: Verkäufer-Copilot – Kundenakte, kein Auto-Senden.
 */
import { buildCustomerUnderstanding } from '../../dealer/customerUnderstanding.js';
import { CLEVER_SURFACES, getCleverIntelligenceConfig } from './cleverIntelligenceConfig.js';
import { buildCleverIntelligenceInstructions, CLEVER_INTELLIGENCE_PROMPT_VERSION } from './cleverBaseInstructions.js';
import { runCleverIntelligenceCore } from './runCleverIntelligenceCore.js';
import {
  CLEVER_SELLER_COPILOT_RESULT_JSON_SCHEMA,
  validateCleverSellerCopilotResult,
  assertGroundedSellerCopilotResult,
} from './sellerCopilotResultSchema.js';
import {
  buildCustomerUnderstandingSnapshotId,
  getSellerCopilotCache,
  setSellerCopilotCache,
} from './sellerCopilotCache.js';
import { cleverActionToHint } from '../../crm/cleverActionEngine.js';

/**
 * Serverseitig begrenzter Kontext – keine Dokumente, keine Kontodaten.
 * @param {object} lead
 */
export function buildSellerCopilotSafeContext(lead = {}) {
  let understanding = null;
  try {
    understanding = buildCustomerUnderstanding(lead);
  } catch {
    understanding = {
      verstaendnis: { labels: [], openPoints: [], vehicles: [] },
      gespraechseinstieg: null,
    };
  }
  const needProfile = lead?.crm?.needProfile ?? {};
  const sellerInsights = (lead?.crm?.sellerInsights ?? []).slice(-8).map((insight) => ({
    text: String(insight.text ?? '').slice(0, 400),
    labels: (insight.understoodLabels ?? []).slice(0, 8),
    context: insight.context ?? null,
  }));

  return {
    promptVersion: CLEVER_INTELLIGENCE_PROMPT_VERSION,
    customerUnderstanding: {
      labels: understanding?.verstaendnis?.labels ?? [],
      summary: understanding?.gespraechseinstieg ?? null,
      openPoints: understanding?.verstaendnis?.openPoints ?? [],
      vehicles: understanding?.verstaendnis?.vehicles ?? [],
    },
    needProfile: {
      fuel: needProfile.fuel ?? null,
      bodyType: needProfile.bodyType ?? null,
      persons: needProfile.persons ?? null,
      annualKm: needProfile.annualKm ?? null,
      leaseDurationMonths: needProfile.leaseDurationMonths ?? null,
      selectedModelKey: needProfile.selectedModelKey ?? null,
      modelHint: needProfile.modelHint ?? null,
      budget: needProfile.budget ?? null,
      timelineLabel: needProfile.timelineLabel ?? null,
      towCapacityKg: needProfile.towCapacityKg ?? null,
    },
    sellerInsights,
    snapshotId: buildCustomerUnderstandingSnapshotId(understanding, lead?.crm?.sellerInsights),
  };
}

/**
 * @param {object} copilotResult
 */
export function mapSellerCopilotToNextStepHint(copilotResult) {
  const action = copilotResult?.recommendedAction ?? {};
  if (!action.type || action.type === 'none') {
    return {
      title: 'Nächster guter Schritt',
      text: copilotResult?.answer ?? '',
      reason: action.reason ?? null,
      cta: action.label ?? null,
      handlerType: null,
      aiGenerated: true,
    };
  }

  const handlerMap = {
    open_offer: 'offer',
    prepare_offer: 'offer',
    open_vehicle: 'vehicle',
    create_message_draft: 'message',
    request_missing_information: 'follow_up',
    review_data_conflict: 'review',
  };

  return {
    title: action.label ?? 'Nächster guter Schritt',
    text: action.reason ?? copilotResult.answer,
    reason: action.reason,
    cta: action.label,
    handlerType: handlerMap[action.type] ?? action.type,
    aiGenerated: true,
    requiresSellerConfirmation: copilotResult.requiresSellerConfirmation === true,
    draft: copilotResult.draft ?? null,
    openPoints: copilotResult.openPoints ?? [],
  };
}

function buildSellerInput({ safeContext, userMessage, requestedAction }) {
  return [
    {
      role: 'user',
      content: JSON.stringify({
        surface: CLEVER_SURFACES.SELLER,
        requestedAction: requestedAction ?? null,
        userMessage: String(userMessage ?? '').slice(0, 2000),
        context: safeContext,
        rules: [
          'Keine Raten oder Lieferzeiten erfinden.',
          'Entwürfe nur vorschlagen, nie senden.',
          'Customer Understanding ist die Wahrheit – nicht überschreiben.',
        ],
      }),
    },
  ];
}

/**
 * @param {object} params
 * @param {object} params.lead
 * @param {string} [params.userMessage]
 * @param {string|null} [params.dealerId]
 * @param {string|null} [params.leadId]
 * @param {string|null} [params.requestedAction]
 * @param {boolean} [params.forceRefresh]
 * @param {object} [deps]
 */
export async function runCleverSellerCopilot(params = {}, deps = {}) {
  const lead = params.lead ?? {};
  const userMessage = String(params.userMessage ?? '').trim()
    || 'Fasse den Kunden zusammen und nenne den nächsten guten Schritt.';
  const config = deps.config ?? getCleverIntelligenceConfig(CLEVER_SURFACES.SELLER, deps.env);
  const safeContext = buildSellerCopilotSafeContext(lead);
  const leadId = params.leadId ?? lead?.id ?? null;

  if (!params.forceRefresh && leadId && !params.userMessage) {
    const cached = getSellerCopilotCache(leadId, safeContext.snapshotId);
    if (cached) {
      return { ...cached, fromCache: true };
    }
  }

  if (!config.enabled) {
    const fallbackHint = cleverActionToHint(
      { title: 'Nächster guter Schritt', explanation: 'Bestehende Journey-Logik', ctaLabel: 'Weiter' },
      {},
    );
    return {
      ok: true,
      mode: 'legacy',
      fallback: true,
      reason: 'seller_copilot_disabled',
      copilotResult: null,
      nextStepHint: fallbackHint,
      customerUnderstanding: buildCustomerUnderstanding(lead),
      snapshotId: safeContext.snapshotId,
      metrics: null,
    };
  }

  const core = await runCleverIntelligenceCore({
    surface: CLEVER_SURFACES.SELLER,
    instructions: buildCleverIntelligenceInstructions(CLEVER_SURFACES.SELLER),
    input: buildSellerInput({
      safeContext,
      userMessage,
      requestedAction: params.requestedAction ?? null,
    }),
    jsonSchema: CLEVER_SELLER_COPILOT_RESULT_JSON_SCHEMA,
    validate: validateCleverSellerCopilotResult,
    assertGrounded: assertGroundedSellerCopilotResult,
    userMessage,
    needProfile: lead?.crm?.needProfile ?? null,
    dealerId: params.dealerId ?? null,
    brandKey: 'kia',
    config,
  }, deps);

  if (!core.ok) {
    return {
      ok: true,
      mode: 'fallback',
      fallback: true,
      reason: core.reason,
      copilotResult: null,
      nextStepHint: {
        title: 'Nächster guter Schritt',
        text: 'Clever konnte gerade keine AI-Empfehlung erzeugen. Bestehende Journey nutzen.',
        cta: null,
      },
      customerUnderstanding: buildCustomerUnderstanding(lead),
      snapshotId: safeContext.snapshotId,
      metrics: core.metrics,
    };
  }

  const nextStepHint = mapSellerCopilotToNextStepHint(core.result);
  const payload = {
    ok: true,
    mode: 'ai',
    fallback: false,
    copilotResult: core.result,
    nextStepHint,
    evidence: core.evidence,
    metrics: core.metrics,
    knowledgeGaps: core.knowledgeGaps ?? [],
    customerUnderstanding: buildCustomerUnderstanding(lead),
    snapshotId: safeContext.snapshotId,
    isTruthSource: false,
  };

  if (leadId && !params.userMessage) {
    setSellerCopilotCache(leadId, safeContext.snapshotId, payload);
  }

  return payload;
}
