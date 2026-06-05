import {
  buildCustomerRecordId,
  buildCustomerRecordPayload,
  customerRecordIdForShareToken,
} from './customerRecordModel.js';
import {
  fetchCustomerRecordsFromServer,
  fetchCustomerRecordFromServer,
  pushCustomerRecordToServer,
  patchCustomerRecordOnServer,
} from './customerRecordsApi.js';
import { isAdvisorServerAvailable } from '../advisor/advisorApi.js';

export { buildCustomerRecordId, buildCustomerRecordPayload, customerRecordIdForShareToken };

const RECORDS_KEY = 'cn-conversation-records';

function readLocalRecords() {
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeLocalRecords(records) {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records.slice(0, 100)));
}

function cacheLocalRecord(record) {
  const records = readLocalRecords();
  const idx = records.findIndex((r) => r.id === record.id);
  if (idx >= 0) records[idx] = { ...records[idx], ...record };
  else records.unshift(record);
  writeLocalRecords(records);
}

function mergeRecords(local = [], remote = []) {
  const map = new Map();
  for (const record of local) map.set(record.id, record);
  for (const record of remote) {
    const prev = map.get(record.id);
    if (!prev || (record.updatedAt ?? record.savedAt ?? 0) >= (prev.updatedAt ?? prev.savedAt ?? 0)) {
      map.set(record.id, record);
    }
  }
  return [...map.values()].sort(
    (a, b) => (b.savedAt ?? b.updatedAt ?? 0) - (a.savedAt ?? a.updatedAt ?? 0),
  );
}

export async function saveCustomerRecord(record) {
  const now = Date.now();
  const entry = {
    savedAt: record.savedAt ?? now,
    updatedAt: now,
    source: 'local',
    ...record,
    id: record.id ?? buildCustomerRecordId({ shareToken: record.shareToken, customer: record.customer }),
  };

  try {
    if (await isAdvisorServerAvailable()) {
      const remote = await pushCustomerRecordToServer(entry);
      const saved = { ...entry, ...(remote.record ?? entry), source: 'server' };
      cacheLocalRecord(saved);
      return saved;
    }
  } catch {
    // Fallback lokal
  }

  cacheLocalRecord(entry);
  return entry;
}

export async function loadCustomerRecords(limit = 20, dealerId = null) {
  try {
    if (await isAdvisorServerAvailable()) {
      const remote = await fetchCustomerRecordsFromServer(dealerId, limit);
      const merged = mergeRecords(readLocalRecords(), remote).slice(0, limit);
      writeLocalRecords(merged);
      return merged;
    }
  } catch {
    // local fallback
  }
  return readLocalRecords().slice(0, limit);
}

export async function getCustomerRecord(id) {
  try {
    if (await isAdvisorServerAvailable()) {
      const remote = await fetchCustomerRecordFromServer(id);
      if (remote) {
        cacheLocalRecord(remote);
        return remote;
      }
    }
  } catch {
    // local fallback
  }
  return readLocalRecords().find((r) => r.id === id) ?? null;
}

export async function patchCustomerRecordByShareToken(shareToken, partial = {}) {
  if (!shareToken) return null;
  const id = customerRecordIdForShareToken(shareToken);
  const existing = await getCustomerRecord(id);

  const entry = {
    ...(existing ?? { id, shareToken, savedAt: Date.now() }),
    ...partial,
    id,
    shareToken,
    updatedAt: Date.now(),
  };

  try {
    if (await isAdvisorServerAvailable()) {
      if (existing) {
        const remote = await patchCustomerRecordOnServer(id, entry);
        const saved = remote.record ?? entry;
        cacheLocalRecord(saved);
        return saved;
      }
      return saveCustomerRecord(entry);
    }
  } catch {
    // local fallback
  }

  cacheLocalRecord(entry);
  return entry;
}
