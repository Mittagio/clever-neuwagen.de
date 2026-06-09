/**
 * Kanonische Suchkriterien – eine Wahrheit, keine Doppelprüfungen.
 *
 * Problem: Text-Parser, Chips, wishParser und Feature-Katalog liefern
 * dieselbe Anforderung in verschiedenen Formen (z. B. towCapacityKg + tow_capacity_2000).
 * Lösung: Profil normalisieren → Evaluierungsplan mit eindeutigen criterionIds.
 */

/** @typedef {'fuel'|'range'|'seats'|'tow_kg'|'length'|'height'|'trunk'|'isofix'|'trim_feature'} CriterionKind */

/**
 * Feature-IDs, die bereits über strukturierte Profilfelder geprüft werden.
 * @type {Record<string, (profile: object) => boolean>}
 */
const STRUCTURAL_FEATURE_COVERAGE = {
  seats_7: (p) => (p.seatsMin ?? 0) >= 7,
  isofix_3: (p) => (p.isofixRearMin ?? 0) >= 3,
  large_trunk: (p) => p.trunkLMin != null,
  tow_capacity_2000: (p) => (p.towCapacityKg ?? 0) >= 2000,
  tow_capacity_1500: (p) => (p.towCapacityKg ?? 0) >= 1500,
  tow_capacity_2500: (p) => (p.towCapacityKg ?? 0) >= 2500,
  reichweite: (p) => (p.minRangeKm ?? p.rangeKmMin ?? 0) > 0,
  range_400: (p) => (p.minRangeKm ?? p.rangeKmMin ?? 0) >= 400,
  elektro: (p) => Boolean(p.fuel === 'electric' || p.fuel === 'elektro'),
  benzin: (p) => p.fuel === 'combustion',
};

const META_FEATURES = new Set(['elektro', 'benzin', 'reichweite', 'range_400', 'seats_7', 'family_suv']);

/**
 * @param {string} featureId
 * @param {object} profile
 */
export function isFeatureCoveredByStructuralProfile(featureId, profile) {
  if (featureId.startsWith('tow_capacity_')) {
    const wantKg = Number(featureId.replace('tow_capacity_', '')) || 0;
    return profile.towCapacityKg != null && profile.towCapacityKg >= wantKg;
  }
  const rule = STRUCTURAL_FEATURE_COVERAGE[featureId];
  return rule ? rule(profile) : false;
}

/**
 * Profil bereinigen: strukturierte Felder schlagen Feature-Duplikate.
 * @param {object} profile
 * @returns {object}
 */
export function canonicalizeSearchProfile(profile) {
  if (!profile) return profile;

  const requiredFeatures = [...(profile.requiredFeatures ?? [])];

  const prune = (predicate) => {
    for (let i = requiredFeatures.length - 1; i >= 0; i -= 1) {
      if (predicate(requiredFeatures[i])) requiredFeatures.splice(i, 1);
    }
  };

  prune((id) => META_FEATURES.has(id));
  prune((id) => isFeatureCoveredByStructuralProfile(id, profile));

  return {
    ...profile,
    requiredFeatures,
  };
}

/**
 * @typedef {object} ProfileCriterion
 * @property {string} criterionId – eindeutig pro Prüfung
 * @property {CriterionKind} kind
 * @property {string} source – Herkunft (fuel, towCapacityKg, requiredFeatures, …)
 * @property {string} [featureId]
 * @property {unknown} [value]
 */

/**
 * Evaluierungsplan – jede Kundenanforderung genau einmal.
 * @param {object} profile
 * @returns {ProfileCriterion[]}
 */
