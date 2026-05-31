/**
 * Intelligence-Events zusammenführen (Browser ↔ Server)
 */

export const INTELLIGENCE_MAX_EVENTS = 3000;

function stablePayloadKey(payload) {
  if (!payload || typeof payload !== 'object') return '';
  const keys = Object.keys(payload).sort();
  return JSON.stringify(payload, keys);
}

export function eventFingerprint(event) {
  if (!event || typeof event !== 'object') return '';
  if (event.id) return String(event.id);
  const { type, at, id: _id, ...rest } = event;
  return `${type ?? ''}|${at ?? ''}|${stablePayloadKey(rest)}`;
}

export function mergeIntelligenceStores(...stores) {
  const seen = new Map();

  for (const store of stores) {
    for (const event of store?.events ?? []) {
      if (!event?.type) continue;
      const fp = eventFingerprint(event);
      if (!fp) continue;
      const existing = seen.get(fp);
      if (!existing) {
        seen.set(fp, event);
        continue;
      }
      if (!existing.id && event.id) {
        seen.set(fp, event);
      }
    }
  }

  const events = [...seen.values()]
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
    .slice(-INTELLIGENCE_MAX_EVENTS);

  const lastUpdated = stores
    .map((store) => store?.lastUpdated)
    .filter(Boolean)
    .sort()
    .at(-1) ?? new Date().toISOString();

  return { events, lastUpdated };
}

export function intelligenceStoresEqual(a, b) {
  const eventsA = a?.events ?? [];
  const eventsB = b?.events ?? [];
  if (eventsA.length !== eventsB.length) return false;
  const fps = new Set(eventsA.map(eventFingerprint));
  for (const event of eventsB) {
    if (!fps.has(eventFingerprint(event))) return false;
  }
  return true;
}
