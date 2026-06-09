/**
 * node src/services/dealer/dealerWishChips.test.js
 */
import assert from 'node:assert/strict';
import {
  DEALER_WISH_CHIPS,
  mergeDealerChipFilters,
  toggleDealerChipId,
  toggleChipInQueryText,
  matchDealerChipIdsFromQuery,
  queryIncludesChip,
} from './dealerWishChips.js';
import { buildSearchProfile } from '../search/searchProfile.js';
import { parseSearchIntent } from '../search/searchIntentParser.js';

const combo = mergeDealerChipFilters(['range_400', 'seats_7', 'heat_pump']);
assert.equal(combo.rangeKmMin, 400);
assert.equal(combo.seatsMin, 7);
assert.ok(combo.features.includes('heat_pump'));

let query = toggleChipInQueryText('', 'fuel_elektro_300');
assert.equal(query, 'Elektro bis 300 €');

query = toggleChipInQueryText(query, 'towbar');
assert.equal(query, 'Elektro bis 300 € Anhängerkupplung');

query = toggleChipInQueryText(query, 'length_4m');
assert.equal(query, 'Elektro bis 300 € Anhängerkupplung bis 4 m Länge');

query = toggleChipInQueryText(query, 'towbar');
assert.equal(query, 'Elektro bis 300 € bis 4 m Länge');

assert.deepEqual(
  matchDealerChipIdsFromQuery('Elektro bis 300 € Anhängerkupplung bis 4 m Länge'),
  ['fuel_elektro_300', 'towbar', 'length_4m'],
);

assert.ok(queryIncludesChip(query, 'fuel_elektro_300'));
assert.ok(!queryIncludesChip(query, 'towbar'));

const profile = buildSearchProfile({
  intent: parseSearchIntent(query),
  filters: mergeDealerChipFilters(matchDealerChipIdsFromQuery(query)),
});
assert.equal(profile.maxMonthlyRate, 300);
assert.equal(profile.maxLengthMm, 4000);

const toggled = toggleDealerChipId(['heat_pump'], 'seats_7');
assert.deepEqual(toggled, ['heat_pump', 'seats_7']);

const withCamera = toggleChipInQueryText('Anhängerkupplung', 'camera_360');
assert.equal(withCamera, 'Anhängerkupplung 360° Kamera');
assert.ok(DEALER_WISH_CHIPS.every((c) => !c.id.startsWith('model_')));

console.log('dealerWishChips.test.js: ok');
