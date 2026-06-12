/**
 * Server-API für Stammdaten-Overrides und offene Kundenfragen.
 */
const API_BASE = '/api/v1';

async function parseJson(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message ?? `HTTP ${res.status}`);
  }
  return data;
}

export async function fetchStammdatenOverrides() {
  const data = await parseJson(await fetch(`${API_BASE}/admin/stammdaten/overrides`));
  return data.overrides ?? {};
}

/**
 * @param {string} modelKey
 * @param {object} patch
 */
export async function patchStammdatenOverrideApi(modelKey, patch) {
  const data = await parseJson(await fetch(
    `${API_BASE}/admin/stammdaten/overrides/${encodeURIComponent(modelKey)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patch }),
    },
  ));
  return data.patch;
}

/**
 * @param {Record<string, object>} overrides
 */
export async function putStammdatenOverridesApi(overrides) {
  const data = await parseJson(await fetch(`${API_BASE}/admin/stammdaten/overrides`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ overrides }),
  }));
  return data.overrides ?? {};
}

/**
 * @param {{ status?: string }} [opts]
 */
export async function fetchOpenCustomerQuestions(opts = {}) {
  const qs = opts.status ? `?status=${encodeURIComponent(opts.status)}` : '';
  const data = await parseJson(await fetch(`${API_BASE}/admin/open-questions${qs}`));
  return data.items ?? [];
}

/**
 * @param {object} entry
 */
export async function postOpenCustomerQuestionApi(entry) {
  const data = await parseJson(await fetch(`${API_BASE}/admin/open-questions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  }));
  return data.item;
}

/**
 * @param {string} id
 * @param {object} updates
 */
export async function patchOpenCustomerQuestionApi(id, updates) {
  const data = await parseJson(await fetch(
    `${API_BASE}/admin/open-questions/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    },
  ));
  return data.item;
}
