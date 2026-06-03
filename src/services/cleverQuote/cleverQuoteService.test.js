import assert from 'node:assert/strict';
import {
  getCleverQuoteTier,
  sortByCleverQuote,
  buildCleverQuoteCountLine,
  hasCleverQuoteWishes,
  CLEVER_QUOTE_FEATURE_WEIGHTS,
} from './cleverQuoteConstants.js';

const tierPerfect = getCleverQuoteTier(97);
assert.equal(tierPerfect.label, 'Perfekter Treffer');
assert.equal(tierPerfect.dot, 'green');

const tierGood = getCleverQuoteTier(78);
assert.equal(tierGood.label, 'Guter Treffer');
assert.equal(tierGood.dot, 'yellow');

const tierLimited = getCleverQuoteTier(40);
assert.equal(tierLimited.label, 'Nur bedingt passend');
assert.equal(tierLimited.dot, 'red');

const sorted = sortByCleverQuote([
  { cleverQuote: { percent: 70 }, score: 80 },
  { cleverQuote: { percent: 96 }, score: 70 },
  { cleverQuote: { percent: 96 }, score: 90 },
]);
assert.equal(sorted[0].cleverQuote.percent, 96);
assert.equal(sorted[0].score, 90);

assert.equal(buildCleverQuoteCountLine(3), '3 Fahrzeuge für Ihre Wünsche · sortiert nach CleverQuote™');
assert.equal(hasCleverQuoteWishes({ features: ['camera_360'] }), true);
assert.equal(hasCleverQuoteWishes({ features: [] }), false);

assert.ok(CLEVER_QUOTE_FEATURE_WEIGHTS.range_400 === 40);
assert.ok(CLEVER_QUOTE_FEATURE_WEIGHTS.camera_360 === 20);

console.log('cleverQuoteService tests OK');
