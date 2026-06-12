/**
 * Leistung, Verbrauch, Antrieb – Kia DE Referenz (WLTP, Einstiegsvariante).
 * Quelle: Kia Deutschland Modellseiten / Preislisten, Stand 2026.
 */

/** @typedef {'FWD'|'RWD'|'AWD'} DriveType */

/**
 * @typedef {object} KiaPerformanceSpec
 * @property {number} [powerKw]
 * @property {number} [powerPs]
 * @property {number} [acceleration0_100Sec]
 * @property {number} [consumptionKwhPer100] – Strom WLTP kombiniert
 * @property {number} [consumptionLPer100] – Kraftstoff WLTP kombiniert
 * @property {DriveType} [driveType]
 */

export const KIA_WARRANTY_DEFAULT = {
  vehicleYears: 7,
  vehicleKm: 150_000,
  batteryYears: 7,
};

/** @type {Record<string, KiaPerformanceSpec>} */
export const KIA_PERFORMANCE_SPECS = {
  picanto: { powerPs: 67, powerKw: 49, acceleration0_100Sec: 14.9, consumptionLPer100: 5.0, driveType: 'FWD' },
  stonic: { powerPs: 100, powerKw: 74, acceleration0_100Sec: 11.2, consumptionLPer100: 5.9, driveType: 'FWD' },
  xceed: { powerPs: 140, powerKw: 103, acceleration0_100Sec: 9.6, consumptionLPer100: 6.2, driveType: 'FWD' },
  k4: { powerPs: 150, powerKw: 110, acceleration0_100Sec: 9.5, consumptionLPer100: 5.8, driveType: 'FWD' },
  'k4-sportswagon': { powerPs: 150, powerKw: 110, acceleration0_100Sec: 9.6, consumptionLPer100: 5.9, driveType: 'FWD' },
  ceed: { powerPs: 150, powerKw: 110, acceleration0_100Sec: 9.3, consumptionLPer100: 5.9, driveType: 'FWD' },
  seltos: { powerPs: 100, powerKw: 74, acceleration0_100Sec: 12.1, consumptionLPer100: 6.5, driveType: 'FWD' },
  sportage: { powerPs: 150, powerKw: 110, acceleration0_100Sec: 9.4, consumptionLPer100: 7.4, driveType: 'FWD' },
  'sportage-hybrid': { powerPs: 239, powerKw: 176, acceleration0_100Sec: 8.0, consumptionLPer100: 5.9, driveType: 'AWD' },
  'sportage-phev': { powerPs: 288, powerKw: 212, acceleration0_100Sec: 8.2, consumptionLPer100: 2.9, consumptionKwhPer100: 10.9, driveType: 'FWD' },
  'niro-hybrid': { powerPs: 141, powerKw: 104, acceleration0_100Sec: 11.1, consumptionLPer100: 5.4, driveType: 'FWD' },
  niro: { powerPs: 288, powerKw: 212, acceleration0_100Sec: 8.2, consumptionLPer100: 0.9, consumptionKwhPer100: 16.1, driveType: 'FWD' },
  sorento: { powerPs: 194, powerKw: 142, acceleration0_100Sec: 9.9, consumptionLPer100: 7.0, driveType: 'AWD' },
  'sorento-hybrid': { powerPs: 230, powerKw: 169, acceleration0_100Sec: 8.8, consumptionLPer100: 6.8, driveType: 'AWD' },
  'sorento-phev': { powerPs: 265, powerKw: 195, acceleration0_100Sec: 8.2, consumptionLPer100: 1.5, consumptionKwhPer100: 17.2, driveType: 'AWD' },
  ev2: { powerPs: 136, powerKw: 100, acceleration0_100Sec: 8.2, consumptionKwhPer100: 15.2, driveType: 'FWD' },
  ev3: { powerPs: 204, powerKw: 150, acceleration0_100Sec: 7.5, consumptionKwhPer100: 14.9, driveType: 'FWD' },
  ev4: { powerPs: 204, powerKw: 150, acceleration0_100Sec: 7.7, consumptionKwhPer100: 16.5, driveType: 'FWD' },
  'ev4-fastback': { powerPs: 204, powerKw: 150, acceleration0_100Sec: 7.5, consumptionKwhPer100: 16.2, driveType: 'FWD' },
  ev5: { powerPs: 218, powerKw: 160, acceleration0_100Sec: 8.4, consumptionKwhPer100: 17.1, driveType: 'FWD' },
  'ev5-gt': { powerPs: 306, powerKw: 225, acceleration0_100Sec: 5.5, consumptionKwhPer100: 18.6, driveType: 'AWD' },
  ev6: { powerPs: 229, powerKw: 168, acceleration0_100Sec: 7.3, consumptionKwhPer100: 16.9, driveType: 'RWD' },
  'ev6-gt': { powerPs: 585, powerKw: 430, acceleration0_100Sec: 3.5, consumptionKwhPer100: 18.9, driveType: 'AWD' },
  ev9: { powerPs: 204, powerKw: 150, acceleration0_100Sec: 9.4, consumptionKwhPer100: 19.7, driveType: 'RWD' },
  'ev9-gt': { powerPs: 385, powerKw: 283, acceleration0_100Sec: 5.3, consumptionKwhPer100: 22.5, driveType: 'AWD' },
  'pv5-passenger': { powerPs: 136, powerKw: 100, acceleration0_100Sec: 12.5, consumptionKwhPer100: 21.0, driveType: 'FWD' },
  'pv5-cargo': { powerPs: 136, powerKw: 100, acceleration0_100Sec: 12.5, consumptionKwhPer100: 21.0, driveType: 'FWD' },
  'pv5-crew': { powerPs: 136, powerKw: 100, acceleration0_100Sec: 12.5, consumptionKwhPer100: 21.0, driveType: 'FWD' },
  'pv5-chassis-cab': { powerPs: 136, powerKw: 100, acceleration0_100Sec: 12.5, consumptionKwhPer100: 21.0, driveType: 'FWD' },
};

const DRIVE_LABELS = {
  FWD: 'Frontantrieb',
  RWD: 'Heckantrieb',
  AWD: 'Allradantrieb',
};

/**
 * @param {string} modelKey
 * @returns {KiaPerformanceSpec | null}
 */
export function getKiaPerformanceSpec(modelKey) {
  return KIA_PERFORMANCE_SPECS[modelKey] ?? null;
}

/**
 * @param {DriveType | undefined} driveType
 * @returns {string | null}
 */
export function formatDriveTypeLabel(driveType) {
  if (!driveType) return null;
  return DRIVE_LABELS[driveType] ?? driveType;
}
