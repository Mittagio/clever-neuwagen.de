/**
 * Kundenakten-API (Gesprächsmodus)
 */

const API_BASE = '/api/v1';

async function parseJson(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || `API ${res.status}`);
  }
  return data;
}

export async function fetchCustomerRecordsFromServer(dealerId = null, limit = 50) {
  const qs = new URLSearchParams();
  if (dealerId) qs.set('dealerId', dealerId);
  if (limit) qs.set('limit', String(limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetch(`${API_BASE}/advisor/customer-records${suffix}`);
  const data = await parseJson(res);
  return Array.isArray(data.records) ? data.records : [];
}

export async function fetchCustomerRecordFromServer(id) {
  const res = await fetch(`${API_BASE}/advisor/customer-records/${encodeURIComponent(id)}`);
  const data = await parseJson(res);
  return data.record ?? null;
}

export async function pushCustomerRecordToServer(record) {
  const res = await fetch(`${API_BASE}/advisor/customer-records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ record }),
  });
  return parseJson(res);
}

export async function patchCustomerRecordOnServer(id, partial) {
  const res = await fetch(`${API_BASE}/advisor/customer-records/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(partial),
  });
  return parseJson(res);
}
