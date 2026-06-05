import { PILOT_DEALER_ID, PILOT_LIVE } from '../../config/pilotLive.js';

const API_BASE = '/api/v1';

export function isPilotLeadsSyncEnabled() {
  return PILOT_LIVE;
}

export async function fetchPilotLeadsFromServer(dealerId = PILOT_DEALER_ID) {
  if (!isPilotLeadsSyncEnabled()) return [];
  try {
    const qs = dealerId ? `?dealerId=${encodeURIComponent(dealerId)}` : '';
    const res = await fetch(`${API_BASE}/pilot/leads${qs}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.leads) ? data.leads : [];
  } catch {
    return [];
  }
}

export async function pushPilotLeadToServer(lead) {
  if (!isPilotLeadsSyncEnabled() || !lead?.id) return false;
  try {
    const res = await fetch(`${API_BASE}/pilot/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function patchPilotLeadOnServer(id, partial) {
  if (!isPilotLeadsSyncEnabled() || !id) return false;
  try {
    const res = await fetch(`${API_BASE}/pilot/leads/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partial),
    });
    return res.ok;
  } catch {
    return false;
  }
}
