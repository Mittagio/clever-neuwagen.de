/**
 * Feature-Flags für Clever Universal Seller Orchestrator.
 * Default: Orchestrator an (deterministisch). OpenAI-Interpretation aus.
 */

/**
 * @param {object} [env]
 */
export function isCleverSellerOrchestratorEnabled(env = process.env) {
  const raw = env?.CLEVER_SELLER_ORCHESTRATOR_ENABLED;
  if (raw === 'false' || raw === '0') return false;
  return true;
}

/**
 * OpenAI-Eskalation für Freitext-Interpretation (Server).
 * Default: aus. An: CLEVER_SELLER_OPENAI_INTERPRET_ENABLED=true + OPENAI_API_KEY
 * @param {object} [env]
 */
export function isCleverSellerOpenAiInterpretEnabled(env = process.env) {
  const raw = env?.CLEVER_SELLER_OPENAI_INTERPRET_ENABLED;
  if (raw !== 'true' && raw !== '1') return false;
  return Boolean(env?.OPENAI_API_KEY);
}

/**
 * Reine Heuristik – wann OpenAI nachziehen sinnvoll ist.
 * @param {object} interpreted
 */
export function shouldEscalateSellerInterpretation(interpreted = {}) {
  const text = String(interpreted.normalized ?? interpreted.raw ?? interpreted.sellerInput ?? '').trim();
  if (text.length < 12) {
    return { shouldEscalate: false, reason: 'too_short' };
  }

  if (interpreted.inputMode === 'customer_message') {
    return { shouldEscalate: false, reason: 'customer_message' };
  }

  const facts = interpreted.facts ?? interpreted.extractedFacts ?? [];
  const intents = interpreted.intents ?? [];
  const primary = intents[0]?.type || 'unknown';
  const confidence = Number(interpreted.confidence ?? 0);

  if (facts.length === 0) {
    return { shouldEscalate: true, reason: 'no_facts' };
  }
  if (primary === 'unknown') {
    return { shouldEscalate: true, reason: 'unknown_intent' };
  }
  if (confidence > 0 && confidence < 0.55) {
    return { shouldEscalate: true, reason: 'low_confidence' };
  }
  if (facts.some((f) => f.field === 'vehicleInterestMulti')) {
    return { shouldEscalate: true, reason: 'multi_interest' };
  }

  return { shouldEscalate: false, reason: null };
}

/**
 * Wann deterministische Interpretation OpenAI nachziehen soll.
 * @param {object} interpreted
 * @param {object} [env]
 */
export function evaluateSellerInterpretEscalation(interpreted = {}, env = process.env) {
  if (!isCleverSellerOpenAiInterpretEnabled(env)) {
    return { shouldEscalate: false, reason: null };
  }
  return shouldEscalateSellerInterpretation(interpreted);
}
