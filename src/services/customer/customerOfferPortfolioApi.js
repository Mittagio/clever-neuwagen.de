import { PORTFOLIO_EVENTS } from '../crm/customerOfferPortfolioService.js';

const API_BASE = '/api/v1';

/**
 * @param {object} params
 */
export async function fetchCustomerOfferPortfolioContext(params = {}) {
  const qs = new URLSearchParams();
  if (params.leadId) qs.set('leadId', params.leadId);
  if (params.token) qs.set('token', params.token);
  if (params.customerSlug) qs.set('customerSlug', params.customerSlug);
  if (params.accessVerified) qs.set('accessVerified', 'true');

  const query = qs.toString();
  const res = await fetch(`${API_BASE}/customer-offer-portfolio/context${query ? `?${query}` : ''}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'context_not_found');
  }
  const data = await res.json();
  return data.context ?? null;
}

/**
 * @param {object} payload
 */
export async function postCustomerOfferPortfolioEvent(payload = {}) {
  const res = await fetch(`${API_BASE}/customer-offer-portfolio/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(data.error ?? 'event_failed');
  }
  return data;
}

/**
 * @param {object} payload
 */
export async function postCustomerOfferPortfolioMessage(payload = {}) {
  const res = await fetch(`${API_BASE}/customer-offer-portfolio/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(data.error ?? 'message_failed');
  }
  return data;
}

function portalSessionKey(leadId, token) {
  return `clever-portal-verified:${leadId}:${token}`;
}

export function isPortfolioAccessVerifiedLocally(leadId, token) {
  if (!leadId || !token || typeof sessionStorage === 'undefined') return false;
  return sessionStorage.getItem(portalSessionKey(leadId, token)) === '1';
}

export function markPortfolioAccessVerifiedLocally(leadId, token) {
  if (!leadId || !token || typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(portalSessionKey(leadId, token), '1');
}

export async function postCustomerPortalAccessOpen(payload = {}) {
  const res = await fetch(`${API_BASE}/customer-offer-portfolio/access/open`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(data.error ?? 'access_open_failed');
  }
  return data;
}

export async function postCustomerPortalAccessVerify(payload = {}) {
  const res = await fetch(`${API_BASE}/customer-offer-portfolio/access/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(data.error ?? 'invalid_code');
  }
  return data;
}

export async function postCustomerPortalAccessViewed(payload = {}) {
  const res = await fetch(`${API_BASE}/customer-offer-portfolio/access/viewed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(data.error ?? 'access_viewed_failed');
  }
  return data;
}

export { PORTFOLIO_EVENTS };
