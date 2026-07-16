/**
 * Clever AI Conversation – zentrale Konfiguration (nur serverseitig).
 */

export function getCleverAiConfig(env = process.env) {
  const timeoutRaw = Number(env.CLEVER_AI_TIMEOUT_MS);
  const cacheTtlRaw = Number(env.CLEVER_OFFICIAL_WEB_CACHE_TTL_MS);
  return {
    enabled: env.CLEVER_AI_CONVERSATION_ENABLED === 'true',
    apiKey: env.OPENAI_API_KEY ?? null,
    model: env.OPENAI_CLEVER_MODEL
      || env.OPENAI_QUERY_MODEL
      || 'gpt-5.6-luna',
    escalationModel: env.OPENAI_CLEVER_ESCALATION_MODEL || 'gpt-5.6-terra',
    escalationEnabled: env.CLEVER_AI_ESCALATION_ENABLED === 'true',
    officialWebSearchEnabled: env.CLEVER_OFFICIAL_WEB_SEARCH_ENABLED === 'true',
    officialWebCacheTtlMs: Number.isFinite(cacheTtlRaw) && cacheTtlRaw > 0 ? cacheTtlRaw : null,
    timeoutMs: Number.isFinite(timeoutRaw) && timeoutRaw > 0 ? timeoutRaw : 25000,
    maxToolRounds: 3,
  };
}

export function isCleverAiConversationEnabled(env = process.env) {
  const config = getCleverAiConfig(env);
  return config.enabled && Boolean(config.apiKey);
}
