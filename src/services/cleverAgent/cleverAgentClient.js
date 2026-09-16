/**
 * Browser-Client für Clever Agent (kein OpenAI-Key im Frontend).
 */

import { slimLeadForSellerTurnClient } from '../clever/intelligence/cleverSharedIntelligenceClient.js';

const API_BASE = '/api/v1';
/** Kurz genug, dass UI bei API-Ausfall nicht minutenlang „denkt“. */
const AGENT_TIMEOUT_MS = 16000;

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
  'payload_too_large',
]);

export function isCleverAgentClientEnabled() {
  const raw = import.meta.env.VITE_CLEVER_AGENT_ENABLED;
  // Explizit aus
  if (raw === 'false' || raw === '0') return false;
  // Explizit an
  if (raw === 'true' || raw === '1') return true;
  // Phase 2: Freier Clever-Modus → Agent default-on (Fallback bleibt Seller-Turn)
  return true;
}

/**
 * Leads-Snapshot für Agent: nur Such-Index, kein Full-CRM (vermeidet UI-Freeze + 413).
 * @param {object[]} leads
 * @param {{ limit?: number }} [opts]
 */
export function slimLeadsSnapshotForAgent(leads = [], opts = {}) {
  const limit = Number(opts.limit) > 0 ? Number(opts.limit) : 60;
  const list = Array.isArray(leads) ? leads : [];
  return list.slice(0, limit).map((lead) => ({
    id: lead?.id ?? null,
    name: lead?.contact?.name || lead?.name || null,
    email: lead?.contact?.email || null,
    phone: lead?.contact?.phone || null,
    referenceCode: lead?.referenceCode || null,
    modelHint: lead?.wish?.model
      || lead?.crm?.needProfile?.selectedModelKey
      || null,
  }));
}

/**
 * Agent-Payload verkleinern (stringify von Multi-MB-Snapshots friert den Tab ein).
 * @param {object} payload
 */
export function slimCleverAgentPayload(payload = {}) {
  const next = { ...payload };
  if (next.lead && typeof next.lead === 'object') {
    next.lead = {
      ...slimLeadForSellerTurnClient(next.lead),
      contact: {
        name: next.lead.contact?.name || next.lead.name || null,
        email: next.lead.contact?.email || null,
        phone: next.lead.contact?.phone || null,
      },
      name: next.lead.name || next.lead.contact?.name || null,
    };
  }
  if (Array.isArray(next.leadsSnapshot)) {
    next.leadsSnapshot = slimLeadsSnapshotForAgent(next.leadsSnapshot);
  }
  if (Array.isArray(next.conversationHistory)) {
    next.conversationHistory = next.conversationHistory.slice(-12).map((turn) => ({
      role: turn?.role === 'assistant' ? 'assistant' : 'user',
      text: String(turn?.text || turn?.content || '').slice(0, 800),
    }));
  }
  return next;
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
 * @param {{ sellerId?: string, dealerId?: string, timeoutMs?: number }} [opts]
 */
export async function requestCleverAgent(payload = {}, opts = {}) {
  const timeoutMs = Number(opts.timeoutMs) > 0 ? Number(opts.timeoutMs) : AGENT_TIMEOUT_MS;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller
    ? setTimeout(() => controller.abort(), timeoutMs)
    : null;
  const body = slimCleverAgentPayload(payload);
  let response;
  try {
    response = await fetch(`${API_BASE}/clever-agent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(opts.sellerId ? { 'X-Seller-Id': String(opts.sellerId) } : {}),
        ...(opts.dealerId ? { 'X-Dealer-Id': String(opts.dealerId) } : {}),
      },
      body: JSON.stringify(body),
      ...(controller ? { signal: controller.signal } : {}),
    });
  } catch (err) {
    const aborted = err?.name === 'AbortError';
    return {
      ok: false,
      message: aborted
        ? 'Clever Agent braucht zu lange – ich nutze den klassischen Pfad.'
        : 'Clever Agent nicht erreichbar – ich nutze den klassischen Pfad.',
      error: aborted ? 'timeout' : 'network_error',
      fallbackReason: aborted ? 'timeout' : 'network_error',
      artifacts: [],
      suggestedActions: [],
      mutations: [],
      detail: String(err?.message || err).slice(0, 160),
    };
  } finally {
    if (timer) clearTimeout(timer);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const tooLarge = response.status === 413;
    const fallbackReason = tooLarge
      ? 'payload_too_large'
      : (data.fallbackReason
        || data.error
        || (response.status >= 500 ? 'agent_error' : 'request_failed'));
    return {
      ok: false,
      message: tooLarge
        ? 'Anfrage zu groß – ich nutze den klassischen Pfad.'
        : (data.message || 'Clever Agent Anfrage fehlgeschlagen.'),
      error: data.error || (tooLarge ? 'payload_too_large' : 'request_failed'),
      fallbackReason,
      artifacts: [],
      suggestedActions: [],
      mutations: [],
    };
  }
  return data;
}
