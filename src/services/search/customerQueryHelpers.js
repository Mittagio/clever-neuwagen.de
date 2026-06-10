/**
 * Gemeinsame Hilfen für Intent-Erkennung (Suche vs. Smart-Answer).
 */
import { parseAdvisoryQuestion } from './advisoryQuestionParser.js';
import { parseModelAttributeQuestion } from './modelAttributeQuestion.js';

export const SEARCH_VERBS = /\b(suche|suchen|brauche|benötige|benoetige|möchte|moechte|zeig(?:e|en)?\s+mir|finde|empfehl(?:e|ung)?|interessier(?:t|e))\b/i;

export const QUESTION_FORM = /\b(wie|was|welche[rs]?|wieviel|wie\s+viel|hat\s+(er|sie|es|der|die)|kann\s+(er|sie|es|der)|passt\s+(er|sie|es|der|die|in)?|gibt\s+es|reicht|wann|warum|ist\s+(er|sie|es|der|die)|größer|groesser|kleiner|besser|oder|versus|vs\.?)\b/i;

/**
 * @param {object} [profile]
 */
export function hasFactualProfileCriteria(profile = {}) {
  return Boolean(
    profile.towCapacityKg != null
    || profile.maxHeightMm != null
    || profile.maxLengthMm != null
    || profile.trunkLMin != null
    || profile.trunkDepthCmMin != null
    || profile.rangeKmMin != null
    || profile.minRangeKm != null
    || profile.isofixRearMin != null
    || profile.rangeRanking === 'max'
    || (profile.seatsMin != null && profile.seatsMin >= 7),
  );
}

/**
 * Einkaufskriterien ohne Frageform → direkt suchen.
 */
export function isShoppingCriteriaQuery(query, intent = {}, profile = {}) {
  const text = String(query ?? '').trim();
  if (!text) return false;
  if (QUESTION_FORM.test(text) || text.includes('?')) return false;
  if (parseAdvisoryQuestion(text) || parseModelAttributeQuestion(text)) return false;
  if (SEARCH_VERBS.test(text)) return true;
  if (intent.modelExplicit) return true;
  return hasFactualProfileCriteria(profile)
    || intent.maxRate != null
    || intent.maxPrice != null
    || (intent.features?.length ?? 0) > 0;
}
