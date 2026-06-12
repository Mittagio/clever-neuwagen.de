/**
 * Stammdaten-Overrides – Server (primär) + localStorage (Offline-Cache).
 */
import { KIA_CLEVER_RECORDS } from '../../data/clever/kiaCleverRecords.js';
import { patchStammdatenOverrideApi } from './stammdatenApi.js';
import { getStammdatenFieldSpec } from './stammdatenFieldSpec.js';

const STORAGE_KEY = 'clever-vehicle-stammdaten-overrides';

/** @type {Record<string, object> | null} */
let memoryOverrides = null;

/** @type {Record<string, object> | null} */
let serverCache = null;

function readLocalStorage() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function readAll() {
  if (memoryOverrides) return { ...memoryOverrides };
  if (serverCache) return { ...serverCache };
  return readLocalStorage();
}

/** @param {Record<string, object>} data */
function writeLocalCache(data) {
  if (typeof window === 'undefined') {
    memoryOverrides = { ...data };
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('clever-stammdaten-overrides-changed'));
  } catch {
    // ignore quota
  }
}

/** @param {Record<string, object>} overrides */
export function setStammdatenOverridesCache(overrides) {
  serverCache = { ...overrides };
  writeLocalCache(overrides);
}

function deepMerge(base, patch) {
  const out = { ...base };
  for (const [key, val] of Object.entries(patch)) {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      out[key] = deepMerge(base[key] ?? {}, val);
    } else {
      out[key] = val;
    }
  }
  return out;
}

function syncPatchToServer(modelKey, patch) {
  if (typeof window === 'undefined') return;
  patchStammdatenOverrideApi(modelKey, patch).catch((err) => {
    console.warn('[stammdaten] Server-Sync fehlgeschlagen:', err.message);
  });
}

/**
 * @param {import('../../data/clever/cleverVehicleRecord.js').CleverVehicleRecord} record
 * @param {string} modelKey
 */
export function mergeCleverRecordWithOverrides(record, modelKey) {
  const all = readAll();
  const patch = all[modelKey];
  if (!patch) return record;
  return deepMerge(record, patch);
}

/**
 * @param {string} modelKey
 * @returns {import('../../data/clever/cleverVehicleRecord.js').CleverVehicleRecord | null}
 */
export function getCleverRecordForModelKey(modelKey) {
  const records = KIA_CLEVER_RECORDS.filter((r) => r.modelKey === modelKey);
  const base = records.find((r) => r.electric?.batteryGrossKwh || r.electric?.batteryNetKwh)
    ?? records.find((r) => r.electric?.batteryOptionsKwh?.length)
    ?? records.find((r) => !r.trimId)
    ?? records.find((r) => r.electric?.wltpRangeKm)
    ?? records[0]
    ?? null;
  if (!base) return null;
  return mergeCleverRecordWithOverrides(base, modelKey);
}

export function loadStammdatenOverrides() {
  return readAll();
}

/**
 * @param {string} modelKey
 * @param {object} patch
 */
export function saveStammdatenOverride(modelKey, patch) {
  const all = readAll();
  all[modelKey] = deepMerge(all[modelKey] ?? {}, patch);
  serverCache = { ...all };
  writeLocalCache(all);
  syncPatchToServer(modelKey, patch);
  return all[modelKey];
}

/**
 * @param {{ modelKey: string, field: import('../search/vehicleQueryIntent.js').VehicleFactField, value: unknown }} params
 */
export function applyFieldAnswer({ modelKey, field, value }) {
  const spec = getStammdatenFieldSpec(field);
  if (!spec || !modelKey) return null;

  const parsed = spec.parse ? spec.parse(value) : value;
  if (parsed === '' || parsed == null || Number.isNaN(parsed)) return null;

  const patch = spec.buildPatch(parsed);

  return saveStammdatenOverride(modelKey, patch);
}

/** Nur für Tests */
export function __resetStammdatenOverridesForTest(data = {}) {
  memoryOverrides = { ...data };
  serverCache = null;
}
