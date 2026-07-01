/**
 * Regelbasierte Klassifikation – Fallback ohne OpenAI.
 */
import { detectModelKeyInQuery, parseModelAttributeQuestion } from '../search/modelAttributeQuestion.js';
import { parseAdvisoryQuestion } from '../search/advisoryQuestionParser.js';
import { analyzeCustomerQueryType } from '../search/customerQueryType.js';
import { parseSearchIntent } from '../search/searchIntentParser.js';
import { buildSearchProfile } from '../search/searchProfile.js';
import { isShoppingCriteriaQuery } from '../search/customerQueryHelpers.js';
import {
  buildFallbackSpecialQuestion,
  detectSpecialCustomerQuestion,
} from '../dealer/specialCustomerQuestionService.js';
import { classifyAdviceFromTopics } from './adviceTopicMatcher.js';
import {
  detectCompetitorComparison,
  detectDealerDataQuery,
  detectGeneralCarComparison,
  detectGeneralCarQuestion,
  isPurchaseIntentQuery,
} from './generalCarQueryDetector.js';
import { normalizeClassification, QUERY_TYPES, RANKING_METRICS } from './customerQueryTypes.js';
import { detectMixedIntent } from './mixedIntentDetector.js';
import { detectModelTechnicalQuestion } from './modelTechnicalTopicDetector.js';
import { detectAdvisorProfileAssessment } from './advisorProfileAssessment.js';

const ADVICE_MARKERS = /\b(warum|wofür|wofuer|brauche?\s+ich|lohnt|sinnvoll|empfehl|unterschied|was\s+bringt|bringt|nutzen|vorteil|vorteile|gut|reicht|mit\s+oder\s+ohne)\b/i;

const VEHICLE_WISH_VERBS = /\b(suche|suchen|möchte|moechte|zeig(?:e|en)?\s+mir|finde|interessier(?:t|e))\b/i;

function isModelFeatureVehicleWish(text, modelKey, featureId) {
  if (!modelKey || !featureId) return false;
  if (/mit\s+oder\s+ohne|verfügbar|serie|ausstattung|hat\s+der|hat\s+die|haben\s+sie/i.test(text)) {
    return false;
  }
  if (VEHICLE_WISH_VERBS.test(text)) return true;
  if (/\bmit\b/i.test(text)) return true;
  return false;
}

function detectFeatureId(text) {
  if (/wärmepumpe|waermepumpe/i.test(text)) return 'heat_pump';
  if (/allrad|4x4|awd/i.test(text)) return 'awd';
  if (/sitzheizung/i.test(text)) return 'heated_seats';
  if (/360|kamera/i.test(text)) return 'camera_360';
  if (/anhängerkupplung|ahk|anhängelast|anhaengelast|zuglast/i.test(text)) return 'towbar';
  return null;
}

/**
 * @param {string} text
 * @param {object} intent
 */
export function detectRankingMetric(text, intent = {}) {
  if (intent.rangeRanking === 'max'
    || /\b(am\s+)?weitesten\b/i.test(text)
    || /\bmit\s+welche[mn]?\s+.{0,50}(weitesten|reichweite)\b/i.test(text)
    || /\b(längste|laengste|höchste|hoechste|meiste[nr]?)\s+(?:wltp[-\s]*)?reichweite\b/i.test(text)
    || /\b(?:reichweite|wltp)\s+(?:am\s+)?(?:weitesten|meisten|höchsten|hoechsten|größten|groessten|längsten|laengsten)\b/i.test(text)) {
    return RANKING_METRICS.WLTP_RANGE;
  }

  if (/\b(größte[nr]?|groesste[nr]?|meisten)\s+kofferraum\b/i.test(text)
    || /\bkofferraum\b.{0,40}(größte|groesste|meisten)\b/i.test(text)
    || /\bwelch(er|es|e)\s+(?:kia\s+)?(?:hat\s+)?(?:den\s+)?größte[nr]?\s+kofferraum\b/i.test(text)
    || /\bwelch(er|es|e)\s+.{0,30}kofferraum\b/i.test(text)) {
    return RANKING_METRICS.TRUNK_VOLUME;
  }

  if (/\b(größte[nr]?|höchste[nr]?|hoechste[nr]?)\s+anhängelast\b/i.test(text)
    || /\bwelch(er|es|e)\s+.{0,40}anhängelast\b/i.test(text)
    || /\bzieht\s+am\s+(meisten|viel)\b/i.test(text)
    || /\bwelch(er|es|e)\s+.{0,40}zieht\b/i.test(text)) {
    return RANKING_METRICS.TOWING;
  }

  if (/\b(längste[nr]?|laengste[nr]?)\s+(?:kia|auto|fahrzeug|modell)\b/i.test(text)
    || /\bwelch(er|es|e)\s+(?:kia\s+)?(?:ist\s+)?(?:am\s+)?längste[nr]?\b/i.test(text)) {
    return RANKING_METRICS.LENGTH;
  }

  if (/\b(größte[nr]?|groesste[nr]?|längste[nr]?|laengste[nr]?)\b/i.test(text)
    && /\b(e-?auto|elektroauto|elektro|elektrofahrzeug|auto|fahrzeug|suv|kia|modell)\b/i.test(text)
    && !/\bkofferraum\b/i.test(text)
    && !/\breichweite\b/i.test(text)) {
    return RANKING_METRICS.LENGTH;
  }

  return null;
}

