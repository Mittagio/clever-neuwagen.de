import assert from 'node:assert/strict';
import {
  getCleverQuoteTier,
  sortByCleverQuote,
  buildCleverQuoteCountLine,
  hasCleverQuoteWishes,
  CLEVER_QUOTE_FEATURE_WEIGHTS,
  CLEVER_QUOTE_UNCERTAIN_LABEL,
} from './cleverQuoteConstants.js';
import {
  computeCleverQuote,
  partitionCleverQuoteItems,
} from './cleverQuoteService.js';
import { buildRecommendReasons } from './cleverQuoteRecommendation.js';

const tierPerfect = getCleverQuoteTier(97);
assert.equal(tierPerfect.label, 'Perfekter Treffer');
assert.equal(tierPerfect.dot, 'green');

const tierGood = getCleverQuoteTier(78);
assert.equal(tierGood.label, 'Guter Treffer');
assert.equal(tierGood.dot, 'yellow');

const tierLimited = getCleverQuoteTier(40);
assert.equal(tierLimited.label, 'Nur bedingt passend');
assert.equal(tierLimited.dot, 'red');

const tierUncertain = getCleverQuoteTier(null);
assert.equal(tierUncertain.dot, 'gray');
assert.equal(tierUncertain.label, 'Nicht sicher prüfbar');

const sorted = sortByCleverQuote([
  { cleverQuote: { percent: 70 }, score: 80 },
  { cleverQuote: { percent: 96 }, score: 70 },
  { cleverQuote: { percent: 96 }, score: 90 },
]);
assert.equal(sorted[0].cleverQuote.percent, 96);
assert.equal(sorted[0].score, 90);

assert.equal(buildCleverQuoteCountLine(3), '3 Fahrzeuge geprüft · sortiert nach CleverQuote™');
assert.equal(buildCleverQuoteCountLine(3, 225), '225 Fahrzeuge geprüft · 3 passen zu Ihren Wünschen');
assert.equal(hasCleverQuoteWishes({ features: ['camera_360'] }), true);
assert.equal(hasCleverQuoteWishes({ features: [] }), false);

assert.ok(CLEVER_QUOTE_FEATURE_WEIGHTS.range_400 === 40);
assert.ok(CLEVER_QUOTE_FEATURE_WEIGHTS.camera_360 === 20);

const allUncertainQuote = computeCleverQuote({
  vehicle: { brand: 'Kia', model: 'EV6', powertrain: 'elektro' },
  wishes: { features: ['range_400'] },
  match: {
    resolution: {
      uncertainFeatures: ['range_400'],
      matchedFeatures: [],
      missingFeatures: [],
    },
  },
});
assert.equal(allUncertainQuote.percent, null);
assert.equal(allUncertainQuote.label, CLEVER_QUOTE_UNCERTAIN_LABEL);
assert.equal(allUncertainQuote.uncertainCount, 1);
assert.equal(allUncertainQuote.items[0].status, 'uncertain');

const mixedQuote = computeCleverQuote({
  vehicle: { brand: 'Kia', model: 'Sportage', powertrain: 'verbrenner', bodyType: 'suv' },
  wishes: { features: ['camera_360', 'family_suv'], vehicleType: 'SUV' },
  match: {
    matchedFeatures: ['camera_360', 'family_suv'],
    missingFeatures: [],
    resolution: {
      matchedFeatures: ['camera_360'],
      missingFeatures: [],
      uncertainFeatures: [],
    },
  },
});
assert.ok(mixedQuote.percent >= 50);
assert.ok(mixedQuote.items.some((i) => i.status === 'fulfilled'));

const parts = partitionCleverQuoteItems({
  items: [
    { id: 'a', status: 'fulfilled', label: 'A' },
    { id: 'b', status: 'package', label: 'B' },
    { id: 'c', status: 'missing', label: 'C' },
    { id: 'd', status: 'uncertain', label: 'D' },
  ],
});
assert.equal(parts.fulfilled.length, 1);
assert.equal(parts.packageNeeded.length, 1);
assert.equal(parts.missing.length, 1);
assert.equal(parts.uncertain.length, 1);

const reasons = buildRecommendReasons(
  {
    cleverQuote: { percent: 80, matched: 2, scorableTotal: 3, uncertainCount: 1 },
    vehicle: { monthlyRate: 299, discountPercent: 12, availability: 'sofort' },
    bestOffer: { monthlyRate: 299 },
  },
  { wishes: { budget: { maxMonthlyRate: 350 } } },
);
assert.ok(reasons.some((r) => r.includes('Budget')));
assert.ok(reasons.some((r) => r.includes('nicht sicher prüfbar')));

console.log('cleverQuoteService tests OK');
