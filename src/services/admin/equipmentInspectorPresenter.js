/**
 * Präsentationslogik für EquipmentDataInspector (testbar, ohne UI).
 */
import { getGlobalFeatureById } from '../../data/features/globalFeatureCatalog.js';
import { FEATURE_AVAILABILITY_STATUS as S } from '../../data/features/modelEquipmentSchema.js';
import { registerDefaultEquipmentImports } from '../configuration/equipmentImportLoader.js';
import { resolveGlobalFeatureFromQuery } from '../configuration/globalFeatureResolver.js';
import {
  getImportedModelEquipmentProfile,
  getImportedUnknownFeatures,
  getProfileRegistrationMeta,
} from '../configuration/equipmentImportRegistry.js';
import {
  getModelEquipmentProfile,
  resolveModelFeatureAvailability,
} from '../configuration/modelEquipmentData.js';
import { getSearchedFeatureStatusCopy } from '../configuration/equipmentFeatureSearch.js';
import { reapplyFeatureAliasMappingsForModel } from './featureAliasProfileApplier.js';
import {
  findMappingForRawLabel,
  ignoreUnknownFeature,
  isUnknownFeatureIgnored,
  saveFeatureAliasMapping,
  searchGlobalFeaturesForMapping,
} from './featureAliasMappingService.js';
import { buildProfileQualityContext } from './equipmentQualityService.js';
import {
  buildFeatureSourceDetailFromSearch,
  canShowSourceForRow,
} from './equipmentInspectorSourcePresenter.js';
import { listTechnicalDataGapsForModel } from '../../data/technical/verifiedTechnicalDataRegistry.js';

export const INSPECTOR_DEMO_MODELS = [
  { brand: 'Kia', brandKey: 'kia', model: 'EV3', modelKey: 'ev3' },
  { brand: 'Kia', brandKey: 'kia', model: 'EV2', modelKey: 'ev2' },
  { brand: 'Kia', brandKey: 'kia', model: 'EV5', modelKey: 'ev5' },
  { brand: 'Demo', brandKey: 'demo', model: 'Model X', modelKey: 'demo-model-x' },
];

export const PROFILE_ORIGIN_LABELS = {
  json_import: 'JSON-Import',
  sample: 'JS-Sample',
  import: 'JS-Sample',
  manual_verified: 'Manuell verifiziert',
  manufacturer_registry: 'Hersteller-Registry',
  merged: 'Zusammengeführt',
  legacy: 'Hersteller-Registry',
  none: 'Keine Daten',
};

/**
 * @param {import('../../data/features/modelEquipmentSchema.js').ModelEquipmentProfile | null} profile
 * @param {boolean} imported
 * @param {import('../../data/features/modelEquipmentSchema.js').ModelEquipmentProfile | null} legacy
 * @param {string} modelKey
 */
export function resolveProfileOrigin(profile, imported, legacy, modelKey) {
  const meta = getProfileRegistrationMeta(modelKey);

  if (profile?.source?.type === 'manual_verified') {
    return {
      key: 'manual_verified',
      label: PROFILE_ORIGIN_LABELS.manual_verified,
      sourceType: profile.source.type,
    };
  }

  const origin = profile?.dataOrigin ?? meta?.origin;

  if (origin === 'json_import' || meta?.origin === 'json_import') {
    return {
      key: 'json_import',
      label: PROFILE_ORIGIN_LABELS.json_import,
      sourceType: profile?.source?.type ?? null,
      importFile: profile?.importFile ?? meta?.importFile ?? null,
    };
  }

  if (origin === 'sample' || origin === 'import') {
    return {
      key: 'sample',
      label: PROFILE_ORIGIN_LABELS.sample,
      sourceType: profile?.source?.type ?? null,
    };
  }

  if (origin === 'merged') {
    return {
      key: 'merged',
      label: PROFILE_ORIGIN_LABELS.merged,
      sourceType: profile?.source?.type ?? null,
      importFile: profile?.importFile ?? meta?.importFile ?? null,
    };
  }

  if (imported) {
    return {
      key: origin ?? 'import',
      label: PROFILE_ORIGIN_LABELS[origin] ?? origin ?? 'Import',
      sourceType: profile?.source?.type ?? null,
    };
  }

  if (legacy?.featureAvailability?.length) {
    return {
      key: 'manufacturer_registry',
      label: PROFILE_ORIGIN_LABELS.manufacturer_registry,
      sourceType: null,
    };
  }

  return {
    key: 'none',
    label: PROFILE_ORIGIN_LABELS.none,
    sourceType: null,
  };
}

