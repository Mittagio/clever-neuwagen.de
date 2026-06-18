/**
 * Layer 2: Modell-Ausstattungsdaten & Feature-Verfügbarkeit.
 * Einheitliche API für Trim-Mapping, Herstellerdaten, technische Quellen und Import-Vorbereitung.
 */
import { getPackagesForTrim } from '../../data/dealer/dealerTrimPackages.js';
import {
  FEATURE_AVAILABILITY_STATUS as S,
} from '../../data/features/modelEquipmentSchema.js';
import {
  getGlobalFeatureById,
  resolveLegacyFeatureId,
} from '../../data/features/globalFeatureCatalog.js';
import { getModelTrims, normalizeModelKey } from '../../data/features/trimFeatureMapping.js';
import { CLEVER_FEATURE_STATUS as CS } from '../../data/clever/cleverVehicleRecord.js';
import {
  getManufacturerModel,
  getManufacturerPackages,
  getManufacturerTrims,
} from '../../data/manufacturer/manufacturerRegistry.js';
import { getCleverRecordForModelKey } from '../admin/vehicleStammdatenOverrideService.js';
import { resolveWishConfiguration } from '../configurator/wishPackageResolver.js';
import { getImportedModelEquipmentProfile } from './equipmentImportRegistry.js';

function resolveTrimFeatureStatus(trim, legacyFeatureId) {
  if (trim.standardFeatures?.includes(legacyFeatureId)) return S.STANDARD;
  if (trim.availableViaPackage?.includes(legacyFeatureId)) return S.PACKAGE_REQUIRED;
  if (trim.notAvailable?.includes(legacyFeatureId)) return S.NOT_AVAILABLE;
  return S.UNKNOWN;
}

function resolveManufacturerFeatureStatus(brand, model, trimId, legacyFeatureId) {
  const res = resolveWishConfiguration({
    brand,
    model,
    trimId,
    wishFeatureIds: [legacyFeatureId],
  });
  if (!res) return S.UNKNOWN;
  if (res.matchedFeatures.includes(legacyFeatureId)) return S.STANDARD;
  if (res.viaPackageFeatures?.some((v) => v.wishId === legacyFeatureId)) return S.PACKAGE_REQUIRED;
  if (res.missingFeatures.includes(legacyFeatureId)) return S.NOT_AVAILABLE;
  if (res.uncertainFeatures.includes(legacyFeatureId)) return S.UNKNOWN;
  return S.UNKNOWN;
}

function cleverStatusToAvailability(status) {
  if (status === CS.STANDARD) return S.STANDARD;
  if (status === CS.PACKAGE || status === CS.ACCESSORY) return S.PACKAGE_REQUIRED;
  if (status === CS.MISSING) return S.NOT_AVAILABLE;
  return S.UNKNOWN;
}

function modelHasElectricPowertrain(modelKey, featureIds) {
  if (featureIds?.has?.('elektro')) return true;
  const record = getCleverRecordForModelKey(modelKey);
  if (record?.electric?.batteryNetKwh > 0) return true;
  if (record?.powertrainType === 'electric' || record?.powertrainType === 'ev') return true;
  return false;
}

function collectModelLegacyFeatureIds(brand, model, modelKey) {
  const mfg = getManufacturerModel(brand, model);
  const ids = new Set();

  if (mfg) {
    for (const trim of getManufacturerTrims(mfg.key)) {
      (trim.standardFeatures ?? []).forEach((id) => ids.add(id));
      (trim.availableViaPackage ?? []).forEach((id) => ids.add(id));
      (trim.notAvailable ?? []).forEach((id) => ids.add(id));
    }
    return ids;
  }

  const key = modelKey ?? normalizeModelKey(brand, model);
  for (const trim of getModelTrims(key)) {
    (trim.standardFeatures ?? []).forEach((id) => ids.add(id));
    (trim.availableViaPackage ?? []).forEach((id) => ids.add(id));
    (trim.notAvailable ?? []).forEach((id) => ids.add(id));
  }
  return ids;
}

