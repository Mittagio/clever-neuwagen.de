import { createJsonStore } from './jsonStore.js';
import { kiaFoundationSeed } from '../src/data/foundation/seeds/kiaFoundationSeed.js';
import { mergeFoundationDatabases } from '../src/data/foundation/legacyFoundationImporter.js';
import { foundationId } from '../src/data/foundation/configuratorFoundationSchema.js';

const store = createJsonStore({
  fileName: 'configurator-foundation.json',
  createEmpty: () => kiaFoundationSeed,
  logTag: 'configurator-foundation',
});

export function loadConfiguratorFoundation() {
  return store.load();
}

export function saveConfiguratorFoundation(db) {
  return store.save(db);
}

export function getConfiguratorFoundationStatus() {
  return store.stat();
}

export function upsertRule(rule) {
  const db = loadConfiguratorFoundation();
  const idx = db.rules.findIndex((r) => r.id === rule.id);
  const now = new Date().toISOString();
  const next = { ...rule, updatedAt: now };
  if (idx >= 0) db.rules[idx] = { ...db.rules[idx], ...next };
  else db.rules.push({ ...next, id: rule.id ?? foundationId('rule'), createdAt: now });
  saveConfiguratorFoundation(db);
  return next;
}

export function deleteRule(ruleId) {
  const db = loadConfiguratorFoundation();
  db.rules = db.rules.filter((r) => r.id !== ruleId);
  saveConfiguratorFoundation(db);
  return { ok: true };
}

export function appendChangeLog(entry) {
  const db = loadConfiguratorFoundation();
  const now = new Date().toISOString();
  db.changeLogs.unshift({
    id: foundationId('log'),
    createdAt: now,
    ...entry,
  });
  saveConfiguratorFoundation(db);
  return db.changeLogs[0];
}

export function mergeFoundationPatch(patchDb) {
  const current = loadConfiguratorFoundation();
  const merged = mergeFoundationDatabases(current, patchDb);
  saveConfiguratorFoundation(merged);
  return merged;
}
