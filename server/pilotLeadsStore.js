import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'pilot-leads.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function emptyStore() {
  return { leads: [], lastUpdated: null };
}

export function loadPilotLeads() {
  ensureDataDir();
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (err) {
    console.warn('[pilot-leads] load failed:', err.message);
  }
  return emptyStore();
}

export function savePilotLeads(leads) {
  ensureDataDir();
  const data = {
    leads: Array.isArray(leads) ? leads : [],
    lastUpdated: new Date().toISOString(),
  };
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
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
