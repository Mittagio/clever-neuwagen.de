/**
 * OpenAI Multi-Source Interpret via vorhandenen openAiResponsesClient.
 * OpenAI = primäres Sprachverständnis; Merge/Validatoren danach.
 * Fallback auf deterministisches buildMultiSourceIntake (ehrlich gekennzeichnet).
 */
import { CLEVER_MULTI_SOURCE_INTAKE_PLAN_SCHEMA } from './cleverMultiSourceIntakePlanSchema.js';
import { mergeMultiSourceIntakePlan } from './mergeMultiSourceIntakePlan.js';
import { buildMultiSourceIntake } from './buildMultiSourceIntake.js';
import { extractMinimalContractContexts } from './extractMinimalContractContext.js';

const ENV = typeof process !== 'undefined' && process.env ? process.env : {};

function resolveModel(options = {}) {
  return options.model
    || ENV.OPENAI_QUERY_MODEL
    || ENV.OPENAI_CLEVER_MODEL
    || ENV.OPENAI_MODEL
    || 'gpt-4o-mini';
}

const SYSTEM_INSTRUCTIONS = [
  'Du bist der semantische Interpreter für komplexe Autohaus-Verkäufer-Turns (Kia).',
  'Liefere ausschließlich einen CleverMultiSourceIntakePlan als JSON.',
  'Erfinde nichts. Keine IBAN, Ausweis, Gehalt, Adresse, Geburt, Unterschrift.',
  'GW / Inzahlungnahme = tradeInCandidates mit role trade_in_vehicle – nie vehicleInterests.',
  'Neuer Wunsch (EV4, Sportage, …) = vehicleInterests mit role desired_vehicle.',
  'Vertragsfahrzeug = historicalContracts.vehicleRole historical_contract_vehicle.',
  'Zahlen mit km-Einheit sind Kilometer (annualMileage), nie purchasePrice.',
  'temporalScope current vs historical strikt trennen.',
  'temporalStatusHint nur Hinweis; Status wird lokal neu berechnet.',
  'proposedActions nur vorbereiten, nicht ausführen.',
  'evidence.snippet kurz und ohne sensible Daten.',
].join('\n');

/**
 * @param {object} safeContext – buildSellerInterpretSafeContext (+ optional minimized attachments)
 * @param {{
 *   apiKey?: string|null,
 *   model?: string,
 *   OpenAI?: object,
 *   createResponse?: Function,
 *   runStructured?: Function,
 *   timeoutMs?: number,
 *   baselineIntake?: object|null,
 *   sellerInput?: string,
 *   attachments?: object[],
 *   facts?: object[],
 *   lead?: object,
 *   now?: Date|number,
 *   timezone?: string,
 *   routeScope?: string|null,
 *   workingContext?: object|object[],
 *   customerRefId?: string|null,
 * }} [options]
 */
