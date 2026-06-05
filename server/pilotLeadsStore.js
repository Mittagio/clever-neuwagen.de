import { createJsonStore } from './jsonStore.js';

const store = createJsonStore({
  fileName: 'pilot-leads.json',
  createEmpty: () => ({ leads: [], lastUpdated: null }),
  logTag: 'pilot-leads',
});

export function loadPilotLeads() {
  return store.load();
}

export function savePilotLeads(leads) {
  const data = {
    leads: Array.isArray(leads) ? leads : [],
    lastUpdated: new Date().toISOString(),
  };
  store.save(data);
  return data;
}

export function upsertPilotLead(lead) {
  const data = loadPilotLeads();
  const idx = data.leads.findIndex((l) => l.id === lead.id);
  if (idx >= 0) {
    data.leads[idx] = { ...data.leads[idx], ...lead, updatedAt: new Date().toISOString() };
  } else {
    data.leads.unshift(lead);
  }
  return savePilotLeads(data.leads);
}

export function listPilotLeads(dealerId = null) {
  const data = loadPilotLeads();
  if (!dealerId) return data;
  return {
    ...data,
    leads: data.leads.filter((l) => !dealerId || l.dealerId === dealerId),
  };
}

export function getPilotLeadsStoreStat() {
  return store.stat();
}
