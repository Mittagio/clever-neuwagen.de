import { loadPilotLeads, upsertPilotLead } from './pilotLeadsStore.js';
import {
  buildPilotLeadFromShareSession,
  shareSessionLeadId,
} from '../src/services/advisor/sharePilotLead.js';

export function findPilotLeadForShareToken(token) {
  const id = shareSessionLeadId(token);
  const data = loadPilotLeads();
  return data.leads.find((l) => l.id === id) ?? null;
}

/**
 * Share-Session in Pilot-Leads spiegeln (Verkäufer-Inbox).
 * @param {object} session
 * @param {'created'|'viewed'|'inquiry_confirmed'} event
 */
export function syncShareSessionToPilotLead(session, event = 'created') {
  if (!session?.token) return null;
  const existing = findPilotLeadForShareToken(session.token);
  const lead = buildPilotLeadFromShareSession(session, existing, event);
  upsertPilotLead(lead);
  return lead;
}
