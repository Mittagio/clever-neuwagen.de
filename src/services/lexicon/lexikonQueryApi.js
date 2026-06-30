const API_BASE = '/api/v1';

/**
 * @param {object} payload
 */
export async function fetchLexikonQuery(payload = {}) {
  const res = await fetch(`${API_BASE}/clever/lexikon-query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(data.error ?? 'lexikon_query_failed');
  }
  return data;
}
