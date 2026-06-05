/**
 * Share → Pilot-Lead
 * node src/services/advisor/sharePilotLead.test.js
 */

import assert from 'node:assert/strict';
import { buildPilotLeadFromShareSession, shareSessionLeadId } from './sharePilotLead.js';
import { syncShareSessionToPilotLead } from '../../../server/sharePilotLeadSync.js';
import { loadPilotLeads } from '../../../server/pilotLeadsStore.js';

const session = {
  token: 'TEST-LEAD-001',
  chipIds: ['fuel_elektro'],
  customer: { name: 'Anna Test', email: 'anna@test.de', phone: '+491701234567' },
  sellerName: 'Mike Quach',
  dealerName: 'Autohaus Trinkle',
  dealerSlug: 'autohaus-trinkle',
  wishLabels: ['Elektro', 'Familie'],
  matches: [
    {
      slug: 'kia-ev3-air-0',
      title: 'Kia EV3',
      trimLabel: 'Air',
      monthlyRate: 299,
      cleverQuote: { percent: 88 },
      vehicle: { brand: 'Kia', model: 'EV3' },
    },
    {
      slug: 'kia-ev2-air-0',
      title: 'Kia EV2',
      trimLabel: 'Air',
      monthlyRate: 249,
      cleverQuote: { percent: 82 },
      vehicle: { brand: 'Kia', model: 'EV2' },
    },
  ],
  modelLineGroups: [],
};

const createdLead = buildPilotLeadFromShareSession(session, null, 'created');
assert.equal(shareSessionLeadId(session.token), 'lead-share-test-lead-001');
assert.equal(createdLead.status, 'angebotVersendet');
assert.equal(createdLead.source, 'gespraech');
assert.equal(createdLead.ownerId, 'mike-quach');
assert.equal(createdLead.contact.name, 'Anna Test');
assert.ok(createdLead.history.some((h) => /Vergleichslink erstellt/i.test(h.text)));

const confirmedSession = {
  ...session,
  inquiryConfirmed: true,
  inquiryConfirmedAt: Date.now(),
};
const confirmedLead = buildPilotLeadFromShareSession(confirmedSession, createdLead, 'inquiry_confirmed');
assert.equal(confirmedLead.status, 'neu');
assert.ok(confirmedLead.history.some((h) => /Anfrage über Vergleichslink bestätigt/i.test(h.text)));

syncShareSessionToPilotLead(session, 'created');
const stored = loadPilotLeads().leads.find((l) => l.id === shareSessionLeadId(session.token));
assert.ok(stored, 'Lead im Pilot-Store');
assert.equal(stored.status, 'angebotVersendet');

syncShareSessionToPilotLead(confirmedSession, 'inquiry_confirmed');
const updated = loadPilotLeads().leads.find((l) => l.id === shareSessionLeadId(session.token));
assert.equal(updated.status, 'neu');

console.log('sharePilotLead tests OK');
