/**
 * In-Memory-Cache für offizielle Hersteller-Websuche (kostenarm).
 */

/** @type {Map<string, { expiresAt: number, value: object }>} */
const cache = new Map();

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SHORT_TTL_MS = 6 * 60 * 60 * 1000;

const SHORT_TTL_FACTS = new Set(['listPrice', 'deliveryTime', 'headUpDisplay']);

/**
 * @param {string} cacheKey
 * @param {string[]} requestedFacts
 */
export function resolveOfficialWebCacheTtlMs(requestedFacts = [], env = process.env) {
  const custom = Number(env.CLEVER_OFFICIAL_WEB_CACHE_TTL_MS);
  if (Number.isFinite(custom) && custom > 0) return custom;
  if (requestedFacts.some((f) => SHORT_TTL_FACTS.has(f))) return SHORT_TTL_MS;
  return DEFAULT_TTL_MS;
}

/** @param {string} cacheKey */
export function getOfficialWebCacheEntry(cacheKey) {
  const entry = cache.get(cacheKey);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(cacheKey);
    return null;
  }
  return entry.value;
}

/**
 * @param {string} cacheKey
 * @param {object} value
 * @param {number} ttlMs
 */
export function setOfficialWebCacheEntry(cacheKey, value, ttlMs) {
  cache.set(cacheKey, {
    expiresAt: Date.now() + ttlMs,
    value,
  });
}

/** Nur für Tests. */
export function clearOfficialWebSearchCache() {
  cache.clear();
}

/**
 * @param {object} params
 */
export function buildOfficialWebCacheKey(params = {}) {
  const {
    brandKey,
    modelKey,
    variantKey = '',
    requestedFacts = [],
    market = 'DE',
    locale = 'de-DE',
  } = params;
  const facts = [...requestedFacts].sort().join(',');
  return `${brandKey}:${modelKey}:${variantKey}:${market}:${locale}:${facts}`;
}
