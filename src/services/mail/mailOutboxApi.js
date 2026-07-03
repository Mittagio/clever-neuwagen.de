/**
 * HTTP-Client für die Server-Mail-Outbox (Produktiv-Quelle).
 */

const DEFAULT_API_BASE = '/api/v1';

let customFetch = null;
let customApiBase = DEFAULT_API_BASE;

export function configureMailOutboxApi({ fetch: fetchFn, apiBase } = {}) {
  if (fetchFn) customFetch = fetchFn;
  if (apiBase) customApiBase = apiBase;
}

function resolveApiBase(base) {
  return resolveMailApiBase(base ?? customApiBase);
}

async function httpFetch(url, options) {
  const fn = customFetch
    ?? (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
  if (!fn) {
    throw new Error('fetch nicht verfügbar');
  }
  return fn(url, options);
}

export function resolveMailApiBase(base = DEFAULT_API_BASE) {
  return base.replace(/\/$/, '');
}

/**
 * @returns {Promise<{ ok: boolean, items: object[]|null, unreachable?: boolean }>}
 */
export async function fetchServerMailOutbox(apiBase = DEFAULT_API_BASE) {
  try {
    const res = await httpFetch(`${resolveApiBase(apiBase)}/mail/outbox`);
    if (!res.ok) {
      return { ok: false, items: null, unreachable: false };
    }
    const data = await res.json();
    return { ok: true, items: data.items ?? [], unreachable: false };
  } catch {
    return { ok: false, items: null, unreachable: true };
  }
}

/**
 * @returns {Promise<{ ok: boolean, entry?: object, error?: string, unreachable?: boolean }|null>}
 * null = Netzwerkfehler → Caller soll Fallback nutzen
 */
export async function sendMailViaServer(payload = {}, apiBase = DEFAULT_API_BASE) {
  try {
    const res = await httpFetch(`${resolveApiBase(apiBase)}/mail/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        entry: data.entry ?? null,
        error: data.error ?? `HTTP ${res.status}`,
        unreachable: false,
      };
    }
    return { ok: true, entry: data.entry ?? null, unreachable: false };
  } catch {
    return null;
  }
}

/**
 * @returns {Promise<{ ok: boolean, entry?: object, error?: string }|null>}
 */
export async function retryMailViaServer(mailId, apiBase = DEFAULT_API_BASE) {
  try {
    const res = await httpFetch(`${resolveApiBase(apiBase)}/mail/outbox/${encodeURIComponent(mailId)}/retry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        entry: data.entry ?? null,
        error: data.error ?? `HTTP ${res.status}`,
      };
    }
    return { ok: true, entry: data.entry ?? null };
  } catch {
    return null;
  }
}

export async function probeMailServer(apiBase = DEFAULT_API_BASE) {
  try {
    const res = await httpFetch(`${resolveApiBase(apiBase)}/mail/status`);
    if (!res.ok) return { reachable: false, productionReady: false };
    const data = await res.json();
    return {
      reachable: true,
      productionReady: Boolean(data.productionReady),
      transport: data.transport ?? null,
    };
  } catch {
    return { reachable: false, productionReady: false };
  }
}
