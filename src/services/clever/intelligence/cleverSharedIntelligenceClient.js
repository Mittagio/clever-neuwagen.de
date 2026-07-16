/**
 * Browser-Client für Shared Clever Intelligence.
 */

const API_BASE = '/api/v1';

export function isCleverLexiconAiClientEnabled() {
  return import.meta.env.VITE_CLEVER_LEXICON_AI_ENABLED === 'true';
}

export function isCleverSellerCopilotClientEnabled() {
  return import.meta.env.VITE_CLEVER_SELLER_COPILOT_ENABLED === 'true';
}

/**
 * @param {object} payload
 */
export async function requestCleverLexiconQuery(payload = {}) {
  const response = await fetch(`${API_BASE}/clever/lexicon-query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok && !data.searchState) {
    return { ok: false, error: data.error ?? 'request_failed' };
  }
  return data;
}

/**
 * @param {object} payload
 */
export async function requestCleverSellerCopilot(payload = {}) {
  const response = await fetch(`${API_BASE}/clever/seller-copilot`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(payload.sellerId ? { 'X-Seller-Id': String(payload.sellerId) } : {}),
      ...(payload.dealerId ? { 'X-Dealer-Id': String(payload.dealerId) } : {}),
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { ok: false, error: data.error ?? 'request_failed' };
  }
  return data;
}

/**
 * @param {object} payload
 */
export async function requestLexiconTransfer(payload = {}) {
  const response = await fetch(`${API_BASE}/clever/lexicon-transfer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(payload.sellerId ? { 'X-Seller-Id': String(payload.sellerId) } : {}),
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { ok: false, error: data.error ?? 'request_failed' };
  }
  return data;
}
