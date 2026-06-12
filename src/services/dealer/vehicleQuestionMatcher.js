/**
 * Fragenkatalog + Modell → Intent-Zuordnung (ohne LLM).
 */
import { VEHICLE_QUESTION_INTENTS } from '../../data/vehicleQuestionCatalog.js';
import { detectModelKeyInQuery } from '../search/modelAttributeQuestion.js';

const QUESTION_HINT = /(\?|^(wie|was|welche|wieviel|wie viel|hat der|gibt es|schaffe ich)\b)/i;

/**
 * @param {string} query
 * @returns {boolean}
 */
export function looksLikeVehicleQuestion(query) {
  return QUESTION_HINT.test(String(query ?? '').trim());
}

/**
 * @param {string} query
 * @returns {{
 *   intentId: string,
 *   category: string,
 *   factField: import('../search/vehicleQueryIntent.js').VehicleFactField,
 *   modelKey: string,
 *   query: string,
 * }|null}
 */
export function matchVehicleQuestion(query) {
  const text = String(query ?? '').trim();
  if (!text) return null;

  const modelKey = detectModelKeyInQuery(text);
  if (!modelKey) return null;

  for (const intent of VEHICLE_QUESTION_INTENTS) {
    if (intent.patterns.some((pattern) => pattern.test(text))) {
      return {
        intentId: intent.id,
        category: intent.category,
        factField: intent.factField,
        modelKey,
        query: text,
      };
    }
  }

  if (looksLikeVehicleQuestion(text)) {
    return {
      intentId: 'unspecified',
      category: 'Allgemein',
      factField: 'dimensionsOverview',
      modelKey,
      query: text,
    };
  }

  return null;
}
