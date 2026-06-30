const API_BASE = '/api/v1';

/**
 * @param {object} payload
 */
export async function fetchCustomerQuery(payload = {}) {
  const res = await fetch(`${API_BASE}/clever/customer-query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(data.error ?? 'customer_query_failed');
  }
  return data;
}
