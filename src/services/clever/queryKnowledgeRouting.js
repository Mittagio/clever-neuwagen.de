/**
 * Drei-Welten-Routing: Allgemeinwissen | Clever-Daten | Autohausprüfung
 */
import { QUERY_TYPES, KNOWLEDGE_ROUTES } from './customerQueryTypes.js';
import {
  detectCompetitorComparison,
  detectDealerDataQuery,
  detectGeneralCarComparison,
  detectGeneralCarQuestion,
} from './generalCarQueryDetector.js';
import { detectModelKeyInQuery } from '../search/modelAttributeQuestion.js';

const GENERAL_QUERY_TYPES = new Set([
  QUERY_TYPES.GENERAL_CAR_QUESTION,
  QUERY_TYPES.GENERAL_CAR_COMPARISON,
  QUERY_TYPES.COMPETITOR_COMPARISON,
  QUERY_TYPES.ADVICE_QUESTION,
]);

const CLEVER_DATA_TYPES = new Set([
  QUERY_TYPES.MODEL_EQUIPMENT_QUESTION,
  QUERY_TYPES.RANKING_QUESTION,
  QUERY_TYPES.COMPARISON_QUESTION,
  QUERY_TYPES.VEHICLE_WISH,
]);

/**
 * @param {string} query
 * @param {object} classification
 */
export function routeQueryKnowledge(query = '', classification = {}) {
  const dealerData = detectDealerDataQuery(query);
  if (dealerData?.needsDealerCheck) {
    return {
      route: KNOWLEDGE_ROUTES.DEALER_CHECK,
      reason: dealerData.kind,
      modelKey: dealerData.modelKey ?? classification.modelKey,
    };
  }

  if (classification.queryType === QUERY_TYPES.SPECIAL_CHECK_QUESTION) {
    return { route: KNOWLEDGE_ROUTES.DEALER_CHECK, reason: 'special_check' };
  }

  const competitor = detectCompetitorComparison(query);
  if (competitor) {
    return {
      route: KNOWLEDGE_ROUTES.GENERAL,
      reason: 'competitor_comparison',
      competitor,
    };
  }

  const generalCompare = detectGeneralCarComparison(query);
  if (generalCompare) {
    return {
      route: KNOWLEDGE_ROUTES.GENERAL,
      reason: 'general_car_comparison',
      generalCompare,
    };
  }

  const generalQ = detectGeneralCarQuestion(query);
  if (generalQ) {
    return {
      route: KNOWLEDGE_ROUTES.GENERAL,
      reason: 'general_car_question',
      generalQ,
    };
  }

  if (CLEVER_DATA_TYPES.has(classification.queryType)) {
    const modelKey = classification.modelKey ?? detectModelKeyInQuery(query);
    if (modelKey && classification.queryType === QUERY_TYPES.MODEL_EQUIPMENT_QUESTION) {
      return { route: KNOWLEDGE_ROUTES.CLEVER_DATA, reason: 'model_equipment' };
    }
    if (classification.queryType === QUERY_TYPES.RANKING_QUESTION
      || classification.queryType === QUERY_TYPES.COMPARISON_QUESTION) {
      return { route: KNOWLEDGE_ROUTES.CLEVER_DATA, reason: classification.queryType };
    }
    if (dealerData?.kind === 'trim_data') {
      return { route: KNOWLEDGE_ROUTES.CLEVER_DATA, reason: 'trim_data' };
    }
    if (classification.queryType === QUERY_TYPES.VEHICLE_WISH && dealerData) {
      return { route: KNOWLEDGE_ROUTES.DEALER_CHECK, reason: dealerData.kind };
    }
    if (classification.queryType === QUERY_TYPES.VEHICLE_WISH) {
      return { route: KNOWLEDGE_ROUTES.CLEVER_DATA, reason: 'vehicle_wish' };
    }
  }

  if (GENERAL_QUERY_TYPES.has(classification.queryType)) {
    if (classification.adviceTopicId || classification.topic?.includes('_')) {
      return { route: KNOWLEDGE_ROUTES.GENERAL, reason: 'advice_topic' };
    }
    if (classification.topic === 'unmatched_advice' || classification.topic === 'general_advice') {
      return { route: KNOWLEDGE_ROUTES.GENERAL, reason: 'open_advice' };
    }
    return { route: KNOWLEDGE_ROUTES.GENERAL, reason: 'advice_question' };
  }

  if (classification.queryType === QUERY_TYPES.UNKNOWN) {
    return { route: KNOWLEDGE_ROUTES.GENERAL, reason: 'unknown_fallback' };
  }

  return { route: KNOWLEDGE_ROUTES.CLEVER_DATA, reason: 'default' };
}

/**
 * @param {object} knowledgeRoute
 */
export function shouldUseOpenAiGeneralKnowledge(knowledgeRoute = {}) {
  return knowledgeRoute.route === KNOWLEDGE_ROUTES.GENERAL;
}
