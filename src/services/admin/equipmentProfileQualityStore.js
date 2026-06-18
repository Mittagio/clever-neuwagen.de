/**
 * Persistenz für manuelle Freigabe von Import-Profilen (localStorage + Memory).
 */
export const PROFILE_QUALITY_OVERRIDE_STORAGE_KEY = 'clever_equipment_profile_quality_overrides';

/** @type {Record<string, object> | null} */
let memoryOverrides = null;

/**
 * @param {string} modelKey
 * @param {string | number | null | undefined} modelYear
 */
export function buildProfileQualityOverrideKey(modelKey, modelYear) {
  const key = String(modelKey ?? '')
    .toLowerCase()
    .replace(/^kia-/, '')
    .replace(/[\s_]+/g, '-')
    .trim();
  const year = modelYear == null || modelYear === '' ? '' : String(modelYear);
  return `${key}::${year}`;
}

function readAllOverrides() {
  if (memoryOverrides) return { ...memoryOverrides };

  if (typeof window === 'undefined') return {};

  try {
    const raw = window.localStorage.getItem(PROFILE_QUALITY_OVERRIDE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** @param {Record<string, object>} data */
function writeAllOverrides(data) {
  const next = { ...data };
  if (typeof window === 'undefined') {
    memoryOverrides = next;
    return;
  }

  try {
    window.localStorage.setItem(PROFILE_QUALITY_OVERRIDE_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('clever-equipment-quality-overrides-changed'));
  } catch {
    memoryOverrides = next;
  }
}

/**
 * @param {string} modelKey
 * @param {string | number | null | undefined} modelYear
 */
export function getProfileQualityOverride(modelKey, modelYear) {
  const storeKey = buildProfileQualityOverrideKey(modelKey, modelYear);
  return readAllOverrides()[storeKey] ?? null;
}

/**
 * @param {object} override
 * @param {string} override.modelKey
 * @param {string | number | null} [override.modelYear]
 * @param {string} override.status
 * @param {string} [override.verifiedBy]
 */
export function saveProfileQualityOverride(override) {
  const storeKey = buildProfileQualityOverrideKey(override.modelKey, override.modelYear);
  const entry = {
    modelKey: override.modelKey,
    modelYear: override.modelYear ?? null,
    status: override.status,
    verifiedAt: override.verifiedAt ?? new Date().toISOString(),
    verifiedBy: override.verifiedBy ?? 'local-admin',
  };

  const all = readAllOverrides();
  all[storeKey] = entry;
  writeAllOverrides(all);
  return entry;
}

/** Nur für Tests. */
export function resetProfileQualityOverrides() {
  memoryOverrides = {};
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(PROFILE_QUALITY_OVERRIDE_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}