export function buildProfileEvaluationPlan(profile) {
  const p = canonicalizeSearchProfile(profile);
  /** @type {ProfileCriterion[]} */
  const plan = [];

  if (p.fuel) {
    plan.push({ criterionId: 'fuel', kind: 'fuel', source: 'fuel', value: p.fuel });
  }

  const rangeKm = p.minRangeKm ?? p.rangeKmMin ?? null;
  if (rangeKm != null) {
    plan.push({ criterionId: 'range_km', kind: 'range', source: 'rangeKmMin', value: rangeKm });
  }

  if (p.seatsMin != null) {
    plan.push({ criterionId: 'seats', kind: 'seats', source: 'seatsMin', value: p.seatsMin });
  }

  if (p.maxLengthMm != null) {
    plan.push({ criterionId: 'length_mm', kind: 'length', source: 'maxLengthMm', value: p.maxLengthMm });
  }

  if (p.maxHeightMm != null) {
    plan.push({ criterionId: 'height_mm', kind: 'height', source: 'maxHeightMm', value: p.maxHeightMm });
  }

  if (p.trunkLMin != null) {
    plan.push({ criterionId: 'trunk_l', kind: 'trunk', source: 'trunkLMin', value: p.trunkLMin });
  }

  if (p.isofixRearMin != null) {
    plan.push({ criterionId: 'isofix_rear', kind: 'isofix', source: 'isofixRearMin', value: p.isofixRearMin });
  }

  if (p.towCapacityKg != null) {
    plan.push({
      criterionId: 'tow_braked',
      kind: 'tow_kg',
      source: 'towCapacityKg',
      value: p.towCapacityKg,
    });
  }

  for (const featureId of p.requiredFeatures ?? []) {
    if (isFeatureCoveredByStructuralProfile(featureId, p)) continue;
    plan.push({
      criterionId: `feature:${featureId}`,
      kind: 'trim_feature',
      source: 'requiredFeatures',
      featureId,
    });
  }

  return plan;
}

/**
 * @param {ProfileCriterion[]} plan
 * @returns {string[]} Konflikte (leer = ok)
 */
export function validateProfileEvaluationPlan(plan = []) {
  const errors = [];
  const ids = new Set();

  for (const item of plan) {
    if (ids.has(item.criterionId)) {
      errors.push(`Doppeltes Kriterium: ${item.criterionId}`);
    }
    ids.add(item.criterionId);
  }

  const hasTowKg = plan.some((c) => c.kind === 'tow_kg');
  const hasTowFeature = plan.some((c) => c.featureId?.startsWith('tow_capacity_'));
  if (hasTowKg && hasTowFeature) {
    errors.push('Anhängelast doppelt: towCapacityKg und tow_capacity_*');
  }

  const hasRange = plan.some((c) => c.kind === 'range');
  const hasReichweiteFeature = plan.some((c) => c.featureId === 'reichweite');
  const hasRange400Feature = plan.some((c) => c.featureId === 'range_400');
  if (hasRange && (hasReichweiteFeature || hasRange400Feature)) {
    errors.push('Reichweite doppelt: rangeKmMin und Reichweite-Feature');
  }

  return errors;
}

/**
 * Intent → strukturelle Felder (Vorschau vor buildSearchProfile).
 * @param {ReturnType<import('./searchIntentParser.js').parseSearchIntent>} intent
 */
export function intentStructuralPreview(intent = {}) {
  const fuelMap = {
    elektro: 'electric',
    electric: 'electric',
    hybrid: 'hybrid',
    'plugin-hybrid': 'plugin_hybrid',
    plugin_hybrid: 'plugin_hybrid',
    verbrenner: 'combustion',
    benzin: 'combustion',
    diesel: 'combustion',
  };
  const fuel = intent.fuel ? (fuelMap[intent.fuel] ?? intent.fuel) : null;
  const rangeKmMin = intent.rangeKmMin ?? null;

  return {
    fuel,
    towCapacityKg: intent.towCapacityKg ?? null,
    rangeKmMin,
    minRangeKm: rangeKmMin,
    seatsMin: intent.seatsMin ?? null,
    isofixRearMin: intent.isofixRearMin ?? null,
    trunkLMin: intent.trunkLMin ?? null,
    maxLengthMm: intent.maxLengthMm ?? null,
    maxHeightMm: intent.maxHeightMm ?? null,
  };
}

/**
 * Feature-Liste bereinigen: keine Duplikate zu strukturierten Intent-Feldern.
 * @param {string[]} features
 * @param {object} intent
 */
export function filterWishFeatures(features = [], intent = null) {
  if (!intent) return features;
  const preview = intentStructuralPreview(intent);
  return features.filter((id) => !isFeatureCoveredByStructuralProfile(id, preview));
}

/**
 * @param {object} profile
 * @returns {{ profile: object, plan: ProfileCriterion[], valid: boolean, errors: string[] }}
 */
export function prepareProfileForEvaluation(profile) {
  const canonical = canonicalizeSearchProfile(profile);
  const plan = buildProfileEvaluationPlan(canonical);
  const errors = validateProfileEvaluationPlan(plan);
  return {
    profile: canonical,
    plan,
    valid: errors.length === 0,
    errors,
  };
}