/**
 * Technische Verfügbarkeit aus model technicalData (Clever-Records / Import).
 * Markenneutral: liest nur strukturierte Felder, keine Modellnamen-Heuristiken.
 */
function resolveTechnicalDataAvailability(globalFeatureId, modelKey, legacyFeatureIds) {
  const record = getCleverRecordForModelKey(modelKey);
  if (!record) return null;

  const electric = record.electric ?? {};
  const comfort = record.comfort ?? {};
  const isElectric = modelHasElectricPowertrain(modelKey, legacyFeatureIds);

  if (globalFeatureId === 'v2l') {
    if (electric.v2l === true) return { status: S.STANDARD, confidence: 'high', sourceRef: 'technicalData.electric.v2l' };
    if (electric.v2l === false) return { status: S.NOT_AVAILABLE, confidence: 'high', sourceRef: 'technicalData.electric.v2l' };
    if (isElectric) return { status: S.OPTIONAL, confidence: 'medium', sourceRef: 'technicalData.electric.inferred' };
    return null;
  }
  if (globalFeatureId === 'v2g') {
    if (electric.v2g === true) return { status: S.STANDARD, confidence: 'high', sourceRef: 'technicalData.electric.v2g' };
    if (electric.v2g === false) return { status: S.NOT_AVAILABLE, confidence: 'high', sourceRef: 'technicalData.electric.v2g' };
    return null;
  }
  if (globalFeatureId === 'waermepumpe') {
    if (electric.heatPump === true) return { status: S.STANDARD, confidence: 'high', sourceRef: 'technicalData.electric.heatPump' };
    if (electric.heatPump === false) return { status: S.NOT_AVAILABLE, confidence: 'high', sourceRef: 'technicalData.electric.heatPump' };
    return null;
  }
  if (globalFeatureId === 'matrix_led') {
    const status = cleverStatusToAvailability(comfort.matrixLed);
    if (status !== S.UNKNOWN) {
      return { status, confidence: 'medium', sourceRef: 'technicalData.comfort.matrixLed' };
    }
    return null;
  }
  if (globalFeatureId === 'led_scheinwerfer') {
    const matrix = cleverStatusToAvailability(comfort.matrixLed);
    if (matrix === S.STANDARD || matrix === S.PACKAGE_REQUIRED) {
      return { status: S.STANDARD, confidence: 'medium', sourceRef: 'technicalData.comfort.matrixLed' };
    }
    if (matrix === S.NOT_AVAILABLE) {
      return { status: S.NOT_AVAILABLE, confidence: 'medium', sourceRef: 'technicalData.comfort.matrixLed' };
    }
    if (isElectric) return { status: S.OPTIONAL, confidence: 'low', sourceRef: 'technicalData.electric.inferred' };
    return null;
  }
  if (globalFeatureId === 'led_rueckleuchten') {
    if (isElectric) return { status: S.OPTIONAL, confidence: 'low', sourceRef: 'technicalData.electric.inferred' };
    const matrix = cleverStatusToAvailability(comfort.matrixLed);
    if (matrix !== S.UNKNOWN) {
      return { status: S.OPTIONAL, confidence: 'low', sourceRef: 'technicalData.comfort.matrixLed' };
    }
    return null;
  }
  if (globalFeatureId === 'reichweite_400' || globalFeatureId === 'reichweite_500') {
    const range = electric.wltpRangeKm ?? record.rangeKm ?? null;
    if (range == null) return null;
    const threshold = globalFeatureId === 'reichweite_500' ? 500 : 400;
    return {
      status: range >= threshold ? S.STANDARD : S.NOT_AVAILABLE,
      confidence: 'medium',
      sourceRef: 'technicalData.electric.wltpRangeKm',
    };
  }
  if (globalFeatureId === 'achthundert_volt') {
    if (electric.voltageArchitecture === '800V' || electric.is800V === true) {
      return { status: S.STANDARD, confidence: 'high', sourceRef: 'technicalData.electric.voltageArchitecture' };
    }
    if (electric.is800V === false) {
      return { status: S.NOT_AVAILABLE, confidence: 'high', sourceRef: 'technicalData.electric.voltageArchitecture' };
    }
    return null;
  }

  return null;
}

