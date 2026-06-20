/**
 * Konfigurator-Brücke – jedes erkannte Modell bekommt Trims, Motor/Batterie, Pakete & Preise.
 * 1. Vollständige Hersteller-Registry (MANUFACTURER_MODELS)
 * 2. Fallback aus Preislisten-Import + TRIM_FEATURE_MAP + Händler-Paketen
 */
import PRICELIST_CATALOG from '../../data/kia/pricelist-imports/catalog.js';
import {
  TRIM_FEATURE_MAP,
  inferTrimFromTitle,
} from '../../data/features/trimFeatureMapping.js';
import { DEALER_TRIM_PACKAGES } from '../../data/dealer/dealerTrimPackages.js';
import { MANUFACTURER_MODELS } from '../../data/manufacturer/manufacturerRegistry.js';
import { getModelColorCatalog } from '../../data/manufacturer/configureModelColorCatalog.js';
import { parseBatteryKwhFromEngine } from '../../data/kia/pricelistBatteryLookup.js';
import { resolveFoundationLegacyEntry } from '../foundation/configuratorFoundationRegistry.js';

const TRIM_MAP_ALIASES = {
  'sportage-hybrid': 'sportage',
  'sportage-phev': 'sportage',
  'ev4-fastback': 'ev4',
  'ev5-gt': 'ev5',
  'ev6-gt': 'ev6',
  'ev9-gt': 'ev9',
};

const FALLBACK_CACHE = new Map();

function normalizeKey(modelKey) {
  return String(modelKey ?? '').trim().toLowerCase();
}

function trimMapKey(modelKey) {
  return TRIM_MAP_ALIASES[modelKey] ?? modelKey;
}

function trimIdFromLabel(label) {
  if (!label) return null;
  const inferred = inferTrimFromTitle(label);
  if (inferred) return inferred;
  return String(label).toLowerCase().replace(/\s+/g, '-');
}

function estimateRateFromPrice(priceGross) {
  if (!priceGross || priceGross <= 0) return null;
  return Math.max(99, Math.round(priceGross / 130));
}

function buildEnginesFromPricelist(pricelist) {
  const kwhOptions = [...new Set(
    (pricelist?.variants ?? [])
      .map((v) => parseBatteryKwhFromEngine(v.engine))
      .filter((kwh) => kwh != null),
  )].sort((a, b) => a - b);

  if (kwhOptions.length >= 2) {
    return kwhOptions.map((kwh, index) => ({
      id: index === 0 ? 'ev-std' : index === 1 ? 'ev-long' : `ev-battery-${String(kwh).replace('.', '-')}`,
      name: `${String(kwh).replace('.', ',')} kWh`,
      powerKw: null,
      rangeKm: null,
      batteryKwh: kwh,
    }));
  }

  if (kwhOptions.length === 1) {
    return [{
      id: 'ev-std',
      name: `${String(kwhOptions[0]).replace('.', ',')} kWh`,
      batteryKwh: kwhOptions[0],
    }];
  }

  const powertrain = pricelist?.powertrainVariant ?? '';
  if (/elektro|ev|battery/i.test(powertrain)) {
    return [{ id: 'ev-std', name: 'Elektro' }];
  }
  if (/hybrid|phev|plug/i.test(powertrain)) {
    return [{ id: 'hybrid', name: 'Hybrid' }];
  }
  if (/benzin|diesel|t-gdi|tgi|crdi/i.test(
    (pricelist?.variants ?? []).map((v) => v.engine).join(' '),
  )) {
    return [{ id: 'standard', name: 'Standard' }];
  }

  return [{ id: 'standard', name: 'Standard' }];
}

function engineIdForKwh(engines, kwh) {
  if (kwh == null) return engines[0]?.id ?? null;
  const exact = engines.find((e) => e.batteryKwh === kwh);
  if (exact) return exact.id;
  if (engines.length >= 2 && kwh <= 60) return engines[0].id;
  if (engines.length >= 2 && kwh > 60) return engines[1].id;
  return engines[0]?.id ?? null;
}

