/**
 * Mapping von Preislisten-/Ausstattungs-Importen → modelEquipmentProfile (Layer 2).
 */
import {
  getGlobalFeatureById,
  LEGACY_CATALOG_ID_ALIASES,
} from '../../data/features/globalFeatureCatalog.js';
import {
  DATA_CONFIDENCE_RANK,
  FEATURE_AVAILABILITY_STATUS as S,
} from '../../data/features/modelEquipmentSchema.js';
import {
  getImportedModelEquipmentProfile,
  getImportedUnknownFeatures,
  registerModelEquipmentProfile,
} from './equipmentImportRegistry.js';
import {
  findMappingForRawLabel,
  isUnknownFeatureIgnored,
} from '../admin/featureAliasMappingService.js';
import { FEATURE_ALIAS_CONFIDENCE, FEATURE_ALIAS_SOURCE } from '../../data/features/featureAliasOverrides.js';

const VALID_STATUSES = new Set(Object.values(S));

/**
 * @param {string} id
 */
export function normalizeEquipmentId(id) {
  if (!id) return '';
  return String(id)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .replace(/_/g, '-');
}

/**
 * @param {string} modelKey
 */
export function normalizeImportModelKey(modelKey) {
  return normalizeEquipmentId(modelKey).replace(/^kia-/, '');
}

/**
 * @param {string} featureId
 */
export function resolveImportFeatureId(featureId) {
  if (!featureId) return null;
  const normalized = featureId.trim();
  const feature = getGlobalFeatureById(normalized)
    ?? getGlobalFeatureById(LEGACY_CATALOG_ID_ALIASES[normalized]);
  return feature?.id ?? null;
}

function normalizeSourceRef(sourceRef) {
  if (!sourceRef) return null;
  if (typeof sourceRef === 'string') {
    return { document: sourceRef, page: null, section: null, rawText: null, url: null };
  }
  return {
    document: sourceRef.document ?? null,
    page: sourceRef.page ?? null,
    section: sourceRef.section ?? null,
    rawText: sourceRef.rawText ?? null,
    url: sourceRef.url ?? null,
  };
}

function normalizeTrim(trim) {
  const id = normalizeEquipmentId(trim.id);
  return {
    id,
    name: trim.label ?? trim.name ?? id,
  };
}

function normalizePackage(pkg) {
  const id = normalizeEquipmentId(pkg.id);
  return {
    id,
    name: pkg.label ?? pkg.name ?? id,
    description: pkg.description ?? null,
    trimIds: (pkg.trimIds ?? []).map(normalizeEquipmentId),
    featureIds: pkg.featureIds ?? [],
  };
}

function normalizeAvailabilityRow(row, importSource, packageById, trimById) {
  const trimId = normalizeEquipmentId(row.trimId);
  const trimName = trimById.get(trimId)?.name ?? trimId;
  const confidence = row.confidence ?? importSource?.confidence ?? 'medium';
  const sourceRef = normalizeSourceRef(row.sourceRef);
  const status = VALID_STATUSES.has(row.status) ? row.status : S.UNKNOWN;

  const globalFeatureId = row.featureId ? resolveImportFeatureId(row.featureId) : null;
  const rawLabel = row.rawLabel ?? row.featureId ?? row.label ?? 'Unbekanntes Feature';

  if (!globalFeatureId && rawLabel && !isUnknownFeatureIgnored(rawLabel)) {
    const aliasMapping = findMappingForRawLabel(rawLabel);
    const mappedFeatureId = aliasMapping
      ? resolveImportFeatureId(aliasMapping.mappedFeatureId)
      : null;

    if (mappedFeatureId) {
      const packageId = row.packageId ? normalizeEquipmentId(row.packageId) : null;
      const packageName = packageId ? (packageById.get(packageId)?.name ?? packageId) : null;

      return {
        type: 'known',
        entry: {
          featureId: mappedFeatureId,
          trimId,
          trimName,
          status,
          packageId,
          packageName,
          sourceRef,
          confidence: FEATURE_ALIAS_CONFIDENCE.MANUAL_VERIFIED,
          source: {
            type: FEATURE_ALIAS_SOURCE.ADMIN_OVERRIDE,
            documentName: aliasMapping.rawLabel,
            validFrom: aliasMapping.createdAt ?? null,
            confidence: FEATURE_ALIAS_CONFIDENCE.MANUAL_VERIFIED,
          },
          mappedFromRawLabel: rawLabel,
        },
      };
    }
  }

  if (!globalFeatureId) {
    return {
      type: 'unknown',
      unknown: {
        rawLabel,
        suggestedFeatureId: row.suggestedFeatureId ?? null,
        trimId,
        status,
        sourceRef,
        confidence,
      },
    };
  }

  const packageId = row.packageId ? normalizeEquipmentId(row.packageId) : null;
  const packageName = packageId ? (packageById.get(packageId)?.name ?? packageId) : null;

  return {
    type: 'known',
    entry: {
      featureId: globalFeatureId,
      trimId,
      trimName,
      status,
      packageId,
      packageName,
      sourceRef,
      confidence,
      source: importSource ?? null,
    },
  };
}