/**
 * @param {string} text
 * @param {object} [intent]
 */
export function detectRankingContext(text, intent = {}) {
  const metric = detectRankingMetric(text, intent);
  if (!metric) return null;

  const powertrainFilter = /\b(e-?auto|elektroauto|elektro|elektrisch|elektrofahrzeug)\b/i.test(text)
    ? 'elektro'
    : null;

  return { metric, powertrainFilter };
}

/**
 * @param {string} text
 * @param {object|null} advisory
 */
export function detectComparisonModels(text, advisory = null) {
  if (advisory?.topic === 'comparison' && advisory.modelKeyA && advisory.modelKeyB) {
    return [advisory.modelKeyA, advisory.modelKeyB];
  }
  return null;
}

/**
 * @param {string} query
 * @param {object} [context]
 */
export function classifyWithRules(query = '', context = {}) {
  const text = String(query).trim();
  const intent = parseSearchIntent(text);
  const profile = buildSearchProfile({ query: text, intent });
  const legacyQueryType = analyzeCustomerQueryType(text, intent, profile);
  const advisory = parseAdvisoryQuestion(text);
  const modelKey = context.modelKey ?? detectModelKeyInQuery(text) ?? advisory?.modelKey ?? null;
  const featureId = detectFeatureId(text) ?? advisory?.featureId ?? null;
  const adviceFromTopics = classifyAdviceFromTopics(text, { modelKey });
  const comparisonModels = detectComparisonModels(text, advisory);
  const rankingContext = detectRankingContext(text, intent);

  const mixed = detectMixedIntent(text, { modelKey, modelLabel: context.modelLabel });
  if (mixed) {
    return normalizeClassification(mixed);
  }

  const special = detectSpecialCustomerQuestion(text, { modelKey, modelLabel: context.modelLabel })
    ?? buildFallbackSpecialQuestion(text, { modelKey, modelLabel: context.modelLabel });

  if (special && special.status === 'needs_dealer_check'
    && (special.category !== 'Sonstiges' || /montier|nachrüst|zubehör|windabweiser|dachbox/i.test(text))) {
    return normalizeClassification({
      queryType: QUERY_TYPES.SPECIAL_CHECK_QUESTION,
      topic: special.category,
      modelKey: special.modelKey,
      featureId,
      customerIntent: 'Kunde fragt etwas, das das Autohaus prüfen sollte',
      shouldShowModels: false,
      shouldAskForContact: true,
      needsDealerCheck: true,
      confidence: 0.82,
      source: 'rules',
    });
  }

  if (isPurchaseIntentQuery(text)) {
    return normalizeClassification({
      queryType: QUERY_TYPES.PURCHASE_INTENT,
      topic: 'purchase_intent',
      modelKey,
      customerIntent: 'Kunde möchte Kontakt oder Angebot',
      shouldShowModels: false,
      shouldAskForContact: true,
      needsDealerCheck: true,
      confidence: 0.88,
      source: 'rules',
    });
  }

  const dealerData = detectDealerDataQuery(text);
  if (dealerData?.needsDealerCheck && modelKey) {
    return normalizeClassification({
      queryType: QUERY_TYPES.MODEL_EQUIPMENT_QUESTION,
      topic: dealerData.kind,
      modelKey,
      featureId,
      customerIntent: 'Konkrete Händler-/Angebotsdaten erforderlich',
      shouldShowModels: false,
      shouldAskForContact: true,
      needsDealerCheck: true,
      confidence: 0.86,
      source: 'rules',
    });
  }

  const competitorCmp = detectCompetitorComparison(text);
  if (competitorCmp) {
    return normalizeClassification({
      queryType: competitorCmp.queryType,
      topic: competitorCmp.topic,
      modelKey: competitorCmp.hasKia ? (modelKey ?? 'ev9') : null,
      customerIntent: `Fremdmarkenvergleich: ${competitorCmp.competitors.join(' vs ')}`,
      shouldShowModels: false,
      shouldAskForContact: false,
      needsDealerCheck: false,
      confidence: 0.84,
      source: 'rules',
    });
  }

  const generalCmp = detectGeneralCarComparison(text);
  if (generalCmp && !modelKey) {
    return normalizeClassification({
      queryType: generalCmp.queryType,
      topic: generalCmp.topic,
      customerIntent: 'Allgemeiner Antriebsvergleich',
      shouldShowModels: false,
      shouldAskForContact: false,
      confidence: 0.8,
      source: 'rules',
    });
  }

  const generalQ = detectGeneralCarQuestion(text);
  if (generalQ && !modelKey && !rankingContext) {
    return normalizeClassification({
      queryType: generalQ.queryType,
      topic: generalQ.topic,
      customerIntent: 'Allgemeine Auto-Frage',
      shouldShowModels: false,
      shouldAskForContact: false,
      confidence: 0.75,
      source: 'rules',
    });
  }

  if (comparisonModels?.length === 2) {
    return normalizeClassification({
      queryType: QUERY_TYPES.COMPARISON_QUESTION,
      topic: 'comparison',
      modelKey: comparisonModels[0],
      modelKeys: comparisonModels,
      comparisonModels,
      featureId,
      customerIntent: `Vergleich ${comparisonModels.join(' vs ')}`,
      shouldShowModels: true,
      shouldAskForContact: false,
      needsDealerCheck: false,
      confidence: 0.88,
      source: 'rules',
    });
  }

  if (rankingContext && !comparisonModels) {
    return normalizeClassification({
      queryType: QUERY_TYPES.RANKING_QUESTION,
      topic: rankingContext.powertrainFilter
        ? `${rankingContext.metric}_elektro`
        : rankingContext.metric,
      modelKey: null,
      rankingMetric: rankingContext.metric,
      rankingFilter: rankingContext.powertrainFilter,
      featureId,
      customerIntent: rankingContext.powertrainFilter
        ? `Größtes Elektroauto (${rankingContext.metric})`
        : `Ranking nach ${rankingContext.metric}`,
      shouldShowModels: true,
      shouldAskForContact: false,
      needsDealerCheck: false,
      confidence: 0.85,
      source: 'rules',
    });
  }

  const technicalQ = detectModelTechnicalQuestion(text, { modelKey });
  if (technicalQ) {
    return normalizeClassification({
      queryType: QUERY_TYPES.MODEL_EQUIPMENT_QUESTION,
      topic: technicalQ.topic,
      modelKey: technicalQ.modelKey,
      featureId: technicalQ.featureId ?? featureId,
      adviceTopicId: technicalQ.adviceTopicId ?? null,
      customerIntent: `Technische Frage: ${technicalQ.topic}`,
      shouldShowModels: false,
      shouldAskForContact: false,
      needsDealerCheck: false,
      confidence: 0.9,
      source: 'rules',
    });
  }

  const advisorProfile = detectAdvisorProfileAssessment(text, intent, profile);
  if (advisorProfile) {
    return normalizeClassification({
      queryType: QUERY_TYPES.VEHICLE_WISH,
      topic: 'advisor_profile_assessment',
      answerType: 'clever_assessment',
      modelKey: advisorProfile.primaryModelKey,
      featureId,
      customerIntent: 'Komplexes Bedarfsprofil mit Clever-Einschätzung',
      shouldShowModels: false,
      shouldAskForContact: false,
      needsDealerCheck: false,
      confidence: 0.9,
      source: 'advisor_profile',
    });
  }

  const modelAttributeQ = !VEHICLE_WISH_VERBS.test(text)
    && parseModelAttributeQuestion(text);
  if (modelAttributeQ) {
    const attrTopic = modelAttributeQ.attribute === 'vertical_load' ? 'vertical_load'
      : modelAttributeQ.attribute === 'charging' ? 'charging_speed'
        : modelAttributeQ.attribute === 'isofix' ? 'isofix'
          : modelAttributeQ.attribute;
    return normalizeClassification({
      queryType: QUERY_TYPES.MODEL_EQUIPMENT_QUESTION,
      topic: attrTopic,
      modelKey: modelAttributeQ.modelKey,
      featureId,
      customerIntent: `Technische Frage: ${attrTopic}`,
      shouldShowModels: false,
      shouldAskForContact: false,
      needsDealerCheck: false,
      confidence: 0.88,
      source: 'rules',
    });
  }

  if (modelKey && /^hat\s+/i.test(text.trim())) {
    return normalizeClassification({
      queryType: QUERY_TYPES.MODEL_EQUIPMENT_QUESTION,
      topic: 'feature',
      modelKey,
      featureId,
      customerIntent: 'Konkrete Ausstattungsfrage',
      shouldShowModels: true,
      shouldAskForContact: false,
      confidence: 0.82,
      source: 'rules',
    });
  }

  if (isShoppingCriteriaQuery(text, intent, profile) && !comparisonModels && !rankingContext) {
    const isShortModelAttribute = modelKey
      && !VEHICLE_WISH_VERBS.test(text)
      && !/\?/.test(text)
      && text.split(/\s+/).filter(Boolean).length <= 5
      && (featureId || /wärmepumpe|waermepumpe|ausstattung|serie|kofferraum|reichweite/i.test(text));
    if (!isShortModelAttribute) {
      return normalizeClassification({
        queryType: QUERY_TYPES.VEHICLE_WISH,
        topic: 'vehicle_search',
        modelKey,
        featureId,
        customerIntent: 'Fahrzeugwunsch mit Kriterien',
        shouldShowModels: true,
        shouldAskForContact: false,
        confidence: 0.78,
        source: 'rules',
      });
    }
  }

  if (adviceFromTopics && !comparisonModels) {
    return normalizeClassification({
      queryType: QUERY_TYPES.ADVICE_QUESTION,
      topic: adviceFromTopics.topic,
      adviceTopicId: adviceFromTopics.adviceTopicId,
      modelKey: null,
      featureId: adviceFromTopics.featureId,
      customerIntent: adviceFromTopics.adviceTopicId
        ? `Beratung: ${adviceFromTopics.adviceTopicId}`
        : 'Offene Beratungsfrage',
      shouldShowModels: false,
      shouldAskForContact: adviceFromTopics.shouldAskForContact,
      needsDealerCheck: adviceFromTopics.needsDealerCheck,
      confidence: adviceFromTopics.confidence,
      source: 'rules',
    });
  }

  if (ADVICE_MARKERS.test(text) && featureId && !modelKey && !/\bwelch(er|es|e)\b/i.test(text)) {
    return normalizeClassification({
      queryType: QUERY_TYPES.ADVICE_QUESTION,
      topic: featureId ? `${featureId}_benefit` : 'general_advice',
      modelKey: null,
      featureId,
      customerIntent: 'Allgemeine Beratungsfrage',
      shouldShowModels: false,
      shouldAskForContact: false,
      confidence: 0.65,
      source: 'rules',
    });
  }

  if (modelKey && featureId && isModelFeatureVehicleWish(text, modelKey, featureId)) {
    return normalizeClassification({
      queryType: QUERY_TYPES.VEHICLE_WISH,
      topic: 'vehicle_search',
      modelKey,
      featureId,
      customerIntent: 'Fahrzeugwunsch mit Ausstattungswunsch',
      shouldShowModels: true,
      shouldAskForContact: false,
      confidence: 0.76,
      source: 'rules',
    });
  }

  if (legacyQueryType === 'knowledge' || legacyQueryType === 'compare') {
    const isModelQuestion = Boolean(modelKey)
      || advisory?.topic === 'feature'
      || Boolean(advisory?.modelKey);
    if ((isModelQuestion || featureId) && modelKey) {
      return normalizeClassification({
        queryType: QUERY_TYPES.MODEL_EQUIPMENT_QUESTION,
        topic: advisory?.topic ?? 'feature',
        modelKey,
        featureId,
        customerIntent: 'Konkrete Modell- oder Ausstattungsfrage',
        shouldShowModels: Boolean(modelKey),
        shouldAskForContact: false,
        confidence: modelKey ? 0.8 : 0.6,
        source: 'rules',
      });
    }
    if (adviceFromTopics) {
      return normalizeClassification({
        queryType: QUERY_TYPES.ADVICE_QUESTION,
        topic: adviceFromTopics.topic,
        adviceTopicId: adviceFromTopics.adviceTopicId,
        modelKey: null,
        featureId: adviceFromTopics.featureId,
        customerIntent: 'Beratungsfrage',
        shouldShowModels: false,
        shouldAskForContact: adviceFromTopics.shouldAskForContact,
        needsDealerCheck: adviceFromTopics.needsDealerCheck,
        confidence: adviceFromTopics.confidence,
        source: 'rules',
      });
    }
  }

  if (modelKey && (featureId || /mit\s+oder\s+ohne|verfügbar|serie|ausstattung/i.test(text))) {
    return normalizeClassification({
      queryType: QUERY_TYPES.MODEL_EQUIPMENT_QUESTION,
      topic: 'feature_compare',
      modelKey,
      featureId,
      customerIntent: `Ausstattungsfrage zu ${modelKey}`,
      shouldShowModels: true,
      shouldAskForContact: false,
      confidence: 0.76,
      source: 'rules',
    });
  }

  if (isShoppingCriteriaQuery(text, intent, profile) || legacyQueryType === 'search' || legacyQueryType === 'purchase') {
    return normalizeClassification({
      queryType: QUERY_TYPES.VEHICLE_WISH,
      topic: 'vehicle_search',
      modelKey,
      featureId,
      customerIntent: 'Fahrzeugwunsch mit Kriterien',
      shouldShowModels: true,
      shouldAskForContact: false,
      confidence: 0.7,
      source: 'rules',
    });
  }

  if ((text.includes('?') || ADVICE_MARKERS.test(text)) && !/\bwelch(er|es|e)\b/i.test(text)) {
    const retryAdvice = classifyAdviceFromTopics(text, { modelKey });
    return normalizeClassification({
      queryType: QUERY_TYPES.ADVICE_QUESTION,
      topic: retryAdvice?.topic ?? 'general_advice',
      adviceTopicId: retryAdvice?.adviceTopicId ?? null,
      modelKey: retryAdvice?.matched ? null : modelKey,
      featureId,
      customerIntent: 'Offene Beratungsfrage',
      shouldShowModels: false,
      shouldAskForContact: retryAdvice?.shouldAskForContact ?? false,
      needsDealerCheck: retryAdvice?.needsDealerCheck ?? false,
      confidence: retryAdvice?.confidence ?? 0.45,
      source: 'rules',
    });
  }

  if (/\bwelch(er|es|e)\b/i.test(text)) {
    const retryRanking = detectRankingContext(text, intent);
    if (retryRanking) {
      return normalizeClassification({
        queryType: QUERY_TYPES.RANKING_QUESTION,
        topic: retryRanking.powertrainFilter
          ? `${retryRanking.metric}_elektro`
          : retryRanking.metric,
        rankingMetric: retryRanking.metric,
        rankingFilter: retryRanking.powertrainFilter,
        featureId,
        customerIntent: 'Ranking-Frage',
        shouldShowModels: true,
        shouldAskForContact: false,
        confidence: 0.75,
        source: 'rules',
      });
    }
    return normalizeClassification({
      queryType: QUERY_TYPES.UNKNOWN,
      topic: 'unclassified_question',
      modelKey,
      featureId,
      customerIntent: 'Frage konnte nicht eindeutig zugeordnet werden',
      shouldShowModels: false,
      shouldAskForContact: false,
      confidence: 0.35,
      source: 'rules',
    });
  }

  return normalizeClassification({
    queryType: QUERY_TYPES.VEHICLE_WISH,
    topic: 'vehicle_search',
    modelKey,
    featureId,
    customerIntent: 'Fahrzeugsuche',
    shouldShowModels: true,
    shouldAskForContact: false,
    confidence: 0.55,
    source: 'rules',
  });
}
