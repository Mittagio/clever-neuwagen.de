/**
 * node src/services/landingAdvisorBridge.test.js
 */
import assert from 'node:assert/strict';
import { parseLandingQuery } from './landingAdvisorBridge.js';
import { parseCustomerWish } from './wish/wishParser.js';
import { parseSearchIntent } from './search/searchIntentParser.js';
import { intentToMarketplaceFilters } from './search/intentToFilters.js';
import { mergeDealerChipFilters, mergeDealerSearchFilters, matchDealerChipIdsFromQuery } from './dealer/dealerWishChips.js';
import { buildSearchProfile } from './search/searchProfile.js';
import { detectProfileConflict } from './search/profileConflictHint.js';

const rangeQuery = 'Reichweite über 400 km 7-Sitzer';
const rangeLanding = parseLandingQuery(rangeQuery);
assert.equal(rangeLanding.profile.desiredRate, undefined, '400 km darf keine Rate sein');

const rangeWish = parseCustomerWish(rangeQuery, ['seats_7', 'reichweite', 'elektro']);
assert.equal(rangeWish.budget.maxMonthlyRate, null, 'Wunschparser: keine Rate aus km');

const intent = parseSearchIntent(rangeQuery);
const chipIds = matchDealerChipIdsFromQuery(rangeQuery);
const filters = mergeDealerSearchFilters(
  intentToMarketplaceFilters(intent),
  mergeDealerChipFilters(chipIds),
  { query: rangeQuery },
);
const profile = buildSearchProfile({
  query: rangeQuery,
  intent,
  filters,
  wishes: rangeWish,
  chipIds,
});
assert.equal(profile.maxMonthlyRate, null);
assert.equal(detectProfileConflict(profile, { intent, filters }), null);

const budgetLanding = parseLandingQuery('Elektro bis 400 €');
assert.equal(budgetLanding.profile.desiredRate, 400);

const budgetBare = parseLandingQuery('Familienauto bis 400');
assert.equal(budgetBare.profile.desiredRate, 400);

console.log('landingAdvisorBridge.test.js: ok');
