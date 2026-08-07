/**
 * Browser-Client für Clever Agent (kein OpenAI-Key im Frontend).
 */

const API_BASE = '/api/v1';

export function isCleverAgentClientEnabled() {
  return import.meta.env.VITE_CLEVER_AGENT_ENABLED === 'true'
    || import.meta.env.VITE_CLEVER_AGENT_ENABLED === '1';
}

/**
 * @param {object} payload
 * @param {{ sellerId?: string, dealerId?: string }} [opts]
 */
export async function requestCleverAgent(payload = {}, opts = {}) {
  const response = await fetch(`${API_BASE}/clever-agent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.sellerId ? { 'X-Seller-Id': String(opts.sellerId) } : {}),
      ...(opts.dealerId ? { 'X-Dealer-Id': String(opts.dealerId) } : {}),
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ok: false,
      message: data.message || 'Clever Agent Anfrage fehlgeschlagen.',
      error: data.error || 'request_failed',
      artifacts: [],
      suggestedActions: [],
      mutations: [],
    };
  }
  return data;
}
