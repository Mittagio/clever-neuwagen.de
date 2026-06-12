/**
 * Schätz-Intents – Nischenfragen ohne exakte Stammdaten.
 */
import { detectModelKeyInQuery } from '../search/modelAttributeQuestion.js';

/** @typedef {'stroller_fit'|'dog_crate_fit'} EstimateType */

/**
 * @typedef {object} EstimateMatch
 * @property {EstimateType} estimateType
 * @property {string} modelKey
 * @property {string} category
 */

const ESTIMATE_PATTERNS = [
  {
    estimateType: 'stroller_fit',
    category: 'Kinderwagen',
    patterns: [/kinderwagen/i, /kinder\s*wagen/i, /buggy/i, /kombi\s*-?\s*kinderwagen/i],
  },
  {
    estimateType: 'dog_crate_fit',
    category: 'Hundebox',
    patterns: [/hundebox/i, /hundetransport/i, /hund.*kofferraum/i, /hund.*passt/i],
  },
];

/**
 * @param {string} query
 * @returns {EstimateMatch | null}
 */
export function matchEstimateQuestion(query) {
  const text = String(query ?? '').trim();
  if (!text) return null;

  const modelKey = detectModelKeyInQuery(text);
  if (!modelKey) return null;

  for (const rule of ESTIMATE_PATTERNS) {
    if (!rule.patterns.some((p) => p.test(text))) continue;
    return {
      estimateType: rule.estimateType,
      modelKey,
      category: rule.category,
    };
  }

  return null;
}