/**
 * @param {import('../../data/features/modelEquipmentSchema.js').EquipmentImportRecord} importData
 */
export function normalizeEquipmentImport(importData) {
  const source = {
    type: importData.source?.type ?? 'pricelist',
    documentName: importData.source?.documentName ?? null,
    validFrom: importData.source?.validFrom ?? null,
    confidence: importData.source?.confidence ?? 'medium',
  };

  const trims = (importData.trims ?? []).map(normalizeTrim);
  const trimById = new Map(trims.map((t) => [t.id, t]));

  const packages = (importData.packages ?? []).map(normalizePackage);
  const packageById = new Map(packages.map((p) => [p.id, p]));

  const featureAvailability = [];
  const unknownFeatures = [];

  for (const row of importData.featureAvailability ?? []) {
    const normalized = normalizeAvailabilityRow(row, source, packageById, trimById);
    if (normalized.type === 'unknown') {
      unknownFeatures.push(normalized.unknown);
    } else {
      featureAvailability.push(normalized.entry);
    }
  }

  return {
    brand: importData.brand,
    model: importData.model,
    modelKey: normalizeImportModelKey(importData.modelKey),
    modelYear: importData.modelYear ?? null,
    source,
    trims,
    packages: packages.map((pkg) => ({
      id: pkg.id,
      name: pkg.name,
      description: pkg.description,
      trimIds: pkg.trimIds.length ? pkg.trimIds : trims.map((t) => t.id),
      featureIds: pkg.featureIds,
    })),
    featureAvailability,
    unknownFeatures,
  };
}

/**
 * @param {import('../../data/features/modelEquipmentSchema.js').EquipmentImportRecord} importData
 */
