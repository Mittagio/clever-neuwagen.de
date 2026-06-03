/**
 * Einfaches Fuzzy-Matching für Auto-Suchbegriffe (Levenshtein)
 */

export function levenshtein(a, b) {
  const s = a.toLowerCase();
  const t = b.toLowerCase();
  if (s === t) return 0;
  if (!s.length) return t.length;
  if (!t.length) return s.length;

  const rows = s.length + 1;
  const cols = t.length + 1;
  const matrix = Array.from({ length: rows }, () => new Array(cols).fill(0));

  for (let i = 0; i < rows; i += 1) matrix[i][0] = i;
  for (let j = 0; j < cols; j += 1) matrix[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[rows - 1][cols - 1];
}

export function similarity(a, b) {
  const maxLen = Math.max(a.length, b.length, 1);
  return 1 - levenshtein(a, b) / maxLen;
}

/**
 * @param {string} token
 * @param {Array<{ id: string, term: string, replace: string, label?: string }>} candidates
 * @param {{ highThreshold?: number, mediumThreshold?: number }} opts
 */
export function fuzzyMatchToken(token, candidates, opts = {}) {
  const high = opts.highThreshold ?? 0.82;
  const medium = opts.mediumThreshold ?? 0.65;
  const clean = token.toLowerCase().trim();
  if (clean.length < 3) return null;

  let best = null;
  for (const c of candidates) {
    const sim = similarity(clean, c.term);
    if (!best || sim > best.sim) {
      best = { ...c, sim };
    }
  }
  if (!best) return null;
  if (best.sim >= high) return { ...best, confidence: 'high' };
  if (best.sim >= medium) return { ...best, confidence: 'medium' };
  return null;
}
