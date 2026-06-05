import { createJsonStore } from './jsonStore.js';

const store = createJsonStore({
  fileName: 'customer-records.json',
  createEmpty: () => ({ records: [], lastUpdated: null }),
  logTag: 'customer-records',
});

export function loadCustomerRecordsStore() {
  return store.load();
}

function saveStore(records) {
  const sorted = [...records].sort(
    (a, b) => (b.savedAt ?? b.updatedAt ?? 0) - (a.savedAt ?? a.updatedAt ?? 0),
  );
  const data = {
    records: sorted.slice(0, 200),
    lastUpdated: new Date().toISOString(),
  };
  store.save(data);
  return data;
}

export function listCustomerRecords(dealerId = null, limit = 50) {
  const data = loadCustomerRecordsStore();
  let records = data.records ?? [];
  if (dealerId) {
    records = records.filter((r) => !r.dealerSlug || r.dealerSlug === dealerId);
  }
  return {
    records: records.slice(0, limit),
    lastUpdated: data.lastUpdated,
    count: records.length,
  };
}

export function getCustomerRecordById(id) {
  if (!id) return null;
  const data = loadCustomerRecordsStore();
  return data.records.find((r) => r.id === id) ?? null;
}

export function upsertCustomerRecord(record) {
  if (!record?.id) throw new Error('record.id required');

  const data = loadCustomerRecordsStore();
  const now = Date.now();
  const idx = data.records.findIndex((r) => r.id === record.id);

  const entry = {
    ...record,
    id: record.id,
    savedAt: record.savedAt ?? now,
    updatedAt: now,
  };

  if (idx >= 0) {
    data.records[idx] = { ...data.records[idx], ...entry };
  } else {
    data.records.unshift(entry);
  }

  return saveStore(data.records);
}

export function patchCustomerRecord(id, partial = {}) {
  const existing = getCustomerRecordById(id);
  if (!existing) return null;
  return upsertCustomerRecord({ ...existing, ...partial, id });
}

export function getCustomerRecordsStoreStat() {
  return store.stat();
}