function getTrimsForModel(brand, model, modelKey) {
  const mfg = getManufacturerModel(brand, model);
  if (mfg) {
    return getManufacturerTrims(mfg.key).map((t) => ({
      id: t.id,
      name: t.name,
      source: 'manufacturer',
      raw: t,
    }));
  }
  const key = modelKey ?? normalizeModelKey(brand, model);
  return getModelTrims(key).map((t) => ({
    id: t.id,
    name: t.name,
    source: 'mapping',
    raw: t,
  }));
}

function buildPackageListForTrim(brand, model, modelKey, trimId, trimSource) {
  const key = modelKey ?? normalizeModelKey(brand, model);
  if (trimSource === 'mapping') {
    return getPackagesForTrim(key, trimId);
  }
  const mfg = getManufacturerModel(brand, model);
  return getManufacturerPackages(mfg?.key ?? '').filter((p) => p.availableTrims?.includes(trimId));
}

function aggregateModelStatus(entries) {
  if (!entries.length) return S.UNKNOWN;
  if (entries.some((e) => e.status === S.STANDARD)) return S.STANDARD;
  if (entries.some((e) => e.status === S.AVAILABLE)) return S.AVAILABLE;
  if (entries.some((e) => e.status === S.OPTIONAL)) return S.OPTIONAL;
  if (entries.some((e) => e.status === S.PACKAGE_REQUIRED)) return S.PACKAGE_REQUIRED;
  if (entries.length > 0 && entries.every((e) => e.status === S.NOT_AVAILABLE)) return S.NOT_AVAILABLE;
  if (entries.some((e) => e.status === S.UNKNOWN)) return S.UNKNOWN;
  return S.UNKNOWN;
}

function resolveFromImportedProfile(profile, globalFeatureId, featureLabel) {
  const entries = (profile.featureAvailability ?? []).filter((e) => e.featureId === globalFeatureId);
  if (!entries.length) return null;

  const trimNameById = new Map((profile.trims ?? []).map((t) => [t.id, t.name]));
  const packageNameById = new Map((profile.packages ?? []).map((p) => [p.id, p.name]));

  const normalizedEntries = entries.map((entry) => ({
    ...entry,
    trimName: entry.trimName ?? trimNameById.get(entry.trimId) ?? entry.trimId,
    packageName: entry.packageName ?? (entry.packageId ? packageNameById.get(entry.packageId) : null),
    trimSource: 'import',
  }));

  const sourceRefs = [...new Set(
    normalizedEntries
      .map((e) => e.sourceRef?.document ?? (typeof e.sourceRef === 'string' ? e.sourceRef : null))
      .filter(Boolean),
  )];

  const modelStatus = aggregateModelStatus(normalizedEntries);
  const confidence = normalizedEntries.some((e) => e.confidence === 'high')
    ? 'high'
    : normalizedEntries.some((e) => e.confidence === 'medium')
      ? 'medium'
      : 'low';

  return {
    featureId: globalFeatureId,
    label: featureLabel,
    modelStatus,
    entries: normalizedEntries,
    availableTrims: toCustomerTrims(normalizedEntries),
    availablePackages: toCustomerPackagesFromImport(normalizedEntries, profile),
    confidence,
    sourceRefs: sourceRefs.length ? sourceRefs : ['import'],
  };
}

