/**
 * Client-API für Berater-Suche, Fahrzeuge und Kunden-Share-Links.
 * Backend ist Single Source of Truth; lokale Berechnung nur als Fallback.
 */

const API_BASE = '/api/v1';

async function parseJson(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || `API ${res.status}`);
  }
  return data;
}

export async function fetchAdvisorDiscoverySearch(payload) {
  const res = await fetch(`${API_BASE}/advisor/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function fetchSalesAdvisorSearch(payload) {
  const res = await fetch(`${API_BASE}/advisor/sales`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function fetchAdvisorVehicle(slug, dealerSlug, context = {}) {
  const qs = new URLSearchParams();
  if (dealerSlug) qs.set('dealerSlug', dealerSlug);
  if (context.query) qs.set('query', context.query);
  if (context.features?.length) qs.set('features', context.features.join(','));
  if (context.fuel) qs.set('fuel', context.fuel);
  if (context.useCase) qs.set('useCase', context.useCase);
  if (context.type) qs.set('type', context.type);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetch(`${API_BASE}/advisor/vehicles/${encodeURIComponent(slug)}${suffix}`);
  return parseJson(res);
}

export async function createAdvisorShareOnServer(payload) {
  const res = await fetch(`${API_BASE}/advisor/share`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function loadAdvisorShareFromServer(token) {
  const res = await fetch(`${API_BASE}/advisor/share/${encodeURIComponent(token)}`);
  return parseJson(res);
}

export async function confirmAdvisorShareInquiryOnServer(token, customer = {}) {
  const res = await fetch(`${API_BASE}/advisor/share/${encodeURIComponent(token)}/inquiry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customer }),
  });
  return parseJson(res);
}

export async function fetchCustomerShareSessions(email) {
  const qs = new URLSearchParams({ email: email.trim().toLowerCase() });
  const res = await fetch(`${API_BASE}/advisor/customer-shares?${qs.toString()}`);
  const data = await parseJson(res);
  return data.sessions ?? [];
}

export async function isAdvisorServerAvailable() {
  try {
    const res = await fetch(`${API_BASE}/advisor/health`, { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}
