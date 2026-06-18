/**
 * Persistenz für Feature-Alias-Mappings (localStorage + Memory für Tests).
 */
import {
  createEmptyFeatureAliasStore,
  FEATURE_ALIAS_STORAGE_KEY,
  normalizeFeatureAliasRawLabel,
} from '../../data/features/featureAliasOverrides.js';

/** @typedef {import('../../data/features/featureAliasOverrides.js').FeatureAliasStoreData} FeatureAliasStoreData */

/** @type {FeatureAliasStoreData | null} */
let memoryStore = null;

function readLocalStorage() {
  if (typeof window === 'undefined') {
    return memoryStore ?? createEmptyFeatureAliasStore();
  }
  try {
    const raw = window.localStorage.getItem(FEATURE_ALIAS_STORAGE_KEY);
    if (!raw) return createEmptyFeatureAliasStore();
    const parsed = JSON.parse(raw);
    return {
      mappings: Array.isArray(parsed.mappings) ? parsed.mappings : [],
      ignoredRawLabels: Array.isArray(parsed.ignoredRawLabels) ? parsed.ignoredRawLabels : [],
    };
  } catch {
    return createEmptyFeatureAliasStore();
  }
}

/** @param {FeatureAliasStoreData} data */
function writeStore(data) {
  const next = {
    mappings: [...data.mappings],
    ignoredRawLabels: [...data.ignoredRawLabels],
  };

  if (typeof window === 'undefined') {
    memoryStore = next;
    return;
  }

  try {
    window.localStorage.setItem(FEATURE_ALIAS_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('clever-feature-alias-mappings-changed'));
  } catch {
    memoryStore = next;
  }
}

export function readFeatureAliasStore() {
  if (memoryStore) return { ...memoryStore, mappings: [...memoryStore.mappings], ignoredRawLabels: [...memoryStore.ignoredRawLabels] };
  return readLocalStorage();
}

/** @param {FeatureAliasStoreData} data */
export function writeFeatureAliasStore(data) {
  writeStore(data);
}

/** Nur für Tests. */
export function resetFeatureAliasStore() {
  memoryStore = createEmptyFeatureAliasStore();
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(FEATURE_ALIAS_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}

/** @param {string} rawLabel */
export function isIgnoredRawLabelInStore(rawLabel) {
  const key = normalizeFeatureAliasRawLabel(rawLabel);
  return readFeatureAliasStore().ignoredRawLabels.includes(key);
}
