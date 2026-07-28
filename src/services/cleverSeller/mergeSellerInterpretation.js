/**
 * Merge deterministische + OpenAI-Facts.
 * OpenAI-Facts immer needsConfirmation – kein Auto-Persist.
 */
import { createExtractedFact } from './cleverSellerTurnResultSchema.js';
import { SELLER_FACT_SOURCE } from './sellerFactTypes.js';

function factKey(fact = {}) {
  return [
    fact.factClass || '',
    fact.field || '',
    String(fact.label || '').trim().toLowerCase(),
  ].join('|');
}

/**
 * @param {object[]} deterministicFacts
 * @param {object[]} aiFacts
 */
export function mergeSellerInterpretation(deterministicFacts = [], aiFacts = []) {
  const merged = [];
  const seen = new Set();

  for (const fact of deterministicFacts) {
    if (!fact) continue;
    const key = factKey(fact);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(fact);
  }

  for (const raw of aiFacts) {
    if (!raw?.label && raw?.value == null) continue;
    const fact = createExtractedFact({
      factClass: raw.factClass || 'seller_note',
      field: raw.field || null,
      value: raw.value ?? null,
      label: raw.label || String(raw.value ?? ''),
      source: SELLER_FACT_SOURCE.OPENAI_INTERPRETATION,
      confidence: Math.min(0.85, Number(raw.confidence) || 0.7),
      needsConfirmation: true,
    });
    const key = factKey(fact);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(fact);
  }

  return merged;
}

/**
 * Intent-Merge: deterministisch behält Vorrang; OpenAI ergänzt.
 * @param {object[]} deterministicIntents
 * @param {object[]} aiIntents
 */
export function mergeSellerIntents(deterministicIntents = [], aiIntents = []) {
  const byType = new Map();
  for (const intent of deterministicIntents) {
    if (!intent?.type) continue;
    byType.set(intent.type, intent);
  }
  for (const intent of aiIntents) {
    if (!intent?.type || byType.has(intent.type)) continue;
    byType.set(intent.type, {
      type: intent.type,
      confidence: Math.min(0.8, Number(intent.confidence) || 0.65),
      source: SELLER_FACT_SOURCE.OPENAI_INTERPRETATION,
    });
  }
  return [...byType.values()].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
}
