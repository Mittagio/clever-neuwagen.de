/**
 * OpenAI-Interpretation für Seller-Freitext (primäre Semantik im freien Clever-Modus).
 * Clever persistiert erst nach Validate/Apply – LLM mutiert keinen Lead.
 */
import { SELLER_FACT_CLASS, SELLER_TURN_INTENTS } from './sellerFactTypes.js';

const ENV = typeof process !== 'undefined' && process.env ? process.env : {};
const OPENAI_MODEL = ENV.OPENAI_QUERY_MODEL || ENV.OPENAI_CLEVER_MODEL || 'gpt-4o-mini';

const ALLOWED_FACT_CLASSES = new Set(Object.values(SELLER_FACT_CLASS));
const ALLOWED_INTENTS = new Set(Object.values(SELLER_TURN_INTENTS));

const RESULT_JSON_SCHEMA = {
  name: 'seller_input_interpretation',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['facts', 'intents', 'confidence'],
    properties: {
      confidence: { type: 'number' },
      facts: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['factClass', 'label', 'field', 'value', 'confidence', 'evidence'],
          properties: {
            factClass: { type: 'string' },
            field: { type: ['string', 'null'] },
            value: {},
            label: { type: 'string' },
            confidence: { type: 'number' },
            evidence: { type: ['string', 'null'] },
          },
        },
      },
      intents: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['type', 'confidence'],
          properties: {
            type: { type: 'string' },
            confidence: { type: 'number' },
          },
        },
      },
    },
  },
};

function sanitizeAiResult(parsed = {}) {
  const facts = (parsed.facts ?? [])
    .filter((f) => f && ALLOWED_FACT_CLASSES.has(f.factClass) && String(f.label || '').trim())
    .slice(0, 24)
    .map((f) => ({
      factClass: f.factClass,
      field: f.field || null,
      value: f.value ?? null,
      label: String(f.label).trim().slice(0, 160),
      confidence: Number(f.confidence) || 0.7,
      evidence: f.evidence != null ? String(f.evidence).trim().slice(0, 160) : null,
    }));

  const intents = (parsed.intents ?? [])
    .filter((i) => i && ALLOWED_INTENTS.has(i.type))
    .slice(0, 6)
    .map((i) => ({
      type: i.type,
      confidence: Number(i.confidence) || 0.65,
    }));

  return {
    facts,
    intents,
    confidence: Number(parsed.confidence) || 0.65,
  };
}

/**
 * @param {object} safeContext – buildSellerInterpretSafeContext()
 * @param {{
 *   fetchImpl?: typeof fetch,
 *   apiKey?: string|null,
 *   model?: string,
 *   interpretImpl?: (ctx: object) => Promise<object>|object,
 * }} [options]
 */
export async function interpretSellerInputWithOpenAi(safeContext = {}, options = {}) {
  if (typeof options.interpretImpl === 'function') {
    try {
      const custom = await options.interpretImpl(safeContext, options);
      if (custom?.ok === false) {
        return {
          ok: false,
          error: custom.error || 'interpret_impl_failed',
          facts: [],
          intents: [],
          confidence: 0,
        };
      }
      const sanitized = sanitizeAiResult({
        facts: custom?.facts ?? [],
        intents: custom?.intents ?? [],
        confidence: custom?.confidence ?? 0.9,
      });
      return { ok: true, error: null, ...sanitized };
    } catch (err) {
      return {
        ok: false,
        error: err?.message || 'interpret_impl_failed',
        facts: [],
        intents: [],
        confidence: 0,
      };
    }
  }

  const apiKey = options.apiKey ?? ENV.OPENAI_API_KEY ?? null;
  if (!apiKey) {
    return { ok: false, error: 'missing_api_key', facts: [], intents: [], confidence: 0 };
  }

  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    return { ok: false, error: 'fetch_unavailable', facts: [], intents: [], confidence: 0 };
  }

  const sellerInput = String(safeContext.sellerInput ?? '').trim();
  if (sellerInput.length < 3) {
    return { ok: false, error: 'empty_input', facts: [], intents: [], confidence: 0 };
  }

  const response = await fetchImpl('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: options.model || OPENAI_MODEL,
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content: [
            'Du bist der primäre semantische Interpreter für Verkäufer-Notizen (Autohaus, Kia).',
            'Verstehe Umgangssprache, Tippfehler, Diktat und Abkürzungen (leasn→leasing, stromer→electric, 15 tausend→15000, 15tkm→15000).',
            'Extrahiere ALLES, was du sicher verstehst. Erfinde nichts.',
            'Kein bedeutungstragender Teil darf verworfen werden.',
            'Nicht sicher klassifizierbar → factClass seller_note, field unresolvedNote, value.text = Originalformulierung.',
            'field = Slotname (fuelPreference, paymentType, termMonths, annualMileage, colorPreference, …).',
            'factClass nur aus erlaubter Liste. Jahre→termMonths (4 Jahre=48). Kilometer/Jahr→annualMileage.',
            'fuelPreference value: electric | hybrid | diesel | petrol. paymentType: leasing | financing | cash.',
            'evidence = kurze Originalspanne aus dem Input (z. B. \"stromer\", \"leasn\").',
            'EQ2/EQ3 o.ä. Tippfehler → kanonisch EV2/EV3 wenn klar Kia-Kontext, sonst niedriger confidence + raw in label.',
            'Bestandsfahrzeug („fährt einen …“) ≠ Wunschfahrzeug; field existingVehicle, nicht vehicleInterest.',
            'GW / Inzahlungnahme nur bei explizitem Cue (tradeInRequested / tradeInVehicle).',
            'workingState beachten: „doch weiß“ / „nee lieber weiß“ = Korrektur colorPreference am bestehenden Track/Draft – kein neues Modell.',
            'Keine Namen/Telefon/E-Mail erfinden. Keine Angebotsraten/Monatsraten erfinden.',
            'Kein Modell erfinden, wenn keines genannt wurde.',
            'Partial Success: unsichere Einzelteile markieren (niedrige confidence), sichere trotzdem liefern.',
            'Antworte NUR als JSON gemäß Schema.',
            'factClass nur aus:',
            Object.values(SELLER_FACT_CLASS).join(', '),
            'intent type nur aus:',
            Object.values(SELLER_TURN_INTENTS).join(', '),
          ].join('\n'),
        },
        {
          role: 'user',
          content: JSON.stringify({
            sellerInput,
            workingState: safeContext.workingState ?? {},
            knownLabels: safeContext.knownLabels ?? [],
            customerLabels: safeContext.customerLabels ?? [],
            needProfileHints: safeContext.needProfileHints ?? {},
            deterministicHints: safeContext.deterministicHints ?? {},
            attachmentTypes: safeContext.attachmentTypes ?? [],
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
      facts: [],
      intents: [],
      confidence: 0,
    };
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    return { ok: false, error: 'empty_response', facts: [], intents: [], confidence: 0 };
  }

  try {
    const parsed = JSON.parse(content);
    const sanitized = sanitizeAiResult(parsed);
    return { ok: true, error: null, ...sanitized };
  } catch {
    return { ok: false, error: 'invalid_json', facts: [], intents: [], confidence: 0 };
  }
}

export { RESULT_JSON_SCHEMA, sanitizeAiResult };
