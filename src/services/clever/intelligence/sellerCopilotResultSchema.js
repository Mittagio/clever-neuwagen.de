/**
 * CleverSellerCopilotResult – Schema und Validierung.
 */

export const CLEVER_SELLER_INTENTS = [
  'customer_summary',
  'next_best_step',
  'missing_information',
  'vehicle_question',
  'vehicle_comparison',
  'offer_preparation',
  'message_draft',
  'data_conflict',
  'other_sales_support',
];

export const CLEVER_SELLER_ACTION_TYPES = [
  'none',
  'open_offer',
  'prepare_offer',
  'open_vehicle',
  'create_message_draft',
  'request_missing_information',
  'review_data_conflict',
];

export function buildCleverSellerCopilotResultJsonSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: [
      'answer',
      'intent',
      'customerSummary',
      'openPoints',
      'vehicleDirections',
      'recommendedAction',
      'draft',
      'evidence',
      'requiresSellerConfirmation',
      'usedFactIds',
    ],
    properties: {
      answer: { type: 'string' },
      intent: { type: 'string', enum: CLEVER_SELLER_INTENTS },
      customerSummary: { type: ['string', 'null'] },
      openPoints: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['field', 'label', 'reason'],
          properties: {
            field: { type: 'string' },
            label: { type: 'string' },
            reason: { type: 'string' },
          },
        },
      },
      vehicleDirections: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['modelKey', 'variantKey', 'status', 'reason', 'evidenceIds'],
          properties: {
            modelKey: { type: 'string' },
            variantKey: { type: ['string', 'null'] },
            status: { type: 'string', enum: ['candidate', 'interesting', 'excluded'] },
            reason: { type: 'string' },
            evidenceIds: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      recommendedAction: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'label', 'reason'],
        properties: {
          type: { type: 'string', enum: CLEVER_SELLER_ACTION_TYPES },
          label: { type: ['string', 'null'] },
          reason: { type: ['string', 'null'] },
        },
      },
      draft: {
        type: 'object',
        additionalProperties: false,
        required: ['channel', 'subject', 'body'],
        properties: {
          channel: { type: ['string', 'null'] },
          subject: { type: ['string', 'null'] },
          body: { type: ['string', 'null'] },
        },
      },
      evidence: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'evidenceId',
            'sourceTier',
            'status',
            'factKey',
            'modelKey',
            'variantKey',
            'sourceId',
            'sourceUrl',
          ],
          properties: {
            evidenceId: { type: 'string' },
            sourceTier: { type: 'string', enum: ['internal_verified', 'official_web'] },
            status: { type: 'string', enum: ['verified', 'provisional_official_source'] },
            factKey: { type: ['string', 'null'] },
            modelKey: { type: ['string', 'null'] },
            variantKey: { type: ['string', 'null'] },
            sourceId: { type: ['string', 'null'] },
            sourceUrl: { type: ['string', 'null'] },
          },
        },
      },
      requiresSellerConfirmation: { type: 'boolean' },
      usedFactIds: { type: 'array', items: { type: 'string' } },
    },
  };
}

export const CLEVER_SELLER_COPILOT_RESULT_JSON_SCHEMA = {
  name: 'clever_seller_copilot_result',
  strict: true,
  schema: buildCleverSellerCopilotResultJsonSchema(),
};

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * @param {unknown} value
 */
export function validateCleverSellerCopilotResult(value) {
  const errors = [];
  if (!value || typeof value !== 'object') {
    return { ok: false, errors: ['not_an_object'] };
  }
  const result = /** @type {Record<string, unknown>} */ (value);
  if (!isNonEmptyString(result.answer)) errors.push('missing_answer');
  if (!CLEVER_SELLER_INTENTS.includes(String(result.intent))) errors.push('invalid_intent');
  if (!Array.isArray(result.openPoints)) errors.push('missing_openPoints');
  if (!Array.isArray(result.vehicleDirections)) errors.push('missing_vehicleDirections');
  if (!result.recommendedAction || typeof result.recommendedAction !== 'object') {
    errors.push('missing_recommendedAction');
  }
  if (!CLEVER_SELLER_ACTION_TYPES.includes(String(result.recommendedAction?.type))) {
    errors.push('invalid_recommendedAction_type');
  }
  if (!result.draft || typeof result.draft !== 'object') errors.push('missing_draft');
  if (!Array.isArray(result.evidence)) errors.push('missing_evidence');
  if (typeof result.requiresSellerConfirmation !== 'boolean') {
    errors.push('missing_requiresSellerConfirmation');
  }
  if (!Array.isArray(result.usedFactIds)) errors.push('missing_usedFactIds');

  if (result.intent === 'message_draft' && result.requiresSellerConfirmation !== true) {
    errors.push('draft_requires_confirmation');
  }

  return errors.length ? { ok: false, errors } : { ok: true, result };
}

/**
 * @param {object} result
 * @param {{ factIds?: Set<string>, evidenceIds?: Set<string>, conflicts?: object[] }} evidence
 */
export function assertGroundedSellerCopilotResult(result, evidence = {}) {
  const errors = [];
  const known = new Set([
    ...(evidence.factIds ?? []),
    ...(evidence.evidenceIds ?? []),
  ]);

  for (const id of result.usedFactIds ?? []) {
    if (!known.has(id)) errors.push(`unknown_used_fact:${id}`);
  }

  for (const direction of result.vehicleDirections ?? []) {
    for (const id of direction.evidenceIds ?? []) {
      if (!known.has(id)) errors.push(`unknown_direction_evidence:${id}`);
    }
  }

  for (const item of result.evidence ?? []) {
    if (!item.evidenceId || !known.has(item.evidenceId)) {
      errors.push(`unknown_evidence_ref:${item.evidenceId ?? 'missing'}`);
    }
  }

  if ((evidence.conflicts ?? []).length > 0) {
    errors.push('internal_official_conflict');
  }

  const technical = /\b(\d[\d.,]*\s*(?:km|kwh|kg|€|eur))\b/i.test(result.answer ?? '');
  if (technical && !(result.usedFactIds ?? []).length && !(result.evidence ?? []).length) {
    errors.push('technical_claim_without_evidence');
  }

  if (result.draft?.body && result.requiresSellerConfirmation !== true) {
    errors.push('draft_without_confirmation');
  }

  return { ok: errors.length === 0, errors };
}
