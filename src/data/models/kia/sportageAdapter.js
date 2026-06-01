import { kiaSportage } from './sportage.js';
import { getUpeOverride } from '../../vehicleCatalogStore.js';

/** Abwärtskompatibilität für Bestandsdaten (Inventory, Sales, Demo) */
export const LEGACY_ENGINE_MAP = {
  'mhev-150': 'tgi-hybrid-2wd',
  'phev-265': 'tgi-hybrid-awd',
  'diesel-136': 'crdi-dct-2wd',
};

export const LEGACY_TRIM_MAP = {
  pulse: 'spirit',
};

export const LEGACY_COLOR_MAP = {
  'snow-white': 'carraraweiss',
  'steel-grey': 'wolfgrau',
  'ocean-blue': 'blueflame',
  'runway-red': 'magmarot',
  'panthera-black': 'zilinaschwarz',
};

export const LEGACY_PACKAGE_MAP = {
  winter: 'p1-comfort',
  assist: 'p5-drivewise',
  comfort: 'p4-panorama',
  tech: 'p3-sound',
};

export function resolveEngineId(engineId) {
  return LEGACY_ENGINE_MAP[engineId] ?? engineId;
}

export function resolveTrimId(trimId) {
  return LEGACY_TRIM_MAP[trimId] ?? trimId;
}

export function resolveColorId(colorId) {
  return LEGACY_COLOR_MAP[colorId] ?? colorId;
}

export function resolvePackageId(packageId) {
  return LEGACY_PACKAGE_MAP[packageId] ?? packageId;
}

export function resolveConfigIds(config = {}) {
  return {
    ...config,
    engineId: resolveEngineId(config.engineId),
    trimId: resolveTrimId(config.trimId),
    colorId: resolveColorId(config.colorId),
    selectedPackageIds: (config.selectedPackageIds ?? []).map(resolvePackageId),
  };
}

export function getVariant(trimId, engineId) {
  const trim = resolveTrimId(trimId);
  const engine = resolveEngineId(engineId);
  return kiaSportage.variants.find(
    (v) => v.trimId === trim && v.engineId === engine && v.available,
  ) ?? null;
}

export function getVariantPrice(trimId, engineId) {
  const override = getUpeOverride('kia', 'sportage', trimId);
  if (override != null) return override;
  return getVariant(trimId, engineId)?.priceGross ?? 0;
}

/** Alias für bestehende priceCalculator-/Listing-Logik */
export function getUpe(trimId, engineId) {
  return getVariantPrice(trimId, engineId);
}

export function getAvailableEnginesForTrim(trimId) {
  const trim = kiaSportage.trims.find((t) => t.id === resolveTrimId(trimId));
  if (!trim) return [];
  return kiaSportage.engines.filter((e) => trim.availableEngines.includes(e.id));
}

export function getAvailableColorsForTrim(trimId) {
  const id = resolveTrimId(trimId);
  return kiaSportage.colors.filter(
    (c) => c.availableTrims.includes(id) || c.availableTrims.includes('all'),
  );
}

export function getAvailablePackagesForTrim(trimId) {
  const id = resolveTrimId(trimId);
  return kiaSportage.packages.filter(
    (p) => p.availableTrims.includes(id) && !p.excludedTrims.includes(id),
  );
}

export function getVariantById(variantId) {
  return kiaSportage.variants.find((v) => v.id === variantId && v.available) ?? null;
}

export function getAvailableAccessoriesForTrim(trimId) {
  const id = resolveTrimId(trimId);
  return kiaSportage.accessories.filter(
    (a) => a.availableTrims.includes(id) || a.availableTrims.includes('all'),
  );
}

/**
 * Prüft, ob ein Paket für Trim + Motor wählbar ist.
 * @returns {{ allowed: boolean, reason?: string }}
 */
export function getPackageAvailability(pkg, trimId, engineId, selectedPackageIds = []) {
  if (!pkg) return { allowed: false, reason: 'Paket nicht gefunden' };

  const trim = resolveTrimId(trimId);
  const engine = resolveEngineId(engineId);

  if (pkg.excludedTrims.includes(trim)) {
    return { allowed: false, reason: 'Paket für diese Ausstattung nicht verfügbar' };
  }
  if (!pkg.availableTrims.includes(trim)) {
    return { allowed: false, reason: 'Paket für diese Ausstattung nicht verfügbar' };
  }
  if (pkg.engineRestrictions.length > 0 && !pkg.engineRestrictions.includes(engine)) {
    return { allowed: false, reason: 'Paket nicht für diese Motorisierung verfügbar' };
  }
  for (const reqId of pkg.requiredPackages ?? []) {
    if (!selectedPackageIds.includes(reqId)) {
      const req = kiaSportage.packages.find((p) => p.id === reqId);
      return {
        allowed: false,
        reason: req ? `Erfordert ${req.name}` : 'Voraussetzung nicht erfüllt',
      };
    }
  }
  return { allowed: true };
}

/**
 * @returns {{ allowed: boolean, reason?: string }}
 */
