/**
 * node src/services/wish/wishParser.test.js
 */
import assert from 'node:assert/strict';
import { parseCustomerWish, resolveWishFeatures, matchFeaturesFromText } from './wishParser.js';
import { buildSearchProfile } from '../search/searchProfile.js';
import { parseSearchIntent } from '../search/searchIntentParser.js';
import { intentToMarketplaceFilters } from '../search/intentToFilters.js';
import { buildProfileEvaluationPlan, validateProfileEvaluationPlan } from '../search/profileCriteriaCanonical.js';

const towQuery = '2 Tonnen Anhängelast hybrid';
const wishes = parseCustomerWish(towQuery, []);
assert.ok(!wishes.features.includes('tow_capacity_2000'), 'kein tow_capacity_2000 aus Katalog');
assert.ok(wishes.features.includes('towbar'), 'Anhängerkupplung bleibt');

const resolved = resolveWishFeatures(towQuery, ['tow_capacity_2000', 'towbar']);
assert.ok(!resolved.includes('tow_capacity_2000'));
assert.ok(resolved.includes('towbar'));

const catalogOnly = matchFeaturesFromText('2 Tonnen Anhängelast');
assert.ok(!catalogOnly.includes('tow_capacity_2000'));

const intent = parseSearchIntent('360° Kamera Reichweite über 400 km');
const rangeWishes = resolveWishFeatures('360° Kamera Reichweite über 400 km', ['reichweite', 'elektro']);
assert.ok(!rangeWishes.includes('reichweite'));
assert.ok(rangeWishes.includes('camera_360'));

const profile = buildSearchProfile({
  query: towQuery,
  intent: parseSearchIntent(towQuery),
  filters: intentToMarketplaceFilters(parseSearchIntent(towQuery)),
  wishes,
});
const plan = buildProfileEvaluationPlan(profile);
assert.equal(validateProfileEvaluationPlan(plan).length, 0);

console.log('wishParser.test.js: ok');
