/**
 * Fakten aus eigener Datenbank – OpenAI formuliert nur daraus.
 */
import { findApprovedKnowledgeAnswer } from '../admin/cleverKnowledgeAnswerService.js';
import { buildAdvisoryAnswer } from '../dealer/dealerAdvisoryAnswerService.js';
import { buildDealerSmartAnswer } from '../dealer/dealerSmartAnswerService.js';
import { getModelTrims } from '../../data/features/trimFeatureMapping.js';
import { KIA_MODEL_ATTRIBUTES } from '../../data/kia/kiaModelAttributes.js';
import { getAdviceTopicById } from './adviceTopicsRegistry.js';
import { matchAdviceTopicByQuery } from './adviceTopicMatcher.js';
import { QUERY_TYPES } from './customerQueryTypes.js';
import { getRankingByMetric } from './customerQueryTools.js';
import { parseSearchIntent } from '../search/searchIntentParser.js';
import { buildSearchProfile } from '../search/searchProfile.js';
import {
  buildDealerFinalChecks,
  buildMixedIntentAnswerText,
  buildMixedOpenQuestions,
  buildUnderstoodWishes,
} from './mixedIntentAnswerBuilder.js';
import { buildModelTechnicalFacts } from './modelTechnicalFactBuilder.js';
import { buildAdvisorProfileFacts } from './advisorProfileAssessment.js';

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

function resolveAdviceTopic(classification, query) {
  const topicId = classification.adviceTopicId ?? classification.topic;
  if (topicId && topicId !== 'general_advice' && topicId !== 'unmatched_advice') {
    return getAdviceTopicById(topicId);
  }
  return matchAdviceTopicByQuery(query);
}

/**
 * @param {object} classification
 * @param {string} query
 */
export function resolveFactsForQuery(classification = {}, query = '') {
  const {
    queryType,
    modelKey,
    featureId,
    topic,
    rankingMetric,
    comparisonModels = [],
  } = classification;

  if (queryType === QUERY_TYPES.SPECIAL_CHECK_QUESTION) {
    return {
      kind: 'dealer_check',
      topic,
      modelKey,
      featureId,
      bullets: ['Das prüft Ihr Autohaus am besten.'],
    };
  }

  if (queryType === QUERY_TYPES.MIXED_INTENT) {
    const intent = classification.searchIntent ?? parseSearchIntent(query);
    const profile = classification.searchProfile ?? buildSearchProfile({ query, intent });
    const answerText = buildMixedIntentAnswerText(classification);
    return {
      kind: 'mixed_intent',
      modelKey: classification.modelKey ?? modelKey,
      primaryModelKey: answerText.primaryModelKey,
      headline: answerText.title,
      shortAnswer: answerText.body,
      understoodWishes: buildUnderstoodWishes(classification, intent, profile),
      dealerFinalChecks: buildDealerFinalChecks(classification),
      openQuestions: buildMixedOpenQuestions(classification),
      questionPart: classification.questionPart,
      vehicleWishPart: classification.vehicleWishPart,
      topic: classification.topic,
      featureId: classification.featureId,
      bullets: [answerText.body],
    };
  }

  if (queryType === QUERY_TYPES.VEHICLE_WISH) {
    const intent = parseSearchIntent(query);
    const profile = buildSearchProfile({ query, intent });
    const advisorProfile = buildAdvisorProfileFacts(query, intent, profile);
    if (advisorProfile) {
      return advisorProfile;
    }
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

  if (queryType === QUERY_TYPES.RANKING_QUESTION && rankingMetric) {
    const ranking = getRankingByMetric(rankingMetric, {
      powertrainFilter: classification.rankingFilter ?? null,
    });
    const bullets = (ranking?.matches ?? []).slice(0, 5).map((match, index) => {
      const detail = match.factLine?.split(' · ')[0] ?? '';
      return `${index + 1}. ${match.label}${detail ? `: ${detail}` : ''}`;
    });
    return {
      kind: 'ranking',
      rankingMetric,
      ranking,
      modelKeys: (ranking?.matches ?? []).map((m) => m.modelKey),
      bullets,
      sources: ['kiaCleverRecords', 'vehicleLexicon'],
    };
  }

  if (queryType === QUERY_TYPES.COMPARISON_QUESTION && comparisonModels.length >= 2) {
    const [modelKeyA, modelKeyB] = comparisonModels;
    const advisory = {
      kind: 'advisory',
      topic: 'comparison',
      modelKeyA,
      modelKeyB,
      query,
    };
    const smartAnswer = buildAdvisoryAnswer(advisory, []);
    return {
      kind: 'comparison',
      comparisonModels,
      smartAnswer,
      modelKeys: comparisonModels,
      bullets: (smartAnswer?.facts ?? []).map((f) => `${f.label}: ${f.value}`),
      sources: ['kiaCleverRecords', 'dealerAdvisoryAnswer'],
    };
  }

  if (queryType === QUERY_TYPES.ADVICE_QUESTION) {
    if (topic === 'unmatched_advice' || (!classification.adviceTopicId && topic === 'general_advice')) {
      return {
        kind: 'advice_unmatched',
        topic: 'unmatched_advice',
        headline: null,
        shortAnswer: null,
        usefulWhen: [],
        dealerChecks: ['individuelle Beratung', 'passendes Modell', 'Verfügbarkeit'],
        dealerCheckHint: 'Ihr Autohaus beantwortet Detailfragen zur konkreten Ausstattung.',
        bullets: [],
        sources: ['openai_advisor_pending'],
      };
    }

    const adviceTopic = resolveAdviceTopic(classification, query);
    if (adviceTopic) {
      return {
        kind: 'advice_topic',
        adviceTopicId: adviceTopic.id,
        topic: adviceTopic.id,
        featureId: adviceTopic.featureId ?? featureId,
        label: adviceTopic.label,
        headline: adviceTopic.label,
        shortAnswer: adviceTopic.shortAnswer,
        usefulWhen: adviceTopic.usefulWhen ?? [],
        lessImportantWhen: adviceTopic.lessImportantWhen ?? [],
        dealerCheckHint: adviceTopic.dealerCheckHint,
        dealerChecks: adviceTopic.dealerChecks ?? [],
        relatedQuestions: adviceTopic.relatedQuestions ?? [],
        ctaLabel: adviceTopic.ctaLabel ?? 'Verkäufer dazu fragen',
        secondaryCtaLabel: adviceTopic.secondaryCtaLabel ?? null,
        needsDealerCheck: Boolean(adviceTopic.needsDealerCheck),
        bullets: [adviceTopic.shortAnswer, ...(adviceTopic.usefulWhen ?? []).slice(0, 3)],
        sources: ['adviceTopicsRegistry'],
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
    const technicalFacts = buildModelTechnicalFacts(classification, query);
    if (technicalFacts) {
      return technicalFacts;
    }

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
