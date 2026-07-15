/**
 * Zentraler Clever AI Conversation Turn – OpenAI Responses API.
 */
import { getCleverAiConfig } from './cleverConversationConfig.js';
import { buildCleverTurnContext, redactForLog } from './buildCleverTurnContext.js';
import { validateCleverTurnResult } from './cleverTurnResultSchema.js';
import { assertGroundedCleverTurn } from './assertGroundedCleverTurn.js';
import { applyNeedProfilePatch, sanitizeNeedProfilePatch } from './needProfilePatch.js';
import { buildToolEvidence, runOpenAiCleverResponse } from './openAiResponsesClient.js';
import {
  createCleverTurnMetrics,
  finalizeCleverTurnMetrics,
  logCleverTurnMetrics,
} from './cleverConversationObservability.js';
import { buildCustomerUnderstanding } from '../../dealer/customerUnderstanding.js';
import { mergeTextIntoNeedProfile } from '../../consultation/needProfileService.js';

function fallbackResult(reason, metrics) {
  const finalized = finalizeCleverTurnMetrics(metrics, {
    fallback: true,
    aiUsed: false,
    errorClass: reason,
  });
  logCleverTurnMetrics(finalized);
  return {
    ok: false,
    fallback: true,
    reason,
    metrics: finalized,
  };
}

function successResult(turnResult, metrics, evidence) {
  const finalized = finalizeCleverTurnMetrics(metrics, {
    aiUsed: true,
    fallback: false,
    schemaValid: true,
    groundingValid: true,
    nextActionType: turnResult.nextAction?.type ?? null,
    handoff: turnResult.handoff?.ready === true,
  });
  logCleverTurnMetrics(finalized);
  return {
    ok: true,
    turnResult,
    evidence,
    metrics: finalized,
  };
}

/**
 * @param {object} params
 * @param {object} params.lead
 * @param {string} params.customerMessage
 * @param {Array<{role:string,text:string}>} [params.conversationHistory]
 * @param {string|null} [params.dealerId]
 * @param {object} [params.brandContext]
 * @param {object} [deps]
 */
export async function runCleverTurn(params, deps = {}) {
  const metrics = createCleverTurnMetrics();
  const config = deps.config ?? getCleverAiConfig(deps.env);

  if (!config.enabled || !config.apiKey) {
    return fallbackResult('disabled_or_missing_key', metrics);
  }

  if (deps.mockTurnResult) {
    const validation = validateCleverTurnResult(deps.mockTurnResult);
    if (!validation.ok) {
      return fallbackResult('mock_schema_invalid', metrics);
    }
    const evidence = deps.mockEvidence ?? buildToolEvidence(deps.mockToolResults ?? []);
    const grounding = assertGroundedCleverTurn(validation.result, evidence);
    if (!grounding.ok && !deps.skipGrounding) {
      return fallbackResult('mock_grounding_failed', metrics);
    }
    return successResult(validation.result, metrics, evidence);
  }

  const {
    lead,
    customerMessage,
    conversationHistory = [],
    dealerId = null,
    brandContext = {},
  } = params;

  const context = buildCleverTurnContext({
    lead,
    customerMessage,
    conversationHistory,
    dealerId,
    brandContext,
  });

  try {
    const apiResult = await runOpenAiCleverResponse({
      instructions: context.instructions,
      input: context.input,
      model: config.model,
      apiKey: config.apiKey,
      timeoutMs: config.timeoutMs,
      maxToolRounds: config.maxToolRounds,
      dealerId,
    }, deps);

    metrics.toolCallCount = apiResult.toolCallCount ?? 0;

    if (!apiResult.ok) {
      return fallbackResult(apiResult.error ?? 'api_error', metrics);
    }

    let parsed = apiResult.parsed;
    if (!parsed && apiResult.rawText) {
      try {
        parsed = JSON.parse(apiResult.rawText);
      } catch {
        return fallbackResult('invalid_json', metrics);
      }
    }

    const validation = validateCleverTurnResult(parsed);
    if (!validation.ok) {
      return fallbackResult(`schema:${validation.errors?.join(',')}`, metrics);
    }

    const evidence = buildToolEvidence(apiResult.toolResults ?? []);
    const grounding = assertGroundedCleverTurn(validation.result, evidence);
    if (!grounding.ok) {
      console.warn('[clever-ai] grounding failed', {
        errors: grounding.errors,
        message: redactForLog(customerMessage),
      });
      return fallbackResult('grounding_failed', metrics);
    }

    return successResult(validation.result, metrics, evidence);
  } catch (err) {
    const errorClass = err?.name === 'APIConnectionTimeoutError'
      || /timeout/i.test(String(err?.message))
      ? 'timeout'
      : /rate limit/i.test(String(err?.message))
        ? 'rate_limit'
        : 'openai_error';
    console.error('[clever-ai]', errorClass, err?.message ?? err);
    return fallbackResult(errorClass, metrics);
  }
}

/**
 * Wendet CleverTurnResult auf Lead an (validiert, kein direktes OpenAI-Schreiben).
 * @param {object} lead
 * @param {object} turnResult
 * @param {string} customerMessage
 */
export function applyCleverTurnToLead(lead, turnResult, customerMessage = '') {
  let needProfile = lead?.crm?.needProfile ?? null;
  if (customerMessage) {
    needProfile = mergeTextIntoNeedProfile(customerMessage, needProfile);
  }

  const { patch, rejectedKeys } = sanitizeNeedProfilePatch(turnResult.needProfilePatch ?? {});
  if (rejectedKeys.length) {
    throw new Error(`rejected_need_profile_fields:${rejectedKeys.join(',')}`);
  }

  needProfile = applyNeedProfilePatch(needProfile, patch);

  const nextLead = {
    ...lead,
    crm: {
      ...(lead?.crm ?? {}),
      needProfile,
    },
  };

  const customerUnderstanding = buildCustomerUnderstanding(nextLead);

  return {
    lead: nextLead,
    needProfile,
    customerUnderstanding,
    turnResult,
  };
}