export function validateEquipmentImport(importData) {
  const errors = [];
  const warnings = [];

  if (!importData?.brand) errors.push('brand fehlt');
  if (!importData?.model) errors.push('model fehlt');
  if (!importData?.modelKey) errors.push('modelKey fehlt');
  if (!importData?.source?.type) warnings.push('source.type fehlt – Standard: pricelist');
  if (!Array.isArray(importData?.trims) || !importData.trims.length) {
    errors.push('trims fehlt oder leer');
  }
  if (!Array.isArray(importData?.featureAvailability)) {
    errors.push('featureAvailability fehlt');
  }

  const trimIds = new Set((importData.trims ?? []).map((t) => normalizeEquipmentId(t.id)));
  const packageIds = new Set((importData.packages ?? []).map((p) => normalizeEquipmentId(p.id)));

  for (const [index, row] of (importData.featureAvailability ?? []).entries()) {
    const trimId = normalizeEquipmentId(row.trimId);
    if (!trimId) errors.push(`featureAvailability[${index}]: trimId fehlt`);
    else if (!trimIds.has(trimId)) warnings.push(`featureAvailability[${index}]: unbekannte trimId "${row.trimId}"`);

    if (row.status && !VALID_STATUSES.has(row.status)) {
      errors.push(`featureAvailability[${index}]: ungültiger status "${row.status}"`);
    }

    if (row.packageId) {
      const pkgId = normalizeEquipmentId(row.packageId);
      if (!packageIds.has(pkgId)) {
        warnings.push(`featureAvailability[${index}]: unbekannte packageId "${row.packageId}"`);
      }
    }

    if (!row.featureId && !row.rawLabel) {
      errors.push(`featureAvailability[${index}]: featureId oder rawLabel erforderlich`);
    }

    if (row.featureId && !resolveImportFeatureId(row.featureId) && !row.rawLabel) {
      warnings.push(`featureAvailability[${index}]: featureId "${row.featureId}" nicht im globalFeatureCatalog`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * @param {import('../../data/features/modelEquipmentSchema.js').EquipmentImportRecord} importData
 */
export function mapImportToModelEquipmentProfile(importData) {
  const normalized = normalizeEquipmentImport(importData);
  const validation = validateEquipmentImport(importData);

  const sourceRefs = [
    normalized.source.documentName,
    normalized.source.type,
    normalized.source.validFrom,
  ].filter(Boolean);

  const profile = {
    brand: normalized.brand,
    model: normalized.model,
    modelKey: normalized.modelKey,
    modelYear: normalized.modelYear,
    trims: normalized.trims,
    packages: normalized.packages,
    technicalData: importData.technicalData ?? null,
    featureAvailability: normalized.featureAvailability,
    sourceRefs,
    source: normalized.source,
    dataOrigin: 'import',
  };

  return {
    profile,
    unknownFeatures: normalized.unknownFeatures,
    validation,
  };
}

function entryPriority(entry) {
  const sourceType = entry?.source?.type ?? '';
  if (sourceType === 'manual_verified') return 1000;
  const confidence = entry?.confidence ?? 'low';
  return DATA_CONFIDENCE_RANK[confidence] ?? 1;
}

function sourcePriority(source) {
  if (source?.type === 'manual_verified') return 1000;
  return DATA_CONFIDENCE_RANK[source?.confidence ?? 'low'] ?? 1;
}

function parseValidFrom(entry) {
  const dateStr = entry?.source?.validFrom ?? null;
  if (!dateStr) return 0;
  const ts = Date.parse(dateStr);
  return Number.isNaN(ts) ? 0 : ts;
}

function availabilityEntryKey(entry) {
  return `${entry.featureId}::${entry.trimId}`;
}

/**
 * @param {import('../../data/features/modelEquipmentSchema.js').ModelEquipmentProfile | null | undefined} existingProfile
 * @param {import('../../data/features/modelEquipmentSchema.js').ModelEquipmentProfile} importedProfile
 */
export function mergeImportedEquipmentProfile(existingProfile, importedProfile) {
  if (!existingProfile) {
    return {
      ...importedProfile,
      dataOrigin: importedProfile.dataOrigin ?? 'import',
    };
  }

  const entryMap = new Map();

  for (const entry of existingProfile.featureAvailability ?? []) {
    entryMap.set(availabilityEntryKey(entry), { ...entry });
  }

  for (const incoming of importedProfile.featureAvailability ?? []) {
    const key = availabilityEntryKey(incoming);
    const current = entryMap.get(key);
    if (!current) {
      entryMap.set(key, { ...incoming });
      continue;
    }

    const currentPriority = entryPriority(current);
    const incomingPriority = entryPriority(incoming);

    if (incomingPriority > currentPriority) {
      entryMap.set(key, { ...incoming });
      continue;
    }

    if (incomingPriority < currentPriority) {
      continue;
    }

    if (parseValidFrom(incoming) >= parseValidFrom(current)) {
      entryMap.set(key, { ...incoming });
    }
  }

  const trimMap = new Map((existingProfile.trims ?? []).map((t) => [t.id, t]));
  for (const trim of importedProfile.trims ?? []) {
    if (!trimMap.has(trim.id)) trimMap.set(trim.id, trim);
  }

  const packageMap = new Map((existingProfile.packages ?? []).map((p) => [p.id, p]));
  for (const pkg of importedProfile.packages ?? []) {
    if (!packageMap.has(pkg.id)) packageMap.set(pkg.id, pkg);
  }

  return {
    brand: existingProfile.brand ?? importedProfile.brand,
    model: existingProfile.model ?? importedProfile.model,
    modelKey: existingProfile.modelKey ?? importedProfile.modelKey,
    modelYear: existingProfile.modelYear ?? importedProfile.modelYear,
    trims: [...trimMap.values()],
    packages: [...packageMap.values()],
    technicalData: existingProfile.technicalData ?? importedProfile.technicalData ?? null,
    featureAvailability: [...entryMap.values()],
    sourceRefs: [...new Set([
      ...(existingProfile.sourceRefs ?? []),
      ...(importedProfile.sourceRefs ?? []),
    ])],
    source: sourcePriority(existingProfile.source) >= sourcePriority(importedProfile.source)
      ? existingProfile.source
      : importedProfile.source,
    dataOrigin: 'merged',
  };
}

/**
 * Convenience: Import normalisieren, mappen und optional registrieren.
 * @param {import('../../data/features/modelEquipmentSchema.js').EquipmentImportRecord} importData
 * @param {{ register?: boolean, mergeExisting?: boolean, dataOrigin?: string, importFile?: string, dedupeKey?: string }} [options]
 */
export function ingestEquipmentImport(importData, options = {}) {
  const mapped = mapImportToModelEquipmentProfile(importData);
  if (!mapped.validation.valid) {
    return { ...mapped, registered: false };
  }

  if (!options.register) {
    return { ...mapped, registered: false };
  }

  let profile = {
    ...mapped.profile,
    dataOrigin: options.dataOrigin ?? mapped.profile.dataOrigin ?? 'import',
    importFile: options.importFile ?? mapped.profile.importFile ?? null,
  };

  if (options.mergeExisting) {
    const existing = getImportedModelEquipmentProfile(profile.modelKey);
    if (existing) {
      profile = mergeImportedEquipmentProfile(existing, profile);
      if (options.dataOrigin && profile.dataOrigin === 'merged') {
        profile = {
          ...profile,
          importFile: options.importFile ?? profile.importFile ?? null,
        };
      }
    }
  }

  const existingUnknown = getImportedUnknownFeatures(profile.modelKey);
  const unknownFeatures = [...existingUnknown, ...mapped.unknownFeatures];

  registerModelEquipmentProfile(profile, unknownFeatures, {
    origin: options.dataOrigin ?? profile.dataOrigin ?? 'import',
    importFile: options.importFile ?? profile.importFile ?? null,
    dedupeKey: options.dedupeKey ?? null,
  });

  return { ...mapped, profile, unknownFeatures, registered: true };
}
