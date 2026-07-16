/**
 * CleverTurnResult – JSON-Schema und Validierung.
 */
import { buildNeedProfilePatchJsonSchema } from './needProfilePatch.js';

export const CLEVER_TURN_INTENTS = [
  'knowledge_question',
  'vehicle_discovery',
  'need_statement',
  'offer_preparation',
  'correction',
  'handoff_request',
  'other_vehicle_related',
];

export const NEXT_ACTION_TYPES = [
  'none',
  'ask_vehicle_disambiguation',
  'ask_offer_parameter',
  'offer_handoff',
];

export const NEXT_ACTION_REASONS = [
  'need_clarification',
  'vehicle_disambiguation',
  'offer_parameter',
  'customer_uncertainty',
  'handoff_contact',
];

export const VEHICLE_DIRECTION_STATUSES = ['candidate', 'interesting', 'excluded'];

export const OFFER_PARAMETER_FIELDS = [
  'purchaseType',
  'annualMileage',
  'durationMonths',
  'downPayment',
  'neededBy',
];

export function buildCleverTurnResultJsonSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: [
      'reply',
      'intent',
      'needProfilePatch',
      'vehicleDirections',
      'nextAction',
      'handoff',
      'usedFactIds',
      'evidence',
    ],
    properties: {
      reply: { type: 'string' },
      intent: { type: 'string', enum: CLEVER_TURN_INTENTS },
      needProfilePatch: buildNeedProfilePatchJsonSchema(),
      vehicleDirections: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['modelKey', 'variantKey', 'status', 'reason', 'verifiedFactIds'],
          properties: {
            modelKey: { type: 'string' },
            variantKey: { type: ['string', 'null'] },
            status: { type: 'string', enum: VEHICLE_DIRECTION_STATUSES },
            reason: { type: 'string' },
            verifiedFactIds: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      nextAction: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'targetField', 'question', 'options', 'reason'],
        properties: {
          type: { type: 'string', enum: NEXT_ACTION_TYPES },
          targetField: { type: ['string', 'null'] },
          question: { type: ['string', 'null'] },
          options: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['label', 'value'],
              properties: {
                label: { type: 'string' },
                value: { type: 'string' },
              },
            },
          },
          reason: { type: ['string', 'null'] },
        },
      },
      handoff: {
        type: 'object',
        additionalProperties: false,
        required: ['requested', 'ready', 'summary'],
        properties: {
          requested: { type: 'boolean' },
          ready: { type: 'boolean' },
          summary: { type: ['string', 'null'] },
        },
      },
      usedFactIds: { type: 'array', items: { type: 'string' } },
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
    },
  };
}

export const CLEVER_TURN_RESULT_JSON_SCHEMA = {
  name: 'clever_turn_result',
  strict: true,
  schema: buildCleverTurnResultJsonSchema(),
};

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * @param {unknown} value
 * @returns {{ ok: boolean, result?: object, errors?: string[] }}
 */
export function validateCleverTurnResult(value) {
  const errors = [];
  if (!value || typeof value !== 'object') {
    return { ok: false, errors: ['not_an_object'] };
  }

  const result = /** @type {Record<string, unknown>} */ (value);

  if (!isNonEmptyString(result.reply)) errors.push('missing_reply');
  if (!CLEVER_TURN_INTENTS.includes(String(result.intent))) errors.push('invalid_intent');
  if (!result.needProfilePatch || typeof result.needProfilePatch !== 'object') {
    errors.push('missing_needProfilePatch');
  }
  if (!Array.isArray(result.vehicleDirections)) errors.push('missing_vehicleDirections');
  if (!result.nextAction || typeof result.nextAction !== 'object') errors.push('missing_nextAction');
  if (!NEXT_ACTION_TYPES.includes(String(result.nextAction?.type))) errors.push('invalid_nextAction_type');
  if (!result.handoff || typeof result.handoff !== 'object') errors.push('missing_handoff');
  if (!Array.isArray(result.usedFactIds)) errors.push('missing_usedFactIds');
  if (!Array.isArray(result.evidence)) errors.push('missing_evidence');

  if (result.nextAction?.type !== 'none') {
    const reason = result.nextAction?.reason;
    if (reason && !NEXT_ACTION_REASONS.includes(String(reason))) {
      errors.push('invalid_nextAction_reason');
    }
    if (result.nextAction?.type === 'ask_offer_parameter') {
      const field = result.nextAction?.targetField;
      if (!OFFER_PARAMETER_FIELDS.includes(String(field))) {
        errors.push('invalid_offer_parameter_field');
      }
    }
  }

  return errors.length ? { ok: false, errors } : { ok: true, result };
}
