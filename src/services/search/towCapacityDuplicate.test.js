/**
 * node src/services/search/towCapacityDuplicate.test.js
 */
import assert from 'node:assert/strict';
import { parseSearchIntent } from './searchIntentParser.js';
import { buildSearchProfile } from './searchProfile.js';
import { parseCustomerWish } from '../wish/wishParser.js';
import { intentToMarketplaceFilters } from './intentToFilters.js';
import { evaluateVehicleAgainstProfile } from './vehicleFeatureRuleEngine.js';
import { computeWeightedWishPercent } from './profileWishScore.js';

const q = '2 Tonnen Anhängelast hybrid';
const intent = parseSearchIntent(q);
const filters = intentToMarketplaceFilters(intent);
const wishes = parseCustomerWish(q, filters.features);
const profile = buildSearchProfile({ query: q, intent, filters, wishes });

assert.ok(!profile.requiredFeatures.includes('tow_capacity_2000'), 'kein doppeltes tow_capacity Feature');
assert.equal(profile.towCapacityKg, 2000);

const vehicle = {
  brand: 'Kia',
  model: 'Sorento Hybrid',
  title: 'Kia Sorento Hybrid Spirit',
  powertrain: 'hybrid',
};

const evaluation = evaluateVehicleAgainstProfile(profile, vehicle);
const towChecks = evaluation.checks.filter((c) =>
  c.id === 'tow_braked' || c.id.startsWith('tow_capacity_'),
);
assert.equal(towChecks.length, 1, 'nur eine Anhängelast-Prüfung');
assert.equal(towChecks[0].status, 'fulfilled');

const fuelCheck = evaluation.checks.find((c) => c.id === 'fuel');
assert.equal(fuelCheck?.status, 'fulfilled', 'Sorento Hybrid erfüllt Hybrid-Wunsch');

const percent = computeWeightedWishPercent(evaluation.checks);
assert.ok(percent > 50, `Quote sollte steigen, war ${percent}%`);

console.log('towCapacityDuplicate.test.js: ok');
