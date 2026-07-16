/**
 * OpenAI Responses API Client – serverseitig, mit Tool-Loop.
 */
import OpenAI from 'openai';
import { CLEVER_TURN_RESULT_JSON_SCHEMA } from './cleverTurnResultSchema.js';
import { CLEVER_CONVERSATION_TOOLS } from './tools/toolDefinitions.js';
import { executeToolCallsFromOutput } from './tools/executeTool.js';
import { collectFactIdsFromToolResults } from './tools/getVerifiedVehicleFacts.js';
import { collectEvidenceIdsFromToolResults } from './assertGroundedCleverTurn.js';

function extractFunctionCalls(output = []) {
  return output.filter(
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

/**
 * @param {object} params
 * @param {object} [deps]
 */
export async function runOpenAiCleverResponse(params, deps = {}) {
  const {
    instructions,
    input,
    model,
    apiKey,
    timeoutMs = 25000,
    maxToolRounds = 3,
    dealerId = null,
    env = process.env,
    performOfficialWebSearch = null,
    tools = CLEVER_CONVERSATION_TOOLS,
    jsonSchema = CLEVER_TURN_RESULT_JSON_SCHEMA,
  } = params;

  const OpenAiCtor = deps.OpenAI ?? OpenAI;
  const client = new OpenAiCtor({
    apiKey,
    timeout: timeoutMs,
  });

  const toolResults = [];
  let toolCallCount = 0;
  let previousResponseId = null;
  let currentInput = input;

  for (let round = 0; round <= maxToolRounds; round += 1) {
    const requestBody = {
      model,
      instructions,
      input: currentInput,
      tools,
      text: {
        format: {
          type: 'json_schema',
          name: jsonSchema.name,
          schema: jsonSchema.schema,
          strict: jsonSchema.strict,
        },
      },
    };

    if (previousResponseId) {
      requestBody.previous_response_id = previousResponseId;
    }

    const response = await client.responses.create(requestBody);
    previousResponseId = response.id;

    const functionCalls = extractFunctionCalls(response.output ?? []);
    if (!functionCalls.length) {
      return {
        ok: true,
        parsed: response.output_parsed ?? null,
        rawText: response.output_text ?? null,
        toolResults,
        toolCallCount,
        responseId: response.id,
        usage: response.usage ?? null,
      };
    }

    if (round >= maxToolRounds) {
      return {
        ok: false,
        error: 'tool_round_limit',
        toolResults,
        toolCallCount,
      };
    }

    const executions = await executeToolCallsFromOutput(functionCalls, {
      dealerId,
      env,
      performOfficialWebSearch,
    });
    toolCallCount += executions.length;
    toolResults.push(...executions);

    currentInput = buildToolResultInput(executions);
  }

  return {
    ok: false,
    error: 'tool_loop_exhausted',
    toolResults,
    toolCallCount,
  };
}

export function buildToolEvidence(toolResults = []) {
  const factIds = collectFactIdsFromToolResults(toolResults);
  const { evidenceIds, evidenceById, conflicts } = collectEvidenceIdsFromToolResults(toolResults);
  return {
    factIds,
    evidenceIds,
    evidenceById,
    conflicts,
    toolResults,
  };
}
