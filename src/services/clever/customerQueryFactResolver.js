/**
 * Fakten aus eigener Datenbank – OpenAI formuliert nur daraus.
 */
import { findApprovedKnowledgeAnswer } from '../admin/cleverKnowledgeAnswerService.js';
import { buildAdvisoryAnswer } from '../dealer/dealerAdvisoryAnswerService.js';
import { buildDealerSmartAnswer } from '../dealer/dealerSmartAnswerService.js';
import { getModelTrims } from '../../data/features/trimFeatureMapping.js';
import { KIA_MODEL_ATTRIBUTES } from '../../data/kia/kiaModelAttributes.js';
import { getAdviceTopicById, matchAdviceTopic } from './adviceTopicCatalog.js';
import { QUERY_TYPES } from './customerQueryTypes.js';
import { parseSearchIntent } from '../search/searchIntentParser.js';
import { buildSearchProfile } from '../search/searchProfile.js';

function modelLabel(modelKey) {
  const label = KIA_MODEL_ATTRIBUTES[modelKey]?.label;
  return label ? `Kia ${label}` : modelKey;
}

function resolveFeatureAvailability(modelKey, featureId) {
  if (!modelKey || !featureId) return null;
  const trims = getModelTrims(modelKey) ?? [];
  const standardTrim = trims.find((t) => t.standardFeatures?.includes(featureId));
  if (standardTrim) {
    return {
      status: 'standard',
      trimName: standardTrim.name,
      label: `Serienmäßig ab Ausstattung ${standardTrim.name}`,
    };
  }
  const packageTrim = trims.find((t) => t.availableViaPackage?.includes(featureId));
  if (packageTrim) {
    return {
      status: 'optional',
      trimName: packageTrim.name,
      label: `Optional ab Ausstattung ${packageTrim.name}`,
    };
  }
  const blocked = trims.length > 0 && trims.every((t) => t.notAvailable?.includes(featureId));
  if (blocked) {
    return { status: 'not_available', label: 'Laut Ausstattungslogik nicht vorgesehen' };
  }
  return { status: 'unknown', label: 'Verfügbarkeit im Bestand prüfen' };
}

/**
 * @param {object} classification
 * @param {string} query
 */
export function resolveFactsForQuery(classification = {}, query = '') {
  const { queryType, modelKey, featureId, topic } = classification;

  if (queryType === QUERY_TYPES.SPECIAL_CHECK_QUESTION) {
    return {
      kind: 'dealer_check',
      topic,
      modelKey,
      featureId,
      bullets: ['Das prüft Ihr Autohaus am besten.'],
    };
  }

  if (queryType === QUERY_TYPES.VEHICLE_WISH) {
    const intent = parseSearchIntent(query);
    const profile = buildSearchProfile({ query, intent });
    return {
      kind: 'vehicle_wish',
      profile,
      intent,
      bullets: [],
    };
  }

  const approved = findApprovedKnowledgeAnswer(query, modelKey);
  if (approved) {
    return {
      kind: 'approved_knowledge',
      approvedAnswer: approved,
      modelKey: approved.modelKey ?? modelKey,
      bullets: [approved.answerText],
      sources: ['cleverKnowledge'],
    };
  }

  if (queryType === QUERY_TYPES.ADVICE_QUESTION) {
    const advice = getAdviceTopicById(topic) ?? matchAdviceTopic(query);
    if (advice) {
      return {
        kind: 'advice_snippets',
        topic: advice.topic,
        featureId: advice.featureId ?? featureId,
        headline: advice.headline,
        snippets: advice.snippets,
        bullets: advice.snippets,
        sources: ['adviceTopicCatalog'],
      };
    }
    return {
      kind: 'advice_snippets',
      topic: topic ?? 'general_advice',
      headline: 'Clever Beratung',
      snippets: [
        'Das hängt von Ihrem Alltag, Budget und den konkreten Modellen ab.',
        'Ihr Autohaus kann die passende Ausstattung und Rate mit Ihnen durchgehen.',
      ],
      bullets: [],
      sources: ['generic_advice'],
    };
  }

  if (queryType === QUERY_TYPES.MODEL_EQUIPMENT_QUESTION) {
    const availability = resolveFeatureAvailability(modelKey, featureId);
    const advisory = modelKey && featureId
      ? buildAdvisoryAnswer({ kind: 'advisory', topic: 'feature', modelKey, featureId, query }, [])
      : null;
    const smartAnswer = buildDealerSmartAnswer(query, []);

    const bullets = [];
    if (availability?.label) bullets.push(availability.label);
    if (advisory?.summary) bullets.push(advisory.summary);
    if (advisory?.facts?.length) {
      advisory.facts.forEach((fact) => bullets.push(`${fact.label}: ${fact.value}`));
    }

    return {
      kind: 'model_equipment',
      modelKey,
      featureId,
      modelLabel: modelKey ? modelLabel(modelKey) : null,
      availability,
      advisory,
      smartAnswer,
      bullets,
      sources: ['trimFeatureMapping', 'dealerAdvisoryAnswer', 'dealerSmartAnswer'],
    };
  }

  return { kind: 'unknown', bullets: [] };
}
