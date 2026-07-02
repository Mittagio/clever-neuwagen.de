/**
 * Clever Verified Technical Data – Schema & Hilfsfunktionen
 *
 * Kia-Fundament für geprüfte technische Stammdaten (Preislisten DE).
 * Weitere Marken später: brands/{marke}/profiles.js + Registry erweitern.
 *
 * Felder pro Attribut (Zielbild Import):
 *   modelKey, modelLabel, trimId, motorPower, driveType, battery, modelYear, market,
 *   attributeId, value, unit, sourceDocument, sourcePage, sourceDate, confidence, verifiedBy, verifiedAt
 */

/** @typedef {'manufacturer_price_list' | 'manufacturer_data_sheet' | 'manual_verified' | 'equipment_import' | 'technicalData' | 'openai_general' | 'fallback_template'} TechnicalSourceType */

/** @typedef {'verified' | 'partially_verified' | 'unverified' | 'needs_review'} TechnicalConfidence */

/**
 * @typedef {object} VerifiedTowingSpec
 * @property {number} [brakedKg]
 * @property {number} [unbrakedKg]
 * @property {number} [noseWeightKg]
 * @property {number} [roofLoadKg]
 * @property {boolean} [permitted] – false = explizit keine Anhängelast (Preisliste)
 */

/**
 * @typedef {object} VerifiedTechnicalVariant
 * @property {string} [trimId]
 * @property {string} [trimLabel]
 * @property {number} [powerPs]
 * @property {number} [powerKw]
 * @property {number} [batteryKwh]
 * @property {'FWD' | 'RWD' | 'AWD' | string} [driveType]
 * @property {VerifiedTowingSpec} [towing]
 * @property {number} [dcKw]
 * @property {number} [wltpRangeKm]
 * @property {number} [trunkL]
 */

/**
 * @typedef {object} VerifiedTechnicalModelProfile
 * @property {string} brandKey
 * @property {string} brand
 * @property {string} modelKey – global eindeutig (Kia: ev5, BYD: byd-atto-3)
 * @property {string} modelLabel
 * @property {string} market
 * @property {number} modelYear
 * @property {string} sourceDocument
 * @property {string} [sourceFile]
 * @property {string} [sourcePage]
 * @property {string} sourceDate
 * @property {TechnicalSourceType} source
 * @property {TechnicalConfidence} confidence
 * @property {VerifiedTechnicalVariant[]} variants
 * @property {string} [verifiedBy]
 * @property {string} [verifiedAt]
 * @property {string} [notes]
 */

export const TECHNICAL_SOURCE_TYPES = {
  MANUFACTURER_PRICE_LIST: 'manufacturer_price_list',
  MANUFACTURER_DATA_SHEET: 'manufacturer_data_sheet',
  MANUAL_VERIFIED: 'manual_verified',
  EQUIPMENT_IMPORT: 'equipment_import',
  TECHNICAL_DATA: 'technicalData',
  OPENAI_GENERAL: 'openai_general',
  FALLBACK_TEMPLATE: 'fallback_template',
};

export const TECHNICAL_CONFIDENCE = {
  VERIFIED: 'verified',
  PARTIALLY_VERIFIED: 'partially_verified',
  UNVERIFIED: 'unverified',
  NEEDS_REVIEW: 'needs_review',
};

/**
 * @param {number} brakedKg
 * @param {number} [unbrakedKg]
 * @param {number} [noseWeightKg]
 * @param {number} [roofLoadKg]
 * @returns {VerifiedTowingSpec}
 */
export function tow(brakedKg, unbrakedKg = null, noseWeightKg = null, roofLoadKg = null) {
  return {
    brakedKg,
    unbrakedKg: unbrakedKg ?? undefined,
    noseWeightKg: noseWeightKg ?? undefined,
    roofLoadKg: roofLoadKg ?? undefined,
    permitted: brakedKg > 0,
  };
}

/** @returns {VerifiedTowingSpec} */
export function towNotPermitted() {
  return { brakedKg: 0, permitted: false };
}

/**
 * @param {Partial<VerifiedTechnicalModelProfile> & Pick<VerifiedTechnicalModelProfile, 'brandKey' | 'brand' | 'modelKey' | 'modelLabel' | 'sourceDocument' | 'variants'>} input
 * @returns {VerifiedTechnicalModelProfile}
 */
export function defineModelProfile(input) {
  const {
    brandKey,
    brand,
    modelKey,
    modelLabel,
    market = 'DE',
    modelYear = 2026,
    sourceDocument,
    sourceFile = null,
    sourcePage = 'Technische Daten',
    sourceDate = '2026-01',
    source = TECHNICAL_SOURCE_TYPES.MANUFACTURER_PRICE_LIST,
    confidence = TECHNICAL_CONFIDENCE.VERIFIED,
    variants,
    verifiedBy = null,
    verifiedAt = null,
    notes = null,
  } = input;

  return {
    brandKey,
    brand,
    modelKey,
    modelLabel,
    market,
    modelYear,
    sourceDocument,
    sourceFile,
    sourcePage,
    sourceDate,
    source,
    confidence,
    variants,
    verifiedBy,
    verifiedAt,
    notes,
  };
}

/**
 * Globaler modelKey für Marken außerhalb Kia (Rückwärtskompatibilität: Kia behält kurze Keys).
 * @param {string} brandKey
 * @param {string} localModelKey
 */
export function buildGlobalModelKey(brandKey, localModelKey) {
  const brand = String(brandKey ?? 'kia').toLowerCase();
  const key = String(localModelKey ?? '').trim();
  if (!key) return '';
  if (brand === 'kia') return key;
  if (key.startsWith(`${brand}-`)) return key;
  return `${brand}-${key}`;
}

/**
 * @param {VerifiedTechnicalModelProfile} profile
 */
export function formatVerifiedSourceLine(profile) {
  const date = profile.sourceDate ? ` · Stand ${profile.sourceDate}` : '';
  const brand = profile.brand ? `${profile.brand} ` : '';
  return `Quelle: ${brand}${profile.sourceDocument}${date}`;
}
