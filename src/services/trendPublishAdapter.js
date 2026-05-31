/**
 * Storage-Adapter für veröffentlichte Trendseiten (Browser / Server)
 */

const STORAGE_KEY = 'clever-neuwagen-published-trends';

export const browserTrendPublishAdapter = {
  load() {
    try {
      if (typeof localStorage === 'undefined') return { pages: [], lastUpdated: null };
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* */ }
    return { pages: [], lastUpdated: null };
  },
  save(data) {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('clever-published-trends-update'));
    }
  },
};

export const memoryTrendPublishAdapter = {
  _data: { pages: [], lastUpdated: null },
  load() {
    return {
      ...this._data,
      pages: [...this._data.pages],
    };
  },
  save(data) {
    this._data = data;
  },
};

let activeAdapter = null;

export function setTrendPublishAdapter(adapter) {
  activeAdapter = adapter;
}

export function getTrendPublishAdapter() {
  if (activeAdapter) return activeAdapter;
  if (typeof localStorage !== 'undefined') return browserTrendPublishAdapter;
  return memoryTrendPublishAdapter;
}

export function loadPublishedTrendStore() {
  return getTrendPublishAdapter().load();
}

export function savePublishedTrendStore(data) {
  return getTrendPublishAdapter().save(data);
}
