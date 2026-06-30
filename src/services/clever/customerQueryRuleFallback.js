/**
 * Regelbasierte Klassifikation – Fallback ohne OpenAI.
 */
import { detectModelKeyInQuery } from '../search/modelAttributeQuestion.js';
import { parseAdvisoryQuestion } from '../search/advisoryQuestionParser.js';
import { analyzeCustomerQueryType } from '../search/customerQueryType.js';
import { parseSearchIntent } from '../search/searchIntentParser.js';
import { buildSearchProfile } from '../search/searchProfile.js';
import { isShoppingCriteriaQuery } from '../search/customerQueryHelpers.js';
import {
  buildFallbackSpecialQuestion,
  detectSpecialCustomerQuestion,
} from '../dealer/specialCustomerQuestionService.js';
import { matchAdviceTopic } from './adviceTopicCatalog.js';
import { normalizeClassification, QUERY_TYPES } from './customerQueryTypes.js';

const ADVICE_MARKERS = /\b(warum|brauche?\s+ich|lohnt|sinnvoll|besser|empfehl|unterschied|vergleich|oder)\b/i;

function detectFeatureId(text) {
  if (/wärmepumpe|waermepumpe/i.test(text)) return 'heat_pump';
  if (/allrad|4x4|awd/i.test(text)) return 'awd';
  if (/sitzheizung/i.test(text)) return 'heated_seats';
  if (/360|kamera/i.test(text)) return 'camera_360';
  if (/anhängerkupplung|ahk/i.test(text)) return 'towbar';
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
  const queryType = analyzeCustomerQueryType(text, intent, profile);
  const advisory = parseAdvisoryQuestion(text);
  const modelKey = context.modelKey ?? detectModelKeyInQuery(text) ?? advisory?.modelKey ?? null;
  const featureId = detectFeatureId(text) ?? advisory?.featureId ?? null;
  const adviceMatch = matchAdviceTopic(text);

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
      confidence: 0.82,
      source: 'rules',
    });
  }

  if (adviceMatch && !modelKey) {
    return normalizeClassification({
      queryType: QUERY_TYPES.ADVICE_QUESTION,
      topic: adviceMatch.topic,
      modelKey: null,
      featureId: adviceMatch.featureId,
      customerIntent: `Beratung zu ${adviceMatch.headline}`,
      shouldShowModels: false,
      shouldAskForContact: false,
      confidence: 0.78,
      source: 'rules',
    });
  }

  if (ADVICE_MARKERS.test(text) && (adviceMatch || featureId) && !modelKey) {
    return normalizeClassification({
      queryType: QUERY_TYPES.ADVICE_QUESTION,
      topic: adviceMatch?.topic ?? (featureId ? `${featureId}_benefit` : 'general_advice'),
      modelKey: null,
      featureId,
      customerIntent: 'Allgemeine Beratungsfrage',
      shouldShowModels: false,
      shouldAskForContact: false,
      confidence: 0.65,
      source: 'rules',
    });
  }

  if (queryType === 'knowledge' || queryType === 'compare') {
    const isModelQuestion = Boolean(modelKey)
      || advisory?.topic === 'feature'
      || Boolean(advisory?.modelKey);
    if (isModelQuestion || featureId) {
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
    if (adviceMatch) {
      return normalizeClassification({
        queryType: QUERY_TYPES.ADVICE_QUESTION,
        topic: adviceMatch.topic,
        modelKey: null,
        featureId: adviceMatch.featureId,
        customerIntent: 'Beratungsfrage',
        shouldShowModels: false,
        shouldAskForContact: false,
        confidence: 0.72,
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

  if (isShoppingCriteriaQuery(text, intent, profile) || queryType === 'search' || queryType === 'purchase') {
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

  if (text.includes('?') || ADVICE_MARKERS.test(text)) {
    return normalizeClassification({
      queryType: QUERY_TYPES.ADVICE_QUESTION,
      topic: adviceMatch?.topic ?? 'general_advice',
      modelKey,
      featureId,
      customerIntent: 'Offene Beratungsfrage',
      shouldShowModels: false,
      shouldAskForContact: false,
      confidence: 0.45,
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
