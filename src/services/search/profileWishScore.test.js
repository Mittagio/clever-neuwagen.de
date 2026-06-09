/**
 * node src/services/search/profileWishScore.test.js
 */
import assert from 'node:assert/strict';
import { buildSearchProfile } from './searchProfile.js';
import { parseSearchIntent } from './searchIntentParser.js';
import {
  computeWeightedWishPercent,
  buildModelLineWishAnalysis,
} from './profileWishScore.js';
import { evaluateModelTrimsAgainstProfile } from './vehicleFeatureRuleEngine.js';

const query = '360° Kamera Reichweite über 400 km';
const intent = parseSearchIntent(query);
const profile = buildSearchProfile({
  query,
  intent,
  filters: { fuel: 'elektro', rangeKmMin: 400, features: ['camera_360', 'reichweite', 'elektro'] },
  chipIds: ['camera_360', 'range_400'],
});

const ev4Trims = evaluateModelTrimsAgainstProfile(profile, 'ev4');
const byTrim = Object.fromEntries(
  ev4Trims.map((e) => [e.trimId, computeWeightedWishPercent(e.checks)]),
);

assert.equal(byTrim.air, 60, 'EV4 Air: Elektro + Reichweite, keine Kamera');
assert.equal(byTrim.earth, 85, 'EV4 Earth: Kamera als Paket');
assert.equal(byTrim['gt-line'], 100, 'EV4 GT-Line: alles Serie');

const analysis = buildModelLineWishAnalysis(profile, {
  modelLineKey: 'ev4',
  primaryMatch: { vehicle: { brand: 'Kia', model: 'EV4', title: 'Kia EV4 Earth' } },
  trimVariants: [],
  variants: [],
});

assert.equal(analysis.modelWeightedPercent, 100, 'Modell-Score = bester Trim');
assert.equal(analysis.trimVariants[0].trimLabel, 'GT-Line', 'GT-Line zuerst');
const cameraCheck = analysis.modelChecks.find((c) => c.id === 'camera_360' || c.canonicalId === 'camera_360');
assert.equal(cameraCheck?.status, 'fulfilled', 'Modell-Ebene: Kamera in GT-Line Serie');

console.log('profileWishScore.test.js: ok');
