/**
 * Shared Clever Intelligence Core – Responses API, Tools, Grounding, Escalation.
 * Keine God-Function: Oberflächen liefern Schema/Validate/Ground und Kontext.
 */
import { buildToolEvidence, runOpenAiCleverResponse } from '../openai/openAiResponsesClient.js';
import {
  createCleverTurnMetrics,
  finalizeCleverTurnMetrics,
  logCleverTurnMetrics,
} from '../openai/cleverConversationObservability.js';
import {
  evaluateCleverModelEscalation,
  isSimpleInternalKnowledgeQuestion,
} from '../openai/cleverModelEscalation.js';
import { deriveKnowledgeGapsFromTurn } from '../knowledge/knowledgeGapService.js';
import { CLEVER_CONVERSATION_TOOLS } from '../openai/tools/toolDefinitions.js';
import { getCleverIntelligenceConfig } from './cleverIntelligenceConfig.js';

function fallbackResult(reason, metrics, extras = {}) {
  const finalized = finalizeCleverTurnMetrics(metrics, {
    fallback: true,
    aiUsed: false,
    errorClass: reason,
    ...extras,
  });
  logCleverTurnMetrics(finalized);
  return {
    ok: false,
    fallback: true,
    reason,
    metrics: finalized,
  };
}

/**
 * @param {object} params
 * @param {string} params.surface
 * @param {string} params.instructions
 * @param {Array} params.input
 * @param {object} params.jsonSchema
 * @param {(value: unknown) => { ok: boolean, result?: object, errors?: string[] }} params.validate
 * @param {(result: object, evidence: object) => { ok: boolean, errors?: string[] }} params.assertGrounded
 * @param {string} [params.userMessage]
 * @param {object|null} [params.needProfile]
 * @param {string|null} [params.dealerId]
 * @param {string} [params.brandKey]
 * @param {object} [params.config]
 * @param {object} [deps]
 */
