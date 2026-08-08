/**
 * JSON-Schema für die finale Clever-Agent-Antwort.
 */
export const CLEVER_AGENT_RESULT_JSON_SCHEMA = {
  name: 'clever_agent_result',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['message', 'artifacts', 'suggestedActions'],
    properties: {
      message: {
        type: 'string',
        description: 'Kompakte Antwort an den Verkäufer auf Deutsch.',
      },
      artifacts: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['type', 'label'],
          properties: {
            type: { type: 'string' },
            label: { type: 'string' },
            offerId: { type: ['string', 'null'] },
          },
        },
      },
      suggestedActions: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['action', 'label'],
          properties: {
            action: { type: 'string' },
            label: { type: 'string' },
          },
        },
      },
    },
  },
};

export function emptyAgentUiPayload(message = '') {
  return {
    message: String(message || '').trim(),
    artifacts: [],
    suggestedActions: [],
  };
}

export function mergeToolSideEffects(toolExecutions = []) {
  const mutations = [];
  const artifacts = [];
  const suggestedActions = [];
  let previousOfferPreparation = null;
  let pendingAction = null;
  let confirmationRequired = false;
  let resolvedVehicle = null;
  let offerSummary = null;
  let intendSend = false;
  let preparedAppointment = null;
  let extractedFacts = [];
  let knowledgeResult = null;
  let todayOverview = null;
  let resolvedCustomer = null;
  let customerSearchResults = [];
  let messageDraft = null;

  for (const exec of toolExecutions) {
    const out = exec.output || {};
    if (Array.isArray(out.mutations)) mutations.push(...out.mutations);
    if (Array.isArray(out.artifacts)) artifacts.push(...out.artifacts);
    if (Array.isArray(out.suggestedActions)) suggestedActions.push(...out.suggestedActions);
    if (out.previousOfferPreparation) previousOfferPreparation = out.previousOfferPreparation;
    if (out.pendingAction) pendingAction = out.pendingAction;
    if (out.confirmationRequired) confirmationRequired = true;
    if (out.resolvedVehicle) resolvedVehicle = out.resolvedVehicle;
    if (out.offer) offerSummary = out.offer;
    if (out.intendSend) intendSend = true;
    if (out.preparedAppointment) preparedAppointment = out.preparedAppointment;
    if (Array.isArray(out.extractedFacts) && out.extractedFacts.length) {
      extractedFacts = [...extractedFacts, ...out.extractedFacts];
    }
    if (out.knowledgeResult) knowledgeResult = out.knowledgeResult;
    if (out.todayOverview) todayOverview = out.todayOverview;
    if (out.resolvedCustomer) resolvedCustomer = out.resolvedCustomer;
    if (Array.isArray(out.customerSearchResults) && out.customerSearchResults.length) {
      customerSearchResults = out.customerSearchResults;
    }
    if (out.messageDraft) messageDraft = out.messageDraft;
    if (out.leadPatch) {
      mutations.push({ type: 'apply_lead_patch', leadPatch: out.leadPatch });
    }
  }

  return {
    mutations,
    artifacts,
    suggestedActions,
    previousOfferPreparation,
    pendingAction,
    confirmationRequired,
    resolvedVehicle,
    offerSummary,
    intendSend,
    preparedAppointment,
    extractedFacts,
    knowledgeResult,
    todayOverview,
    resolvedCustomer,
    customerSearchResults,
    messageDraft,
  };
}
