/**
 * Clever Seller Agent – OpenAI Responses API + Tool-Loop.
 * Serverseitig. Keine Keyword-Hauptlogik.
 */
import OpenAI from 'openai';
import {
  CLEVER_AGENT_DEFAULT_MODEL,
  CLEVER_AGENT_MAX_TOOL_ROUNDS,
} from './cleverAgentTypes.js';
import { CLEVER_AGENT_SYSTEM_PROMPT, CLEVER_AGENT_PROMPT_VERSION } from './cleverSystemPrompt.js';
import {
  buildCleverCustomerContext,
  formatCleverCustomerContextForPrompt,
} from './cleverContextBuilder.js';
import { buildCleverAgentOpenAiTools } from './cleverToolRegistry.js';
import { executeCleverAgentToolCalls } from './cleverToolExecutor.js';
import {
  CLEVER_AGENT_RESULT_JSON_SCHEMA,
  emptyAgentUiPayload,
  mergeToolSideEffects,
} from './cleverAgentResultSchema.js';

export function getCleverAgentConfig(env = process.env) {
  const timeoutRaw = Number(env.CLEVER_AGENT_TIMEOUT_MS);
  const roundsRaw = Number(env.CLEVER_AGENT_MAX_TOOL_ROUNDS);
  return {
    enabled: env.CLEVER_AGENT_ENABLED === 'true' || env.CLEVER_AGENT_ENABLED === '1',
    apiKey: env.OPENAI_API_KEY || null,
    model: env.OPENAI_CLEVER_AGENT_MODEL
      || env.OPENAI_MODEL
      || env.OPENAI_CLEVER_MODEL
      || CLEVER_AGENT_DEFAULT_MODEL,
    timeoutMs: Number.isFinite(timeoutRaw) && timeoutRaw > 0 ? timeoutRaw : 45000,
    maxToolRounds: Number.isFinite(roundsRaw) && roundsRaw > 0
      ? Math.min(roundsRaw, 12)
      : CLEVER_AGENT_MAX_TOOL_ROUNDS,
    debug: env.CLEVER_AGENT_DEBUG === 'true' || env.CLEVER_AGENT_DEBUG === '1',
  };
}

export function isCleverAgentEnabled(env = process.env) {
  const cfg = getCleverAgentConfig(env);
  return cfg.enabled && Boolean(cfg.apiKey);
}

function extractFunctionCalls(output = []) {
  return (output || []).filter(
    (item) => item.type === 'function_call' || item.type === 'function_tool_call',
  );
}

function buildToolResultInput(executions = []) {
  return executions.map((exec) => ({
    type: 'function_call_output',
    call_id: exec.callId,
    output: JSON.stringify(exec.output),
  }));
}

function buildHistoryInput(history = []) {
  return (history || [])
    .slice(-12)
    .map((entry) => {
      const role = entry.role === 'assistant' ? 'assistant' : 'user';
      const text = String(entry.text || entry.content || entry.message || '').trim();
      if (!text) return null;
      return {
        role,
        content: text.slice(0, 2000),
      };
    })
    .filter(Boolean);
}

function collectSuccessfulToolMessages(toolExecutions = []) {
  return toolExecutions
    .map((e) => e.output?.message)
    .filter(Boolean)
    .slice(-3);
}

/**
 * Deterministischer Pfad für Tests: forcedTools ohne OpenAI.
 */
export async function runCleverAgentDeterministic(params = {}, deps = {}) {
  const { applyCleverAgentMutations } = deps.applyCleverAgentMutations
    ? deps
    : await import('./applyCleverAgentMutations.js');
  return buildDeterministicFromForced(params, {
    lead: params.lead || {},
    workingContext: params.workingContext,
    currentOffer: params.currentOffer,
    previousOfferPreparation: params.previousOfferPreparation || null,
  }, { ...deps, applyCleverAgentMutations });
}

