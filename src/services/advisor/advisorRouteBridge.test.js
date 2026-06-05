/**
 * node src/services/advisor/advisorRouteBridge.test.js
 */

import assert from 'node:assert/strict';
import {
  buildDiscoveryFiltersFromBeraterParams,
  buildFahrzeugeUrlFromAdvisorProfile,
  mapAdvisorWishesToFeatures,
} from './advisorRouteBridge.js';

const familyUrl = buildDiscoveryFiltersFromBeraterParams(
  new URLSearchParams('q=Elektro+Familie&fuel=elektro&household=family&rate=400'),
);
assert.ok(familyUrl.includes('/fahrzeuge'), 'Redirect-Ziel /fahrzeuge');
assert.ok(familyUrl.includes('query=Elektro'), 'Query erhalten');
assert.ok(familyUrl.includes('fuel=elektro'), 'Fuel');
assert.ok(familyUrl.includes('useCase=family'), 'UseCase Familie');
assert.ok(familyUrl.includes('maxRate=400'), 'Budget');

const towUrl = buildDiscoveryFiltersFromBeraterParams(
  new URLSearchParams('wishes=anhaenger,reichweite&q=SUV+mit+Anhänger'),
);
assert.ok(towUrl.includes('features=towbar'), 'Anhänger → towbar');
assert.ok(towUrl.includes('range_400'), 'Reichweite → range_400');

const features = mapAdvisorWishesToFeatures(['panorama', 'kamera360', 'gewerblich']);
assert.ok(features.includes('panorama_roof'), 'Panorama');
assert.ok(features.includes('camera_360'), 'Kamera');

const chipUrl = buildFahrzeugeUrlFromAdvisorProfile(
  { desiredRate: 400, household: 'family', fuelPreference: 'elektro', bodyType: 'suv', wishes: ['reichweite'] },
  'Elektroauto für Familie',
);
assert.ok(chipUrl.startsWith('/fahrzeuge?'), 'Chip-URL direkt auf Fahrzeuge');
assert.ok(chipUrl.includes('useCase=family'), 'Chip UseCase');

console.log('advisorRouteBridge tests OK');
