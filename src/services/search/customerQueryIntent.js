/**
 * Kunden-Intent: Informationsfrage (Antwortmodus) vs. Fahrzeugsuche (Suchmodus).
 */
import {
  hasFactualProfileCriteria,
  isShoppingCriteriaQuery,
} from './customerQueryHelpers.js';
import { analyzeCustomerQueryType } from './customerQueryType.js';
import { analyzeVehicleQuery, vehicleIntentToCustomerMode } from './vehicleQueryIntent.js';

/** @typedef {'info' | 'search'} CustomerQueryMode */

export { hasFactualProfileCriteria, isShoppingCriteriaQuery };

/**
 * @param {string} query
 * @param {object} [intent]
 * @param {object} [profile]
 * @returns {CustomerQueryMode}
 */
export function classifyCustomerQueryIntent(query, intent = {}, profile = {}) {
  const queryType = analyzeCustomerQueryType(query, intent, profile);
  if (queryType === 'knowledge' || queryType === 'compare') return 'info';
  return 'search';
}

/**
 * @param {string} query
 * @param {object} [intent]
 * @param {object} [profile]
 */
export function getCustomerQueryType(query, intent = {}, profile = {}) {
  return analyzeCustomerQueryType(query, intent, profile);
}
