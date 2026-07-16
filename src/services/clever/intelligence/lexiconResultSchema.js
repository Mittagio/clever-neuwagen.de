/**
 * CleverLexiconResult – Schema und Validierung.
 */

export const CLEVER_LEXICON_INTENTS = [
  'vehicle_fact',
  'vehicle_comparison',
  'technology_explanation',
  'equipment_question',
  'model_discovery',
  'other_automotive',
];

export const CLEVER_LEXICON_ACTION_TYPES = [
  'open_model',
  'compare_models',
  'transfer_to_customer',
  'report_data_issue',
];

export function buildCleverLexiconResultJsonSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: [
      'answer',
      'intent',
      'facts',
      'vehicleDirections',
      'evidence',
      'knowledgeGap',
      'suggestedActions',
      'usedFactIds',
    ],
    properties: {
      answer: { type: 'string' },
      intent: { type: 'string', enum: CLEVER_LEXICON_INTENTS },
      facts: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['label', 'value', 'evidenceIds'],
          properties: {
            label: { type: 'string' },
            value: { type: 'string' },
            evidenceIds: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      vehicleDirections: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['modelKey', 'variantKey', 'reason', 'evidenceIds'],
          properties: {
            modelKey: { type: 'string' },
            variantKey: { type: ['string', 'null'] },
            reason: { type: 'string' },
            evidenceIds: { type: 'array', items: { type: 'string' } },
          },
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
            'sourceTitle',
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
            sourceTitle: { type: ['string', 'null'] },
          },
        },
      },
      knowledgeGap: {
        type: 'object',
        additionalProperties: false,
        required: ['created', 'reason'],
        properties: {
          created: { type: 'boolean' },
          reason: { type: ['string', 'null'] },
        },
      },
      suggestedActions: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['type', 'label'],
          properties: {
            type: { type: 'string', enum: CLEVER_LEXICON_ACTION_TYPES },
            label: { type: 'string' },
          },
        },
      },
      usedFactIds: { type: 'array', items: { type: 'string' } },
    },
  };
}

export const CLEVER_LEXICON_RESULT_JSON_SCHEMA = {
  name: 'clever_lexicon_result',
  strict: true,
  schema: buildCleverLexiconResultJsonSchema(),
};

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * @param {unknown} value
 */
export function validateCleverLexiconResult(value) {
  const errors = [];
  if (!value || typeof value !== 'object') {
    return { ok: false, errors: ['not_an_object'] };
  }
  const result = /** @type {Record<string, unknown>} */ (value);
  if (!isNonEmptyString(result.answer)) errors.push('missing_answer');
  if (!CLEVER_LEXICON_INTENTS.includes(String(result.intent))) errors.push('invalid_intent');
  if (!Array.isArray(result.facts)) errors.push('missing_facts');
  if (!Array.isArray(result.vehicleDirections)) errors.push('missing_vehicleDirections');
  if (!Array.isArray(result.evidence)) errors.push('missing_evidence');
  if (!result.knowledgeGap || typeof result.knowledgeGap !== 'object') {
    errors.push('missing_knowledgeGap');
  }
  if (!Array.isArray(result.suggestedActions)) errors.push('missing_suggestedActions');
  if (!Array.isArray(result.usedFactIds)) errors.push('missing_usedFactIds');
  return errors.length ? { ok: false, errors } : { ok: true, result };
}

/**
 * @param {object} result
 * @param {{ factIds?: Set<string>, evidenceIds?: Set<string>, conflicts?: object[] }} evidence
 */
export function assertGroundedLexiconResult(result, evidence = {}) {
  const errors = [];
  const known = new Set([
    ...(evidence.factIds ?? []),
    ...(evidence.evidenceIds ?? []),
  ]);

  for (const id of result.usedFactIds ?? []) {
    if (!known.has(id)) errors.push(`unknown_used_fact:${id}`);
  }

  for (const fact of result.facts ?? []) {
    for (const id of fact.evidenceIds ?? []) {
      if (!known.has(id)) errors.push(`unknown_fact_evidence:${id}`);
    }
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

  const technical = /\b(\d[\d.,]*\s*(?:km|kwh|kg|€|eur|sitze?))\b/i.test(result.answer ?? '');
  const hasEvidence = (result.usedFactIds ?? []).length > 0 || (result.evidence ?? []).length > 0;
  if (technical && !hasEvidence) {
    errors.push('technical_claim_without_evidence');
  }

  return { ok: errors.length === 0, errors };
}
