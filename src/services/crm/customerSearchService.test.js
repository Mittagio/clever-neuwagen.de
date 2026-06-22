import assert from 'node:assert/strict';

globalThis.localStorage = {
  store: {},
  setItem(key, value) {
    this.store[key] = value;
  },
  getItem(key) {
    return this.store[key] ?? null;
  },
  removeItem(key) {
    delete this.store[key];
  },
};

import { DEMO_LEADS } from '../../data/demoLeads.js';
import {
  RECENT_CUSTOMER_RECORDS_KEY,
  buildCustomerSearchResult,
  getRecentCustomerRecords,
  normalizeCustomerSearchQuery,
  recordRecentCustomerOpen,
  resolveCustomerOpenAction,
  searchCustomers,
} from './customerSearchService.js';

const leads = DEMO_LEADS;

assert.ok(searchCustomers('Müller', leads).length >= 1, 'Nachname findet Kunden');
assert.ok(
  searchCustomers('Müller', leads).some((r) => r.customerName.includes('Müller')),
  'Treffer enthält Müller',
);

assert.ok(
  searchCustomers('0171', leads).some((r) => r.customerName.includes('Weber')),
  'Telefonnummer findet Kunden',
);

assert.ok(
  searchCustomers('sarah.mueller@mail.de', leads).length === 1,
  'E-Mail findet Kunden',
);
assert.equal(searchCustomers('sarah.mueller@mail.de', leads)[0].customerName, 'Sarah Müller');

assert.ok(
  searchCustomers('sportage', leads).length >= 2,
  'Fahrzeugmodell findet Kunden',
);

assert.ok(
  searchCustomers('EV3', leads).some((r) => r.vehicleLabel.toLowerCase().includes('ev3')),
  'EV3 findet Kunden',
);

assert.equal(
  searchCustomers('CN-2026-00004', leads)[0]?.customerName,
  'Max Müller',
  'CN-Nummer findet Kunden',
);

assert.equal(searchCustomers('xyz-nicht-vorhanden-999', leads).length, 0, 'Kein Treffer bei unbekanntem Suchbegriff');

const openAction = resolveCustomerOpenAction('lead-demo-001', leads);
assert.equal(openAction.action, 'open');
assert.equal(openAction.leadId, 'lead-demo-001');
assert.equal(resolveCustomerOpenAction('lead-missing', leads).action, 'missing');

localStorage.removeItem(RECENT_CUSTOMER_RECORDS_KEY);
const sampleLead = leads.find((l) => l.id === 'lead-demo-001');
recordRecentCustomerOpen(sampleLead);
recordRecentCustomerOpen(leads.find((l) => l.id === 'lead-demo-002'));

const recent = getRecentCustomerRecords(leads);
assert.equal(recent.length, 2, 'Zuletzt geöffnete Kunden werden gespeichert');
assert.equal(recent[0].leadId, 'lead-demo-002', 'Neuester Eintrag zuerst');
assert.ok(recent[0].lastOpenedAt >= recent[1].lastOpenedAt, 'Sortierung nach lastOpenedAt');

const normalized = normalizeCustomerSearchQuery('  CN-2026-20  ');
assert.ok(normalized.referenceToken.includes('cn-2026'), 'CN-Query wird normalisiert');

const result = buildCustomerSearchResult(sampleLead);
assert.ok(result.customerName);
assert.ok(result.vehicleLabel);
assert.ok(result.statusLabel);

// Öffnen aus Suche erzeugt keine neue Verkaufschance – nur bestehende Lead-ID
assert.equal(resolveCustomerOpenAction(result.leadId, leads).action, 'open');

console.log('customerSearchService.test.js: ok');
