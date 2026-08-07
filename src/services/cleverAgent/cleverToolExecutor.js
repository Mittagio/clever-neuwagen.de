/**
 * Validiert und führt Clever-Agent-Tools aus.
 */
import { getCleverAgentTool, listCleverAgentToolNames } from './cleverToolRegistry.js';

function parseArgs(raw) {
  if (raw == null) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(String(raw));
  } catch {
    return {};
  }
}

/**
 * @param {string} name
 * @param {object|string} rawArgs
 * @param {object} runtime
 */
export function executeCleverAgentTool(name, rawArgs, runtime = {}) {
  const tool = getCleverAgentTool(name);
  if (!tool) {
    return {
      ok: false,
      error: 'unknown_tool',
      message: `Unbekanntes Werkzeug „${name}“. Erlaubt: ${listCleverAgentToolNames().join(', ')}.`,
      allowedTools: listCleverAgentToolNames(),
    };
  }

  const args = parseArgs(rawArgs);
  try {
    const result = tool.execute(runtime, args) || {};
    return {
      ...result,
      ok: result.ok !== false,
      toolName: name,
      toolKind: tool.kind,
    };
  } catch (err) {
    return {
      ok: false,
      error: 'tool_execution_failed',
      toolName: name,
      message: 'Die Aktion ist fehlgeschlagen. Es wurde nichts gespeichert.',
      detail: String(err?.message || err).slice(0, 200),
    };
  }
}

/**
 * @param {object[]} functionCalls – OpenAI output items
 * @param {object} runtime
 */
export function executeCleverAgentToolCalls(functionCalls = [], runtime = {}) {
  return functionCalls.map((call) => {
    const name = call.name || call.function?.name;
    const rawArgs = call.arguments ?? call.function?.arguments ?? {};
    const callId = call.call_id || call.id || `call_${name}`;
    const output = executeCleverAgentTool(name, rawArgs, runtime);
    return {
      callId,
      name,
      arguments: parseArgs(rawArgs),
      output,
    };
  });
}
