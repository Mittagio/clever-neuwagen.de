/**
 * OpenAI Offer Interpreter – Structured JSON aus PDF-Text.
 * Browser-sicher (kein process.env-Crash). Bei Fehler → deterministischer Fallback.
 */
import {
  OFFER_INTERPRETER_JSON_SCHEMA,
  OFFER_INTERPRETER_SYSTEM_PROMPT,
  validateOfferInterpretation,
  buildOfferReviewModel,
  detectRateAmbiguity,
} from './offerInterpreterSchema.js';
import {
  interpretOfferFromPdfText,
  collectMonthlyRateCandidates,
} from './interpretOfferFromPdfText.js';

const ENV = typeof process !== 'undefined' && process.env ? process.env : {};
const OPENAI_MODEL = ENV.OPENAI_QUERY_MODEL || ENV.OPENAI_CLEVER_MODEL || 'gpt-4o-mini';

const RESULT_JSON_SCHEMA = {
  name: 'offer_interpretation',
  strict: false,
  schema: OFFER_INTERPRETER_JSON_SCHEMA,
};

/**
 * Roh-Aufruf OpenAI Structured Outputs.
 * @param {string} pdfText
 * @param {{ fileName?: string, knownVehicle?: object }} [context]
 * @param {{ fetchImpl?: typeof fetch, apiKey?: string|null, model?: string }} [options]
 */
export async function interpretOfferFromPdfWithOpenAi(pdfText, context = {}, options = {}) {
  const apiKey = options.apiKey ?? ENV.OPENAI_API_KEY ?? null;
  if (!apiKey) {
    return { ok: false, error: 'missing_api_key', interpretation: null };
  }

  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    return { ok: false, error: 'fetch_unavailable', interpretation: null };
  }

  const text = String(pdfText ?? '').trim();
  if (text.length < 20) {
    return { ok: false, error: 'empty_input', interpretation: null };
  }

  const response = await fetchImpl('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: options.model || OPENAI_MODEL,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: OFFER_INTERPRETER_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: JSON.stringify({
            pdfText: text.slice(0, 24000),
            fileName: context.fileName ?? null,
            knownVehicle: context.knownVehicle ?? null,
          }),
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: RESULT_JSON_SCHEMA,
      },
    }),
  });

  if (!response.ok) {
    return {
      ok: false,
      error: `openai_http_${response.status}`,
      interpretation: null,
    };
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    return { ok: false, error: 'empty_response', interpretation: null };
  }

  try {
    const parsed = JSON.parse(content);
    const validation = validateOfferInterpretation(parsed);
    return {
      ok: true,
      error: null,
      validation,
      interpretation: validation.interpretation,
    };
  } catch {
    return { ok: false, error: 'invalid_json', interpretation: null };
  }
}

/**
 * Pipeline: OpenAI → validate → Review-Modell; sonst deterministischer Fallback.
 * Erfindet keine Werte; Ambiguities bleiben im Review.
 *
 * @param {string} pdfText
 * @param {{ fileName?: string, knownVehicle?: object }} [context]
 * @param {{ fetchImpl?: typeof fetch, apiKey?: string|null, model?: string }} [options]
 */
export async function interpretOfferFromPdf(pdfText, context = {}, options = {}) {
  let ai;
  try {
    ai = await interpretOfferFromPdfWithOpenAi(pdfText, context, options);
  } catch {
    ai = { ok: false, error: 'openai_exception', interpretation: null };
  }

  if (ai.ok && ai.validation && ai.interpretation) {
    // Rate-Ambiguity aus Text nachziehen, falls Modell nur einen Wert wählte
    const rateCandidates = collectMonthlyRateCandidates(pdfText || '');
    const ambiguity = detectRateAmbiguity(rateCandidates);
    let validation = ai.validation;
    if (ambiguity && !(validation.interpretation.ambiguities ?? []).some((a) => a.field === 'monthlyRate')) {
      validation = validateOfferInterpretation({
        ...validation.interpretation,
        monthlyRate: null,
        ambiguities: [...(validation.interpretation.ambiguities ?? []), ambiguity],
        confidence: {
          ...validation.interpretation.confidence,
          monthlyRate: 0.4,
        },
      });
    }

    return {
      ...validation,
      review: buildOfferReviewModel(validation),
      rateCandidates,
      source: 'openai',
      openaiError: null,
    };
  }

  const fallback = interpretOfferFromPdfText(pdfText, context);
  return {
    ...fallback,
    openaiError: ai?.error ?? 'unavailable',
  };
}
