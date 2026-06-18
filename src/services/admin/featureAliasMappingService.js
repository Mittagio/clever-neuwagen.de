/**
 * Admin-Service: Unknown-Import-Rohbegriffe → globale Feature-IDs.
 * Priorität manual_verified über Katalog-Synonyme.
 */
import { getGlobalFeatureById, getSearchableGlobalFeatures } from '../../data/features/globalFeatureCatalog.js';
import {
  createFeatureAliasMapping,
  FEATURE_ALIAS_CONFIDENCE,
  FEATURE_ALIAS_SOURCE,
  normalizeFeatureAliasRawLabel,
} from '../../data/features/featureAliasOverrides.js';
import { normalizeEquipmentQuery, scoreSearchPattern } from '../configuration/equipmentQueryUtils.js';
import {
  isIgnoredRawLabelInStore,
  readFeatureAliasStore,
  resetFeatureAliasStore,
  writeFeatureAliasStore,
} from './featureAliasMappingStore.js';

/** @typedef {import('../../data/features/featureAliasOverrides.js').FeatureAliasMapping} FeatureAliasMapping */

export function getFeatureAliasMappings() {
  return readFeatureAliasStore().mappings;
}

/**
 * @param {string} rawLabel
 * @returns {FeatureAliasMapping | null}
 */
export function findMappingForRawLabel(rawLabel) {
  const key = normalizeFeatureAliasRawLabel(rawLabel);
  if (!key) return null;
  return getFeatureAliasMappings().find(
    (mapping) => normalizeFeatureAliasRawLabel(mapping.rawLabel) === key,
  ) ?? null;
}

/**
 * @param {string} query
 * @returns {FeatureAliasMapping | null}
 */
export function findMappingForQuery(query) {
  const normalized = normalizeEquipmentQuery(query);
  if (!normalized.normalized) return null;

  const mappings = getFeatureAliasMappings();
  const exact = mappings.find(
    (mapping) => normalizeFeatureAliasRawLabel(mapping.rawLabel) === normalized.normalized,
  );
  if (exact) return exact;

  const partial = mappings.filter((mapping) => {
    const labelKey = normalizeFeatureAliasRawLabel(mapping.rawLabel);
    return labelKey.includes(normalized.normalized) || normalized.normalized.includes(labelKey);
  });

  if (partial.length === 1) return partial[0];
  return null;
}

/**
 * @param {string} featureId
 * @returns {string[]}
 */
export function getRawLabelsForFeatureId(featureId) {
  return getFeatureAliasMappings()
    .filter((mapping) => mapping.mappedFeatureId === featureId)
    .map((mapping) => mapping.rawLabel);
}

/**
 * @param {string} rawLabel
 * @param {string} mappedFeatureId
 * @returns {FeatureAliasMapping | null}
 */
export function saveFeatureAliasMapping(rawLabel, mappedFeatureId) {
  const trimmedLabel = String(rawLabel ?? '').trim();
  const feature = getGlobalFeatureById(mappedFeatureId);
  if (!trimmedLabel || !feature) return null;

  const store = readFeatureAliasStore();
  const key = normalizeFeatureAliasRawLabel(trimmedLabel);
  const mapping = createFeatureAliasMapping(trimmedLabel, feature.id, {
    source: FEATURE_ALIAS_SOURCE.ADMIN_OVERRIDE,
    confidence: FEATURE_ALIAS_CONFIDENCE.MANUAL_VERIFIED,
  });

  const nextMappings = store.mappings.filter(
    (item) => normalizeFeatureAliasRawLabel(item.rawLabel) !== key,
  );
  nextMappings.push(mapping);

  const nextIgnored = store.ignoredRawLabels.filter((ignored) => ignored !== key);

  writeFeatureAliasStore({
    mappings: nextMappings,
    ignoredRawLabels: nextIgnored,
  });

  return mapping;
}

/**
 * @param {string} rawLabel
 */
export function ignoreUnknownFeature(rawLabel) {
  const key = normalizeFeatureAliasRawLabel(rawLabel);
  if (!key) return;

  const store = readFeatureAliasStore();
  if (store.ignoredRawLabels.includes(key)) return;

  writeFeatureAliasStore({
    ...store,
    ignoredRawLabels: [...store.ignoredRawLabels, key],
  });
}

/**
 * @param {string} rawLabel
 */
export function isUnknownFeatureIgnored(rawLabel) {
  return isIgnoredRawLabelInStore(rawLabel);
}

/** Nur für Tests. */
export function resetFeatureAliasMappings() {
  resetFeatureAliasStore();
}

/**
 * Feature-Dropdown-Suche im Inspector (Label, ID, Synonym).
 * @param {string} query
 * @param {number} [limit]
 */
export function searchGlobalFeaturesForMapping(query, limit = 25) {
  const features = getSearchableGlobalFeatures();
  const raw = query?.trim() ?? '';
  if (!raw) return features.slice(0, limit);

  const normalized = normalizeEquipmentQuery(raw);
  const hits = [];

  for (const feature of features) {
    let best = 0;
    if (feature.id.toLowerCase().includes(normalized.normalized)) best = 100;
    if (feature.label.toLowerCase().includes(normalized.normalized)) best = Math.max(best, 95);

    const patterns = [feature.label, feature.id, ...(feature.synonyms ?? [])];
    for (const pattern of patterns) {
      best = Math.max(best, scoreSearchPattern(normalized, pattern));
    }

    if (best >= 40) {
      hits.push({ feature, score: best });
    }
  }

  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit).map((hit) => hit.feature);
}
