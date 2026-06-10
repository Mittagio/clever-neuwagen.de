/**
 * Kunden-Intent: Informationsfrage (Antwortmodus) vs. Fahrzeugsuche (Suchmodus).
 */
import {
  hasFactualProfileCriteria,
  isShoppingCriteriaQuery,
} from './customerQueryHelpers.js';
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
  const analysis = analyzeVehicleQuery(query, intent, profile);
  return vehicleIntentToCustomerMode(analysis.intent);
}
