/**
 * node src/services/search/availabilityPreference.test.js
 */
import assert from 'node:assert/strict';
import { filterMarketplaceVehicles } from '../../logic/marketplaceService.js';
import { buildSearchProfile } from './searchProfile.js';
import { parseSearchIntent } from './searchIntentParser.js';
import { runCleverSearch } from './cleverSearchPipeline.js';
import { compareAvailabilityPreference } from './availabilityPreference.js';

const pool = [
  { id: 'a', model: 'EV3', availability: 'bestell', monthlyRate: 299, powertrain: 'elektro', brand: 'Kia' },
  { id: 'b', model: 'EV3', availability: 'sofort', monthlyRate: 319, powertrain: 'elektro', brand: 'Kia' },
];

const hardFiltered = filterMarketplaceVehicles(pool, { availability: 'sofort', fuel: 'elektro' });
assert.equal(hardFiltered.length, 1, 'Hart: nur Lager');

const softFiltered = filterMarketplaceVehicles(pool, {
  availability: 'sofort',
  fuel: 'elektro',
  softAvailability: true,
});
assert.equal(softFiltered.length, 2, 'Soft: alle Elektro bleiben');

const profile = buildSearchProfile({
  intent: parseSearchIntent('Elektro sofort verfügbar'),
  filters: { fuel: 'elektro', availability: 'sofort' },
});
const result = runCleverSearch({
  profileOverride: profile,
  filters: { fuel: 'elektro', availability: 'sofort', softAvailability: true },
  vehicles: pool,
  wishes: { features: [], budget: {} },
  limit: 5,
});
assert.ok(result.matches.length >= 1, 'Pipeline: Ergebnisse trotz Verfügbarkeitswunsch');
const sofortInTop = result.matches.some((m) => m.vehicle.availability === 'sofort');
assert.ok(sofortInTop, 'Sofort-Fahrzeug in den Treffern');

assert.ok(compareAvailabilityPreference(
  { vehicle: pool[1] },
  { vehicle: pool[0] },
  'sofort',
) < 0);

console.log('availabilityPreference.test.js: ok');
