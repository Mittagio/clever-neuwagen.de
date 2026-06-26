import { CUSTOMER_LINK_EVENTS } from '../crm/customerLinkOfferService.js';

const API_BASE = '/api/v1';

/**
 * @param {object} params
 */
export async function fetchCustomerOfferLinkContext(params = {}) {
  const qs = new URLSearchParams();
  if (params.leadId) qs.set('leadId', params.leadId);
  if (params.vehicleCardId) qs.set('cardId', params.vehicleCardId);
  if (params.modelSlug) qs.set('modelSlug', params.modelSlug);
  if (params.customerSlug) qs.set('customerSlug', params.customerSlug);

  const query = qs.toString();
  const res = await fetch(`${API_BASE}/customer-offer-link/context${query ? `?${query}` : ''}`);
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
export async function postCustomerOfferLinkEvent(payload = {}) {
  const res = await fetch(`${API_BASE}/customer-offer-link/event`, {
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

export { CUSTOMER_LINK_EVENTS };
