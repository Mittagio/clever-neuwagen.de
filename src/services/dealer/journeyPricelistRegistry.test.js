import assert from 'node:assert/strict';
import { hasJourneyPricelist, JOURNEY_PRICELISTS } from './journeyPricelistRegistry.js';

assert.ok(hasJourneyPricelist('ev9'));
assert.ok(hasJourneyPricelist('sportage-hybrid'));
assert.ok(!hasJourneyPricelist('picanto'));
assert.ok(Object.keys(JOURNEY_PRICELISTS).length >= 10);

console.log('journeyPricelistRegistry.test.js: ok');
