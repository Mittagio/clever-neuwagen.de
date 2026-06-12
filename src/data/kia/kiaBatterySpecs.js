/**
 * Batteriekapazitäten – Fallback wenn Preislisten-PDF kein kWh im engine-Feld hat.
 * Quelle: Kia Deutschland Modellseiten / Preislisten, Stand 2026.
 */

/** @typedef {{ batteryGrossKwh?: number, batteryNetKwh?: number, batteryOptionsKwh?: number[] }} KiaBatterySpec */

/** @type {Record<string, KiaBatterySpec>} */
export const KIA_BATTERY_SPECS = {
  ev9: {
    batteryGrossKwh: 99.8,
    batteryNetKwh: 96,
    batteryOptionsKwh: [84, 99.8],
  },
  'ev9-gt': {
    batteryGrossKwh: 99.8,
    batteryNetKwh: 96,
  },
  'sportage-phev': {
    batteryGrossKwh: 13.8,
    batteryNetKwh: 13,
  },
  'sorento-phev': {
    batteryGrossKwh: 13.8,
    batteryNetKwh: 13,
  },
  'pv5-cargo': {
    batteryGrossKwh: 51.5,
    batteryOptionsKwh: [51.5, 71.2],
  },
  'pv5-cargo-l2h1': {
    batteryGrossKwh: 51.5,
    batteryOptionsKwh: [51.5, 71.2],
  },
  'pv5-crew': {
    batteryGrossKwh: 51.5,
    batteryOptionsKwh: [51.5, 71.2],
  },
  'pv5-chassis-cab': {
    batteryGrossKwh: 51.5,
    batteryOptionsKwh: [51.5, 71.2],
  },
};

/**
 * @param {string} modelKey
 * @returns {KiaBatterySpec | null}
 */
export function getKiaBatterySpec(modelKey) {
  return KIA_BATTERY_SPECS[modelKey] ?? null;
}
