import { createJsonStore } from '../jsonStore.js';

const store = createJsonStore({
  fileName: 'mail-outbox.json',
  createEmpty: () => ({ entries: [] }),
  logTag: 'mail-outbox',
});

export function listServerMailOutbox() {
  return store.load().entries ?? [];
}

export function appendServerMailEntry(entry) {
  const data = store.load();
  const entries = [entry, ...(data.entries ?? [])].slice(0, 200);
  store.save({ entries });
  return entry;
}

export function updateServerMailEntry(mailId, patch) {
  const data = store.load();
  const entries = (data.entries ?? []).map((m) => (
    m.id === mailId ? { ...m, ...patch, updatedAt: new Date().toISOString() } : m
  ));
  store.save({ entries });
  return entries.find((m) => m.id === mailId) ?? null;
}

export function findServerMailEntry(mailId) {
  return listServerMailOutbox().find((m) => m.id === mailId) ?? null;
}

export function setServerMailOutbox(entries = []) {
  store.save({ entries: entries.slice(0, 200) });
  return listServerMailOutbox();
}

export function resetServerMailOutboxForTests(entries = []) {
  setServerMailOutbox(entries);
}
