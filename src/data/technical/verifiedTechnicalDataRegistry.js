/**
 * Clever Verified Technical Data – zentrale Registry (Kia).
 *
 * API für Lexikon, Inspector, Berater und künftige Import-Pipelines.
 */
import {
  ALL_VERIFIED_TECHNICAL_PROFILES,
  VERIFIED_TECHNICAL_BRAND_REGISTRIES,
} from './brands/index.js';
import { KIA_MODEL_KEY_ALIASES, resolveKiaModelKey } from './brands/kia/pdfSourceCatalog.js';
import {
  buildGlobalModelKey,
  formatVerifiedSourceLine,
  TECHNICAL_CONFIDENCE,
} from './verifiedTechnicalDataSchema.js';

/** @typedef {import('./verifiedTechnicalDataSchema.js').VerifiedTechnicalModelProfile} VerifiedTechnicalModelProfile */
/** @typedef {import('./verifiedTechnicalDataSchema.js').VerifiedTechnicalVariant} VerifiedTechnicalVariant */

const PS_TOLERANCE = 3;
const KW_TOLERANCE = 2;

/** Export-/Markt-PS, die dieselbe Variante meinen (nur mit passendem kW). */
const POWER_PS_EQUIVALENTS = [
  { powerKw: 150, powerPs: [204] },
  { powerKw: 160, powerPs: [218] },
  { powerKw: 195, powerPs: [265] },
  { powerKw: 225, powerPs: [306] },
];

/** @type {Map<string, VerifiedTechnicalModelProfile>} */
const PROFILE_BY_KEY = new Map(
  ALL_VERIFIED_TECHNICAL_PROFILES.map((profile) => [profile.modelKey, profile]),
);

/**
 * @param {string} query
 * @returns {{ powerPs: number | null, powerKw: number | null, driveType: 'FWD' | 'AWD' | 'RWD' | null, batteryKwh: number | null }}
 */
export function parseVariantHintsFromQuery(query) {
  const text = String(query ?? '');
  const psMatch = text.match(/\b(\d{2,3})\s*ps\b/i);
  const powerPs = psMatch ? Number(psMatch[1]) : null;
  const kwMatch = text.match(/\b(\d{2,3})\s*kw\b/i);
  const powerKw = kwMatch ? Number(kwMatch[1]) : null;
  const kwhMatch = text.match(/\b(\d{2,3}(?:[,.]\d)?)\s*kwh\b/i);
  const batteryKwh = kwhMatch ? parseFloat(kwhMatch[1].replace(',', '.')) : null;
  let driveType = null;
  if (/\b(awd|allrad|4x4|4wd)\b/i.test(text)) driveType = 'AWD';
  else if (/\b(fwd|vorderrad|2wd)\b/i.test(text)) driveType = 'FWD';
  else if (/\b(rwd|heckantrieb)\b/i.test(text)) driveType = 'RWD';
  return { powerPs, powerKw, driveType, batteryKwh };
}

/**
 * @param {string} [brandKey]
 */
export function listRegisteredBrands(brandKey = null) {
  if (brandKey) {
    const entry = VERIFIED_TECHNICAL_BRAND_REGISTRIES[brandKey];
    return entry ? [{ key: brandKey, label: entry.label, modelCount: entry.profiles.length }] : [];
  }
  return Object.entries(VERIFIED_TECHNICAL_BRAND_REGISTRIES).map(([key, entry]) => ({
    key,
    label: entry.label,
    modelCount: entry.profiles.length,
    verifiedCount: entry.profiles.filter((p) => p.confidence === TECHNICAL_CONFIDENCE.VERIFIED).length,
  }));
}

/**
 * @param {string} modelKey
 * @param {string} [brandKey]
 * @returns {VerifiedTechnicalModelProfile | null}
 */
export function getVerifiedTechnicalProfile(modelKey, brandKey = 'kia') {
  if (!modelKey) return null;
  const resolvedKey = brandKey === 'kia' ? resolveKiaModelKey(modelKey) : modelKey;
  const direct = PROFILE_BY_KEY.get(resolvedKey);
  if (direct) return direct;
  const globalKey = buildGlobalModelKey(brandKey, resolvedKey);
  return PROFILE_BY_KEY.get(globalKey) ?? null;
}

/**
 * @param {string} brandKey
 * @returns {VerifiedTechnicalModelProfile[]}
 */
export function listVerifiedProfilesForBrand(brandKey) {
  return VERIFIED_TECHNICAL_BRAND_REGISTRIES[brandKey]?.profiles ?? [];
}

/**
 * @returns {string[]}
 */
export function listAllVerifiedModelKeys() {
  return [...PROFILE_BY_KEY.keys()];
}

/**
 * @param {VerifiedTechnicalVariant} variant
 * @param {{ powerPs: number | null, powerKw: number | null, driveType: string | null, batteryKwh: number | null }} hints
 */