function buildVariants(modelKey, pricelist, engines, baseRates) {
  const variants = [];
  const seen = new Set();
  const allowedTrimIds = new Set([
    ...(pricelist?.trims ?? []).map((t) => t.id),
    ...(TRIM_FEATURE_MAP[trimMapKey(modelKey)]?.trims ?? []).map((t) => t.id),
  ]);

  function pushVariant(trimId, engineId, priceGross, baseLeasingRate) {
    if (!trimId || !priceGross || priceGross < 8000) return;
    if (allowedTrimIds.size && !allowedTrimIds.has(trimId)) return;
    const sig = `${trimId}|${engineId ?? ''}|${priceGross}`;
    if (seen.has(sig)) return;
    seen.add(sig);
    variants.push({
      id: `${modelKey}-${trimId}-${engineId ?? 'std'}-${priceGross}`,
      trimId,
      engineId: engineId ?? engines[0]?.id ?? 'standard',
      priceGross,
      baseLeasingRate: baseLeasingRate ?? estimateRateFromPrice(priceGross) ?? 299,
    });
  }

  for (const row of pricelist?.variants ?? []) {
    const trimId = row.trimId ?? trimIdFromLabel(row.trim);
    const kwh = parseBatteryKwhFromEngine(row.engine);
    pushVariant(
      trimId,
      engineIdForKwh(engines, kwh),
      row.priceGross,
      baseRates[trimId],
    );
  }

  for (const row of pricelist?.trimPricesFrom ?? []) {
    const trimId = row.trimId ?? trimIdFromLabel(row.trim);
    pushVariant(
      trimId,
      engines.length > 1 ? engines[engines.length - 1].id : engines[0]?.id,
      row.priceFromGross,
      baseRates[trimId],
    );
  }

  return variants;
}

function resolveModelColors(modelKey, dataColors) {
  if (dataColors?.length) return dataColors;
  return getModelColorCatalog(modelKey) ?? [];
}

function enrichManufacturerEntry(entry) {
  if (!entry?.data) return entry;
  const colors = resolveModelColors(entry.key ?? entry.data.modelKey, entry.data.colors);
  if (colors.length && !entry.data.colors?.length) {
    return {
      ...entry,
      data: { ...entry.data, colors },
    };
  }
  return entry;
}

function buildPackages(modelKey) {
  return (DEALER_TRIM_PACKAGES[modelKey] ?? []).map((pkg) => ({
    id: pkg.id,
    name: pkg.label,
    priceGross: pkg.priceGross ?? 0,
    rateDelta: Math.max(1, Math.round((pkg.priceGross ?? 0) / 100)),
    availableTrims: pkg.trimIds ?? [],
  }));
}

function buildTrims(modelKey, pricelist) {
  const trimMap = TRIM_FEATURE_MAP[trimMapKey(modelKey)];
  const byId = new Map();

  for (const trim of pricelist?.trims ?? []) {
    byId.set(trim.id, { id: trim.id, name: trim.name ?? trim.label ?? trim.id });
  }
  for (const trim of trimMap?.trims ?? []) {
    if (!byId.has(trim.id)) {
      byId.set(trim.id, { id: trim.id, name: trim.name });
    }
  }

  return [...byId.values()];
}

function buildFallbackManufacturerModel(modelKey) {
  const pricelist = PRICELIST_CATALOG[modelKey];
  const trimMap = TRIM_FEATURE_MAP[trimMapKey(modelKey)];
  const trims = buildTrims(modelKey, pricelist);

  if (!trims.length && !pricelist) return null;

  const packages = buildPackages(modelKey);
  const engines = buildEnginesFromPricelist(pricelist);
  const baseRates = trimMap?.baseRate ?? {};
  const variants = buildVariants(modelKey, pricelist, engines, baseRates);

  const defaultTrimId = trims.find((t) => t.id === 'earth')?.id
    ?? trims.find((t) => t.id === 'spirit')?.id
    ?? trims.find((t) => t.id === 'vision')?.id
    ?? trims[0]?.id
    ?? null;

  const defaultEngineId = engines.length > 1
    ? engines[engines.length - 1].id
    : engines[0]?.id
    ?? 'standard';

  const modelLabel = pricelist?.model
    ?? trimMap?.modelLabel?.replace(/^Kia\s+/i, '')
    ?? modelKey.toUpperCase();

  const data = {
    brand: pricelist?.brand ?? 'Kia',
    model: modelLabel,
    modelKey,
    colors: resolveModelColors(modelKey, null),
    trims: trims.map((trim) => ({
      ...trim,
      availablePackages: packages
        .filter((pkg) => !pkg.availableTrims?.length || pkg.availableTrims.includes(trim.id))
        .map((pkg) => pkg.id),
    })),
    packages,
    accessories: [],
    engines,
    variants,
  };

  return {
    key: modelKey,
    brand: data.brand,
    model: data.model,
    label: `Kia ${data.model}`,
    data,
    engine: modelKey.startsWith('sportage') ? 'sportage' : modelKey,
    defaultTrimId,
    defaultEngineId,
    _fallback: true,
  };
}

