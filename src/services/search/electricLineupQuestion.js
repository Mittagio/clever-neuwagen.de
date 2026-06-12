import { detectModelKeyInQuery } from './modelAttributeQuestion.js';

const ELECTRIC_LINEUP_PATTERNS = [
  /welche\s+(?:e-?\s*autos?|elektroautos?|elektro-?\s*fahrzeuge?)\b/i,
  /welche\s+(?:kia\s+)?(?:e-?\s*autos?|elektro)\b/i,
  /(?:übersicht|alle)\s+(?:e-?autos?|elektro)/i,
  /was\s+für\s+(?:e-?autos?|elektro)/i,
  /(?:gibt\s+es|bietet|hat)\s+kia\s+(?:e-?autos?|elektro)/i,
  /kia\s+(?:e-?autos?|elektro(?:fahrzeuge)?)\s+(?:gibt\s+es|im\s+angebot)/i,
];

/**
 * @param {string} query
 */
export function matchElectricLineupQuestion(query) {
  const text = String(query ?? '').trim();
  if (!text) return false;
  if (!/\b(e-?\s*autos?|elektro|elektroautos?)\b/i.test(text)) return false;
  if (detectModelKeyInQuery(text)) return false;
  return ELECTRIC_LINEUP_PATTERNS.some((pattern) => pattern.test(text));
}
