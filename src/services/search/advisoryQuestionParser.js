/**
 * Beratungsfragen erkennen – Antwortmodus vs. Suchmodus.
 * Deckt Größe, Reichweite, Ausstattung, Familie, Preis, Verfügbarkeit, Vergleich ab.
 */
import { detectModelKeyInQuery, detectModelAttribute, parseModelAttributeQuestion } from './modelAttributeQuestion.js';
import { parseSearchIntent } from './searchIntentParser.js';

/** @typedef {'dimensions'|'garage'|'trunk'|'comparison'|'battery'|'range_real'|'range_winter'|'range_enough'|'charging'|'feature'|'towbar'|'tow'|'isofix'|'family'|'stroller_dog'|'price_leasing'|'price_mileage'|'buy_vs_lease'|'subsidy'|'availability'|'colors'|'options'|'attribute'|'overview'} AdvisoryTopic */

const QUESTION_MARKERS = /\b(wie|was|welche[rs]?|wieviel|wie\s+viel|hat\s+(er|sie|es|der|die)|kann\s+(er|sie|es|der)|passt\s+(er|sie|es|der|die|in)?|gibt\s+es|reicht|wann|warum|ist\s+(er|sie|es|der|die)|größer|groesser|kleiner|besser|oder|versus|vs\.?)\b/i;

const FEATURE_PATTERNS = [
  { featureId: 'heated_seats', patterns: [/sitzheizung/i, /beheizte\s+sitze/i] },
  { featureId: 'heat_pump', patterns: [/wärmepumpe/i, /waermepumpe/i, /\bwp\b/i] },
  { featureId: 'rear_camera', patterns: [/rückfahrkamera/i, /rueckfahrkamera/i, /rückkamera/i] },
  { featureId: 'camera_360', patterns: [/360/, /rundumsicht/i, /surround\s*view/i] },
  { featureId: 'towbar', patterns: [/anhängerkupplung/i, /anhaengerkupplung/i, /ahk\b/i] },
  { featureId: 'panorama_roof', patterns: [/schiebedach/i, /panoramadach/i, /glasdach/i] },
];

function hasQuestionForm(text) {
  return QUESTION_MARKERS.test(text) || text.includes('?');
}

function detectFeatureId(text) {
  for (const { featureId, patterns } of FEATURE_PATTERNS) {
    if (patterns.some((re) => re.test(text))) return featureId;
  }
  return null;
}

function parseComparisonModels(text) {
  const oder = text.match(/\b(.+?)\s+(?:oder|vs\.?|versus|gegen)\s+(.+?)$/i);
  if (oder) {
    const left = detectModelKeyInQuery(oder[1]);
    const right = detectModelKeyInQuery(oder[2]);
    if (left && right) return { modelKeyA: left, modelKeyB: right };
  }

  const groesser = text.match(/\b(größer|groesser|kleiner|kürzer|kuerzer|höher|hoeher)\s+als\s+(.+)/i);
  if (groesser) {
    const other = detectModelKeyInQuery(groesser[2]);
    const subject = detectModelKeyInQuery(text.replace(groesser[0], ''));
    if (subject && other) return { modelKeyA: subject, modelKeyB: other, compareSize: groesser[1].toLowerCase() };
  }
  return null;
}

function extractGarageHeightMm(text) {
  const m = text.match(/(\d(?:[.,]\d+)?)\s*m(?:eter)?(?:\s*hoch|\s*höhe|\s*garage)?/i)
    ?? text.match(/garage\s*(\d(?:[.,]\d+)?)\s*m/i);
  if (!m) return null;
  return Math.round(Number(m[1].replace(',', '.')) * 1000);
}

/**
 * @param {string} query
 * @returns {object|null}
 */
