/**
 * node src/services/search/profileCriteriaCanonical.test.js
 */
import assert from 'node:assert/strict';
import { parseSearchIntent } from './searchIntentParser.js';
import { buildSearchProfile } from './searchProfile.js';
import { parseCustomerWish } from '../wish/wishParser.js';
import { intentToMarketplaceFilters } from './intentToFilters.js';
import {
  buildProfileEvaluationPlan,
  validateProfileEvaluationPlan,
  prepareProfileForEvaluation,
} from './profileCriteriaCanonical.js';

function profileFor(query) {
  const intent = parseSearchIntent(query);
  const filters = intentToMarketplaceFilters(intent);
  const wishes = parseCustomerWish(query, filters.features);
  return buildSearchProfile({ query, intent, filters, wishes });
}

// Anhängelast: kein Doppel-Kriterium
const tow = profileFor('2 Tonnen Anhängelast hybrid');
const towPlan = buildProfileEvaluationPlan(tow);
assert.equal(validateProfileEvaluationPlan(towPlan).length, 0);
assert.equal(towPlan.filter((c) => c.kind === 'tow_kg').length, 1);
assert.equal(towPlan.filter((c) => c.featureId?.startsWith('tow_capacity_')).length, 0);

// Reichweite: kein Doppel-Kriterium
const range = profileFor('360° Kamera Reichweite über 400 km');
const rangePlan = buildProfileEvaluationPlan(range);
assert.equal(validateProfileEvaluationPlan(rangePlan).length, 0);
assert.equal(rangePlan.filter((c) => c.kind === 'range').length, 1);
assert.equal(rangePlan.filter((c) => c.featureId === 'reichweite').length, 0);

// 7-Sitzer + Chip
const seven = profileFor('7-Sitzer Elektro');
const sevenPlan = buildProfileEvaluationPlan(seven);
assert.equal(sevenPlan.filter((c) => c.criterionId === 'seats').length, 1);
assert.equal(sevenPlan.filter((c) => c.featureId === 'seats_7').length, 0);

const prepared = prepareProfileForEvaluation(tow);
assert.ok(prepared.valid, prepared.errors.join(', '));

// Händler-Chips: 7-Sitzer + Reichweite = genau 2 Prüfpunkte (kein implizites Elektro, keine Doppel-Reichweite)
import { mergeDealerChipFilters, mergeDealerSearchFilters, matchDealerChipIdsFromQuery } from '../dealer/dealerWishChips.js';
const dealerQuery = '7-Sitzer Reichweite über 400 km';
const chipIds = matchDealerChipIdsFromQuery(dealerQuery);
const dealerIntent = parseSearchIntent(dealerQuery);
const dealerFilters = mergeDealerSearchFilters(
  intentToMarketplaceFilters(dealerIntent),
  mergeDealerChipFilters(chipIds),
  { query: dealerQuery },
);
const dealerProfile = buildSearchProfile({
  query: dealerQuery,
  intent: dealerIntent,
  filters: dealerFilters,
  wishes: parseCustomerWish(dealerQuery, dealerFilters.features),
  chipIds,
});
const dealerPlan = buildProfileEvaluationPlan(dealerProfile);
assert.equal(validateProfileEvaluationPlan(dealerPlan).length, 0);
assert.equal(dealerPlan.length, 2, 'Zwei Wünsche: Sitze + Reichweite');
assert.deepEqual(
  dealerPlan.map((c) => c.criterionId).sort(),
  ['range_km', 'seats'],
);
assert.equal(dealerProfile.fuel, null, 'Reichweite-Chip setzt kein implizites Elektro');

console.log('profileCriteriaCanonical.test.js: ok');
