/**
 * Topic-basierte Beratungserkennung – Token-Overlap statt Einzel-Regex pro Frage.
 */
import { ADVICE_TOPICS, getAdviceTopicById } from './adviceTopicsRegistry.js';

const STOP_WORDS = new Set([
  'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einer', 'eines',
  'und', 'oder', 'mit', 'für', 'fur', 'von', 'aus', 'auf', 'ist', 'sind',
  'wie', 'was', 'kann', 'ich', 'man', 'soll', 'sollte', 'beim', 'zum', 'zur',
  'auto', 'fahrzeug', 'kia', 'elektro', 'elektroauto', 'e-auto', 'eauto',
]);

const SHOPPING_VERBS = /\b(suche|suchen|möchte|moechte|zeig(?:e|en)?\s+mir|finde|interessier(?:t|e)\s+(?:mich|für))\b/i;

const ADVICE_SIGNALS = /\b(wie|was|warum|wofür|wofuer|wieso|brauche|lohnt|reicht|sinkt|kann\s+ich|ist|besser|bringt|vorteil|vorteile|sinnvoll|empfehl|unterschied|wichtig|nutzen)\b/i;

function normalizeText(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text) {
  return normalizeText(text)
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function tokenOverlapScore(queryTokens, referenceTokens) {
  if (!referenceTokens.length) return 0;
  const querySet = new Set(queryTokens);
  const overlap = referenceTokens.filter((token) => querySet.has(token)).length;
  return overlap / referenceTokens.length;
}

function scoreTopic(query, topic) {
  const queryTokens = tokenize(query);
  let best = 0;

  for (const example of topic.triggerExamples ?? []) {
    best = Math.max(best, tokenOverlapScore(queryTokens, tokenize(example)));
  }

  for (const keyword of topic.keywords ?? []) {
    const keywordTokens = tokenize(keyword);
    if (keywordTokens.length === 1 && queryTokens.includes(keywordTokens[0])) {
      best = Math.max(best, 0.55);
    } else {
      best = Math.max(best, tokenOverlapScore(queryTokens, keywordTokens));
    }
  }

  return best;
}

/**
 * @param {string} query
 * @param {{ minScore?: number }} [options]
 */
export function matchAdviceTopicByQuery(query = '', options = {}) {
  const text = String(query).trim();
  if (!text) return null;

  const minScore = options.minScore ?? 0.38;
  let bestTopic = null;
  let bestScore = 0;

  for (const topic of ADVICE_TOPICS) {
    const score = scoreTopic(text, topic);
    if (score > bestScore) {
      bestScore = score;
      bestTopic = topic;
    }
  }

  if (!bestTopic || bestScore < minScore) return null;

  return {
    ...bestTopic,
    matchScore: bestScore,
  };
}

/**
 * @param {string} query
 * @param {{ modelKey?: string|null }} [context]
 */
export function isLikelyAdviceQuestion(query = '', context = {}) {
  const text = String(query).trim();
  if (!text) return false;
  if (context.modelKey && isModelSpecificTechnicalQuery(text, context.modelKey)) return false;
  if (SHOPPING_VERBS.test(text) && !/\?/.test(text)) return false;
  return ADVICE_SIGNALS.test(text) || text.includes('?');
}

/**
 * @param {string} text
 * @param {string} modelKey
 */
export function isModelSpecificTechnicalQuery(text, modelKey) {
  if (!modelKey) return false;
  if (/hat\s+der|hat\s+die|haben\s+sie|verfügbar|serie|ausstattung/i.test(text)) return true;
  const trimmed = text.trim();
  if (new RegExp(`^${modelKey.replace('-', '[-\\s]?')}\\b`, 'i').test(trimmed)) {
    if (!/\b(warum|wofür|wofuer|was bringt|brauche ich|lohnt|mit oder ohne)\b/i.test(text)) {
      return true;
    }
  }
  if (/anhängelast|anhaengelast|zuglast/i.test(text) && modelKey) return true;
  return false;
}

/**
 * @param {string} query
 * @param {object} [context]
 */
export function classifyAdviceFromTopics(query = '', context = {}) {
  const text = String(query).trim();
  const { modelKey = null } = context;

  if (modelKey) {
    if (/mit\s+oder\s+ohne|verfügbar|verfuegbar|serie|ausstattung|hat\s+der|hat\s+die|haben\s+sie/i.test(text)) {
      return null;
    }
    if (/\bmit\b/i.test(text) && !/\b(warum|wofür|wofuer|was bringt|brauche ich|lohnt)\b/i.test(text)) {
      return null;
    }
    if (isModelSpecificTechnicalQuery(text, modelKey)) {
      return null;
    }
  }

  if (SHOPPING_VERBS.test(text)) {
    return null;
  }

  const topicMatch = matchAdviceTopicByQuery(text);
  if (topicMatch) {
    return {
      adviceTopicId: topicMatch.id,
      topic: topicMatch.id,
      featureId: topicMatch.featureId ?? null,
      confidence: Math.min(0.95, 0.6 + topicMatch.matchScore * 0.35),
      needsDealerCheck: Boolean(topicMatch.needsDealerCheck),
      shouldAskForContact: Boolean(topicMatch.needsDealerCheck),
      shouldShowModels: false,
      matched: true,
    };
  }

  if (!modelKey && isLikelyAdviceQuestion(text, context)) {
    return {
      adviceTopicId: null,
      topic: 'unmatched_advice',
      featureId: null,
      confidence: 0.42,
      needsDealerCheck: true,
      shouldAskForContact: true,
      shouldShowModels: false,
      matched: false,
    };
  }

  return null;
}

/** @deprecated use matchAdviceTopicByQuery */
export function matchAdviceTopic(query) {
  const match = matchAdviceTopicByQuery(query);
  if (!match) return null;
  return {
    topic: match.id,
    featureId: match.featureId ?? null,
    headline: match.label,
    snippets: [
      match.shortAnswer,
      ...(match.usefulWhen ?? []).slice(0, 2),
    ],
  };
}

export { getAdviceTopicById };
