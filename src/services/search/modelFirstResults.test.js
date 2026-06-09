/**
 * Regression: Modell zuerst, Ausstattung nach Klick (Verkäufer-Logik).
 * node src/services/search/modelFirstResults.test.js
 */
import assert from 'node:assert/strict';
import { parseSearchIntent } from './searchIntentParser.js';
import { buildSearchProfile } from './searchProfile.js';
import { enrichModelLineGroupWithProfileQuote } from '../cleverQuote/cleverQuoteService.js';
import { modelCheckLabel } from './profileWishScore.js';

const QUERY = '360° Kamera Reichweite über 400 km';

const profile = buildSearchProfile({
  query: QUERY,
  intent: parseSearchIntent(QUERY),
  filters: {
    fuel: 'elektro',
    rangeKmMin: 400,
    features: ['camera_360', 'reichweite', 'elektro'],
  },
  chipIds: ['camera_360', 'range_400'],
});

const ev4 = enrichModelLineGroupWithProfileQuote({
  modelLineKey: 'ev4',
  label: 'EV4',
  primaryMatch: { vehicle: { brand: 'Kia', model: 'EV4', title: 'Kia EV4 Earth' } },
  trimVariants: [],
  variants: [],
}, profile);

assert.equal(ev4.label, 'EV4', 'Ebene 1: Modellname');
assert.ok(ev4.modelQuote, 'Modell-CleverQuote vorhanden');
assert.equal(ev4.modelQuote.percent, 100, 'Modell-Quote = bester Trim');

const rangeOk = ev4.modelChecks?.find((c) => c.id === 'range_km');
assert.equal(rangeOk?.status, 'fulfilled', 'Reichweite passt');

const cameraLabel = modelCheckLabel(
  ev4.modelChecks?.find((c) => c.id === 'camera_360' || c.canonicalId === 'camera_360'),
);
assert.equal(cameraLabel, '360° Kamera verfügbar', 'Modell-Begründung in Verkäufer-Sprache');

const trimScores = Object.fromEntries(
  ev4.trimVariants.map((t) => [t.trimLabel, t.weightedPercent]),
);
assert.equal(trimScores['GT-Line'], 100);
assert.equal(trimScores.Earth, 85);
assert.equal(trimScores.Air, 60);
assert.notEqual(trimScores.Air, trimScores.Earth, 'Air und Earth dürfen nicht gleich bewertet sein');

assert.equal(ev4.trimVariants[0].trimLabel, 'GT-Line', 'Empfohlene Ausstattung zuerst (höchste Quote)');
assert.ok(ev4.trimVariants.length >= 3, 'Alle Ausstattungen unter dem Modell');

console.log('modelFirstResults.test.js: ok');