function toCustomerPackagesFromImport(entries, profile) {
  const packages = [];
  const packageNameById = new Map((profile.packages ?? []).map((p) => [p.id, p.name]));
  for (const entry of entries) {
    if (entry.status !== S.PACKAGE_REQUIRED || !entry.packageId) continue;
    packages.push({
      id: entry.packageId,
      name: entry.packageName ?? packageNameById.get(entry.packageId) ?? entry.packageId,
      trimId: entry.trimId,
    });
  }
  return [...new Map(packages.map((p) => [p.id, p])).values()];
}

function toCustomerTrims(entries) {
  return entries
    .filter((e) => [S.STANDARD, S.AVAILABLE, S.OPTIONAL, S.PACKAGE_REQUIRED].includes(e.status))
    .map((e) => ({
      trimId: e.trimId,
      trimName: e.trimName,
      via: e.status === S.PACKAGE_REQUIRED
        ? 'package'
        : (e.status === S.OPTIONAL || e.status === S.AVAILABLE ? 'optional' : 'standard'),
    }));
}

function toCustomerPackages(entries, brand, model, modelKey) {
  const packages = [];
  for (const entry of entries) {
    if (entry.status !== S.PACKAGE_REQUIRED || !entry.packageId) continue;
    packages.push({
      id: entry.packageId,
      name: entry.packageName ?? entry.packageId,
      trimId: entry.trimId,
    });
  }
  if (packages.length) return [...new Map(packages.map((p) => [p.id, p])).values()];

  for (const entry of entries.filter((e) => e.status === S.PACKAGE_REQUIRED)) {
    const pkgs = buildPackageListForTrim(brand, model, modelKey, entry.trimId, entry.trimSource);
    for (const pkg of pkgs) {
      packages.push({
        id: pkg.id,
        name: pkg.name ?? pkg.label,
        trimId: entry.trimId,
      });
    }
  }
  return [...new Map(packages.map((p) => [p.id, p])).values()];
}

/**
 * @returns {import('../../data/features/modelEquipmentSchema.js').ResolvedModelFeatureAvailability | null}
 */
export function resolveModelFeatureAvailability(brand, model, modelKey, globalFeatureId) {
  const feature = getGlobalFeatureById(globalFeatureId);
  if (!feature) return null;

  const key = modelKey ?? normalizeModelKey(brand, model);
  const importedProfile = getImportedModelEquipmentProfile(key);
  if (importedProfile?.featureAvailability?.length) {
    const imported = resolveFromImportedProfile(importedProfile, feature.id, feature.label);
    if (imported) return imported;
  }

  const legacyFeatureId = resolveLegacyFeatureId(feature);
  const legacyFeatureIds = collectModelLegacyFeatureIds(brand, model, key);
  const trims = getTrimsForModel(brand, model, key);
  const entries = [];
  const sourceRefs = [];

  if (legacyFeatureId && legacyFeatureIds.has(legacyFeatureId)) {
    for (const trim of trims) {
      let status = S.UNKNOWN;
      if (trim.source === 'mapping' && trim.raw) {
        status = resolveTrimFeatureStatus(trim.raw, legacyFeatureId);
      } else {
        status = resolveManufacturerFeatureStatus(brand, model, trim.id, legacyFeatureId);
      }

      if (status === S.UNKNOWN) continue;

      let packageId = null;
      let packageName = null;
      if (status === S.PACKAGE_REQUIRED) {
        const pkgs = buildPackageListForTrim(brand, model, key, trim.id, trim.source);
        const match = pkgs.find((pkg) => (pkg.features ?? []).includes(legacyFeatureId));
        packageId = match?.id ?? null;
        packageName = match?.name ?? match?.label ?? null;
      }

      entries.push({
        featureId: feature.id,
        trimId: trim.id,
        trimName: trim.name,
        status,
        packageId,
        packageName,
        sourceRef: trim.source === 'mapping' ? 'trimFeatureMapping' : 'manufacturerRegistry',
        confidence: 'high',
        trimSource: trim.source,
      });
    }
    if (trims.length) {
      sourceRefs.push(trims[0].source === 'mapping' ? 'trimFeatureMapping' : 'manufacturerRegistry');
    }
  }

  if (!entries.length) {
    const technical = resolveTechnicalDataAvailability(feature.id, key, legacyFeatureIds);
    if (technical) {
      sourceRefs.push(technical.sourceRef);
      for (const trim of trims) {
        entries.push({
          featureId: feature.id,
          trimId: trim.id,
          trimName: trim.name,
          status: technical.status,
          sourceRef: technical.sourceRef,
          confidence: technical.confidence,
          trimSource: trim.source,
        });
      }
    }
  }

  const modelStatus = aggregateModelStatus(entries);
  const confidence = entries.some((e) => e.confidence === 'high')
    ? 'high'
    : entries.some((e) => e.confidence === 'medium')
      ? 'medium'
      : 'low';

  return {
    featureId: feature.id,
    label: feature.label,
    modelStatus,
    entries,
    availableTrims: toCustomerTrims(entries),
    availablePackages: toCustomerPackages(entries, brand, model, key),
    confidence,
    sourceRefs: [...new Set(sourceRefs)],
  };
}

