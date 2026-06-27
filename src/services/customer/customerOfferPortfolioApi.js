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

export { PORTFOLIO_EVENTS };
