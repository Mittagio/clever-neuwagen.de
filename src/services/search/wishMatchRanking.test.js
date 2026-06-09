/**
 * node src/services/search/wishMatchRanking.test.js
 */
import assert from 'node:assert/strict';
import { buildSearchProfile } from './searchProfile.js';
import { parseSearchIntent } from './searchIntentParser.js';
import { enrichVehicleWithCleverRecord } from '../../data/clever/cleverDataRegistry.js';
import {
  compareWishTruthMatches,
  rankMatchesByProfileTruth,
  summarizeWishEvaluation,
  buildFulfillmentLabel,
} from './wishMatchRanking.js';

const lengthProfile = buildSearchProfile({
  intent: parseSearchIntent('5 sitze bis 4 Meter länge'),
});

const picanto = enrichVehicleWithCleverRecord({
  brand: 'Kia', model: 'Picanto', modelKey: 'picanto',
  title: 'Kia Picanto', powertrain: 'verbrenner', seats: 5,
});

const sportage = enrichVehicleWithCleverRecord({
  brand: 'Kia', model: 'Sportage', modelKey: 'sportage-hybrid',
  title: 'Kia Sportage Spirit', powertrain: 'hybrid', seats: 5,
});

const ranked = rankMatchesByProfileTruth([
  { vehicle: sportage, score: 99, cleverQuote: { percent: 99 } },
  { vehicle: picanto, score: 70, cleverQuote: { percent: 70 } },
], lengthProfile);

assert.equal(ranked[0].vehicle.model, 'Picanto', 'Voll erfüllt schlägt hohen % mit Verfehlung');

const picantoSum = summarizeWishEvaluation(ranked[0].evaluation);
const sportageSum = summarizeWishEvaluation(ranked[1].evaluation);
assert.equal(picantoSum.truthTier, 0);
assert.equal(sportageSum.truthTier, 2);

const label = buildFulfillmentLabel({
  checks: [
    { status: 'fulfilled' },
    { status: 'fulfilled' },
    { status: 'unknown' },
  ],
});
assert.match(label, /2 von 3 Wünschen/);
assert.match(label, /1 nicht geprüft/);

assert.ok(compareWishTruthMatches(
  { evaluation: { checks: [{ status: 'fulfilled' }, { status: 'fulfilled' }] }, cleverQuote: { percent: 70 } },
  { evaluation: { checks: [{ status: 'fulfilled' }, { status: 'unknown' }] }, cleverQuote: { percent: 95 } },
) < 0, 'Vollständig erfüllt schlägt hohen % mit Unbekannt');

console.log('wishMatchRanking.test.js: ok');
