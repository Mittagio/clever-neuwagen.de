export const DATA_CONFIDENCE = {
  GENERAL: 'general',
  CLEVER_VERIFIED: 'clever_verified',
  NEEDS_DEALER_CHECK: 'needs_dealer_check',
};

/** Dezente UI-Labels – nicht technisch */
export const DATA_CONFIDENCE_LABELS = {
  [DATA_CONFIDENCE.GENERAL]: 'Allgemeine Einschätzung',
  [DATA_CONFIDENCE.CLEVER_VERIFIED]: 'Nach hinterlegten Fahrzeugdaten',
  [DATA_CONFIDENCE.NEEDS_DEALER_CHECK]: 'Autohaus prüft final',
};

export const QUERY_TYPES = {
  VEHICLE_WISH: 'vehicle_wish',
  MODEL_EQUIPMENT_QUESTION: 'model_equipment_question',
  ADVICE_QUESTION: 'advice_question',
  RANKING_QUESTION: 'ranking_question',
  COMPARISON_QUESTION: 'comparison_question',
  GENERAL_CAR_QUESTION: 'general_car_question',
  GENERAL_CAR_COMPARISON: 'general_car_comparison',
  COMPETITOR_COMPARISON: 'competitor_comparison',
  COMPETITOR_QUESTION: 'competitor_question',
  PURCHASE_INTENT: 'purchase_intent',
  SPECIAL_CHECK_QUESTION: 'special_check_question',
  MIXED_INTENT: 'mixed_intent',
  UNKNOWN: 'unknown',
};

/** Daten-Routing: welche Quelle die Antwort speist */
export const KNOWLEDGE_ROUTES = {
  GENERAL: 'general_knowledge',
  CLEVER_DATA: 'clever_data',
  DEALER_CHECK: 'dealer_check',
};

export const RANKING_METRICS = {
  TRUNK_VOLUME: 'trunk_volume',
  WLTP_RANGE: 'wltp_range',
  TOWING: 'towing',
  LENGTH: 'length',
  BATTERY: 'battery',
};

export const DEALER_DISCLAIMER = 'Die finale Ausstattung, Verfügbarkeit und Rate prüft Ihr Autohaus.';

export const UI_COMPONENTS = {
  SMART_ANSWER: 'smart_answer',
  ADVICE_ANSWER: 'advice_answer',
  RANKING_ANSWER: 'ranking_answer',
  COMPARISON_ANSWER: 'comparison_answer',
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
      adviceTopicId: { type: ['string', 'null'] },
      modelKey: { type: ['string', 'null'] },
      modelKeys: {
        type: 'array',
        items: { type: 'string' },
      },
      featureId: { type: ['string', 'null'] },
      featureIds: {
        type: 'array',
        items: { type: 'string' },
      },
      rankingMetric: { type: ['string', 'null'] },
      rankingFilter: { type: ['string', 'null'] },
      comparisonModels: {
        type: 'array',
        items: { type: 'string' },
      },
      customerIntent: { type: 'string' },
      shouldShowModels: { type: 'boolean' },
      shouldAskForContact: { type: 'boolean' },
      needsDealerCheck: { type: 'boolean' },
      confidence: { type: 'number' },
    },
    required: [
      'queryType',
      'topic',
      'adviceTopicId',
      'modelKey',
      'modelKeys',
      'featureId',
      'featureIds',
      'rankingMetric',
      'rankingFilter',
      'comparisonModels',
      'customerIntent',
      'shouldShowModels',
      'shouldAskForContact',
      'needsDealerCheck',
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

  const modelKeys = Array.isArray(input.modelKeys) && input.modelKeys.length
    ? input.modelKeys.filter(Boolean)
    : input.modelKey
      ? [input.modelKey]
      : [];

  const comparisonModels = Array.isArray(input.comparisonModels)
    ? input.comparisonModels.filter(Boolean)
    : [];

  const featureIds = Array.isArray(input.featureIds) && input.featureIds.length
    ? input.featureIds.filter(Boolean)
    : input.featureId
      ? [input.featureId]
      : [];

  const rankingMetric = Object.values(RANKING_METRICS).includes(input.rankingMetric)
    ? input.rankingMetric
    : input.rankingMetric ?? null;

  const adviceTopicId = input.adviceTopicId ?? (
    input.topic && !input.topic.includes('_benefit') && input.topic !== 'general_advice'
      && input.topic !== 'unmatched_advice' && input.topic !== 'unclassified_question'
      ? input.topic
      : null
  );

  return {
    queryType,
    topic: input.topic ?? adviceTopicId ?? null,
    adviceTopicId,
    modelKey: modelKeys[0] ?? input.modelKey ?? null,
    modelKeys,
    featureId: featureIds[0] ?? input.featureId ?? null,
    featureIds,
    rankingMetric,
    rankingFilter: input.rankingFilter ?? null,
    comparisonModels,
    customerIntent: String(input.customerIntent ?? '').trim() || 'Kunde sucht Orientierung',
    shouldShowModels: Boolean(input.shouldShowModels),
    shouldAskForContact: Boolean(input.shouldAskForContact),
    needsDealerCheck: Boolean(input.needsDealerCheck),
    confidence: Math.max(0, Math.min(1, Number(input.confidence) || 0.5)),
    source: input.source ?? 'rules',
    competitorBrands: Array.isArray(input.competitorBrands) ? input.competitorBrands.filter(Boolean) : [],
    competitorModels: Array.isArray(input.competitorModels) ? input.competitorModels.filter(Boolean) : [],
    brandScopeMode: input.brandScopeMode ?? null,
    primaryIntent: input.primaryIntent ?? null,
    secondaryIntent: input.secondaryIntent ?? null,
    vehicleWishPart: input.vehicleWishPart ?? null,
    questionPart: input.questionPart ?? null,
    searchIntent: input.searchIntent ?? null,
    searchProfile: input.searchProfile ?? null,
  };
}
