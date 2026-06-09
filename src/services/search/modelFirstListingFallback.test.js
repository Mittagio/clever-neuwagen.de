/**
 * Modell-first für alle Modelle: Katalog oder Listing-Fallback.
 * node src/services/search/modelFirstListingFallback.test.js
 */
import assert from 'node:assert/strict';
import { parseSearchIntent } from './searchIntentParser.js';
import { buildSearchProfile } from './searchProfile.js';
import { buildModelLineWishAnalysis } from './profileWishScore.js';
import { enrichModelLineGroupWithProfileQuote } from '../cleverQuote/cleverQuoteService.js';
import { mergeDealerChipFilters, mergeDealerSearchFilters, matchDealerChipIdsFromQuery } from '../dealer/dealerWishChips.js';
import { intentToMarketplaceFilters } from './intentToFilters.js';

const q = 'Sitzheizung Rückfahrkamera';
const chipIds = matchDealerChipIdsFromQuery(q);
const intent = parseSearchIntent(q);
const filters = mergeDealerSearchFilters(
  intentToMarketplaceFilters(intent),
  mergeDealerChipFilters(chipIds),
  { query: q },
);
const profile = buildSearchProfile({ query: q, intent, filters, chipIds });

const stonicGroup = {
  modelLineKey: 'stonic',
  label: 'Stonic',
  primaryMatch: {
    vehicle: {
      brand: 'Kia', model: 'Stonic', modelKey: 'stonic', title: 'Kia Stonic Vision', trimId: 'vision',
    },
  },
  trimVariants: [
    {
      trimKey: 'vision',
      match: {
        vehicle: {
          brand: 'Kia', model: 'Stonic', modelKey: 'stonic', title: 'Kia Stonic Vision', trimId: 'vision',
        },
      },
    },
    {
      trimKey: 'gt-line',
      match: {
        vehicle: {
          brand: 'Kia', model: 'Stonic', modelKey: 'stonic', title: 'Kia Stonic GT-Line', trimId: 'gt-line',
        },
      },
    },
  ],
};

const stonicAnalysis = buildModelLineWishAnalysis(profile, stonicGroup);
assert.ok(stonicAnalysis?.modelQuote, 'Stonic: Modell-Quote');
assert.ok(stonicAnalysis.modelChecks?.length, 'Stonic: aggregierte Modell-Checks');
assert.ok(stonicAnalysis.trimVariants.length >= 2, 'Stonic: Ausstattungen unter dem Modell');
assert.ok(
  ['GT-Line', 'Spirit'].includes(stonicAnalysis.trimVariants[0].trimLabel),
  'Stonic: Spirit oder GT-Line empfohlen',
);

const enrichedStonic = enrichModelLineGroupWithProfileQuote(stonicGroup, profile);
assert.ok(enrichedStonic.modelQuote, 'Stonic enrich: modelQuote');
assert.equal(enrichedStonic.hasMultipleVariants, true);

const ceedGroup = {
  modelLineKey: 'ceed',
  label: 'Ceed',
  primaryMatch: {
    vehicle: { brand: 'Kia', model: 'Ceed', modelKey: 'ceed', title: 'Kia Ceed Vision', trimId: 'vision' },
  },
  trimVariants: [],
};

const ceedAnalysis = buildModelLineWishAnalysis(profile, ceedGroup);
assert.ok(ceedAnalysis?.modelQuote, 'Ceed: Katalog-Modell-Quote');
assert.ok(ceedAnalysis.trimVariants.length >= 3, 'Ceed: alle Trims aus Katalog');

console.log('modelFirstListingFallback.test.js: ok');
