/**
 * Pilot-Flow E2E über HTTP (Gespräch → Share → Anfrage → Kundenkonto)
 * Voraussetzung: npm run dev:pilot (Server auf :3001)
 * node server/pilotFlowE2e.test.js
 */

import assert from 'node:assert/strict';

const BASE = (process.env.PILOT_API_BASE || 'http://127.0.0.1:3001/api/v1').replace(/\/$/, '');
const TEST_EMAIL = `pilot-flow-${Date.now()}@test.de`;

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    throw new Error(`GET ${path} → ${res.status}: ${data.message || res.statusText}`);
  }
  return data;
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    throw new Error(`POST ${path} → ${res.status}: ${data.message || res.statusText}`);
  }
  return data;
}

async function ensureServer() {
  try {
    const health = await fetch(`${BASE.replace('/api/v1', '')}/health`);
    if (!health.ok) throw new Error('health failed');
    const advisor = await fetch(`${BASE}/advisor/health`);
    const ct = advisor.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      throw new Error('advisor API fehlt – alter Server auf :3001? Prozess beenden und npm run dev:pilot neu starten');
    }
    const data = await advisor.json();
    if (!data.ok) throw new Error('advisor health not ok');
  } catch (err) {
    console.error(err.message || 'Server nicht erreichbar. Bitte zuerst: npm run dev:pilot');
    process.exit(1);
  }
}

await ensureServer();

// 1) Gesprächsmodus: Elektro + Familie
const sales = await post('/advisor/sales', {
  chipIds: ['fuel_elektro', 'daily_family'],
  dealerSlug: 'autohaus-trinkle',
  limit: 12,
});

assert.ok(sales.matches.length >= 3, 'Sales: mindestens 3 Treffer');
assert.ok(sales.modelLineGroups.length >= 3, 'Sales: Modelllinien');

const modelKeys = sales.modelLineGroups.map((g) => g.modelLineKey);
assert.ok(modelKeys.includes('ev3'), 'EV3 in Ergebnissen');
assert.ok(!modelKeys.includes('niro-ev'), 'Niro EV ausgeschlossen');

const cqPercents = sales.matches.map((m) => m.cleverQuote?.percent).filter(Boolean);
assert.ok(cqPercents.length >= 3, 'CleverQuote vorhanden');
assert.ok(Math.max(...cqPercents) - Math.min(...cqPercents) >= 5, 'CleverQuote differenziert');

// 2) Vergleichslink erstellen (Share)
const share = await post('/advisor/share', {
  chipIds: ['fuel_elektro', 'daily_family'],
  wishLabels: ['Elektro', 'Familie'],
  customer: { name: 'Pilot Test', email: TEST_EMAIL, phone: '+491701234567' },
  sellerName: 'Mike Quach',
  dealerName: 'Autohaus Trinkle',
  dealerSlug: 'autohaus-trinkle',
  matches: sales.matches.slice(0, 3),
  modelLineGroups: sales.modelLineGroups.slice(0, 3),
});

assert.ok(share.token, 'Share-Token');
assert.ok(share.url?.includes('/vergleich/'), 'Share-URL');
assert.ok(share.leadId?.startsWith('lead-share-'), 'Pilot-Lead angelegt');

// 3) Kunde öffnet Vergleich
const loaded = await get(`/advisor/share/${encodeURIComponent(share.token)}`);
assert.equal(loaded.session.token, share.token);
assert.equal(loaded.session.matches.length, 3);
assert.equal(loaded.session.inquiryConfirmed, false);

// 4) Lead-Status: Angebot versendet
const leadsAfterShare = await get('/pilot/leads?dealerId=autohaus-trinkle');
const leadAfterShare = leadsAfterShare.leads.find((l) => l.id === share.leadId);
assert.ok(leadAfterShare, 'Lead im Pilot-Store');
assert.equal(leadAfterShare.status, 'angebotVersendet');
assert.equal(leadAfterShare.contact.email, TEST_EMAIL);

// 5) Kunde bestätigt Anfrage
const inquiry = await post(`/advisor/share/${encodeURIComponent(share.token)}/inquiry`, {
  customer: { name: 'Pilot Test', email: TEST_EMAIL },
});
assert.equal(inquiry.session.inquiryConfirmed, true);
assert.equal(inquiry.lead.status, 'neu');

// 6) Kundenkonto: Vergleiche per E-Mail
const customerShares = await get(`/advisor/customer-shares?email=${encodeURIComponent(TEST_EMAIL)}`);
assert.ok(customerShares.sessions.some((s) => s.token === share.token), 'Share in Kundenliste');

// 7) Kundenakte
const recordId = `beratung-${share.token.toLowerCase()}`;
const recordRes = await get(`/advisor/customer-records/${encodeURIComponent(recordId)}`);
assert.equal(recordRes.record.inquiryConfirmed, true);
assert.equal(recordRes.record.nextStep, 'Kunde hat Anfrage bestätigt');
assert.ok(recordRes.record.selectedVehicles.length >= 1, 'Fahrzeuge in Akte');

console.log('pilotFlowE2e OK');
console.log(`  Vergleich: http://127.0.0.1:5173${share.url}`);
console.log(`  Kundenkonto: http://127.0.0.1:5173/mein-bereich (Login: ${TEST_EMAIL})`);