function variantMatchesHints(variant, hints) {
  if (hints.driveType && variant.driveType && variant.driveType !== hints.driveType) {
    return false;
  }
  if (hints.batteryKwh != null && variant.batteryKwh != null) {
    if (Math.abs(variant.batteryKwh - hints.batteryKwh) > 1) return false;
  }
  if (hints.powerKw != null && variant.powerKw != null) {
    if (Math.abs(variant.powerKw - hints.powerKw) > KW_TOLERANCE) return false;
  }
  if (hints.powerPs != null && variant.powerPs != null) {
    if (Math.abs(variant.powerPs - hints.powerPs) <= PS_TOLERANCE) return true;
    if (hints.powerKw != null && variant.powerKw != null
      && Math.abs(variant.powerKw - hints.powerKw) <= KW_TOLERANCE) {
      return true;
    }
    const equivalent = POWER_PS_EQUIVALENTS.find((entry) => entry.powerPs.includes(hints.powerPs));
    if (equivalent && variant.powerKw != null
      && Math.abs(variant.powerKw - equivalent.powerKw) <= KW_TOLERANCE) {
      return true;
    }
    return false;
  }
  return true;
}

/**
 * @param {string} modelKey
 * @param {{ powerPs?: number | null, powerKw?: number | null, driveType?: string | null, batteryKwh?: number | null }} hints
 * @param {string} [brandKey]
 */
export function matchVerifiedVariants(modelKey, hints = {}, brandKey = 'kia') {
  const resolvedKey = brandKey === 'kia' ? resolveKiaModelKey(modelKey) : modelKey;
  const profile = getVerifiedTechnicalProfile(resolvedKey, brandKey);
  const normalizedHints = {
    powerPs: hints.powerPs ?? null,
    powerKw: hints.powerKw ?? null,
    driveType: hints.driveType ?? null,
    batteryKwh: hints.batteryKwh ?? null,
  };

  if (!profile || profile.confidence !== TECHNICAL_CONFIDENCE.VERIFIED) {
    return { matched: [], profile, powerPsMismatch: false };
  }

  let matched = profile.variants.filter((v) => variantMatchesHints(v, normalizedHints));

  let powerPsMismatch = false;
  if (normalizedHints.powerPs != null && matched.length === 0) {
    const hasAnyPs = profile.variants.some((v) => v.powerPs != null);
    if (hasAnyPs && normalizedHints.powerKw == null) {
      powerPsMismatch = true;
      matched = [];
    } else {
      matched = profile.variants.filter((v) => variantMatchesHints(v, { ...normalizedHints, powerPs: null }));
    }
  }

  return { matched, profile, powerPsMismatch };
}

/**
 * @param {string} modelKey
 * @param {string} [brandKey]
 * @returns {Array<{ attribute: string, status: string, source: string, value?: string, noseWeight?: number, note?: string }>}
 */
export function listTechnicalDataGapsForModel(modelKey, brandKey = 'kia') {
  const profile = getVerifiedTechnicalProfile(modelKey, brandKey);
  const gaps = [];

  if (!profile) {
    gaps.push({
      attribute: 'Anhängelast',
      status: TECHNICAL_CONFIDENCE.NEEDS_REVIEW,
      source: 'keine',
      note: 'Kein Preislisten-Profil – Import anlegen unter src/data/technical/brands/',
    });
    return gaps;
  }

  if (profile.confidence !== TECHNICAL_CONFIDENCE.VERIFIED) {
    gaps.push({
      attribute: 'Profil',
      status: profile.confidence,
      source: profile.sourceDocument,
      note: profile.notes ?? 'Profil noch nicht vollständig geprüft',
    });
    return gaps;
  }

  for (const variant of profile.variants) {
    const label = variant.trimLabel ?? variant.driveType ?? 'Variante';
    if (variant.towing?.permitted === false) {
      gaps.push({
        attribute: `Anhängelast ${label}`,
        status: TECHNICAL_CONFIDENCE.VERIFIED,
        source: profile.sourceDocument,
        value: 'nicht zulässig',
      });
      continue;
    }
    if (variant.towing?.brakedKg != null) {
      gaps.push({
        attribute: `Anhängelast ${label}`,
        status: TECHNICAL_CONFIDENCE.VERIFIED,
        source: profile.sourceDocument,
        value: `${variant.towing.brakedKg} kg`,
        noseWeight: variant.towing.noseWeightKg ?? null,
      });
    } else {
      gaps.push({
        attribute: `Anhängelast ${label}`,
        status: TECHNICAL_CONFIDENCE.NEEDS_REVIEW,
        source: profile.sourceDocument,
        note: 'fehlt',
      });
    }
  }

  return gaps;
}

/**
 * @param {string} [brandKey]
 * @returns {{ brand: string, modelKey: string, modelLabel: string, status: string }[]}
 */
export function listModelsMissingVerifiedProfiles(brandKey = null) {
  const brands = brandKey
    ? [brandKey]
    : Object.keys(VERIFIED_TECHNICAL_BRAND_REGISTRIES);

  const missing = [];
  for (const key of brands) {
    const entry = VERIFIED_TECHNICAL_BRAND_REGISTRIES[key];
    if (!entry) continue;
    if (entry.profiles.length === 0) {
      missing.push({
        brand: entry.label,
        modelKey: '*',
        modelLabel: 'Alle Modelle',
        status: 'Marke registriert, keine Profile',
      });
    }
  }
  return missing;
}

export { formatVerifiedSourceLine, KIA_MODEL_KEY_ALIASES };

// Abwärtskompatibilität: flaches Record für Legacy-Imports
/** @type {Record<string, VerifiedTechnicalModelProfile>} */
export const VERIFIED_TECHNICAL_DATA_FLAT = Object.fromEntries(PROFILE_BY_KEY.entries());
