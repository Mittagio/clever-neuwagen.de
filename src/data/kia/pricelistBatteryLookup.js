/**
 * Batteriekapazität aus offiziellen Kia-Preislisten (PDF-Import).
 */
import PRICELIST_CATALOG from './pricelist-imports/catalog.js';

/**
 * @param {string} engine
 * @returns {number|null}
 */
export function parseBatteryKwhFromEngine(engine) {
  const m = String(engine ?? '').match(/(\d+(?:[,.]\d+)?)-kWh-Batterie/i);
  if (!m) return null;
  return parseFloat(m[1].replace(',', '.'));
}

/**
 * @param {string} modelKey
 * @returns {{ batteryGrossKwh: number, batteryOptionsKwh: number[] }|null}
 */
export function getPricelistBatteryKwh(modelKey) {
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
 * Clever-Record-Elektrodaten mit Preislisten-kWh anreichern.
 * @param {object} record
 * @returns {object}
 */
export function resolveElectricSpecs(record) {
  const electric = { ...(record?.electric ?? {}) };

  if (electric.batteryNetKwh != null || electric.batteryGrossKwh != null) {
    return electric;
  }

  const fromList = getPricelistBatteryKwh(record?.modelKey);
  if (!fromList) return electric;

  return {
    ...electric,
    batteryGrossKwh: fromList.batteryGrossKwh,
    batteryOptionsKwh: fromList.batteryOptionsKwh,
    batterySource: 'pricelist',
  };
}
