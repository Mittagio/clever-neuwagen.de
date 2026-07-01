/**
 * Erkennung allgemeiner Auto-/Fremdmarken- und Händlerdaten-Fragen (ohne OpenAI).
 */
import { detectModelKeyInQuery } from '../search/modelAttributeQuestion.js';
import { QUERY_TYPES } from './customerQueryTypes.js';

const COMPETITOR_PATTERNS = [
  { pattern: /\bzeekr\b/i, name: 'Zeekr' },
  { pattern: /\bbyd\b/i, name: 'BYD' },
  { pattern: /\bmercedes|gle\b/i, name: 'Mercedes GLE' },
  { pattern: /\bbmw\b/i, name: 'BMW' },
  { pattern: /\baudi\b/i, name: 'Audi' },
  { pattern: /\btesla\b/i, name: 'Tesla' },
  { pattern: /\bvolkswagen|vw\b/i, name: 'VW' },
  { pattern: /\bskoda\b/i, name: 'Skoda' },
  { pattern: /\bhyundai\b/i, name: 'Hyundai' },
  { pattern: /\btoyota\b/i, name: 'Toyota' },
];

const KIA_PATTERN = /\b(kia|ev[2-9]|sorento|sportage|niro|ceed|stonic|picanto)\b/i;

/**
 * @param {string} text
 */
export function detectCompetitorMentions(text = '') {
  const q = String(text);
  return COMPETITOR_PATTERNS
    .filter((entry) => entry.pattern.test(q))
    .map((entry) => entry.name);
}

/**
 * @param {string} text
 */
export function detectCompetitorComparison(text = '') {
  const q = String(text).trim();
  const competitors = detectCompetitorMentions(q);
  if (!competitors.length) return null;

  const hasKia = KIA_PATTERN.test(q);
  const hasCompareSignal = /\b(oder|vs\.?|versus|vergleich|besser|reichweite)\b/i.test(q);

  if (competitors.length >= 2 || (competitors.length && hasCompareSignal)) {
    return {
      queryType: QUERY_TYPES.COMPETITOR_COMPARISON,
      competitors,
      hasKia,
      topic: competitors.join('_vs_'),
    };
  }

  if (hasKia && competitors.length) {
    return {
      queryType: QUERY_TYPES.COMPETITOR_COMPARISON,
      competitors,
      hasKia: true,
      topic: `${competitors[0]}_vs_kia`,
    };
  }

  return null;
}

/**
 * @param {string} text
 */
export function detectGeneralCarComparison(text = '') {
  const q = String(text).trim();
  if (/\b(diesel|benzin|verbrenner)\b/i.test(q) && /\b(elektro|e-?auto|ev)\b/i.test(q)) {
    return { topic: 'diesel_vs_ev', queryType: QUERY_TYPES.GENERAL_CAR_COMPARISON };
  }
  if (/\bhybrid\b/i.test(q) && /\b(plug-?in|phev|plugin)\b/i.test(q)) {
    return { topic: 'hybrid_vs_plugin', queryType: QUERY_TYPES.GENERAL_CAR_COMPARISON };
  }
  if (/\b(rwd|heckantrieb)\b/i.test(q) && /\b(awd|allrad|4x4)\b/i.test(q)) {
    return { topic: 'rwd_vs_awd', queryType: QUERY_TYPES.GENERAL_CAR_COMPARISON };
  }
  return null;
}

/**
 * @param {string} text
 */
export function detectGeneralCarQuestion(text = '') {
  const q = String(text).trim();
  if (detectCompetitorComparison(q)) return null;
  if (detectGeneralCarComparison(q)) return null;

  const generalTopics = [
    { pattern: /welche\s+e-?autos?\s+.{0,30}reichweite/i, topic: 'ev_range_overview' },
    { pattern: /viel\s+reichweite|lange\s+reichweite/i, topic: 'ev_range_overview' },
    { pattern: /was\s+ist\s+besser.*(diesel|elektro|hybrid)/i, topic: 'powertrain_choice' },
    { pattern: /wie\s+schnell\s+lädt|ladegeschwindigkeit|schnelllad/i, topic: 'charging_speed' },
  ];

  for (const entry of generalTopics) {
    if (entry.pattern.test(q)) {
      return { topic: entry.topic, queryType: QUERY_TYPES.GENERAL_CAR_QUESTION };
    }
  }

  if (detectCompetitorMentions(q).length === 1 && !detectModelKeyInQuery(q)) {
    return {
      topic: 'competitor_info',
      queryType: QUERY_TYPES.GENERAL_CAR_QUESTION,
      competitor: detectCompetitorMentions(q)[0],
    };
  }

  return null;
}

/**
 * Händler-/Angebotsdaten – nicht frei von OpenAI erfinden.
 * @param {string} text
 */
export function detectDealerDataQuery(text = '') {
  const q = String(text).trim();
  const modelKey = detectModelKeyInQuery(q);

  if (/\b(leasing)?rate\b/i.test(q) && /\b(\d+\s*monat|\d+\s*km|laufzeit|monate)\b/i.test(q)) {
    return { kind: 'leasing_rate', modelKey, needsDealerCheck: true };
  }
  if (/\b(verfügbar|verfuegbar|bestand|lieferzeit|sofort)\b/i.test(q) && modelKey) {
    return { kind: 'availability', modelKey, needsDealerCheck: true };
  }
  if (/\binzahlungnahme\b/i.test(q)) {
    return { kind: 'trade_in', modelKey, needsDealerCheck: true };
  }
  if (/\b(angebot|konkrete\s+rate|sonderkondition)\b/i.test(q) && modelKey) {
    return { kind: 'offer', modelKey, needsDealerCheck: true };
  }
  if (/\b(paket|ausstattungslinie|trim|earth|gt-?line)\b/i.test(q) && modelKey && !/was\s+bringt|warum|lohnt/i.test(q)) {
    return { kind: 'trim_data', modelKey, needsDealerCheck: false };
  }
  return null;
}

/**
 * @param {string} text
 */
export function isPurchaseIntentQuery(text = '') {
  const q = String(text).trim();
  return /\b(angebot\s+anfragen|ich\s+will\s+(ein\s+)?angebot|angebot\s+erhalten|probefahrt|autohaus\s+soll|verkäufer|beraten\s+lassen|kontakt\s+aufnehmen)\b/i.test(q);
}
