/**
 * Server-Persistenz: Stammdaten-Overrides + offene Kundenfragen.
 */
import { createJsonStore } from './jsonStore.js';

const overridesStore = createJsonStore({
  fileName: 'stammdaten-overrides.json',
  createEmpty: () => ({ overrides: {}, lastUpdated: null }),
  logTag: 'stammdaten-overrides',
});

const questionsStore = createJsonStore({
  fileName: 'open-customer-questions.json',
  createEmpty: () => ({ items: [], lastUpdated: null }),
  logTag: 'open-questions',
});

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

export function loadStammdatenOverrides() {
  const data = overridesStore.load();
  return data.overrides ?? {};
}

export function saveStammdatenOverrides(overrides) {
  overridesStore.save({
    overrides,
    lastUpdated: new Date().toISOString(),
  });
  return overrides;
}

/**
 * @param {string} modelKey
 * @param {object} patch
 */
export function patchStammdatenOverride(modelKey, patch) {
  const all = loadStammdatenOverrides();
  all[modelKey] = deepMerge(all[modelKey] ?? {}, patch);
  saveStammdatenOverrides(all);
  return all[modelKey];
}

export function loadOpenCustomerQuestions() {
  const data = questionsStore.load();
  return data.items ?? [];
}

function saveOpenCustomerQuestions(items) {
  questionsStore.save({
    items,
    lastUpdated: new Date().toISOString(),
  });
  return items;
}

export function listOpenCustomerQuestions({ status = null } = {}) {
  const items = loadOpenCustomerQuestions();
  if (!status) return items;
  return items.filter((item) => item.status === status);
}

/**
 * @param {object} entry
 */
export function addOpenCustomerQuestion(entry) {
  const items = loadOpenCustomerQuestions();
  const duplicate = items.find(
    (item) => item.status === 'open'
      && item.query?.toLowerCase() === entry.query?.toLowerCase()
      && item.modelKey === entry.modelKey,
  );
  if (duplicate) return duplicate;

  const next = [entry, ...items];
  saveOpenCustomerQuestions(next);
  return entry;
}

/**
 * @param {string} id
 * @param {object} updates
 */
export function updateOpenCustomerQuestion(id, updates) {
  const items = loadOpenCustomerQuestions();
  let found = null;
  const next = items.map((item) => {
    if (item.id !== id) return item;
    found = { ...item, ...updates };
    return found;
  });
  if (!found) return null;
  saveOpenCustomerQuestions(next);
  return found;
}

export function getStammdatenStorageStatus() {
  return {
    overrides: overridesStore.stat(),
    openQuestions: questionsStore.stat(),
  };
}