/** Lädt JSON-Imports (idempotent). */
export function ensureSampleEquipmentImportsLoaded() {
  registerDefaultEquipmentImports();
}

/**
 * @param {string} modelKey
 */
export function getInspectorUnknownFeatureGroups(modelKey) {
  const unknownFeatures = getImportedUnknownFeatures(modelKey);
  const openUnknownFeatures = [];
  const ignoredUnknownFeatures = [];

  for (const item of unknownFeatures) {
    if (isUnknownFeatureIgnored(item.rawLabel)) {
      ignoredUnknownFeatures.push({ ...item, inspectorStatus: 'ignored' });
      continue;
    }
    if (findMappingForRawLabel(item.rawLabel)) {
      continue;
    }
    openUnknownFeatures.push({ ...item, inspectorStatus: 'open' });
  }

  return { openUnknownFeatures, ignoredUnknownFeatures };
}

/**
 * @param {string} modelKey
 * @param {string} rawLabel
 * @param {string} mappedFeatureId
 */
export function assignUnknownFeatureMapping(modelKey, rawLabel, mappedFeatureId) {
  const mapping = saveFeatureAliasMapping(rawLabel, mappedFeatureId);
  if (!mapping) return null;

  reapplyFeatureAliasMappingsForModel(modelKey);
  const feature = getGlobalFeatureById(mapping.mappedFeatureId);
  return {
    mapping,
    feature,
    message: feature
      ? `${rawLabel} wurde ${feature.label} zugeordnet.`
      : `${rawLabel} wurde zugeordnet.`,
  };
}

/**
 * @param {string} modelKey
 * @param {string} rawLabel
 */
export function ignoreInspectorUnknownFeature(modelKey, rawLabel) {
  ignoreUnknownFeature(rawLabel);
  reapplyFeatureAliasMappingsForModel(modelKey);
}

export { searchGlobalFeaturesForMapping };
export {
  buildProfileQualityContext,
  getQualityBadgeLabel,
  getQualityBadgeTone,
  markProfileAsVerified,
} from './equipmentQualityService.js';
export {
  buildFeatureSourceCopyText,
  buildFeatureSourceDetailFromRow,
  buildFeatureSourceDetailFromSearch,
  canShowSourceForRow,
  sortSourceBlocks,
} from './equipmentInspectorSourcePresenter.js';

/**
 * @param {string} modelKey
 */
export function loadInspectorModelContext(modelKey) {
  reapplyFeatureAliasMappingsForModel(modelKey);

  const demo = INSPECTOR_DEMO_MODELS.find((m) => m.modelKey === modelKey) ?? {
    brand: '—',
    model: modelKey,
    modelKey,
  };

  const imported = getImportedModelEquipmentProfile(modelKey);
  const legacy = imported ? null : getModelEquipmentProfile(demo.brand, demo.model, modelKey);
  const profile = imported ?? legacy;
  const { openUnknownFeatures, ignoredUnknownFeatures } = getInspectorUnknownFeatureGroups(modelKey);
  const profileOrigin = resolveProfileOrigin(profile, Boolean(imported), legacy, modelKey);
  const quality = buildProfileQualityContext(modelKey, profile);

  return {
    brand: profile?.brand ?? demo.brand,
    model: profile?.model ?? demo.model,
    modelKey,
    modelYear: profile?.modelYear ?? null,
    profile,
    unknownFeatures: openUnknownFeatures,
    ignoredUnknownFeatures,
    quality,
    openReviewItems: quality.reviewItems,
    dataOrigin: profileOrigin.key,
    profileOrigin,
    source: profile?.source ?? null,
    trims: profile?.trims ?? [],
    packages: profile?.packages ?? [],
    featureRows: buildAvailabilityRows(profile),
    technicalDataGaps: listTechnicalDataGapsForModel(modelKey, demo.brandKey ?? 'kia'),
  };
}

/**
 * @param {import('../../data/features/modelEquipmentSchema.js').ModelEquipmentProfile | null} profile
 */