export function getAccessoryAvailability(acc, trimId, engineId) {
  if (!acc) return { allowed: false, reason: 'Zubehör nicht gefunden' };

  const trim = resolveTrimId(trimId);
  const engine = resolveEngineId(engineId);

  if (!acc.availableTrims.includes(trim) && !acc.availableTrims.includes('all')) {
    return { allowed: false, reason: 'Zubehör für diese Ausstattung nicht verfügbar' };
  }
  if (acc.id === 'acc-standheizung' && engine.includes('hybrid')) {
    return { allowed: false, reason: 'Nicht mit Hybrid kombinierbar' };
  }
  if (acc.id === 'acc-abgasanlage' && !engine.startsWith('tgi-')) {
    return { allowed: false, reason: 'Nur für T-GDI-Benziner' };
  }
  return { allowed: true };
}

/** Pakete inkl. Verfügbarkeitsstatus für Konfigurator */
export function getPackagesWithAvailability(trimId, engineId, selectedPackageIds = []) {
  const trim = kiaSportage.trims.find((t) => t.id === resolveTrimId(trimId));
  const packageIds = trim?.availablePackages ?? [];
  return packageIds
    .map((id) => kiaSportage.packages.find((p) => p.id === id))
    .filter(Boolean)
    .map((pkg) => ({
      ...pkg,
      availability: getPackageAvailability(pkg, trimId, engineId, selectedPackageIds),
    }));
}

/** Zubehör inkl. Verfügbarkeitsstatus */
export function getAccessoriesWithAvailability(trimId, engineId) {
  return kiaSportage.accessories.map((acc) => ({
    ...acc,
    availability: getAccessoryAvailability(acc, trimId, engineId),
  }));
}

export function getFeatureById(featureId) {
  return kiaSportage.equipment.find((f) => f.id === featureId) ?? null;
}

export function getEquipmentForTrim(trimId) {
  const id = resolveTrimId(trimId);
  const trim = kiaSportage.trims.find((t) => t.id === id);
  if (!trim) return { standard: [], optional: [] };

  const standard = trim.baseEquipment
    .map((fid) => getFeatureById(fid)?.name)
    .filter(Boolean);

  const optional = getAvailablePackagesForTrim(id).map((p) => p.name);

  return { standard, optional, featureIds: trim.baseEquipment };
}

export function getWltpForEngine(engineId) {
  const id = resolveEngineId(engineId);
  const entry = kiaSportage.wltp.find((w) => w.engineId === id);
  const engine = kiaSportage.engines.find((e) => e.id === id);
  if (!entry && !engine) return null;

  return {
    engineId: id,
    consumptionCombined: entry?.consumptionCombined ?? engine?.consumptionCombined,
    co2Combined: { min: entry?.co2 ?? engine?.co2, max: entry?.co2 ?? engine?.co2, unit: 'g/km' },
    efficiencyClass: entry?.efficiencyClass ?? engine?.co2Class,
    co2Class: entry?.co2Class ?? engine?.co2Class,
  };
}

function toLegacyEngine(engine) {
  return {
    ...engine,
    power: engine.powerPs,
    powerUnit: 'PS',
    fuel: engine.fuelType,
  };
}

function toLegacyColor(color) {
  return {
    ...color,
    hex: color.hexPreview,
    price: color.priceGross,
    type: color.type === 'solid' ? 'Uni' : color.type === 'twoTone' ? 'Zweifarbig' : 'Metallic',
  };
}

function toLegacyPackage(pkg) {
  return {
    ...pkg,
    price: pkg.priceGross,
  };
}

function buildLegacyUpe() {
  return kiaSportage.variants
    .filter((v) => v.available)
    .map((v) => ({
      trimId: v.trimId,
      engineId: v.engineId,
      price: v.priceGross,
    }));
}

function buildLegacyEquipmentObject() {
  return Object.fromEntries(
    kiaSportage.trims.map((trim) => [trim.id, getEquipmentForTrim(trim.id)]),
  );
}

function buildLegacyWltpExtended() {
  return kiaSportage.wltp.map((w) => ({
    engineId: w.engineId,
    consumptionCombined: { min: parseFloat(w.consumptionCombined), max: parseFloat(w.consumptionCombined), unit: 'l/100 km' },
    co2Combined: { min: w.co2, max: w.co2, unit: 'g/km' },
    efficiencyClass: w.efficiencyClass,
    electricRange: null,
  }));
}

/** Legacy-Objekt für bestehende Komponenten, die sportage.upe etc. erwarten */
export function buildLegacySportage() {
  return {
    ...kiaSportage,
    modelYear: Number(kiaSportage.modelYear) || kiaSportage.modelYear,
    engines: kiaSportage.engines.map(toLegacyEngine),
    colors: kiaSportage.colors.map(toLegacyColor),
    packages: kiaSportage.packages.map(toLegacyPackage),
    upe: buildLegacyUpe(),
    equipment: buildLegacyEquipmentObject(),
    wltp: buildLegacyWltpExtended(),
  };
}

export { kiaSportage };
