import { PILOT_DEALER_ID, PILOT_LIVE } from '../../config/pilotLive.js';
import { PILOT_LEAD_ID } from '../../data/demoLeads.js';

const API_BASE = '/api/v1';

const DEMO_LEAD_PREFIXES = ['lead-demo-', 'lead-pilot-'];

/** Demo-Seeds nur ohne Pilot-LIVE; Server-Sync läuft immer wenn API erreichbar. */
export function isPilotLeadsSyncEnabled() {
  return true;
}

export function isPersistablePilotLead(lead) {
  const id = lead?.id ?? lead;
  if (!id || typeof id !== 'string') return false;
  if (id === PILOT_LEAD_ID) return false;
  if (DEMO_LEAD_PREFIXES.some((p) => id.startsWith(p))) return false;
  return true;
}

export async function fetchPilotLeadsFromServer(dealerId = PILOT_DEALER_ID) {
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
  if (!isPersistablePilotLead(lead)) return false;
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
  if (!isPersistablePilotLead({ id })) return false;
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

/** @deprecated Nutze isPersistablePilotLead – PILOT_LIVE steuert nur Demo-Daten im UI. */
export function usesPilotLiveDemoLeads() {
  return PILOT_LIVE;
}