/**
 * Liefert Hersteller-Eintrag für den Konfigurator – Registry oder synthetischer Fallback.
 * @param {string} modelKey
 */
export function resolveConfigureModel(modelKey) {
  const key = normalizeKey(modelKey);
  if (!key) return null;

  const foundationEntry = resolveFoundationLegacyEntry(key);
  if (foundationEntry) return foundationEntry;

  if (MANUFACTURER_MODELS[key]) return enrichManufacturerEntry(MANUFACTURER_MODELS[key]);
  if (FALLBACK_CACHE.has(key)) return FALLBACK_CACHE.get(key);

  const built = buildFallbackManufacturerModel(key);
  if (built) FALLBACK_CACHE.set(key, built);
  return built ?? null;
}

/**
 * Modell-Key aus Marke/Modellbezeichnung – für Parser & Konfigurator.
 */
export function resolveConfigureModelKey(brand, model) {
  const m = String(model ?? '').toLowerCase();
  if (!m) return null;

  if (MANUFACTURER_MODELS[m]) return m;
  if (PRICELIST_CATALOG[m]) return m;
  if (TRIM_FEATURE_MAP[m]) return m;

  const catalogHit = Object.keys(PRICELIST_CATALOG).find((key) => m.includes(key.replace(/-/g, ' ')) || m.includes(key));
  if (catalogHit) return catalogHit;

  if (m.includes('ev2')) return 'ev2';
  if (m.includes('ev3')) return 'ev3';
  if (m.includes('ev4') && m.includes('fastback')) return 'ev4-fastback';
  if (m.includes('ev4')) return 'ev4';
  if (m.includes('ev5') && m.includes('gt')) return 'ev5-gt';
  if (m.includes('ev5')) return 'ev5';
  if (m.includes('ev6') && m.includes('gt')) return 'ev6-gt';
  if (m.includes('ev6')) return 'ev6';
  if (m.includes('ev9') && m.includes('gt')) return 'ev9-gt';
  if (m.includes('ev9')) return 'ev9';
  if (m.includes('sportage') && (m.includes('phev') || m.includes('plug-in'))) return 'sportage-phev';
  if (m.includes('sportage') && m.includes('hybrid')) return 'sportage-hybrid';
  if (m.includes('sportage')) return 'sportage';
  if (m.includes('sorento') && (m.includes('phev') || m.includes('plug-in'))) return 'sorento-phev';
  if (m.includes('sorento') && m.includes('hybrid')) return 'sorento-hybrid';
  if (m.includes('sorento')) return 'sorento';
  if (m.includes('picanto')) return 'picanto';
  if (m.includes('niro')) return 'niro';
  if (m.includes('ceed')) return 'ceed';
  if (m.includes('stonic')) return 'stonic';
  if (m.includes('seltos')) return 'seltos';
  if (m.includes('xceed')) return 'xceed';
  if (m.includes('k4') && m.includes('sportswagon')) return 'k4-sportswagon';
  if (m.includes('k4')) return 'k4';

  return m.replace(/\s+/g, '-');
}

export function listResolvableConfigureModelKeys() {
  const keys = new Set([
    ...Object.keys(MANUFACTURER_MODELS),
    ...Object.keys(PRICELIST_CATALOG),
    ...Object.keys(TRIM_FEATURE_MAP),
  ]);
  return [...keys].sort();
}
