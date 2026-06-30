export const QUERY_TYPES = {
  VEHICLE_WISH: 'vehicle_wish',
  MODEL_EQUIPMENT_QUESTION: 'model_equipment_question',
  ADVICE_QUESTION: 'advice_question',
  SPECIAL_CHECK_QUESTION: 'special_check_question',
};

export const DEALER_DISCLAIMER = 'Die finale Ausstattung, Verfügbarkeit und Rate prüft Ihr Autohaus.';

export const UI_COMPONENTS = {
  SMART_ANSWER: 'smart_answer',
  ADVICE_ANSWER: 'advice_answer',
  NEED_SEARCH: 'need_search',
  SPECIAL_CONTACT: 'special_contact',
};

export const CLASSIFICATION_JSON_SCHEMA = {
  name: 'customer_query_classification',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      queryType: {
        type: 'string',
        enum: Object.values(QUERY_TYPES),
      },
      topic: { type: ['string', 'null'] },
      modelKey: { type: ['string', 'null'] },
      featureId: { type: ['string', 'null'] },
      customerIntent: { type: 'string' },
      shouldShowModels: { type: 'boolean' },
      shouldAskForContact: { type: 'boolean' },
      confidence: { type: 'number' },
    },
    required: [
      'queryType',
      'topic',
      'modelKey',
      'featureId',
      'customerIntent',
      'shouldShowModels',
      'shouldAskForContact',
      'confidence',
    ],
  },
};

/**
 * @param {object} input
 */
export function normalizeClassification(input = {}) {
  const queryType = Object.values(QUERY_TYPES).includes(input.queryType)
    ? input.queryType
    : QUERY_TYPES.VEHICLE_WISH;

  return {
    queryType,
    topic: input.topic ?? null,
    modelKey: input.modelKey ?? null,
    featureId: input.featureId ?? null,
    customerIntent: String(input.customerIntent ?? '').trim() || 'Kunde sucht Orientierung',
    shouldShowModels: Boolean(input.shouldShowModels),
    shouldAskForContact: Boolean(input.shouldAskForContact),
    confidence: Math.max(0, Math.min(1, Number(input.confidence) || 0.5)),
    source: input.source ?? 'rules',
  };
}
