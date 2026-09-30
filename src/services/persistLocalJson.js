/**
 * localStorage-JSON ohne App-Crash.
 * Quota: schwere Data-URLs (PDF/Bilder) weglassen, dann auf die neuesten Einträge kürzen.
 * In-Memory-State bleibt vollständig – nur die persistierte Kopie wird schlank.
 */

const DATA_URL_RE = /^data:[^;]+;base64,/i;
const HEAVY_KEYS = new Set(['dataUrl', 'base64', 'fileBytes', 'pdfBytes', 'imageBase64']);
const HEAVY_STRING = 2_000;
const RECENT_LIMIT = 40;

export function isQuotaExceededError(err) {
  if (!err) return false;
  return err.name === 'QuotaExceededError'
    || err.code === 22
    || err.code === 1014
    || /quota/i.test(String(err.message || ''));
}

export function stripHeavyLocalStorageValue(value) {
  if (Array.isArray(value)) return value.map(stripHeavyLocalStorageValue);
  if (!value || typeof value !== 'object') {
    if (typeof value === 'string' && DATA_URL_RE.test(value) && value.length > HEAVY_STRING) {
      return null;
    }
    return value;
  }
  const out = Array.isArray(value) ? [] : {};
  for (const [key, child] of Object.entries(value)) {
    if (HEAVY_KEYS.has(key) && typeof child === 'string' && child.length > HEAVY_STRING) {
      out[key] = null;
      continue;
    }
    out[key] = stripHeavyLocalStorageValue(child);
  }
  return out;
}

function newestFirst(items) {
  return [...items].sort((a, b) => {
    const aAt = new Date(a?.updatedAt || a?.createdAt || 0).getTime();
    const bAt = new Date(b?.updatedAt || b?.createdAt || 0).getTime();
    return bAt - aAt;
  });
}

export function persistLocalJson(key, value) {
  if (typeof localStorage === 'undefined') {
    return { ok: false, skipped: true };
  }

  const attempts = [
    () => value,
    () => stripHeavyLocalStorageValue(value),
    () => {
      const slim = stripHeavyLocalStorageValue(value);
      return Array.isArray(slim) ? newestFirst(slim).slice(0, RECENT_LIMIT) : slim;
    },
  ];

  let lastError = null;
  for (const build of attempts) {
    try {
      localStorage.setItem(key, JSON.stringify(build()));
      return { ok: true };
    } catch (err) {
      lastError = err;
      if (!isQuotaExceededError(err)) {
        return { ok: false, error: err };
      }
    }
  }

  return { ok: false, quota: true, error: lastError };
}
