/**
 * Advisor-Backend Tests
 * node server/advisorEngine.test.js
 */

import assert from 'node:assert/strict';
import {
  runServerDiscoverySearch,
  runServerSalesSearch,
  getServerVehicleBySlug,
} from './advisorEngine.js';
import {
  createAdvisorShareSession,
  getAdvisorShareSession,
  confirmAdvisorShareInquiry,
} from './advisorShareStore.js';

const discovery = runServerDiscoverySearch({
  query: 'Elektro',
  filters: { useCase: 'family', fuel: 'elektro' },
  dealerSlug: 'autohaus-trinkle',
});

assert.ok(discovery.matches.length >= 4, 'Discovery: mehrere Modelllinien');
assert.ok(discovery.modelLineGroups.length >= 4, 'Discovery: Modelllinien-Gruppen');

const ev3 = discovery.modelLineGroups.find((g) => g.modelLineKey === 'ev3');
assert.ok(ev3, 'EV3 Gruppe');
assert.equal(ev3.variantCount, 3, 'EV3: drei Ausstattungen');

const sales = runServerSalesSearch({
  chipIds: ['fuel_elektro', 'daily_family'],
  dealerSlug: 'autohaus-trinkle',
  limit: 12,
});

assert.ok(sales.matches.length >= 3, 'Sales: Treffer');
assert.ok(sales.modelLineGroups.length >= 3, 'Sales: Modelllinien');

const slug = sales.matches[0]?.slug;
assert.ok(slug, 'Slug vorhanden');
const vehicleResult = getServerVehicleBySlug(slug, 'autohaus-trinkle');
assert.equal(vehicleResult.vehicle.slug, slug, 'Fahrzeug per Slug');
assert.equal(vehicleResult.match.slug, slug, 'Match per Slug');
assert.ok(vehicleResult.vehicle.monthlyRate != null, 'Vollständiges Listing');

const session = createAdvisorShareSession({
  token: 'TEST-SHARE-001',
  chipIds: ['fuel_elektro'],
  customer: { name: 'Max Mustermann' },
  sellerName: 'Berater',
  dealerName: 'Autohaus Trinkle',
  matches: sales.matches.slice(0, 3),
  modelLineGroups: sales.modelLineGroups.slice(0, 3),
});

assert.equal(session.token, 'TEST-SHARE-001');

const loaded = getAdvisorShareSession('test-share-001');
assert.ok(loaded, 'Share-Session geladen');
assert.equal(loaded.matches.length, 3);
assert.equal(loaded.modelLineGroups.length, 3);

const confirmed = confirmAdvisorShareInquiry('TEST-SHARE-001');
assert.equal(confirmed.inquiryConfirmed, true);

console.log('advisorEngine tests OK');
