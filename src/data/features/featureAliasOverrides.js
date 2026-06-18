/**
 * Schema für Admin-Alias-Mappings (Unknown Import → globales Feature).
 */

/** @typedef {'admin_override'} FeatureAliasSource */

/** @typedef {'manual_verified' | 'high' | 'medium' | 'low'} FeatureAliasConfidence */

/**
 * @typedef {object} FeatureAliasMapping
 * @property {string} rawLabel – Rohbegriff aus Preisliste / Import
 * @property {string} mappedFeatureId – ID aus globalFeatureCatalog
 * @property {FeatureAliasSource} source
 * @property {string} createdAt – ISO-Zeitstempel
 * @property {FeatureAliasConfidence} confidence
 */

export const FEATURE_ALIAS_STORAGE_KEY = 'clever_equipment_feature_alias_mappings';

export const FEATURE_ALIAS_SOURCE = {
  ADMIN_OVERRIDE: 'admin_override',
};

export const FEATURE_ALIAS_CONFIDENCE = {
  MANUAL_VERIFIED: 'manual_verified',
};

/**
 * @param {string} rawLabel
 * @param {string} mappedFeatureId
 * @param {Partial<FeatureAliasMapping>} [overrides]
 * @returns {FeatureAliasMapping}
 */
export function createFeatureAliasMapping(rawLabel, mappedFeatureId, overrides = {}) {
  return {
    rawLabel: String(rawLabel ?? '').trim(),
    mappedFeatureId,
    source: overrides.source ?? FEATURE_ALIAS_SOURCE.ADMIN_OVERRIDE,
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    confidence: overrides.confidence ?? FEATURE_ALIAS_CONFIDENCE.MANUAL_VERIFIED,
  };
}

/**
 * @param {string} rawLabel
 */
export function normalizeFeatureAliasRawLabel(rawLabel) {
  return String(rawLabel ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * @typedef {object} FeatureAliasStoreData
 * @property {FeatureAliasMapping[]} mappings
 * @property {string[]} ignoredRawLabels – normalisierte rawLabels
 */

/** @returns {FeatureAliasStoreData} */
export function createEmptyFeatureAliasStore() {
  return {
    mappings: [],
    ignoredRawLabels: [],
  };
}
