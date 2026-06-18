/**
 * Kundenanfragen vom Frontend an das Backend (Verkaufschancen-Inbox).
 */
const API_BASE = '/api/v1';

/**
 * @param {{
 *   type?: 'lead' | 'offer_action' | 'inquiry',
 *   lead?: object,
 *   offer?: object,
 *   action?: string,
 *   contact?: object,
 *   message?: string,
 *   sonderwuensche?: object,
 * }} payload
 * @returns {Promise<{ ok: boolean, lead?: object, leadId?: string, isNew?: boolean }|null>}
 */
export async function syncCustomerInquiryToBackend(payload = {}) {
  const body = payload.type === 'offer_action'
    ? payload
  : {
    type: payload.type ?? 'lead',
    lead: payload.lead,
  };

  if (!body.lead?.id && body.type !== 'offer_action') {
    return null;
  }
  if (body.type === 'offer_action' && !body.offer) {
    return null;
  }

  try {
    const res = await fetch(`${API_BASE}/customer/inquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
