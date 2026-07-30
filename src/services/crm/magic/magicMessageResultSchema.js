/**
 * MagicMessageResult – Structured Output für grounded Kunden-Nachrichten.
 */

export const MAGIC_MESSAGE_MODES = Object.freeze([
  'write_from_notes',
  'clarify_vehicle',
  'missing_knowledge',
  'neutral_without_details',
]);

export function buildMagicMessageResultJsonSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: [
      'mode',
      'body',
      'usedFacts',
      'missingKnowledge',
      'ambiguities',
      'warnings',
      'confidence',
    ],
    properties: {
      mode: { type: 'string', enum: MAGIC_MESSAGE_MODES },
      body: { type: 'string' },
      usedFacts: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['type', 'value', 'source', 'evidenceId'],
          properties: {
            type: { type: 'string' },
            value: { type: 'string' },
            source: { type: 'string' },
            evidenceId: { type: 'string' },
          },
        },
      },
      missingKnowledge: {
        type: 'array',
        items: { type: 'string' },
      },
      ambiguities: {
        type: 'array',
        items: { type: 'string' },
      },
      warnings: {
        type: 'array',
        items: { type: 'string' },
      },
      confidence: { type: 'number' },
    },
  };
}

export const MAGIC_MESSAGE_RESULT_JSON_SCHEMA = {
  name: 'magic_message_result',
  strict: true,
  schema: buildMagicMessageResultJsonSchema(),
};

/**
 * @param {unknown} value
 */
export function validateMagicMessageResult(value) {
  const errors = [];
  if (!value || typeof value !== 'object') {
    return { ok: false, errors: ['not_object'] };
  }
  const result = value;
  if (!MAGIC_MESSAGE_MODES.includes(String(result.mode))) errors.push('invalid_mode');
  if (typeof result.body !== 'string') errors.push('invalid_body');
  if (!Array.isArray(result.usedFacts)) errors.push('invalid_usedFacts');
  if (!Array.isArray(result.missingKnowledge)) errors.push('invalid_missingKnowledge');
  if (!Array.isArray(result.ambiguities)) errors.push('invalid_ambiguities');
  if (!Array.isArray(result.warnings)) errors.push('invalid_warnings');
  if (typeof result.confidence !== 'number') errors.push('invalid_confidence');

  for (const fact of result.usedFacts ?? []) {
    if (!fact || typeof fact !== 'object') {
      errors.push('invalid_usedFact');
      break;
    }
    if (typeof fact.type !== 'string' || typeof fact.value !== 'string') {
      errors.push('invalid_usedFact_fields');
      break;
    }
    if (typeof fact.source !== 'string' || typeof fact.evidenceId !== 'string') {
      errors.push('invalid_usedFact_source');
      break;
    }
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, result };
}

/**
 * Grounding: keine technischen Claims ohne Evidence aus dem Pre-Retrieval.
 * @param {object} result
 * @param {{ allowedEvidenceIds?: Set<string>|string[], allowedValues?: Set<string>|string[] }} evidence
 */
export function assertGroundedMagicMessageResult(result, evidence = {}) {
  const errors = [];
  const allowedIds = new Set(
    Array.isArray(evidence.allowedEvidenceIds)
      ? evidence.allowedEvidenceIds
      : [...(evidence.allowedEvidenceIds ?? [])],
  );
  const allowedValues = new Set(
    [...(evidence.allowedValues ?? [])].map((v) => String(v).toLowerCase().trim()).filter(Boolean),
  );

  for (const fact of result?.usedFacts ?? []) {
    if (fact.source === 'seller_input') continue;
    if (allowedIds.size && fact.evidenceId && !allowedIds.has(fact.evidenceId)) {
      errors.push(`unknown_evidence:${fact.evidenceId}`);
    }
  }

  const body = String(result?.body ?? '').toLowerCase();
  // Harte Halluzinations-Heuristik: Zahlen im Body müssen in erlaubten Werten oder Seller-Fakten vorkommen
  const numbers = body.match(/\d+[.,]?\d*/g) ?? [];
  for (const num of numbers) {
    const normalized = num.replace(',', '.');
    const ok = [...allowedValues].some((v) => v.includes(normalized) || v.includes(num));
    const sellerOk = (result.usedFacts ?? []).some(
      (f) => f.source === 'seller_input' && String(f.value).includes(num),
    );
    // Jahre / kurze Ziffern (Anreden) ignorieren
    if (normalized.length <= 1) continue;
    if (/^(19|20)\d{2}$/.test(normalized)) continue;
    if (!ok && !sellerOk && Number(normalized) > 20) {
      // soft: only flag large numbers that look like prices/rates
      if (Number(normalized) >= 100) {
        errors.push(`unguarded_number:${num}`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}
