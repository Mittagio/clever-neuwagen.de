/**
 * Grounding-Prüfung für CleverTurnResult inkl. Evidence & offizielle Quellen.
 */
import { KIA_MODEL_ATTRIBUTES } from '../../../data/kia/kiaModelAttributes.js';
import { isAllowedOfficialDomain } from '../../../config/officialManufacturerDomains.js';
import { resolveBrandKeyFromModelKey } from '../../../config/officialManufacturerDomains.js';
import { sanitizeNeedProfilePatch } from './needProfilePatch.js';
import { isAllowedOfferOption } from './tools/getSupportedOfferParameters.js';

const TECHNICAL_FACT_PATTERN = /\b(\d[\d.,]*\s*(?:km|kwh|kg|€|eur|sitze?))\b/i;

function isKnownModelKey(modelKey) {
  return Boolean(modelKey && KIA_MODEL_ATTRIBUTES[String(modelKey).toLowerCase()]);
}

/**
 * @param {object} result
 * @param {{ factIds?: Set<string>, evidenceIds?: Set<string>, evidenceById?: Map<string, object>, toolResults?: object[], conflicts?: object[] }} evidence
 */
export function assertGroundedCleverTurn(result, evidence = {}) {
  const errors = [];
  const factIds = evidence.factIds ?? new Set();
  const evidenceIds = evidence.evidenceIds ?? new Set();
  const evidenceById = evidence.evidenceById ?? new Map();
  const allKnownIds = new Set([...factIds, ...evidenceIds]);
  const usedFactIds = result.usedFactIds ?? [];

  for (const factId of usedFactIds) {
    if (!allKnownIds.has(factId)) {
      errors.push(`unknown_used_fact:${factId}`);
    }
  }

  for (const item of result.evidence ?? []) {
    if (!item.evidenceId || !allKnownIds.has(item.evidenceId)) {
      errors.push(`unknown_evidence_ref:${item.evidenceId ?? 'missing'}`);
    }
    if (item.sourceTier === 'official_web') {
      const brandKey = resolveBrandKeyFromModelKey(item.modelKey);
      if (item.sourceUrl && !isAllowedOfficialDomain(item.sourceUrl, brandKey)) {
        errors.push(`disallowed_official_domain:${item.sourceUrl}`);
      }
      if (item.status !== 'provisional_official_source') {
        errors.push(`invalid_official_status:${item.evidenceId}`);
      }
    }
    if (item.sourceTier === 'internal_verified' && item.status !== 'verified') {
      errors.push(`invalid_internal_status:${item.evidenceId}`);
    }
  }

  if ((evidence.conflicts ?? []).length > 0) {
    errors.push('internal_official_conflict');
  }

  const candidateKeys = new Set();
  const excludedKeys = new Set();

  for (const direction of result.vehicleDirections ?? []) {
    if (!isKnownModelKey(direction.modelKey)) {
      errors.push(`unknown_model:${direction.modelKey}`);
    }

    for (const factId of direction.verifiedFactIds ?? []) {
      if (factId && !allKnownIds.has(factId)) {
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

  const hasTechnicalClaim = TECHNICAL_FACT_PATTERN.test(result.reply ?? '');
  const hasEvidenceRefs = usedFactIds.length > 0 || (result.evidence ?? []).length > 0;
  if (hasTechnicalClaim && !hasEvidenceRefs) {
    errors.push('technical_claim_without_evidence');
  }

  // Intake: Knowledge-Turns dürfen keine Fact-abgeleiteten harten Wünsche setzen.
  // Modellinteresse (selectedModelKey) bleibt erlaubt, wenn der Kunde das Modell nennt.
  if (result.intent === 'knowledge_question') {
    const patch = result.needProfilePatch ?? {};
    const hardWishKeys = [
      'towCapacityKg', 'persons', 'fuel', 'bodyType', 'colorHint',
      'annualKm', 'leaseDurationMonths',
    ];
    for (const key of hardWishKeys) {
      if (patch[key] != null && patch[key] !== '' && !(Array.isArray(patch[key]) && patch[key].length === 0)) {
        errors.push(`knowledge_fact_as_wish:${key}`);
      }
    }
    if (Array.isArray(patch.equipmentWishes) && patch.equipmentWishes.length > 0) {
      errors.push('knowledge_fact_as_wish:equipmentWishes');
    }
  }

  const replyLower = String(result.reply ?? '').toLowerCase();
  for (const banned of ['% match', 'match-prozent', 'perfekt für sie', 'beste wahl', 'klare empfehlung', 'sie sollten den']) {
    if (replyLower.includes(banned)) {
      errors.push(`forbidden_recommendation_language:${banned}`);
    }
  }

  for (const usedId of usedFactIds) {
    const meta = evidenceById.get(usedId);
    if (meta?.sourceTier === 'official_web' && meta?.sourceUrl) {
      const brandKey = resolveBrandKeyFromModelKey(meta.modelKey);
      if (!isAllowedOfficialDomain(meta.sourceUrl, brandKey)) {
        errors.push(`third_party_source:${usedId}`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

export function collectEvidenceIdsFromToolResults(toolResults = []) {
  const ids = new Set();
  const byId = new Map();
  const conflicts = [];

  for (const result of toolResults) {
    if (result.name === 'get_verified_vehicle_facts') {
      for (const fact of result.output?.facts ?? []) {
        if (fact.factId) {
          ids.add(fact.factId);
          byId.set(fact.factId, {
            evidenceId: fact.factId,
            sourceTier: 'internal_verified',
            status: 'verified',
            factKey: fact.key,
            modelKey: fact.modelKey,
            variantKey: fact.variantKey ?? null,
            sourceId: fact.sourceId ?? null,
            sourceUrl: null,
          });
        }
      }
    }

    if (result.name === 'search_official_manufacturer_knowledge') {
      for (const item of result.output?.evidence ?? []) {
        if (item.evidenceId) {
          ids.add(item.evidenceId);
          byId.set(item.evidenceId, item);
        }
      }
      for (const conflict of result.output?.conflicts ?? []) {
        conflicts.push(conflict);
      }
    }
  }

  return { evidenceIds: ids, evidenceById: byId, conflicts };
}
