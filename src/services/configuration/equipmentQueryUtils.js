/**
 * Query-Normalisierung für Ausstattungssuche (markenneutral).
 */

/** @typedef {{ raw: string, normalized: string, compact: string }} NormalizedQuery */

export function stripQuestionPhrases(text = '') {
  return text
    .replace(/^(hat (das auto|er|sie)|gibt es|ich (möchte|brauche|will)|ist der|ist die|kann (ich|man))\s+/i, '')
    .replace(/\s+(haben|vorhanden|verfügbar|dabei)\??$/i, '')
    .trim();
}

export function normalizeEquipmentQuery(text = '') {
  const raw = stripQuestionPhrases(text).trim();
  let normalized = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[?!.,;:'"()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  normalized = normalized
    .replace(/\bbi\s+direktional\b/g, 'bidirektional')
    .replace(/\bvehicle\s+to\s+load\b/g, 'vehicle to load')
    .replace(/\bvehicle\s+to\s+grid\b/g, 'vehicle to grid');

  const compact = normalized.replace(/[\s\-_/]/g, '');
  return { raw, normalized, compact };
}

/**
 * @param {NormalizedQuery} query
 * @param {string} pattern
 */
export function scoreSearchPattern(query, pattern) {
  const { normalized: np, compact: ncp } = normalizeEquipmentQuery(pattern);
  if (!np) return 0;

  const { normalized: nq, compact: cq } = query;
  if (nq === np || cq === ncp) return 100;
  if (np.length >= 3 && (nq.includes(np) || cq.includes(ncp))) {
    return 72 + Math.min(np.length, 18);
  }
  if (nq.length >= 5 && np.includes(nq)) return 58;
  if (ncp.length >= 5 && ncp.includes(cq)) return 62;

  const words = nq.split(' ').filter((w) => w.length > 2);
  if (words.length >= 2) {
    const hits = words.filter((w) => np.includes(w)).length;
    if (hits >= 2) return 42 + hits * 6;
  }
  return 0;
}
