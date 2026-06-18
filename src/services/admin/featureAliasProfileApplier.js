/**
 * Wendet Admin-Alias-Mappings auf importierte Model-Profile an.
 */
import { getGlobalFeatureById } from '../../data/features/globalFeatureCatalog.js';
import { FEATURE_ALIAS_CONFIDENCE, FEATURE_ALIAS_SOURCE } from '../../data/features/featureAliasOverrides.js';
import {
  getImportedEquipmentBundle,
  listImportedModelKeys,
  registerModelEquipmentProfile,
} from '../configuration/equipmentImportRegistry.js';
import {
  findMappingForRawLabel,
  isUnknownFeatureIgnored,
} from './featureAliasMappingService.js';

const ADMIN_OVERRIDE_SOURCE = {
  type: 'admin_override',
  documentName: 'Admin-Alias-Mapping',
  validFrom: null,
  confidence: FEATURE_ALIAS_CONFIDENCE.MANUAL_VERIFIED,
};

/**
 * @param {string} modelKey
 */
export function reapplyFeatureAliasMappingsForModel(modelKey) {
  const bundle = getImportedEquipmentBundle(modelKey);
  if (!bundle) return false;

  const profile = {
    ...bundle.profile,
    featureAvailability: [...(bundle.profile.featureAvailability ?? [])],
  };
  const remainingUnknowns = [];
  const entryKeys = new Set(
    profile.featureAvailability.map((entry) => `${entry.featureId}::${entry.trimId}`),
  );

  for (const unknown of bundle.unknownFeatures ?? []) {
    const rawLabel = unknown.rawLabel;
    if (!rawLabel) continue;

    if (isUnknownFeatureIgnored(rawLabel)) {
      remainingUnknowns.push(unknown);
      continue;
    }

    const mapping = findMappingForRawLabel(rawLabel);
    if (!mapping) {
      remainingUnknowns.push(unknown);
      continue;
    }

    const feature = getGlobalFeatureById(mapping.mappedFeatureId);
    if (!feature) {
      remainingUnknowns.push(unknown);
      continue;
    }

    const trimName = profile.trims?.find((trim) => trim.id === unknown.trimId)?.name ?? unknown.trimId;
    const entryKey = `${feature.id}::${unknown.trimId}`;

    if (!entryKeys.has(entryKey)) {
      profile.featureAvailability.push({
        featureId: feature.id,
        trimId: unknown.trimId,
        trimName,
        status: unknown.status,
        packageId: unknown.packageId ?? null,
        packageName: unknown.packageName ?? null,
        sourceRef: unknown.sourceRef ?? null,
        confidence: FEATURE_ALIAS_CONFIDENCE.MANUAL_VERIFIED,
        source: ADMIN_OVERRIDE_SOURCE,
        mappedFromRawLabel: rawLabel,
      });
      entryKeys.add(entryKey);
    }
  }

  registerModelEquipmentProfile(profile, remainingUnknowns, bundle.meta ?? {});
  return true;
}

export function reapplyFeatureAliasMappingsForAllImportedModels() {
  for (const modelKey of listImportedModelKeys()) {
    reapplyFeatureAliasMappingsForModel(modelKey);
  }
}
