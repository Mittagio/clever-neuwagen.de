/**
 * Observability – ohne personenbezogene Inhalte in Produktionslogs.
 */

export function createCleverTurnMetrics() {
  return {
    startedAt: Date.now(),
    aiUsed: false,
    fallback: false,
    toolCallCount: 0,
    schemaValid: null,
    groundingValid: null,
    nextActionType: null,
    handoff: false,
    errorClass: null,
    durationMs: null,
    primaryModel: null,
    finalModel: null,
    escalationUsed: false,
    escalationReason: null,
    usedOfficialWeb: false,
    hadDataConflict: false,
  };
}

/**
 * @param {object} metrics
 * @param {object} patch
 */
export function finalizeCleverTurnMetrics(metrics, patch = {}) {
  const next = {
    ...metrics,
    ...patch,
    durationMs: Date.now() - metrics.startedAt,
  };
  return next;
}

/**
 * @param {object} metrics
 */
export function logCleverTurnMetrics(metrics = {}) {
  const payload = {
    event: 'clever_ai_turn',
    aiUsed: metrics.aiUsed === true,
    fallback: metrics.fallback === true,
    durationMs: metrics.durationMs,
    toolCallCount: metrics.toolCallCount ?? 0,
    schemaValid: metrics.schemaValid,
    groundingValid: metrics.groundingValid,
    nextActionType: metrics.nextActionType ?? null,
    handoff: metrics.handoff === true,
    errorClass: metrics.errorClass ?? null,
    primaryModel: metrics.primaryModel ?? null,
    finalModel: metrics.finalModel ?? null,
    escalationUsed: metrics.escalationUsed === true,
    escalationReason: metrics.escalationReason ?? null,
    usedOfficialWeb: metrics.usedOfficialWeb === true,
    hadDataConflict: metrics.hadDataConflict === true,
  };
  console.info(JSON.stringify(payload));
}
