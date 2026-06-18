/**
 * Layer-2-Suche: globales Feature erkennen + Modell-Verfügbarkeit auflösen.
 */
import { resolveLegacyFeatureId } from '../../data/features/globalFeatureCatalog.js';
import { FEATURE_AVAILABILITY_STATUS as S } from '../../data/features/modelEquipmentSchema.js';
import { resolveGlobalFeatureFromQuery } from './globalFeatureResolver.js';
import { getImportedModelEquipmentProfile } from './equipmentImportRegistry.js';
import { resolveModelFeatureAvailability } from './modelEquipmentData.js';
import {
  buildProfileQualityContext,
  isFeatureSafeForCustomer,
} from '../admin/equipmentQualityService.js';

function mapAvailabilityToSearchStatus(modelStatus) {
  if (modelStatus === S.STANDARD) return 'standard';
  if (modelStatus === S.AVAILABLE) return 'available';
  if (modelStatus === S.OPTIONAL) return 'optional';
  if (modelStatus === S.PACKAGE_REQUIRED) return 'package';
  if (modelStatus === S.NOT_AVAILABLE) return 'not_available';
  return 'unknown';
}

function buildHitFromFeature(feature, availability, score, modelKey) {
  let status = availability
    ? mapAvailabilityToSearchStatus(availability.modelStatus)
    : 'unknown';

  const profile = modelKey ? getImportedModelEquipmentProfile(modelKey) : null;
  if (profile && availability?.entries?.length) {
    const qualityCtx = buildProfileQualityContext(modelKey, profile);
    const entriesForFeature = availability.entries;
    const allSafe = entriesForFeature.every((entry) => (
      isFeatureSafeForCustomer(entry, qualityCtx, qualityCtx.reviewItems)
    ));
    if (!allSafe) {
      status = 'unknown';
    }
  }

  return {
    entry: {
      key: `feature:${feature.id}`,
      catalogId: feature.id,
      globalFeatureId: feature.id,
      featureId: resolveLegacyFeatureId(feature),
      label: feature.label,
      synonyms: feature.synonyms,
      status,
      availableTrims: availability?.availableTrims ?? [],
      availablePackages: availability?.availablePackages ?? [],
      source: availability?.sourceRefs?.[0] ?? 'globalCatalog',
      confidence: status === 'unknown' ? 'low' : (availability?.confidence ?? feature.confidence),
      customerSafetyUncertain: status === 'unknown' && Boolean(profile),
    },
    score,
  };
}

/**
 * Modellbezogene Suche – erkennt Features, nie Paketnamen als Wunsch.
 */
export function searchModelEquipmentIndex(query, brand, model, modelKey) {
  const recognition = resolveGlobalFeatureFromQuery(query);
  if (recognition.type === 'empty') return { type: 'empty', query };
  if (recognition.type === 'not_recognized') return { type: 'not_found', query };

  if (recognition.type === 'ambiguous') {
    const suggestions = recognition.suggestions.map((feature) => {
      const availability = resolveModelFeatureAvailability(brand, model, modelKey, feature.id);
      return buildHitFromFeature(feature, availability, 80, modelKey);
    });
    return { type: 'ambiguous', query, suggestions };
  }

  const availability = resolveModelFeatureAvailability(
    brand,
    model,
    modelKey,
    recognition.feature.id,
  );
  const hit = buildHitFromFeature(recognition.feature, availability, recognition.score, modelKey);

  if (hit.entry.status === 'unknown') {
    return { type: 'catalog_unconfirmed', query, hit, feature: recognition.feature };
  }

  return { type: 'match', query, hit };
}
