/**
 * Vier Kunden-Eingabe-Typen für den digitalen Verkaufsberater.
 *
 * knowledge  – Wissensfrage (Antwort geben)
 * search     – Suchanfrage mit Kriterien (Fahrzeuge finden)
 * compare    – expliziter Modellvergleich
 * purchase   – Kaufabsicht → 5-Schritte-Journey
 */
import { detectModelKeyInQuery } from './modelAttributeQuestion.js';
import {
  isShoppingCriteriaQuery,
  QUESTION_FORM,
} from './customerQueryHelpers.js';
import { matchElectricLineupQuestion } from './electricLineupQuestion.js';
import { analyzeVehicleQuery } from './vehicleQueryIntent.js';

/** @typedef {'knowledge'|'search'|'compare'|'purchase'} CustomerQueryType */

const PURCHASE_VERBS = /\b(möchte|moechte|will|wollen|zeig(?:e|en)?\s+mir|interessier(?:t|e)\s+(?:mich|für)|nehme|bestelle|konfigurier|holen?\s+mir)\b/i;

export { matchElectricLineupQuestion };

/**
 * @param {string} query
 * @param {object} [intent]
 */
export function matchPurchaseIntent(query, intent = {}) {
  const text = String(query ?? '').trim();
  const modelKey = detectModelKeyInQuery(text);
  if (!modelKey) return false;

  if (/\bleasing\b/i.test(text)) return true;
  if (PURCHASE_VERBS.test(text)) return true;
  if (intent.modelExplicit && /\b(zeig|schau|ansehen|konfigur)/i.test(text)) return true;

  return false;
}

/**
 * @param {string} query
 * @param {object} [intent]
 * @param {object} [profile]
 * @returns {CustomerQueryType}
 */
export function analyzeCustomerQueryType(query, intent = {}, profile = {}) {
  const text = String(query ?? '').trim();
  if (!text) return 'search';

  const vehicleAnalysis = analyzeVehicleQuery(text, intent, profile);

  if (vehicleAnalysis.intent === 'vehicle_compare_question') {
    return 'compare';
  }

  if (matchPurchaseIntent(text, intent)) {
    return 'purchase';
  }

  if (matchElectricLineupQuestion(text)) {
    return 'knowledge';
  }

  if (vehicleAnalysis.intent === 'vehicle_fact_question') {
    return 'knowledge';
  }

  if (isShoppingCriteriaQuery(text, intent, profile)) {
    return 'search';
  }

  if (QUESTION_FORM.test(text) || text.includes('?')) {
    return 'knowledge';
  }

  if (intent.modelExplicit && detectModelKeyInQuery(text)) {
    return 'purchase';
  }

  return 'search';
}
