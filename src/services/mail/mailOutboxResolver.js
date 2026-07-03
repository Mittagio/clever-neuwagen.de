/**
 * Vereinheitlichte Outbox-Ansicht – Server bevorzugt, localStorage als Demo-Fallback.
 */

import { getMailOutboxEntries } from './mailOutboxStore.js';

export const OUTBOX_SOURCE = {
  SERVER: 'server',
  DEMO: 'demo',
};

let activeItems = null;
let activeSource = OUTBOX_SOURCE.DEMO;
let serverReachable = false;

const listeners = new Set();

export function subscribeUnifiedOutbox(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  const snapshot = getUnifiedOutboxSnapshot();
  for (const fn of listeners) {
    try {
      fn(snapshot);
    } catch {
      /* ignore */
    }
  }
}

export function getUnifiedOutboxSnapshot() {
  return {
    items: activeItems ?? getMailOutboxEntries(),
    source: activeSource,
    serverReachable,
    isDemo: activeSource === OUTBOX_SOURCE.DEMO,
  };
}

export function setUnifiedOutbox(items, source = OUTBOX_SOURCE.SERVER, reachable = true) {
  activeItems = [...items];
  activeSource = source;
  serverReachable = reachable;
  notify();
  return getUnifiedOutboxSnapshot();
}

export function useDemoOutboxFallback() {
  activeItems = getMailOutboxEntries();
  activeSource = OUTBOX_SOURCE.DEMO;
  serverReachable = false;
  notify();
  return getUnifiedOutboxSnapshot();
}

export function isServerOutboxActive() {
  return activeSource === OUTBOX_SOURCE.SERVER;
}

export function patchUnifiedMailEntry(mailId, patch) {
  if (!activeItems) return null;
  activeItems = activeItems.map((m) => (
    m.id === mailId ? { ...m, ...patch, updatedAt: new Date().toISOString() } : m
  ));
  notify();
  return activeItems.find((m) => m.id === mailId) ?? null;
}

export function resetUnifiedOutboxForTests() {
  activeItems = null;
  activeSource = OUTBOX_SOURCE.DEMO;
  serverReachable = false;
  listeners.clear();
}

export function listUnifiedMailOutbox() {
  return getUnifiedOutboxSnapshot().items;
}

export function getUnifiedMailOutboxStats(items = listUnifiedMailOutbox()) {
  return {
    total: items.length,
    sent: items.filter((m) => m.status === 'sent').length,
    queued: items.filter((m) => m.status === 'queued').length,
    failed: items.filter((m) => m.status === 'failed').length,
  };
}
