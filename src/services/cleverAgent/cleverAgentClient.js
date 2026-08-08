/**
 * Browser-Client für Clever Agent (kein OpenAI-Key im Frontend).
 */

const API_BASE = '/api/v1';

/** Gründe, bei denen UI sauber auf deterministischen Seller-Turn fällt. */
export const CLEVER_AGENT_FALLBACK_REASONS = new Set([
  'feature_disabled',
  'api_key_missing',
  'agent_disabled',
  'agent_error',
  'request_failed',
  'network_error',
  'timeout',
  'internal_error',
]);

export function isCleverAgentClientEnabled() {
  return import.meta.env.VITE_CLEVER_AGENT_ENABLED === 'true'
    || import.meta.env.VITE_CLEVER_AGENT_ENABLED === '1';
}

/**
 * @param {object} agentResult
 * @returns {boolean} true → Caller soll runCleverSellerTurn nutzen
 */
export function shouldFallbackToSellerTurn(agentResult = {}) {
  if (!agentResult || typeof agentResult !== 'object') return true;
  if (agentResult.ok) return false;
  if (agentResult.confirmationRequired || agentResult.pendingAction) return false;
  if (Array.isArray(agentResult.mutations) && agentResult.mutations.length) return false;
  const reason = agentResult.fallbackReason || agentResult.error;
  if (reason && CLEVER_AGENT_FALLBACK_REASONS.has(String(reason))) return true;
  if (agentResult.error === 'request_failed' || agentResult.error === 'internal_error') return true;
  return false;
}

/**
 * @param {object} payload
 * @param {{ sellerId?: string, dealerId?: string }} [opts]
 */
export async function requestCleverAgent(payload = {}, opts = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}/clever-agent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(opts.sellerId ? { 'X-Seller-Id': String(opts.sellerId) } : {}),
        ...(opts.dealerId ? { 'X-Dealer-Id': String(opts.dealerId) } : {}),
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    return {
      ok: false,
      message: 'Clever Agent nicht erreichbar – ich nutze den klassischen Pfad.',
      error: 'network_error',
      fallbackReason: 'network_error',
      artifacts: [],
      suggestedActions: [],
      mutations: [],
      detail: String(err?.message || err).slice(0, 160),
    };
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const fallbackReason = data.fallbackReason
      || data.error
      || (response.status >= 500 ? 'agent_error' : 'request_failed');
    return {
      ok: false,
      message: data.message || 'Clever Agent Anfrage fehlgeschlagen.',
      error: data.error || 'request_failed',
      fallbackReason,
      artifacts: [],
      suggestedActions: [],
      mutations: [],
    };
  }
  return data;
}
