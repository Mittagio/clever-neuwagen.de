/**
 * Journey-Zwischenspeicher – Fortsetzen nach Reload (gleiche Suche).
 */
const STORAGE_PREFIX = 'clever-dealer-journey';

function storageKey(dealerId) {
  return `${STORAGE_PREFIX}:${dealerId ?? 'default'}`;
}

/**
 * @param {string} dealerId
 * @param {object} state
 */
export function saveJourneyState(dealerId, state) {
  if (typeof window === 'undefined' || !state?.submittedQuery) return;
  try {
    window.localStorage.setItem(storageKey(dealerId), JSON.stringify({
      ...state,
      savedAt: new Date().toISOString(),
    }));
  } catch {
    // Quota / private mode
  }
}

/**
 * @param {string} dealerId
 * @param {string} submittedQuery
 */
export function loadJourneyState(dealerId, submittedQuery) {
  if (typeof window === 'undefined' || !submittedQuery?.trim()) return null;
  try {
    const raw = window.localStorage.getItem(storageKey(dealerId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.submittedQuery?.trim() !== submittedQuery.trim()) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * @param {string} dealerId
 */
export function clearJourneyState(dealerId) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(storageKey(dealerId));
  } catch {
    // ignore
  }
}