export async function interpretMultiSourceWithOpenAi(safeContext = {}, options = {}) {
  const started = Date.now();
  const apiKey = options.apiKey ?? ENV.OPENAI_API_KEY ?? null;
  const model = resolveModel(options);

  const baseline = options.baselineIntake || buildMultiSourceIntake({
    sellerInput: options.sellerInput || safeContext.sellerInput,
    attachments: options.attachments || [],
    facts: options.facts || [],
    lead: options.lead || {},
    now: options.now || Date.now(),
  });

  const contractContexts = extractMinimalContractContexts(options.attachments || [], {
    requestedPurpose: 'customer_contract_tradein_intake',
    now: options.now || Date.now(),
  });
  const attachmentContextMode = resolveAttachmentContextMode(contractContexts);

  const fail = (error, extra = {}) => ({
    ok: false,
    error,
    intake: baseline,
    interpreterSource: 'fallback',
    responseId: null,
    model,
    latencyMs: Date.now() - started,
    durationMs: Date.now() - started,
    attachmentContextMode,
    attachmentCount: (options.attachments || []).length,
    schemaValid: false,
    validatorWarningsCount: 0,
    toolCalls: 0,
    fallbackReason: error,
    ...extra,
  });

  if (!apiKey && !options.createResponse && !options.runStructured) {
    return fail('missing_api_key');
  }

  let parsed = null;
  let responseId = null;
  let toolCalls = 0;

  try {
    if (typeof options.createResponse === 'function') {
      const mocked = await options.createResponse({
        safeContext,
        schema: CLEVER_MULTI_SOURCE_INTAKE_PLAN_SCHEMA,
        model,
        contractContexts,
      });
      parsed = mocked?.parsed ?? mocked;
      responseId = mocked?.responseId || 'mock_response';
    } else {
      const userPayload = buildModelInput({
        safeContext,
        options,
        contractContexts,
      });

      const runStructured = options.runStructured || (async (params) => {
        const { runOpenAiStructuredJsonResponse } = await import(
          '../../clever/openai/openAiResponsesClient.js'
        );
        return runOpenAiStructuredJsonResponse(params, {
          OpenAI: options.OpenAI,
        });
      });

      const result = await runStructured({
        instructions: SYSTEM_INSTRUCTIONS,
        input: [
          {
            role: 'user',
            content: [{ type: 'input_text', text: JSON.stringify(userPayload) }],
          },
        ],
        model,
        apiKey,
        timeoutMs: options.timeoutMs ?? 25000,
        jsonSchema: CLEVER_MULTI_SOURCE_INTAKE_PLAN_SCHEMA,
        store: false,
      });

      if (!result?.ok) {
        return fail(result?.error || 'openai_error', { responseId: result?.responseId || null });
      }
      parsed = result.parsed;
      responseId = result.responseId || null;
      toolCalls = result.toolCallCount || 0;
    }
  } catch (err) {
    return fail(err?.message || 'openai_error', { responseId });
  }

  if (!parsed || typeof parsed !== 'object') {
    return fail('empty_or_invalid_response', { responseId });
  }

  const merged = mergeMultiSourceIntakePlan(parsed, baseline, {
    sellerInput: options.sellerInput || safeContext.sellerInput,
    now: options.now || Date.now(),
  });

  if (!merged.ok) {
    return fail(merged.error || 'merge_failed', {
      responseId,
      validators: merged.validators,
      schemaValid: merged.schemaValid,
      validatorWarningsCount: (merged.validatorWarnings || []).length,
    });
  }

  return {
    ok: true,
    error: null,
    intake: merged.intake,
    plan: merged.plan || parsed,
    validators: merged.validators,
    validatorWarnings: merged.validatorWarnings || [],
    interpreterSource: 'openai',
    responseId,
    model,
    latencyMs: Date.now() - started,
    durationMs: Date.now() - started,
    attachmentContextMode,
    attachmentCount: (options.attachments || []).length,
    schemaValid: merged.schemaValid !== false,
    validatorWarningsCount: (merged.validatorWarnings || []).length,
    toolCalls,
    fallbackReason: null,
  };
}

function buildModelInput({ safeContext, options, contractContexts }) {
  const now = options.now || Date.now();
  const nowDate = now instanceof Date ? now : new Date(now);
  const working = options.workingContext;
  const workingItems = Array.isArray(working) ? working : (working ? [working] : []);

  return {
    sellerInput: String(safeContext.sellerInput || options.sellerInput || '').slice(0, 2000),
    nowIso: nowDate.toISOString(),
    timezone: options.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin',
    routeScope: options.routeScope || null,
    customerRefId: options.customerRefId || null,
    attachmentTypes: safeContext.attachmentTypes || [],
    minimizedAttachments: contractContexts.map((c) => ({
      attachmentId: c.attachmentId,
      fileName: c.fileName,
      kind: c.kind,
      mode: c.attachmentContextMode,
      structured: c.structured,
      minimizedText: String(c.minimizedText || '').slice(0, 2800),
      redactedLabels: c.redacted || [],
    })),
    workingContext: workingItems.slice(0, 4).map((w) => ({
      id: w.id || null,
      kind: w.kind || w.type || null,
      label: w.label || w.shortLabel || null,
    })),
    needProfileHints: safeContext.needProfileHints || {},
    // Nur schmale Hints – keine Baseline als Wahrheit
    localSafetyHints: {
      hasKmCue: /\bkm\b/i.test(String(safeContext.sellerInput || '')),
      hasTradeInCue: /\bgw\b|inzahlung/i.test(String(safeContext.sellerInput || '')),
    },
  };
}

function resolveAttachmentContextMode(contexts = []) {
  if (!contexts.length) return 'none';
  if (contexts.some((c) => c.attachmentContextMode === 'structured_extract')) {
    return 'structured_extract';
  }
  if (contexts.some((c) => c.attachmentContextMode === 'minimized_text')) {
    return 'minimized_text';
  }
  if (contexts.some((c) => c.attachmentContextMode === 'metadata_only')) {
    return 'metadata_only';
  }
  return 'none';
}