function buildDeterministicFromForced(params, runtime, deps) {
  const { executeCleverAgentToolCalls: execCalls = executeCleverAgentToolCalls } = deps;
  const forced = params.forcedTools;
  if (!Array.isArray(forced) || !forced.length) {
    return {
      ok: false,
      message: 'Clever Agent ist nicht aktiviert oder kein API-Key konfiguriert.',
      artifacts: [],
      suggestedActions: [],
      mutations: [],
      error: 'agent_disabled',
      fallbackReason: 'agent_disabled',
    };
  }

  const fakeCalls = forced.map((step, idx) => ({
    type: 'function_call',
    name: step.name,
    arguments: JSON.stringify(step.arguments || {}),
    call_id: step.callId || `forced_${idx}`,
  }));

  let lead = runtime.lead;
  const allExecutions = [];
  for (const call of fakeCalls) {
    const [execution] = execCalls([call], { ...runtime, lead });
    allExecutions.push(execution);
    const effects = mergeToolSideEffects([execution]);
    if (effects.mutations.length) {
      const { applyCleverAgentMutations } = deps;
      if (typeof applyCleverAgentMutations === 'function') {
        lead = applyCleverAgentMutations(lead, effects.mutations).lead;
        runtime.lead = lead;
      }
    }
    if (execution.output?.previousOfferPreparation) {
      runtime.previousOfferPreparation = execution.output.previousOfferPreparation;
    }
  }

  const effects = mergeToolSideEffects(allExecutions);
  const toolMessages = collectSuccessfulToolMessages(allExecutions);
  const last = allExecutions[allExecutions.length - 1]?.output || {};
  const message = last.message
    || toolMessages[toolMessages.length - 1]
    || (last.ok === false
      ? (last.message || 'Die Aktion konnte nicht ausgeführt werden.')
      : 'Erledigt.');

  const confirmationRequired = effects.confirmationRequired
    || allExecutions.some((e) => e.output?.confirmationRequired);
  const filteredMutations = confirmationRequired
    ? effects.mutations.filter((m) => {
      if (m.type === 'set_message_draft') return true;
      if (m.type === 'apply_lead_patch' && m.leadPatch?.crm?.sellerInsights) return true;
      if (m.type === 'apply_lead_patch' && !m.leadPatch?.crm?.vehicleOffers
        && !m.leadPatch?.crm?.vehicleConfigurations) {
        return true;
      }
      return false;
    })
    : effects.mutations;

  return {
    ok: last.ok !== false,
    message,
    artifacts: effects.artifacts,
    suggestedActions: effects.suggestedActions,
    mutations: filteredMutations,
    pendingAction: effects.pendingAction || last.pendingAction || null,
    confirmationRequired,
    resolvedVehicle: effects.resolvedVehicle || last.resolvedVehicle || null,
    offerSummary: effects.offerSummary || last.offer || null,
    toolCalls: allExecutions.map((e) => ({
      name: e.name,
      arguments: e.arguments,
      ok: e.output?.ok !== false,
      confirmationRequired: Boolean(e.output?.confirmationRequired),
      status: e.output?.status || null,
    })),
    previousOfferPreparation: effects.previousOfferPreparation || runtime.previousOfferPreparation,
    lead,
    debug: params.debug
      ? {
        mode: 'deterministic_forced_tools',
        toolExecutions: allExecutions.map((e) => ({ name: e.name, status: e.output?.status })),
        promptVersion: CLEVER_AGENT_PROMPT_VERSION,
      }
      : null,
  };
}

/**
 * @param {object} params
 * @param {object} [deps]
 */
