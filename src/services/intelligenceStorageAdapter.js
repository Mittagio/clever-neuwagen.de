/**
 * Storage-Adapter für Intelligence-Events (Browser / Server / Datei)
 */

const STORAGE_KEY = 'clever-neuwagen-intelligence';

export const browserStorageAdapter = {
  load() {
    try {
      if (typeof localStorage === 'undefined') return { events: [], lastUpdated: null };
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* */ }
    return { events: [], lastUpdated: null };
  },
  save(data) {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('clever-intelligence-update'));
    }
  },
};

export const memoryStorageAdapter = {
  _data: { events: [], lastUpdated: null },
  load() {
    return { ...this._data, events: [...this._data.events] };
  },
  save(data) {
    this._data = data;
  },
};

let activeAdapter = null;

export function setIntelligenceStorageAdapter(adapter) {
  activeAdapter = adapter;
}

export function getIntelligenceStorageAdapter() {
  if (activeAdapter) return activeAdapter;
  if (typeof localStorage !== 'undefined') return browserStorageAdapter;
  return memoryStorageAdapter;
}

export function loadIntelligenceStore() {
  return getIntelligenceStorageAdapter().load();
}

export function saveIntelligenceStore(data) {
  return getIntelligenceStorageAdapter().save(data);
}
