/**
 * node src/services/dealer/dealerWishChips.test.js
 */
import assert from 'node:assert/strict';
import {
  mergeDealerChipFilters,
  toggleDealerChipId,
  buildDealerSearchSummary,
} from './dealerWishChips.js';
import { buildSearchProfile } from '../search/searchProfile.js';
import { parseSearchIntent } from '../search/searchIntentParser.js';

const combo = mergeDealerChipFilters(['range_400', 'seats_7', 'heat_pump']);
assert.equal(combo.rangeKmMin, 400);
assert.equal(combo.seatsMin, 7);
assert.ok(combo.features.includes('heat_pump'));
assert.ok(combo.features.includes('seats_7'));

const profile = buildSearchProfile({
  intent: parseSearchIntent(''),
  filters: combo,
});
assert.equal(profile.minRangeKm, 400);
assert.equal(profile.seatsMin, 7);
assert.ok(profile.requiredFeatures.includes('heat_pump'));

const toggled = toggleDealerChipId(['heat_pump'], 'seats_7');
assert.deepEqual(toggled, ['heat_pump', 'seats_7']);
assert.deepEqual(toggleDealerChipId(toggled, 'heat_pump'), ['seats_7']);

assert.equal(
  buildDealerSearchSummary(['range_400', 'heat_pump'], ''),
  'Reichweite über 400 km · Wärmepumpe',
);

console.log('dealerWishChips.test.js: ok');
