/**
 * Batteriekapazität aus offiziellen Kia-Preislisten (PDF-Import) + Stammdaten-Fallback.
 */
import PRICELIST_CATALOG from './pricelist-imports/catalog.js';
import { getKiaBatterySpec } from './kiaBatterySpecs.js';

/** Modell-Keys ohne eigene kWh in der PDF → andere Preisliste nutzen */
const PRICELIST_MODEL_ALIASES = {
  'pv5-cargo': ['pv5-cargo-l2h1', 'pv5-passenger'],
  'pv5-cargo-l2h1': ['pv5-passenger'],
  'pv5-crew': ['pv5-passenger'],
  'pv5-chassis-cab': ['pv5-passenger'],
};

/**
 * @param {string} engine
 * @returns {number|null}
 */
export function parseBatteryKwhFromEngine(engine) {
  const text = String(engine ?? '');
  const labeled = text.match(/(\d+(?:[,.]\d+)?)-kWh-Batterie/i);
  if (labeled) {
    return parseFloat(labeled[1].replace(',', '.'));
  }
  return null;
}

/**
 * @param {string} modelKey
 * @returns {{ batteryGrossKwh: number, batteryNetKwh?: number, batteryOptionsKwh: number[] }|null}
 */
function lookupPricelistBattery(modelKey) {
  const entry = PRICELIST_CATALOG[modelKey];
  if (!entry?.variants?.length) return null;

  const options = [...new Set(
    entry.variants
      .map((v) => parseBatteryKwhFromEngine(v.engine))
      .filter((kwh) => kwh != null),
  )].sort((a, b) => a - b);

  if (options.length === 0) return null;

  return {
    batteryGrossKwh: options[0],
    batteryOptionsKwh: options,
  };
}

/**
 * @param {string} modelKey
 * @returns {{ batteryGrossKwh: number, batteryNetKwh?: number, batteryOptionsKwh: number[] }|null}
 */
export function getPricelistBatteryKwh(modelKey) {
  const keys = [modelKey, ...(PRICELIST_MODEL_ALIASES[modelKey] ?? [])];
  for (const key of keys) {
    const found = lookupPricelistBattery(key);
    if (found) return found;
  }
  return null;
}

/**
 * Preisliste → Stammdaten-Fallback.
 * @param {string} modelKey
 */
export function resolveBatteryForModelKey(modelKey) {
  const fromList = getPricelistBatteryKwh(modelKey);
  if (fromList) return { ...fromList, batterySource: 'pricelist' };

  const fromSpec = getKiaBatterySpec(modelKey);
  if (!fromSpec) return null;

  const options = fromSpec.batteryOptionsKwh
    ?? (fromSpec.batteryGrossKwh != null ? [fromSpec.batteryGrossKwh] : null);

  return {
    batteryGrossKwh: fromSpec.batteryGrossKwh ?? options?.[0] ?? null,
    batteryNetKwh: fromSpec.batteryNetKwh,
    batteryOptionsKwh: options ?? undefined,
    batterySource: 'spec',
  };
}

/**
 * Clever-Record-Elektrodaten mit Batterie-kWh anreichern.
 * @param {object} record
 * @returns {object}
 */
export function resolveElectricSpecs(record) {
  const electric = { ...(record?.electric ?? {}) };

  if (electric.batteryNetKwh != null || electric.batteryGrossKwh != null) {
    if (!electric.batteryOptionsKwh) {
      const kwh = electric.batteryGrossKwh ?? electric.batteryNetKwh;
      if (kwh != null) {
        return { ...electric, batteryOptionsKwh: [kwh] };
      }
    }
    return electric;
  }

  const resolved = resolveBatteryForModelKey(record?.modelKey);
  if (!resolved) return electric;

  return {
    ...electric,
    batteryGrossKwh: resolved.batteryGrossKwh,
    batteryNetKwh: resolved.batteryNetKwh ?? electric.batteryNetKwh,
    batteryOptionsKwh: resolved.batteryOptionsKwh,
    batterySource: resolved.batterySource,
  };
}