/**
 * Profil für Import / Debugging – skalierbar auf 1000+ Modelle.
 */
export function getModelEquipmentProfile(brand, model, modelKey) {
  const key = modelKey ?? normalizeModelKey(brand, model);
  const importedProfile = getImportedModelEquipmentProfile(key);
  if (importedProfile) {
    return { ...importedProfile };
  }

  const trims = getTrimsForModel(brand, model, key);
  const cleverRecord = getCleverRecordForModelKey(key);

  const packages = [];
  for (const trim of trims) {
    for (const pkg of buildPackageListForTrim(brand, model, key, trim.id, trim.source)) {
      if (!packages.some((p) => p.id === pkg.id)) {
        packages.push({
          id: pkg.id,
          name: pkg.name ?? pkg.label,
          description: pkg.description ?? pkg.highlights?.join(', '),
          trimIds: pkg.trimIds ?? pkg.availableTrims ?? [trim.id],
          featureIds: pkg.features ?? [],
        });
      }
    }
  }

  return {
    brand,
    model,
    modelKey: key,
    modelYear: cleverRecord?.modelYear ?? null,
    trims: trims.map((t) => ({ id: t.id, name: t.name })),
    packages,
    technicalData: {
      electric: cleverRecord?.electric ?? null,
      comfort: cleverRecord?.comfort ?? null,
    },
    featureAvailability: [],
    sourceRefs: [
      trims[0]?.source === 'mapping' ? 'trimFeatureMapping' : 'manufacturerRegistry',
      cleverRecord ? 'technicalData' : null,
    ].filter(Boolean),
  };
}

/** Abwärtskompatibilität für bestehende Aufrufer mit legacy featureCatalog-IDs */
export function resolveFeatureAvailabilityForModel(brand, model, modelKey, featureId) {
  const globalFeature = getGlobalFeatureById(featureId);
  const globalId = globalFeature?.id ?? featureId;
  const resolved = resolveModelFeatureAvailability(brand, model, modelKey, globalId);
  if (!resolved) {
    return { availableTrims: [], availablePackages: [], modelStatus: 'unknown' };
  }

  let modelStatus = 'unknown';
  if (resolved.modelStatus === S.STANDARD || resolved.modelStatus === S.AVAILABLE) {
    modelStatus = 'available';
  } else if (resolved.modelStatus === S.OPTIONAL) {
    modelStatus = 'available';
  } else if (resolved.modelStatus === S.PACKAGE_REQUIRED) {
    modelStatus = 'package_required';
  } else if (resolved.modelStatus === S.NOT_AVAILABLE) {
    modelStatus = 'not_available';
  }

  return {
    availableTrims: resolved.availableTrims,
    availablePackages: resolved.availablePackages,
    modelStatus,
    confidence: resolved.confidence,
    sourceRefs: resolved.sourceRefs,
  };
}
