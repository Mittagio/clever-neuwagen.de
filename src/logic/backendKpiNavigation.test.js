import assert from 'node:assert/strict';
import {
  filterOffersList,
  filterSalesChances,
  matchesFollowUpView,
  matchesNeedsOfferView,
  matchesNewRequestsView,
} from './backendKpiNavigation.js';

const leads = [
  { id: 'l1', status: 'neu', updatedAt: '2026-05-29T10:00:00Z' },
  { id: 'l2', status: 'inBearbeitung', crm: { pipelineStatusId: 'nachfassen' }, updatedAt: '2026-05-29T09:00:00Z' },
  { id: 'l3', status: 'angebotVersendet', updatedAt: '2026-05-28T09:00:00Z' },
];

assert.equal(filterSalesChances(leads, 'new').length, 1);
assert.ok(matchesNewRequestsView(leads[0]));
assert.ok(matchesFollowUpView(leads[1], new Set()));
assert.ok(matchesFollowUpView(leads[2], new Set()));
const needsOfferLead = {
  id: 'l4',
  status: 'inBearbeitung',
  vehicle: { model: 'EV2', brand: 'Kia', label: 'Kia EV2' },
  paymentType: 'cash',
  updatedAt: '2026-05-29T08:00:00Z',
};

assert.ok(matchesNeedsOfferView(needsOfferLead, []));
assert.equal(filterSalesChances([...leads, needsOfferLead], 'needs-offer', [], []).length, 1);

const withOffer = {
  ...needsOfferLead,
  offerCode: 'CN-1',
};
assert.ok(!matchesNeedsOfferView(withOffer, [{ code: 'CN-1', status: 'entwurf', leadId: 'l4' }]));

const offers = [
  { code: 'A', status: 'entwurf', updatedAt: '2026-05-29T10:00:00Z' },
  { code: 'B', status: 'versendet', updatedAt: '2026-05-29T09:00:00Z', tracking: { openedAt: '2026-05-29T11:00:00Z' } },
  { code: 'C', status: 'bestellung', updatedAt: '2026-05-29T08:00:00Z' },
];

assert.equal(filterOffersList(offers, 'open').length, 2);
assert.equal(filterOffersList(offers, 'opened').length, 0);

const openedOffers = [
  { code: 'X', status: 'geoeffnet', updatedAt: '2026-05-28T10:00:00Z', tracking: { openedAt: '2026-05-28T12:00:00Z' } },
  { code: 'Y', status: 'geoeffnet', updatedAt: '2026-05-29T10:00:00Z', tracking: { openedAt: '2026-05-29T15:00:00Z' } },
];
const sorted = filterOffersList(openedOffers, 'opened', 'lastOpenedDesc');
assert.equal(sorted[0].code, 'Y');

console.log('backendKpiNavigation.test.js: OK');
