/**
 * Datenqualität je Antwort – für UI und CRM.
 */
import { DATA_CONFIDENCE, KNOWLEDGE_ROUTES } from './customerQueryTypes.js';

/**
 * @param {object} facts
 */
export function hasVerifiedCleverFacts(facts = {}) {
  if (facts.kind === 'approved_knowledge') return true;
  if (facts.kind === 'ranking' || facts.kind === 'comparison') return true;
  if (facts.kind === 'model_detail' || facts.kind === 'family_variant_advice') return true;
  if (facts.kind === 'model_technical') return Boolean(facts.hasVerifiedData);
  if (facts.kind === 'advisor_profile') return true;

  if (facts.kind === 'model_equipment') {
    if (facts.featureId && facts.availability?.status !== 'unknown') return true;
    if (facts.smartAnswer?.facts?.length > 0 && facts.featureId) return true;
    if (facts.availability?.status === 'standard' || facts.availability?.status === 'optional') {
      return true;
    }
    const narrative = facts.smartAnswer?.narrative?.join(' ') ?? '';
    const lead = facts.smartAnswer?.lead ?? '';
    const combined = `${narrative} ${lead} ${(facts.bullets ?? []).join(' ')}`;
    if (/\d+\s*(?:Liter|km|kW|PS)/i.test(combined)) return true;
    if (/wärmepumpe|serienmäßig|optional ab/i.test(combined) && facts.featureId) return true;
    return false;
  }

  return false;
}

/**
 * @param {object} params
 */
export function resolveDataConfidence({
  classification = {},
  facts = {},
  knowledgeRoute = {},
  answerSource = null,
} = {}) {
  if (knowledgeRoute.route === KNOWLEDGE_ROUTES.DEALER_CHECK
    || classification.needsDealerCheck
    || facts.kind === 'dealer_data_required'
    || facts.kind === 'dealer_check') {
    return DATA_CONFIDENCE.NEEDS_DEALER_CHECK;
  }

  if (hasVerifiedCleverFacts(facts)
    || facts.kind === 'advice_topic'
    || answerSource === 'approved_knowledge'
    || answerSource === 'vehicle_lexicon_ranking'
    || answerSource === 'dealer_smart_answer') {
    return DATA_CONFIDENCE.CLEVER_VERIFIED;
  }

  return DATA_CONFIDENCE.GENERAL;
}