export function buildAvailabilityRows(profile) {
  if (!profile?.featureAvailability?.length) return [];

  const trimNames = new Map((profile.trims ?? []).map((t) => [t.id, t.name]));
  const packageNames = new Map((profile.packages ?? []).map((p) => [p.id, p.name]));

  return profile.featureAvailability.map((entry) => {
    const feature = getGlobalFeatureById(entry.featureId);
    const sourceRef = normalizeSourceRef(entry.sourceRef);

    return {
      featureId: entry.featureId,
      featureLabel: feature?.label ?? entry.featureId,
      trimId: entry.trimId,
      trimName: entry.trimName ?? trimNames.get(entry.trimId) ?? entry.trimId,
      status: entry.status,
      packageId: entry.packageId ?? null,
      packageName: entry.packageName ?? (entry.packageId ? packageNames.get(entry.packageId) : null) ?? null,
      confidence: entry.confidence ?? 'medium',
      sourceDocument: sourceRef.document,
      sourceSection: sourceRef.section,
      sourcePage: sourceRef.page,
      rawText: sourceRef.rawText,
      sourceUrl: sourceRef.url,
    };
  });
}

function normalizeSourceRef(sourceRef) {
  if (!sourceRef) {
    return { document: null, section: null, page: null, rawText: null, url: null };
  }
  if (typeof sourceRef === 'string') {
    return { document: sourceRef, section: null, page: null, rawText: null, url: null };
  }
  return {
    document: sourceRef.document ?? null,
    section: sourceRef.section ?? null,
    page: sourceRef.page ?? null,
    rawText: sourceRef.rawText ?? null,
    url: sourceRef.url ?? null,
  };
}

/**
 * Interne Feature-Prüfung – gleiche Resolver wie Kundenseite + Debug-Felder.
 */
export function inspectFeatureSearch(query, brand, model, modelKey) {
  const rawQuery = query?.trim() ?? '';
  if (!rawQuery) {
    return { type: 'empty', query: rawQuery };
  }

  const recognition = resolveGlobalFeatureFromQuery(rawQuery);
  if (recognition.type === 'not_recognized') {
    return { type: 'not_recognized', query: rawQuery, recognition };
  }

  if (recognition.type === 'ambiguous') {
    const options = recognition.suggestions.map((feature) => ({
      feature,
      availability: resolveModelFeatureAvailability(brand, model, modelKey, feature.id),
    }));
    return { type: 'ambiguous', query: rawQuery, recognition, options };
  }

  const feature = recognition.feature;
  const availability = resolveModelFeatureAvailability(brand, model, modelKey, feature.id);
  const customerCopy = availability
    ? getSearchedFeatureStatusCopy({
      label: feature.label,
      modelStatus: mapStatusToCustomerItemStatus(availability.modelStatus),
      availableTrims: availability.availableTrims,
      availablePackages: availability.availablePackages,
    })
    : null;

  const internalEntries = (availability?.entries ?? []).map((entry) => ({
    ...entry,
    sourceRef: normalizeSourceRef(entry.sourceRef),
  }));

  return {
    type: 'match',
    query: rawQuery,
    recognition,
    feature,
    availability,
    customerCopy,
    internalEntries,
    debugSourceRefs: availability?.sourceRefs ?? [],
    hasInspectableSource: internalEntries.some((entry) => {
      const ref = normalizeSourceRef(entry.sourceRef);
      return Boolean(ref.document || ref.section || ref.rawText || ref.page != null);
    }),
  };
}

function mapStatusToCustomerItemStatus(modelStatus) {
  if (modelStatus === S.STANDARD) return 'standard';
  if (modelStatus === S.AVAILABLE) return 'available';
  if (modelStatus === S.OPTIONAL) return 'optional';
  if (modelStatus === S.PACKAGE_REQUIRED) return 'package';
  if (modelStatus === S.NOT_AVAILABLE) return 'not_available';
  return 'unknown';
}

export const STATUS_LABELS = {
  standard: 'Serie',
  available: 'Verfügbar',
  optional: 'Optional',
  package_required: 'Paket nötig',
  not_available: 'Nicht verfügbar',
  unknown: 'Unklar',
};

/** Prüft, dass Kundentexte keine internen Import-Felder enthalten. */
export function customerCopyExposesInternalFields(copy) {
  if (!copy) return false;
  const blob = `${copy.statusLine ?? ''} ${copy.hint ?? ''}`.toLowerCase();
  const forbidden = ['rawtext', 'source.ref', 'pdf', 'seite', 'abschnitt', 'document:'];
  return forbidden.some((token) => blob.includes(token));
}
