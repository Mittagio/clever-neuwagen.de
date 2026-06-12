/**
 * Lieferzeit und Ausstattungs-Verfügbarkeit – Händler-Referenz (unverbindlich).
 * Quelle: typische Kia-DE-Lieferzeiten / Paketlogik, Stand 2026.
 */
import { CLEVER_FEATURE_STATUS as S } from '../clever/cleverVehicleRecord.js';

/** @type {Record<string, string>} */
export const KIA_DELIVERY_WEEKS = {
  picanto: '3–5',
  stonic: '3–5',
  xceed: '4–6',
  k4: '4–6',
  'k4-sportswagon': '4–6',
  ceed: '3–5',
  seltos: '4–6',
  sportage: '3–5',
  'sportage-hybrid': '4–6',
  'sportage-phev': '5–8',
  'niro-hybrid': '4–6',
  niro: '5–8',
  sorento: '5–8',
  'sorento-hybrid': '5–8',
  'sorento-phev': '4–6',
  ev2: '6–10',
  ev3: '4–6',
  ev4: '6–10',
  'ev4-fastback': '6–10',
  ev5: '8–12',
  'ev5-gt': '8–12',
  ev6: '5–8',
  'ev6-gt': '6–10',
  ev9: '6–10',
  'ev9-gt': '8–12',
  'pv5-passenger': '8–14',
  'pv5-cargo': '8–14',
  'pv5-crew': '8–14',
  'pv5-chassis-cab': '8–14',
};

/** @type {Record<string, import('../clever/cleverVehicleRecord.js').CleverFeatureStatus>} */
export const KIA_LEATHER_STATUS = {
  picanto: S.MISSING,
  stonic: S.MISSING,
  xceed: S.PACKAGE,
  k4: S.PACKAGE,
  'k4-sportswagon': S.PACKAGE,
  ceed: S.PACKAGE,
  seltos: S.PACKAGE,
  sportage: S.PACKAGE,
  'sportage-hybrid': S.PACKAGE,
  'sportage-phev': S.PACKAGE,
  'niro-hybrid': S.PACKAGE,
  niro: S.PACKAGE,
  sorento: S.PACKAGE,
  'sorento-hybrid': S.PACKAGE,
  'sorento-phev': S.STANDARD,
  ev2: S.MISSING,
  ev3: S.PACKAGE,
  ev4: S.PACKAGE,
  'ev4-fastback': S.PACKAGE,
  ev5: S.PACKAGE,
  'ev5-gt': S.STANDARD,
  ev6: S.PACKAGE,
  'ev6-gt': S.STANDARD,
  ev9: S.PACKAGE,
  'ev9-gt': S.STANDARD,
  'pv5-passenger': S.PACKAGE,
  'pv5-cargo': S.MISSING,
  'pv5-crew': S.PACKAGE,
  'pv5-chassis-cab': S.MISSING,
};

/**
 * @param {string} modelKey
 * @returns {string | null}
 */
export function getKiaDeliveryWeeks(modelKey) {
  return KIA_DELIVERY_WEEKS[modelKey] ?? null;
}

/**
 * @param {string} modelKey
 * @returns {import('../clever/cleverVehicleRecord.js').CleverFeatureStatus | null}
 */
export function getKiaLeatherStatus(modelKey) {
  return KIA_LEATHER_STATUS[modelKey] ?? S.UNKNOWN;
}