export async function runCleverIntelligenceCore(params, deps = {}) {
  const metrics = createCleverTurnMetrics();
  const surface = params.surface;
  const config = params.config ?? getCleverIntelligenceConfig(surface, deps.env);

  metrics.surface = surface;
  metrics.primaryModel = config.model;
  metrics.finalModel = config.model;

  if (!config.enabled || !config.apiKey) {
    return fallbackResult('disabled_or_missing_key', metrics, { surface });
  }

  if (deps.mockResult) {
    const validation = params.validate(deps.mockResult);
    if (!validation.ok) return fallbackResult('mock_schema_invalid', metrics, { surface });
    const evidence = deps.mockEvidence ?? buildToolEvidence(deps.mockToolResults ?? []);
    const grounding = params.assertGrounded(validation.result, evidence);
    if (!grounding.ok && !deps.skipGrounding) {
      return fallbackResult('mock_grounding_failed', metrics, { surface });
    }
    const finalized = finalizeCleverTurnMetrics(metrics, {
      aiUsed: true,
      fallback: false,
      schemaValid: true,
      groundingValid: true,
      surface,
    });
    logCleverTurnMetrics(finalized);
    return {
      ok: true,
      result: validation.result,
      evidence,
      metrics: finalized,
      knowledgeGaps: [],
      fromCache: false,
    };
  }

  const userMessage = String(params.userMessage ?? '');
  const escalationPreview = evaluateCleverModelEscalation({
    customerMessage: userMessage,
    needProfile: params.needProfile ?? null,
  }, deps.env ?? process.env);

  let useEscalationFirst = escalationPreview.shouldEscalate
    && config.escalationEnabled
    && !isSimpleInternalKnowledgeQuestion(userMessage);

  if (useEscalationFirst) {
    metrics.escalationUsed = true;
    metrics.escalationReason = escalationPreview.reason;
    metrics.finalModel = config.escalationModel;
  }

  async function callApi(model) {
    return runOpenAiCleverResponse({
      instructions: params.instructions,
      input: params.input,
      model,
      apiKey: config.apiKey,
      timeoutMs: config.timeoutMs,
      maxToolRounds: config.maxToolRounds,
      dealerId: params.dealerId ?? null,
      env: deps.env ?? process.env,
      performOfficialWebSearch: deps.performOfficialWebSearch,
      tools: params.tools ?? CLEVER_CONVERSATION_TOOLS,
      jsonSchema: params.jsonSchema,
    }, deps);
  }

  try {
    let apiResult = await callApi(metrics.finalModel);
    metrics.toolCallCount = apiResult.toolCallCount ?? 0;

    if (!apiResult.ok) {
      return fallbackResult(apiResult.error ?? 'api_error', metrics, { surface });
    }

    let parsed = apiResult.parsed;
    if (!parsed && apiResult.rawText) {
      try {
        parsed = JSON.parse(apiResult.rawText);
      } catch {
        return fallbackResult('invalid_json', metrics, { surface });
      }
    }

    let validation = parsed ? params.validate(parsed) : { ok: false, errors: ['missing_parsed'] };
    let evidence = buildToolEvidence(apiResult.toolResults ?? []);
    let grounding = validation.ok
      ? params.assertGrounded(validation.result, evidence)
      : { ok: false, errors: validation.errors ?? ['invalid_schema'] };

    const canRetry = config.escalationEnabled
      && !metrics.escalationUsed
      && (!validation.ok || !grounding.ok)
      && !isSimpleInternalKnowledgeQuestion(userMessage);

    if (canRetry) {
      metrics.escalationUsed = true;
      metrics.escalationReason = validation.ok ? 'grounding_failed' : 'schema_invalid';
      metrics.finalModel = config.escalationModel;
      apiResult = await callApi(config.escalationModel);
      metrics.toolCallCount += apiResult.toolCallCount ?? 0;
      if (!apiResult.ok) {
        return fallbackResult(apiResult.error ?? 'api_error', metrics, { surface });
      }
      parsed = apiResult.parsed;
      if (!parsed && apiResult.rawText) {
        try {
          parsed = JSON.parse(apiResult.rawText);
        } catch {
          return fallbackResult('invalid_json', metrics, { surface });
        }
      }
      validation = params.validate(parsed);
      evidence = buildToolEvidence(apiResult.toolResults ?? []);
      grounding = validation.ok
        ? params.assertGrounded(validation.result, evidence)
        : { ok: false, errors: validation.errors ?? ['invalid_schema'] };
    }

    if (!validation.ok) {
      return fallbackResult(`schema:${validation.errors?.join(',')}`, metrics, { surface });
    }
    if (!grounding.ok) {
      console.warn('[clever-intelligence] grounding failed', {
        surface,
        errors: grounding.errors,
      });
      return fallbackResult('grounding_failed', metrics, { surface });
    }

    const usedOfficialWeb = (apiResult.toolResults ?? []).some(
      (tool) => tool.name === 'search_official_manufacturer_knowledge'
        && (tool.output?.evidence ?? []).length > 0,
    );

    const knowledgeGaps = deriveKnowledgeGapsFromTurn({
      toolResults: apiResult.toolResults ?? [],
      customerMessage: userMessage,
      conversationTurnId: apiResult.responseId ?? null,
      brandKey: params.brandKey ?? 'kia',
    });

    const finalized = finalizeCleverTurnMetrics(metrics, {
      aiUsed: true,
      fallback: false,
      schemaValid: true,
      groundingValid: true,
      surface,
      usedOfficialWeb,
      hadDataConflict: (evidence.conflicts ?? []).length > 0,
      usage: apiResult.usage ?? null,
    });
    logCleverTurnMetrics(finalized);

    return {
      ok: true,
      result: validation.result,
      evidence,
      metrics: finalized,
      usage: apiResult.usage ?? null,
      knowledgeGaps,
      fromCache: false,
      toolResults: apiResult.toolResults ?? [],
    };
  } catch (err) {
    const errorClass = /timeout/i.test(String(err?.message))
      ? 'timeout'
      : /rate limit/i.test(String(err?.message))
        ? 'rate_limit'
        : 'openai_error';
    console.error('[clever-intelligence]', surface, errorClass, err?.message ?? err);
    return fallbackResult(errorClass, metrics, { surface });
  }
}
