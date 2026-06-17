import assert from 'node:assert/strict';
import {
  buildKundenaktePath,
  buildParsedFromLead,
  formatInquiryCustomerName,
  getNewInquiryLeads,
  getLeadSourceLabel,
} from './leadAkteEntry.js';

const leads = [
  { id: 'a', status: 'neu', createdAt: '2026-05-29T12:00:00Z', source: 'dealerAi', vehicle: { model: 'EV2', brand: 'Kia' }, paymentType: 'cash' },
  { id: 'b', status: 'neu', createdAt: '2026-05-28T12:00:00Z', source: 'landing', contact: { name: 'Max Müller' } },
  { id: 'c', status: 'inBearbeitung', createdAt: '2026-05-27T12:00:00Z' },
];

assert.equal(getNewInquiryLeads(leads).length, 2);
assert.equal(getNewInquiryLeads(leads)[0].id, 'a');
assert.equal(formatInquiryCustomerName({ contact: { name: 'Kunde (offen)' } }), 'Kunde noch offen');
assert.equal(getLeadSourceLabel('dealerAi'), 'Verkaufsassistent');
assert.equal(getLeadSourceLabel('landing'), 'Landingpage');
assert.equal(buildKundenaktePath('lead-1'), '/backend/kundenakte/lead-1');

const parsed = buildParsedFromLead(leads[0], (p) => p);
assert.equal(parsed.ok, true);
assert.equal(parsed.fields.model, 'EV2');

console.log('leadAkteEntry.test.js: OK');
