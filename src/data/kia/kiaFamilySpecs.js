/**
 * Familien- und AHK-Daten Kia 7-Sitzer (Kia DE, ADAC Familien-SUV-Check).
 * Single Source für Clever Records und kiaModelAttributes.
 */

/** @typedef {{
 *   seats: number,
 *   isofixRearCount: number,
 *   isofixRear: boolean,
 *   isofixPassenger: boolean,
 *   towCapacityKg: number,
 *   frunkL?: number|null,
 * }} KiaFamilySpec */

/** @type {Record<string, KiaFamilySpec>} */
export const KIA_SEVEN_SEATER_FAMILY_SPECS = {
  ev9: {
    seats: 7,
    isofixRearCount: 2,
    isofixRear: true,
    isofixPassenger: false,
    towCapacityKg: 2500,
    frunkL: 52,
  },
  'ev9-gt': {
    seats: 7,
    isofixRearCount: 2,
    isofixRear: true,
    isofixPassenger: false,
    towCapacityKg: 2500,
    frunkL: 52,
  },
  sorento: {
    seats: 7,
    isofixRearCount: 3,
    isofixRear: true,
    isofixPassenger: true,
    towCapacityKg: 2500,
  },
  'sorento-hybrid': {
    seats: 7,
    isofixRearCount: 3,
    isofixRear: true,
    isofixPassenger: true,
    towCapacityKg: 2000,
  },
  'sorento-phev': {
    seats: 7,
    isofixRearCount: 3,
    isofixRear: true,
    isofixPassenger: true,
    towCapacityKg: 2500,
  },
};

/** @param {string} modelKey */
export function getKiaFamilySpec(modelKey) {
  return KIA_SEVEN_SEATER_FAMILY_SPECS[modelKey] ?? null;
}

export const KIA_SEVEN_SEATER_MODEL_KEYS = Object.keys(KIA_SEVEN_SEATER_FAMILY_SPECS);