export function parseAdvisoryQuestion(query) {
  const text = String(query ?? '').trim();
  if (!text) return null;

  const modelKey = detectModelKeyInQuery(text);
  const comparison = parseComparisonModels(text);
  if (comparison) {
    return { kind: 'advisory', topic: 'comparison', query: text, ...comparison };
  }

  if (!modelKey && !/\b(der|die|das)\b/i.test(text)) {
    const attrOnly = parseModelAttributeQuestion(text);
    if (attrOnly) return { kind: 'advisory', topic: 'attribute', ...attrOnly };
    if (!hasQuestionForm(text)) return null;
    return null;
  }

  if (/\b(garage|carport|tiefgarage|einfahrt)\b/i.test(text) && /\b(passt|rein|hinein|unter|hoch)\b/i.test(text)) {
    if (modelKey) {
      return {
        kind: 'advisory', topic: 'garage', modelKey, query: text, garageHeightMm: extractGarageHeightMm(text),
      };
    }
  }

  if (/\b(wie\s+(lang|groß|gross|hoch|breit)|abmessungen|maße|masse)\b/i.test(text) && modelKey) {
    return { kind: 'advisory', topic: 'dimensions', modelKey, query: text };
  }

  if (/\b(winter|kälte|kaelte|kalt|frost)\b/i.test(text) && /\b(reichweite|weit|kommt)\b/i.test(text) && modelKey) {
    return { kind: 'advisory', topic: 'range_winter', modelKey, query: text };
  }

  if (/\b(wirklich|real|alltag|praxis|echt)\b/i.test(text) && /\b(reichweite|weit|kommt)\b/i.test(text) && modelKey) {
    return { kind: 'advisory', topic: 'range_real', modelKey, query: text };
  }

  if (/\b(kleine[nr]?\s+)?batterie\b/i.test(text) && /\b(reicht|ausreichend|genug)\b/i.test(text) && modelKey) {
    return { kind: 'advisory', topic: 'range_enough', modelKey, query: text };
  }

  if (/\b(batterie|akku|kwh)\b/i.test(text) && modelKey) {
    return { kind: 'advisory', topic: 'battery', modelKey, query: text };
  }

  if (/\b(laden|ladezeit|schnelllad|dc[-\s]?lad|ladeleistung)\b/i.test(text) && modelKey) {
    return { kind: 'advisory', topic: 'charging', modelKey, query: text };
  }

  const featureId = detectFeatureId(text);
  if (featureId && modelKey && /\b(hat|haben|mit|brauche|welche\s+ausstattung)\b/i.test(text)) {
    return { kind: 'advisory', topic: 'feature', modelKey, featureId, query: text };
  }

  if (featureId && modelKey && hasQuestionForm(text)) {
    return { kind: 'advisory', topic: 'feature', modelKey, featureId, query: text };
  }

  if (/\banhängelast\b/i.test(text) && modelKey) {
    return { kind: 'advisory', topic: 'tow', modelKey, query: text };
  }

  if (/\bisofix\b/i.test(text) && modelKey) {
    return { kind: 'advisory', topic: 'isofix', modelKey, query: text };
  }

  if (/\b(familien(tauglich|auto|freundlich)|kindersitz|kinderwagen|hund)\b/i.test(text) && modelKey) {
    return { kind: 'advisory', topic: modelKey && /kinderwagen|hund|kofferraum/i.test(text) ? 'stroller_dog' : 'family', modelKey, query: text };
  }

  if (/\b(kofferraum|laderaum)\b/i.test(text) && /\b(wie\s+groß|wie\s+gross|platz|rein)\b/i.test(text) && modelKey) {
    return { kind: 'advisory', topic: 'trunk', modelKey, query: text };
  }

  if (/\b(leasing|monatsrate|monatlich)\b/i.test(text) && /\b(kostet|preis|was)\b/i.test(text) && modelKey) {
    return { kind: 'advisory', topic: 'price_leasing', modelKey, query: text };
  }

  if (/\b(15\.?000|20\.?000|25\.?000)\s*km\b/i.test(text) && /\b(kostet|preis|leasing|laufleistung)\b/i.test(text) && modelKey) {
    return { kind: 'advisory', topic: 'price_mileage', modelKey, query: text };
  }

  if (/\b(kauf|leasing)\b/i.test(text) && /\b(besser|sinnvoller|lohnt)\b/i.test(text)) {
    return { kind: 'advisory', topic: 'buy_vs_lease', modelKey, query: text };
  }

  if (/\b(förderung|foerderung|prämie|praemie|e-prämie|umweltbonus|thg)\b/i.test(text)) {
    return { kind: 'advisory', topic: 'subsidy', modelKey, query: text };
  }

  if (/\b(lieferbar|lieferzeit|wann|sofort|verfügbar|verfuegbar)\b/i.test(text) && modelKey && hasQuestionForm(text)) {
    return { kind: 'advisory', topic: 'availability', modelKey, query: text };
  }

  if (/\b(farbe|farben|schwarz|grau|weiß|weiss|blau|rot)\b/i.test(text) && modelKey && hasQuestionForm(text)) {
    return { kind: 'advisory', topic: 'colors', modelKey, query: text };
  }

  if (/\b(ohne|ohne\s+extras)\b/i.test(text) && /\b(schiebedach|panorama|ausstattung)\b/i.test(text) && modelKey) {
    return { kind: 'advisory', topic: 'options', modelKey, query: text };
  }

  const attrQ = parseModelAttributeQuestion(text);
  if (attrQ) return { kind: 'advisory', topic: 'attribute', ...attrQ };

  const attribute = detectModelAttribute(text);
  if (attribute && modelKey && hasQuestionForm(text)) {
    return { kind: 'advisory', topic: 'attribute', modelKey, attribute, query: text };
  }

  if (modelKey && hasQuestionForm(text)) {
    const intent = parseSearchIntent(text);
    if (intent.rangeRanking === 'max') {
      return { kind: 'advisory', topic: 'overview', modelKey, query: text, rangeRanking: 'max' };
    }
    return { kind: 'advisory', topic: 'overview', modelKey, query: text };
  }

  return null;
}

export function hasAdvisoryQuestionForm(query) {
  return Boolean(parseAdvisoryQuestion(query));
}
