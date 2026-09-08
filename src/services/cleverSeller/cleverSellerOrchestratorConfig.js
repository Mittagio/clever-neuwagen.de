/**
 * Feature-Flags für Clever Universal Seller Orchestrator.
 * Default: Orchestrator an (deterministisch). OpenAI-Interpretation aus.
 *
 * Freier Clever-Modus (Flag an): OpenAI = primäre Semantik (semantic_first).
 */
import {
  evaluateComplexSellerTurn,
  shouldUseSemanticInterpreter,
} from './multiSource/evaluateComplexSellerTurn.js';
import { SELLER_INPUT_MODE } from './sellerFactTypes.js';

function resolveEnv(env) {
  if (env) return env;
  return typeof process !== 'undefined' && process.env ? process.env : {};
}

/**
 * @param {object} [env]
 */
export function isCleverSellerOrchestratorEnabled(env) {
  const resolved = resolveEnv(env);
  const raw = resolved?.CLEVER_SELLER_ORCHESTRATOR_ENABLED;
  if (raw === 'false' || raw === '0') return false;
  return true;
}

/**
 * OpenAI-Interpretation für Freitext (Server).
 * Default: aus. An: CLEVER_SELLER_OPENAI_INTERPRET_ENABLED=true + OPENAI_API_KEY
 * @param {object} [env]
 */
export function isCleverSellerOpenAiInterpretEnabled(env) {
  const resolved = resolveEnv(env);
  const raw = resolved?.CLEVER_SELLER_OPENAI_INTERPRET_ENABLED;
  if (raw !== 'true' && raw !== '1') return false;
  return Boolean(resolved?.OPENAI_API_KEY);
}

/**
 * Freier Clever-Work-Input (nicht Kunden-Nachrichten-Edit / reiner Message-Mode).
 * @param {object} interpreted
 */
export function isFreeCleverSemanticInput(interpreted = {}) {
  const mode = interpreted.inputMode || interpreted.mode || null;
  if (mode === SELLER_INPUT_MODE.CUSTOMER_MESSAGE || mode === 'customer_message') {
    return false;
  }
  const text = String(
    interpreted.normalized ?? interpreted.raw ?? interpreted.sellerInput ?? '',
  ).trim();
  if (text.length < 3) return false;
  return true;
}

/**
 * Reine Heuristik – wann OpenAI nachziehen sinnvoll ist (schwache Eskalation / Legacy).
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
 * Wann OpenAI für Seller-Interpret genutzt wird.
 * Freier Clever-Modus + Flag: immer semantic_first (nicht durch Partial-Regex überspringen).
 * @param {object} interpreted
 * @param {object} [env]
 * @param {{ attachments?: object[], sellerInput?: string }} [options]
 */
export function evaluateSellerInterpretEscalation(interpreted = {}, env, options = {}) {
  const resolved = resolveEnv(env);
  if (!isCleverSellerOpenAiInterpretEnabled(resolved)) {
    return {
      shouldEscalate: false,
      reason: null,
      path: null,
      complexity: { isComplex: false, reason: null, path: null },
      semanticFirst: false,
    };
  }

  const complexity = evaluateComplexSellerTurn({
    sellerInput: options.sellerInput ?? interpreted.normalized ?? interpreted.raw ?? interpreted.sellerInput,
    attachments: options.attachments || [],
    facts: interpreted.facts ?? interpreted.extractedFacts ?? [],
    interpreted,
  });

  if (complexity.isComplex) {
    return {
      shouldEscalate: true,
      reason: complexity.reason,
      path: complexity.path || 'multi_source',
      complexity,
      semanticFirst: true,
    };
  }

  // Produkt: freier Clever-Input → OpenAI primär (auch bei Partial Regex Success)
  if (isFreeCleverSemanticInput(interpreted) || isFreeCleverSemanticInput({
    ...interpreted,
    sellerInput: options.sellerInput,
  })) {
    return {
      shouldEscalate: true,
      reason: 'semantic_first',
      path: 'facts',
      complexity,
      semanticFirst: true,
    };
  }

  const weak = shouldEscalateSellerInterpretation(interpreted);
  return {
    shouldEscalate: weak.shouldEscalate,
    reason: weak.reason,
    path: weak.shouldEscalate ? 'facts' : null,
    complexity,
    semanticFirst: false,
  };
}

export { evaluateComplexSellerTurn, shouldUseSemanticInterpreter };
