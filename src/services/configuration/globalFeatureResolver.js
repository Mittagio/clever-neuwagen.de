/**
 * Layer 1: Globale Feature-Erkennung (Suche & Spracheingabe).
 * Mappt normalisierte Kundenbegriffe auf den globalen Katalog – ohne Modellbezug.
 */
import {
  getGlobalFeatureById,
  getSearchableGlobalFeatures,
  LEGACY_CATALOG_ID_ALIASES,
} from '../../data/features/globalFeatureCatalog.js';
import { normalizeEquipmentQuery, scoreSearchPattern } from './equipmentQueryUtils.js';
import {
  findMappingForQuery,
  getRawLabelsForFeatureId,
} from '../admin/featureAliasMappingService.js';

const AMBIGUOUS_SHORT_QUERIES = new Set(['led']);

const LED_FAMILY_IDS = new Set([
  'led_scheinwerfer',
  'matrix_led',
  'led_rueckleuchten',
  'tagfahrlicht_led',
  'ambientebeleuchtung',
]);

/**
 * @param {string} query
 * @param {object} [options]
 * @param {boolean} [options.includeNonSearchable]
 */
export function resolveGlobalFeatureFromQuery(query, options = {}) {
  const rawQuery = query?.trim() ?? '';
  if (!rawQuery) return { type: 'empty', query: rawQuery };

  const normalized = normalizeEquipmentQuery(rawQuery);
  if (!normalized.normalized) return { type: 'empty', query: rawQuery };

  const adminAlias = findMappingForQuery(rawQuery);
  if (adminAlias) {
    const aliasFeature = getGlobalFeatureById(adminAlias.mappedFeatureId);
    if (aliasFeature) {
      return {
        type: 'match',
        query: rawQuery,
        feature: aliasFeature,
        score: 100,
        resolutionSource: 'admin_override',
      };
    }
  }

  const features = options.includeNonSearchable
    ? getSearchableGlobalFeatures()
    : getSearchableGlobalFeatures();

  const hits = [];
  for (const feature of features) {
    const patterns = [feature.label, ...(feature.synonyms ?? [])];
    const adminAliases = getRawLabelsForFeatureId(feature.id);
    let best = 0;
    for (const pattern of patterns) {
      best = Math.max(best, scoreSearchPattern(normalized, pattern));
    }
    for (const aliasLabel of adminAliases) {
      const aliasScore = scoreSearchPattern(normalized, aliasLabel);
      if (aliasScore >= 55) {
        best = Math.max(best, Math.min(100, aliasScore + 15));
      }
    }
    if (best >= 55) {
      hits.push({ feature, score: best });
    }
  }

  hits.sort((a, b) => b.score - a.score);

  if (!hits.length) {
    return { type: 'not_recognized', query: rawQuery };
  }

  if (AMBIGUOUS_SHORT_QUERIES.has(normalized.normalized) || normalized.normalized === 'led') {
    const ledFamily = hits.filter((h) => LED_FAMILY_IDS.has(h.feature.id));
    if (ledFamily.length >= 2) {
      return {
        type: 'ambiguous',
        query: rawQuery,
        suggestions: ledFamily.map((h) => h.feature),
      };
    }
  }

  const top = hits[0];
  const close = hits.filter((h) => h.score >= top.score - 8 && h.feature.id !== top.feature.id);
  if (close.length >= 1 && top.score < 95) {
    return {
      type: 'ambiguous',
      query: rawQuery,
      suggestions: [top, ...close].map((h) => h.feature),
    };
  }

  return {
    type: 'match',
    query: rawQuery,
    feature: top.feature,
    score: top.score,
  };
}

export function resolveGlobalFeatureId(id) {
  if (!id) return null;
  const aliased = LEGACY_CATALOG_ID_ALIASES[id] ?? id;
  return getGlobalFeatureById(aliased)?.id ?? aliased;
}
