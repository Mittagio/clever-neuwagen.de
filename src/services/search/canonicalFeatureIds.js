/**
 * Canonical Feature-IDs (API/OpenAI) ↔ interne IDs (Trim-DB, CleverQuote).
 */

const CANONICAL_TO_INTERNAL = {
  heated_front_seats: 'heated_seats',
  electric_tailgate: 'power_tailgate',
};

const INTERNAL_TO_CANONICAL = Object.fromEntries(
  Object.entries(CANONICAL_TO_INTERNAL).map(([c, i]) => [i, c]),
);

/** @param {string} id */
export function toInternalFeatureId(id) {
  return CANONICAL_TO_INTERNAL[id] ?? id;
}

/** @param {string} id */
export function toCanonicalFeatureId(id) {
  return INTERNAL_TO_CANONICAL[id] ?? id;
}

/** @param {string[]} ids */
export function normalizeFeatureIdsToInternal(ids = []) {
  return [...new Set(ids.map(toInternalFeatureId))];
}

/** @param {string[]} ids */
export function normalizeFeatureIdsToCanonical(ids = []) {
  return [...new Set(ids.map(toCanonicalFeatureId))];
}
