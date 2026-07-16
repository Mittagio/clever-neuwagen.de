/**
 * In-Memory-Cache für Lexikon-AI-Antworten.
 */

/** @type {Map<string, { expiresAt: number, value: object }>} */
const cache = new Map();

const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000;

function normalizeQuery(query = '') {
  return String(query)
    .toLowerCase()
    .replace(/[^\wäöüß0-9\s-]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {object} params
 */
export function buildLexiconCacheKey(params = {}) {
  const {
    query,
    brandKey = 'kia',
    modelKey = '',
    variantKey = '',
    market = 'DE',
    dataVersion = 'v1',
    promptVersion = 'v1',
  } = params;
  return [
    normalizeQuery(query),
    brandKey,
    modelKey,
    variantKey,
    market,
    dataVersion,
    promptVersion,
  ].join('|');
}

export function getLexiconCacheEntry(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

export function setLexiconCacheEntry(key, value, ttlMs = DEFAULT_TTL_MS) {
  cache.set(key, { expiresAt: Date.now() + ttlMs, value });
}

export function invalidateLexiconCache() {
  cache.clear();
}

/** Nur für Tests. */
export function clearLexiconQueryCache() {
  cache.clear();
}
