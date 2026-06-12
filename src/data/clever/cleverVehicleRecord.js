/**
 * CleverVehicleRecord – strukturierte Fahrzeugwahrheit (Phase 2).
 * @typedef {'standard'|'package'|'accessory'|'missing'|'unknown'} CleverFeatureStatus
 */

export const CLEVER_FIELD_UNKNOWN = 'unknown';
export const CLEVER_FEATURE_STATUS = {
  STANDARD: 'standard',
  PACKAGE: 'package',
  ACCESSORY: 'accessory',
  MISSING: 'missing',
  UNKNOWN: 'unknown',
};

/** @typedef {1|2|3|4|5|6|7|8|9|10} CleverScore */

/**
 * @typedef {object} CleverVehicleRecord
 * @property {string} id
 * @property {string} brand
 * @property {string} model
 * @property {string} modelKey
 * @property {string} [trimId]
 * @property {string} [trimLabel]
 * @property {object} basis
 * @property {object} [performance]
 * @property {object} [electric]
 * @property {object} [family]
 * @property {object} [towing]
 * @property {object} [dimensions]
 * @property {Record<string, CleverFeatureStatus>} [comfort]
 * @property {Record<string, CleverScore>} [cleverScores]
 * @property {number} [popularityScore]
 */

export const CLEVER_SCORE_KEYS = [
  'familyVehicle',
  'dogFriendly',
  'caravanReady',
  'longDistance',
  'commuter',
  'seniorFriendly',
  'fieldSales',
  'cityCar',
  'valuePick',
];
