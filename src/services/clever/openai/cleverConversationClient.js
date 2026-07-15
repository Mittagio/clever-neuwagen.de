/**
 * Browser-Client für Clever AI Conversation Turn (serverseitig).
 */

const API_BASE = '/api/v1';

/**
 * @param {object} params
 */
export async function requestCleverConversationTurn({
  customerMessage,
  conversationHistory = [],
  dealerId = null,
  brandContext = {},
  session = null,
}) {
  const response = await fetch(`${API_BASE}/clever/conversation-turn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerMessage,
      conversationHistory,
      dealerId,
      brandContext,
      session,
      needProfile: session?.needProfile ?? null,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { ok: false, error: data.error ?? 'request_failed' };
  }
  return data;
}

export function isCleverAiConversationClientEnabled() {
  return import.meta.env.VITE_CLEVER_AI_CONVERSATION_ENABLED === 'true';
}
