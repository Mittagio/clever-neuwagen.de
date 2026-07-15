/**
 * Tool-Ausführung – read-only, keine Lead-Schreiboperationen.
 */
import { findMatchingVehicles } from './findMatchingVehicles.js';
import { getVerifiedVehicleFacts } from './getVerifiedVehicleFacts.js';
import { getSupportedOfferParameters } from './getSupportedOfferParameters.js';

/**
 * @param {string} name
 * @param {object} args
 * @param {{ dealerId?: string|null }} [ctx]
 */
export function executeCleverTool(name, args = {}, ctx = {}) {
  switch (name) {
    case 'find_matching_vehicles':
      return findMatchingVehicles({ ...args, brand: args.brand ?? 'Kia' });
    case 'get_verified_vehicle_facts':
      return getVerifiedVehicleFacts(args);
    case 'get_supported_offer_parameters':
      return getSupportedOfferParameters(args);
    case 'get_dealer_offer_options':
      return {
        available: false,
        reason: 'verified_dealer_rates_not_in_conversation_v01',
        dealerId: ctx.dealerId ?? null,
      };
    default:
      return { error: 'unknown_tool', name };
  }
}

/**
 * @param {Array<{ type?: string, name?: string, call_id?: string, arguments?: string }>} outputItems
 * @param {{ dealerId?: string|null }} [ctx]
 */
export function executeToolCallsFromOutput(outputItems = [], ctx = {}) {
  const executions = [];

  for (const item of outputItems) {
    if (item.type !== 'function_call' && item.type !== 'function_tool_call') continue;
    const name = item.name;
    const callId = item.call_id ?? item.id;
    let parsedArgs = {};
    try {
      parsedArgs = JSON.parse(item.arguments ?? '{}');
    } catch {
      parsedArgs = {};
    }

    const output = executeCleverTool(name, parsedArgs, ctx);
    executions.push({
      callId,
      name,
      arguments: parsedArgs,
      output,
    });
  }

  return executions;
}
