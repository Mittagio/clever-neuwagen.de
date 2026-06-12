/**
 * Typ-A-Fragen: „Bei welchem Kia …?“ ohne konkretes Modell.
 */
import { detectModelKeyInQuery } from './modelAttributeQuestion.js';
import { parseSearchIntent } from './searchIntentParser.js';

/** @typedef {'towbar'|'heat_pump'|'seats_7'} FeatureLineupId */

const WHICH_MODEL_PATTERNS = [
  /\bbei\s+welch(?:em|er|en)\b/i,
  /\bwelch(?:e[rsnm]?|es)\s+(?:kia|modell)/i,
  /\ban\s+welch(?:em|er|en)\b/i,
  /\bwo\s+(?:gibt\s+es|ist|kann\s+ich)\b/i,
];

/** @type {{ featureId: FeatureLineupId, patterns: RegExp[], actionPatterns?: RegExp[] }[]} */
const FEATURE_LINEUP_SIGNALS = [
  {
    featureId: 'towbar',
    patterns: [
      /anh[aä]nger[\w]*kupplung/i,
      /\bahk\b/i,
      /anh[aä]ngelast/i,
      /wohnwagen\s+ziehen/i,
    ],
    actionPatterns: [
      /montier/i,
      /einbau/i,
      /nachr[uü]st/i,
      /monit/i,
      /monitor/i,
      /überwach/i,
      /ueberwach/i,
      /ziehen/i,
    ],
  },
  {
    featureId: 'heat_pump',
    patterns: [/w[aä]rmepumpe/i],
  },
  {
    featureId: 'seats_7',
    patterns: [/\b7[\s-]*sitz/i, /sieben\s*sitz/i],
  },
];

/**
 * @param {string} query
 * @returns {{ featureId: FeatureLineupId }|null}
 */
export function matchFeatureLineupQuestion(query) {
  const text = String(query ?? '').trim();
  if (!text) return null;
  if (detectModelKeyInQuery(text)) return null;

  const whichModel = WHICH_MODEL_PATTERNS.some((pattern) => pattern.test(text));
  const hasQuestion = text.includes('?')
    || /\b(kann|könnte|koennte|gibt\s+es|haben|bietet|verfügbar|verfuegbar)\b/i.test(text);

  if (!whichModel && !/\bwelche\s+kia\b/i.test(text)) return null;
  if (!hasQuestion && !whichModel) return null;

  for (const signal of FEATURE_LINEUP_SIGNALS) {
    if (!signal.patterns.some((pattern) => pattern.test(text))) continue;
    if (whichModel || signal.actionPatterns?.some((pattern) => pattern.test(text))) {
      return { featureId: signal.featureId };
    }
  }

  if (whichModel) {
    const intent = parseSearchIntent(text);
    const featureId = intent.features?.find((id) => FEATURE_LINEUP_SIGNALS.some((s) => s.featureId === id));
    if (featureId) return { featureId };
  }

  return null;
}
