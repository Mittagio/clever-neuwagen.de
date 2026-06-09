/**
 * node src/services/search/picantoWishSearch.test.js
 */
import assert from 'node:assert/strict';
import { parseSearchIntent } from './searchIntentParser.js';
import { buildSearchProfile } from './searchProfile.js';
import { parseCustomerWish } from '../wish/wishParser.js';
import { intentToMarketplaceFilters } from './intentToFilters.js';
import { mergeDealerChipFilters, mergeDealerSearchFilters, matchDealerChipIdsFromQuery } from '../dealer/dealerWishChips.js';
import { enrichModelLineGroupWithProfileQuote } from '../cleverQuote/cleverQuoteService.js';
import {
  buildModelLineWishAnalysis,
  modelMeetsWishThreshold,
  profileHasWishCriteria,
} from './profileWishScore.js';

const q = 'Sitzheizung Rückfahrkamera bis 4 m Länge';
const chipIds = matchDealerChipIdsFromQuery(q);
const intent = parseSearchIntent(q);
const filters = mergeDealerSearchFilters(
  intentToMarketplaceFilters(intent),
  mergeDealerChipFilters(chipIds),
  { query: q },
);
const profile = buildSearchProfile({
  query: q,
  intent,
  filters,
  wishes: parseCustomerWish(q, filters.features),
  chipIds,
});

assert.ok(profileHasWishCriteria(profile), 'Länge + Features lösen Modell-first-Anreicherung aus');
assert.ok(profile.maxLengthMm, 'maxLengthMm im Profil');

const group = {
  modelLineKey: 'picanto',
  label: 'Picanto',
  primaryMatch: {
    vehicle: { brand: 'Kia', model: 'Picanto', title: 'Kia Picanto Core', trimId: 'core' },
  },
  trimVariants: [],
  variants: [],
};

const analysis = buildModelLineWishAnalysis(profile, group);
assert.ok(analysis, 'Picanto im Trim-Katalog');
assert.equal(analysis.recommendedTrim.trimLabel, 'Vision');
assert.equal(analysis.modelWeightedPercent, 100);

const coreRow = analysis.trimVariants.find((t) => t.trimLabel === 'Core');
assert.ok((coreRow?.weightedPercent ?? 0) < 80, 'Core allein deutlich schwächer');

assert.ok(modelMeetsWishThreshold(analysis, profile));

const enriched = enrichModelLineGroupWithProfileQuote(group, profile);
assert.equal(enriched.modelQuote.percent, 100);
assert.equal(enriched.recommendedTrimLabel, 'Vision');

const camera = enriched.modelChecks.find((c) => c.id === 'rear_camera');
const heat = enriched.modelChecks.find((c) => c.id === 'heated_seats');
assert.equal(camera?.status, 'fulfilled');
assert.equal(heat?.status, 'fulfilled');

console.log('picantoWishSearch.test.js: ok');
