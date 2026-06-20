const API_BASE = '/api/v1/admin/foundation';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message ?? `Foundation API ${res.status}`);
  }
  return data;
}

export function fetchFoundationDatabase() {
  return request('');
}

export function saveFoundationDatabase(database) {
  return request('', { method: 'PUT', body: JSON.stringify({ database }) });
}

export function fetchModelYearBundle(modelYearId) {
  return request(`/model-years/${encodeURIComponent(modelYearId)}`);
}

export function validateModelYear(modelYearId) {
  return request(`/model-years/${encodeURIComponent(modelYearId)}/validate`);
}

export function testConfiguration(modelYearId, selection, audience = 'admin') {
  return request(`/model-years/${encodeURIComponent(modelYearId)}/test-config`, {
    method: 'POST',
    body: JSON.stringify({ selection, audience }),
  });
}

export function upsertFoundationRule(rule) {
  const id = rule.id ? `/${encodeURIComponent(rule.id)}` : '';
  return request(`/rules${id}`, { method: 'PUT', body: JSON.stringify({ rule }) });
}

export function deleteFoundationRule(ruleId) {
  return request(`/rules/${encodeURIComponent(ruleId)}`, { method: 'DELETE' });
}

export function fetchFoundationStatus() {
  return request('/status');
}