export async function runCleverAgent(params = {}, deps = {}) {
  const env = deps.env || process.env;
  const config = deps.config || getCleverAgentConfig(env);
  const debug = Boolean(params.debug ?? config.debug);

  if (Array.isArray(params.forcedTools) && params.forcedTools.length) {
    const { applyCleverAgentMutations } = await import('./applyCleverAgentMutations.js');
    const forcedResult = buildDeterministicFromForced(params, {
      lead: params.lead || {},
      workingContext: params.workingContext,
      currentOffer: params.currentOffer,
      previousOfferPreparation: params.previousOfferPreparation
        || params.workingMemory?.previousOfferPreparation
        || null,
      workingMemory: params.workingMemory || null,
      sellerMessage: params.sellerMessage || params.message || '',
    }, { ...deps, applyCleverAgentMutations });
    return {
      ...forcedResult,
      agentSource: 'deterministic',
      confirmationRequired: Boolean(
        forcedResult.toolCalls?.some((t) => t.confirmationRequired)
        || forcedResult.pendingAction?.status === 'needs_confirmation',
      ),
    };
  }

  if (!config.enabled) {
    return {
      ok: false,
      ...emptyAgentUiPayload('Clever Agent ist noch nicht aktiviert.'),
      mutations: [],
      error: 'feature_disabled',
      fallbackReason: 'feature_disabled',
      agentSource: 'fallback',
    };
  }
  if (!config.apiKey) {
    return {
      ok: false,
      ...emptyAgentUiPayload('OpenAI ist nicht konfiguriert. Bitte OPENAI_API_KEY setzen.'),
      mutations: [],
      error: 'api_key_missing',
      fallbackReason: 'api_key_missing',
      agentSource: 'fallback',
    };
  }

  const sellerMessage = String(params.sellerMessage || params.message || '').trim();
  if (!sellerMessage) {
    return {
      ok: false,
      ...emptyAgentUiPayload('Welche Aufgabe soll ich erledigen?'),
      mutations: [],
      error: 'missing_message',
      agentSource: 'fallback',
    };
  }

  const lead = params.lead || {};
  const context = buildCleverCustomerContext(lead, {
    workingContext: params.workingContext,
    currentOffer: params.currentOffer,
  });

  const { formatWorkingMemoryForPrompt } = await import('./cleverAgentWorkingMemory.js');
  const memoryPrompt = formatWorkingMemoryForPrompt(params.workingMemory);

  const runtime = {
    lead,
    workingContext: params.workingContext || null,
    currentOffer: params.currentOffer || context.selectedOffer || null,
    previousOfferPreparation: params.previousOfferPreparation
      || params.workingMemory?.previousOfferPreparation
      || null,
    workingMemory: params.workingMemory || null,
    sellerMessage,
    leadsSnapshot: params.leadsSnapshot || [],
  };

  const instructions = [
    CLEVER_AGENT_SYSTEM_PROMPT,
    `Prompt-Version: ${CLEVER_AGENT_PROMPT_VERSION}`,
    'Antworte ausschließlich als JSON gemäß Schema (message, artifacts, suggestedActions).',
    'Nutze Tools für Fakten und Aktionen. Nach erfolgreichen Write-Tools die Ergebnisdaten aus dem Tool-Output übernehmen.',
    'prepare_offer ohne confirm=true erzeugen – Persist erst nach Seller-Bestätigung.',
  ].join('\n\n');

  const input = [
    {
      role: 'developer',
      content: `Kundenkontext (strukturiert, vollständig nutzen):\n${formatCleverCustomerContextForPrompt(context)}`,
    },
    memoryPrompt
      ? {
        role: 'developer',
        content: `Arbeitskontext / Pending:\n${JSON.stringify(memoryPrompt)}`,
      }
      : null,
    ...buildHistoryInput(params.conversationHistory),
    {
      role: 'user',
      content: sellerMessage,
    },
  ].filter(Boolean);

  const OpenAiCtor = deps.OpenAI || OpenAI;
  const client = deps.client || new OpenAiCtor({
    apiKey: config.apiKey,
    timeout: config.timeoutMs,
  });

  const tools = deps.tools || buildCleverAgentOpenAiTools();
  const allExecutions = [];
  let previousResponseId = null;
  let currentInput = input;
  let parsed = null;
  let rawText = null;
  let responseId = null;
  let usage = null;

  const execCalls = deps.executeCleverAgentToolCalls || executeCleverAgentToolCalls;

  for (let round = 0; round <= config.maxToolRounds; round += 1) {
    const requestBody = {
      model: config.model,
      instructions,
      input: currentInput,
      tools,
      text: {
        format: {
          type: 'json_schema',
          name: CLEVER_AGENT_RESULT_JSON_SCHEMA.name,
          schema: CLEVER_AGENT_RESULT_JSON_SCHEMA.schema,
          strict: CLEVER_AGENT_RESULT_JSON_SCHEMA.strict,
        },
      },
    };
    if (previousResponseId) {
      requestBody.previous_response_id = previousResponseId;
    }

    const createResponse = deps.createResponse
      || ((body) => client.responses.create(body));
    const response = await createResponse(requestBody);
    previousResponseId = response.id;
    responseId = response.id;
    usage = response.usage || usage;

    const functionCalls = extractFunctionCalls(response.output || []);
    if (!functionCalls.length) {
      parsed = response.output_parsed || null;
      rawText = response.output_text || null;
      break;
    }

    if (round >= config.maxToolRounds) {
      return {
        ok: false,
        ...emptyAgentUiPayload(
          'Ich musste abbrechen – zu viele Werkzeugschritte. Bitte die Aufgabe etwas enger formulieren.',
        ),
        mutations: mergeToolSideEffects(allExecutions).mutations,
        error: 'tool_round_limit',
        toolCalls: allExecutions.map((e) => ({ name: e.name, ok: e.output?.ok !== false })),
        debug: debug
          ? { toolExecutions: allExecutions, responseId, rounds: round }
          : null,
      };
    }

    const executions = execCalls(functionCalls, runtime);
    allExecutions.push(...executions);

    // Lead nach Write-Tools aktualisieren (Kontext für Folgetools)
    const effects = mergeToolSideEffects(executions);
    if (effects.mutations.length) {
      const { applyCleverAgentMutations } = await import('./applyCleverAgentMutations.js');
      const applied = applyCleverAgentMutations(runtime.lead, effects.mutations);
      runtime.lead = applied.lead;
    }
    for (const ex of executions) {
      if (ex.output?.previousOfferPreparation) {
        runtime.previousOfferPreparation = ex.output.previousOfferPreparation;
      }
    }

    currentInput = buildToolResultInput(executions);
  }

  const effects = mergeToolSideEffects(allExecutions);
  let ui = parsed;
  if (!ui && rawText) {
    try {
      ui = JSON.parse(rawText);
    } catch {
      ui = null;
    }
  }

  const toolMessages = collectSuccessfulToolMessages(allExecutions);
  const failedWrite = allExecutions.find(
    (e) => e.output?.toolKind === 'write' && e.output?.ok === false,
  );

  let message = String(ui?.message || '').trim();
  if (!message && toolMessages.length) {
    message = toolMessages[toolMessages.length - 1];
  }
  if (!message && failedWrite) {
    message = failedWrite.output.message
      || 'Die Aktion konnte nicht ausgeführt werden.';
  }
  if (!message) {
    message = 'Ich habe den Kontext geprüft – sag mir kurz, was ich konkret erledigen soll.';
  }

  // Keine Fake-Erfolge: wenn letztes Write-Tool fehlschlug, ok=false
  const lastWrite = [...allExecutions].reverse().find((e) => e.output?.toolKind === 'write');
  const ok = lastWrite ? lastWrite.output?.ok !== false : true;

  const confirmationRequired = effects.confirmationRequired
    || allExecutions.some((e) => e.output?.confirmationRequired);

  // Prepared offers: keine Persist-Mutationen bis Confirm
  const safeMutations = confirmationRequired
    ? effects.mutations.filter((m) => m.type === 'set_message_draft' || m.type === 'apply_lead_patch' && m.fromRemember)
    : effects.mutations;

  // Remember patches always allowed; offer prepare patches stripped when confirmationRequired
  const filteredMutations = confirmationRequired
    ? effects.mutations.filter((m) => {
      if (m.type === 'set_message_draft') return true;
      // remember: apply_lead_patch ohne offerDraft
      if (m.type === 'apply_lead_patch' && m.leadPatch?.crm?.sellerInsights) return true;
      if (m.type === 'apply_lead_patch' && !m.leadPatch?.crm?.vehicleOffers
        && !m.leadPatch?.crm?.vehicleConfigurations) {
        return true;
      }
      return false;
    })
    : effects.mutations;

  return {
    ok,
    message,
    artifacts: [
      ...(Array.isArray(ui?.artifacts) ? ui.artifacts : []),
      ...effects.artifacts,
    ],
    suggestedActions: [
      ...(Array.isArray(ui?.suggestedActions) ? ui.suggestedActions : []),
      ...effects.suggestedActions,
    ],
    mutations: filteredMutations,
    pendingAction: effects.pendingAction || null,
    confirmationRequired,
    resolvedVehicle: effects.resolvedVehicle || null,
    offerSummary: effects.offerSummary || null,
    toolCalls: allExecutions.map((e) => ({
      name: e.name,
      arguments: e.arguments,
      ok: e.output?.ok !== false,
      error: e.output?.error || null,
      confirmationRequired: Boolean(e.output?.confirmationRequired),
      status: e.output?.status || null,
    })),
    previousOfferPreparation: effects.previousOfferPreparation || runtime.previousOfferPreparation,
    lead: runtime.lead,
    agentSource: 'openai',
    model: config.model,
    responseId,
    usage,
    debug: debug
      ? {
        promptVersion: CLEVER_AGENT_PROMPT_VERSION,
        model: config.model,
        agentSource: 'openai',
        context,
        toolExecutions: allExecutions.map((e) => ({
          name: e.name,
          ok: e.output?.ok !== false,
          status: e.output?.status || null,
        })),
        responseId,
        rounds: allExecutions.length,
        confirmationRequired,
      }
      : null,
  };
}
