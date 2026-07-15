/**
 * Grounding-Prüfung für CleverTurnResult.
 */
import { KIA_MODEL_ATTRIBUTES } from '../../../data/kia/kiaModelAttributes.js';
import { sanitizeNeedProfilePatch } from './needProfilePatch.js';
import { isAllowedOfferOption } from './tools/getSupportedOfferParameters.js';

function isKnownModelKey(modelKey) {
  return Boolean(modelKey && KIA_MODEL_ATTRIBUTES[String(modelKey).toLowerCase()]);
}

/**
 * @param {object} result
 * @param {{ factIds?: Set<string>, toolResults?: object[] }} evidence
 */
export function assertGroundedCleverTurn(result, evidence = {}) {
  const errors = [];
  const factIds = evidence.factIds ?? new Set();
  const usedFactIds = result.usedFactIds ?? [];

  for (const factId of usedFactIds) {
    if (!factIds.has(factId)) {
      errors.push(`unknown_used_fact:${factId}`);
    }
  }

  const candidateKeys = new Set();
  const excludedKeys = new Set();

  for (const direction of result.vehicleDirections ?? []) {
    if (!isKnownModelKey(direction.modelKey)) {
      errors.push(`unknown_model:${direction.modelKey}`);
    }

    for (const factId of direction.verifiedFactIds ?? []) {
      if (factId && !factIds.has(factId)) {
        errors.push(`unknown_direction_fact:${factId}`);
      }
    }

    if (direction.status === 'candidate' || direction.status === 'interesting') {
      candidateKeys.add(direction.modelKey);
    }
    if (direction.status === 'excluded') {
      excludedKeys.add(direction.modelKey);
    }
  }

  for (const key of candidateKeys) {
    if (excludedKeys.has(key)) {
      errors.push(`conflicting_direction:${key}`);
    }
  }

  const { rejectedKeys } = sanitizeNeedProfilePatch(result.needProfilePatch ?? {});
  for (const key of rejectedKeys) {
    errors.push(`rejected_patch_field:${key}`);
  }

  if (result.nextAction?.type === 'ask_offer_parameter') {
    const field = result.nextAction.targetField;
    for (const option of result.nextAction.options ?? []) {
      if (!isAllowedOfferOption(field, option.value)) {
        errors.push(`invalid_offer_option:${field}:${option.value}`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}
