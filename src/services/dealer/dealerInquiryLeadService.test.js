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

import {
  buildDealerSearchInquiryLead,
  extractEmailFromInquiryText,
  findRelatedInquiryLead,
  listWebsiteInquiryLeads,
  syncDealerSearchInquiryLead,
  writeInquirySessionLeadId,
  readInquirySessionLeadId,
} from './dealerInquiryLeadService.js';
import { parseSearchIntent } from '../search/searchIntentParser.js';

const dealerId = 'autohaus-trinkle';
const existing = {
  id: 'lead-existing-1',
  dealerId,
  status: 'angebotVersendet',
  source: 'dealerJourney',
  wishLabels: ['Elektro'],
  notes: 'Konfigurator-Anfrage EV5',
  updatedAt: new Date().toISOString(),
};

assert.equal(findRelatedInquiryLead([existing], dealerId)?.id, 'lead-existing-1');

const emailLead = {
  id: 'lead-email-1',
  dealerId,
  status: 'neu',
  source: 'configurator',
  contact: { email: 'kunde@example.com', name: 'Max Mustermann' },
  updatedAt: new Date().toISOString(),
};
assert.equal(
  findRelatedInquiryLead([emailLead, existing], dealerId, 'kunde@example.com')?.id,
  'lead-email-1',
);
assert.equal(
  extractEmailFromInquiryText('Bitte Rückruf an max@firma.de – habe schon geschrieben'),
  'max@firma.de',
);

const websiteList = listWebsiteInquiryLeads(
  [
    { id: 'a', source: 'dealerSearch', wishLabels: ['Hybrid'], updatedAt: '2026-01-01' },
    { id: 'b', source: 'pilot', inquiryContext: { existingLeadMentioned: true }, updatedAt: '2026-02-01' },
    { id: 'c', source: 'pilot', updatedAt: '2026-03-01' },
  ],
  null,
  5,
);
assert.deepEqual(websiteList.map((l) => l.id), ['b', 'a']);

const wohnwagenIntent = parseSearchIntent('Wohnwagen 1,8 t, drei Kinder, Hundebox');
assert.equal(wohnwagenIntent.towCapacityKg, 1800);
assert.equal(wohnwagenIntent.familyHint, 'Drei Kinder');
assert.ok(wohnwagenIntent.dogBoxHint);

const updates = [];
const histories = [];
const created = [];
const sync = syncDealerSearchInquiryLead({
  leads: [existing],
  addLead: (lead) => created.push(lead),
  updateLead: (id, patch) => updates.push({ id, patch }),
  addHistory: (id, text) => histories.push({ id, text }),
  dealerId,
  searchQuery: 'Anhängelast 1500 kg, bereits E-Mail geschickt',
  recognizedWishes: [{ label: 'Anhängelast ≥ 1,5 t' }],
  existingLeadMentioned: true,
});

assert.equal(sync.matched, true);
assert.equal(sync.leadId, 'lead-existing-1');
assert.equal(updates[0].patch.status, 'rueckfrageOffen');
assert.ok(histories.length >= 1);

writeInquirySessionLeadId(dealerId, 'lead-session-1');
assert.equal(readInquirySessionLeadId(dealerId), 'lead-session-1');

const newLead = buildDealerSearchInquiryLead({
  dealerId,
  searchQuery: 'Hybrid bis 400 €',
  recognizedWishes: [{ label: 'Hybrid' }],
});
assert.equal(newLead.source, 'dealerSearch');
assert.equal(newLead.status, 'rueckfrageOffen');

const emailSync = syncDealerSearchInquiryLead({
  leads: [],
  addLead: (lead) => created.push(lead),
  updateLead: (id, patch) => updates.push({ id, patch }),
  addHistory: (id, text) => histories.push({ id, text }),
  dealerId,
  searchQuery: 'Rückfrage – meine Mail ist kunde@example.com',
  recognizedWishes: [{ label: 'Elektro' }],
  existingLeadMentioned: true,
});
assert.equal(emailSync.created, true);
assert.equal(created.at(-1).contact.email, 'kunde@example.com');

console.log('dealerInquiryLeadService.test.js: ok');
