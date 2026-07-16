/**
 * Modell-Routing: Luna Standard, Terra kontrollierte Eskalation.
 */
import { getCleverAiConfig } from '../openai/cleverConversationConfig.js';

export const ESCALATION_REASONS = {
  CONFLICTING_REQUIREMENTS: 'conflicting_hard_requirements',
  COMPETING_VEHICLES: 'competing_vehicle_directions',
  UNCLEAR_MODEL: 'unclear_model_variant',
  INTERNAL_DATA_CONFLICT: 'internal_data_conflict',
  COMPLEX_COMPARISON: 'complex_multi_model_comparison',
  SCHEMA_ERROR: 'repeated_schema_error',
  GROUNDING_ERROR: 'repeated_grounding_error',
};

const UNCLEAR_MODEL_PATTERN = /\b(neu(?:es|er|e)?|unbekannt|xyz|modell\s*\?)\b/i;
const COMPETING_PATTERN = /\b(entweder|oder\s+(?:der|die|das)|vs\.?|versus|vergleich)\b/i;

/**
 * @param {object} params
 * @param {string} [params.customerMessage]
 * @param {object|null} [params.needProfile]
 * @param {string|null} [params.groundingFailureReason]
 * @param {boolean} [params.hadInternalConflict]
 */
export function evaluateCleverModelEscalation(params = {}, env = process.env) {
  const config = getCleverAiConfig(env);
  if (env.CLEVER_AI_ESCALATION_ENABLED !== 'true') {
    return { shouldEscalate: false, reason: null, primaryModel: config.model, escalationModel: config.escalationModel };
  }

  const message = String(params.customerMessage ?? '');
  const profile = params.needProfile ?? {};
  const reasons = [];

  if (params.hadInternalConflict) {
    reasons.push(ESCALATION_REASONS.INTERNAL_DATA_CONFLICT);
  }
  if (params.groundingFailureReason) {
    reasons.push(ESCALATION_REASONS.GROUNDING_ERROR);
  }
  if (UNCLEAR_MODEL_PATTERN.test(message)) {
    reasons.push(ESCALATION_REASONS.UNCLEAR_MODEL);
  }
  if (COMPETING_PATTERN.test(message)) {
    reasons.push(ESCALATION_REASONS.COMPETING_VEHICLES);
  }
  if (/\bvergleich\b/i.test(message) && /\bund\b/i.test(message)) {
    reasons.push(ESCALATION_REASONS.COMPLEX_COMPARISON);
  }

  const hardFuel = profile.fuel;
  const hardSeats = profile.persons;
  const hardTowing = profile.towingCapacityKg ?? profile.minimumTowingCapacityKg;
  if (hardFuel === 'electric' && hardTowing >= 2000 && hardSeats >= 7) {
    reasons.push(ESCALATION_REASONS.CONFLICTING_REQUIREMENTS);
  }

  const shouldEscalate = reasons.length > 0;
  return {
    shouldEscalate,
    reason: shouldEscalate ? reasons[0] : null,
    reasons,
    primaryModel: config.model,
    escalationModel: config.escalationModel,
  };
}

/**
 * Einfache Reichweitenfrage mit internem Fakt → keine Eskalation.
 * @param {string} customerMessage
 */
export function isSimpleInternalKnowledgeQuestion(customerMessage = '') {
  return /\b(reichweite|weit\s+kommt|anhängelast|sitze|batterie|ladezeit)\b/i.test(customerMessage)
    && !/\b(vergleich|entweder|oder)\b/i.test(customerMessage);
}
