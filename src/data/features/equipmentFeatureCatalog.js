/**
 * Abwärtskompatibilität: Suchkatalog → globalFeatureCatalog (Layer 1).
 * @deprecated Bitte getGlobalFeatureById / GLOBAL_FEATURE_CATALOG direkt nutzen.
 */
import {
  getGlobalFeatureById,
  GLOBAL_FEATURE_CATALOG,
  LEGACY_CATALOG_ID_ALIASES,
  resolveLegacyFeatureId,
} from './globalFeatureCatalog.js';

function toLegacySearchEntry(feature) {
  return {
    id: feature.id,
    label: feature.label,
    category: feature.category,
    synonyms: feature.synonyms,
    tags: feature.tags,
    confidence: feature.confidence,
    showAsChip: feature.showAsChip,
    searchable: feature.searchable,
    advisorRelevant: feature.advisorRelevant,
    mapsToFeatureId: feature.legacyFeatureId,
    legacyFeatureId: feature.legacyFeatureId,
  };
}

/** @deprecated Nutze GLOBAL_FEATURE_CATALOG */
export const EQUIPMENT_SEARCH_CATALOG = GLOBAL_FEATURE_CATALOG
  .filter((f) => f.searchable)
  .map(toLegacySearchEntry);

/** @deprecated */
export const EXTENDED_EQUIPMENT_FEATURES = EQUIPMENT_SEARCH_CATALOG.filter(
  (e) => e.mapsToFeatureId == null,
);

export function getEquipmentSearchEntry(id) {
  const feature = getGlobalFeatureById(id)
    ?? getGlobalFeatureById(LEGACY_CATALOG_ID_ALIASES[id]);
  return feature ? toLegacySearchEntry(feature) : null;
}

export function resolveSearchFeatureId(entry) {
  if (!entry) return null;
  if (entry.legacyFeatureId != null) return entry.legacyFeatureId;
  if (entry.mapsToFeatureId != null) return entry.mapsToFeatureId;
  const feature = getGlobalFeatureById(entry.id);
  return resolveLegacyFeatureId(feature) ?? entry.id ?? null;
}

export {
  GLOBAL_FEATURE_CATALOG,
  getGlobalFeatureById,
  getSearchableGlobalFeatures,
  getChipEligibleGlobalFeatures,
  getAdvisorRelevantGlobalFeatures,
} from './globalFeatureCatalog.js';
