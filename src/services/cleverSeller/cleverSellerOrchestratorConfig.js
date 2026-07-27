/**
 * Feature-Flag für Clever Universal Seller Orchestrator.
 * Default: an (deterministisch, kein OpenAI nötig).
 * Abschalten: CLEVER_SELLER_ORCHESTRATOR_ENABLED=false
 */

/**
 * @param {object} [env]
 */
export function isCleverSellerOrchestratorEnabled(env = process.env) {
  const raw = env?.CLEVER_SELLER_ORCHESTRATOR_ENABLED;
  if (raw === 'false' || raw === '0') return false;
  return true;
}
