/**
 * Registry für importierte Model-Ausstattungsprofile (Layer 2).
 * Wird von modelEquipmentData gelesen – keine Kundenseite-Logik.
 */
/** @typedef {import('../../data/features/modelEquipmentSchema.js').ModelEquipmentProfile} ModelEquipmentProfile */
/** @typedef {import('../../data/features/modelEquipmentSchema.js').UnknownImportedFeature} UnknownImportedFeature */

/**
 * @typedef {object} ProfileRegistrationMeta
 * @property {string} [origin]
 * @property {string} [importFile]
 * @property {string} [dedupeKey]
 */

/** @type {Map<string, { profile: ModelEquipmentProfile, unknownFeatures: UnknownImportedFeature[], meta: ProfileRegistrationMeta }>} */
const registry = new Map();

function normalizeRegistryKey(modelKey) {
  return String(modelKey ?? '')
    .toLowerCase()
    .replace(/^kia-/, '')
    .replace(/[\s_]+/g, '-')
    .trim();
}

/**
 * @param {ModelEquipmentProfile} profile
 * @param {UnknownImportedFeature[]} [unknownFeatures]
 * @param {ProfileRegistrationMeta} [meta]
 */
export function registerModelEquipmentProfile(profile, unknownFeatures = [], meta = {}) {
  const key = normalizeRegistryKey(profile.modelKey);
  registry.set(key, {
    profile: { ...profile, modelKey: key },
    unknownFeatures: [...unknownFeatures],
    meta: { ...meta },
  });
}

export function getProfileRegistrationMeta(modelKey) {
  return getImportedEquipmentBundle(modelKey)?.meta ?? null;
}

/**
 * @returns {{ profile: ModelEquipmentProfile, unknownFeatures: UnknownImportedFeature[] } | null}
 */
export function getImportedEquipmentBundle(modelKey) {
  const key = normalizeRegistryKey(modelKey);
  return registry.get(key) ?? null;
}

export function getImportedModelEquipmentProfile(modelKey) {
  return getImportedEquipmentBundle(modelKey)?.profile ?? null;
}

export function getImportedUnknownFeatures(modelKey) {
  return getImportedEquipmentBundle(modelKey)?.unknownFeatures ?? [];
}

export function hasImportedModelEquipmentProfile(modelKey) {
  return registry.has(normalizeRegistryKey(modelKey));
}

export function clearImportedModelEquipmentProfiles() {
  registry.clear();
}

export function listImportedModelKeys() {
  return [...registry.keys()];
}
