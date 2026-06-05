import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'customer-records.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function emptyStore() {
  return { records: [], lastUpdated: null };
}

export function loadCustomerRecordsStore() {
  ensureDataDir();
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (err) {
    console.warn('[customer-records] load failed:', err.message);
  }
  return emptyStore();
}

function saveStore(records) {
  ensureDataDir();
  const sorted = [...records].sort(
    (a, b) => (b.savedAt ?? b.updatedAt ?? 0) - (a.savedAt ?? a.updatedAt ?? 0),
  );
  const data = {
    records: sorted.slice(0, 200),
    lastUpdated: new Date().toISOString(),
  };
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
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
