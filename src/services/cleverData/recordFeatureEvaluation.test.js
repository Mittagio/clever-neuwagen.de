/**
 * node src/services/cleverData/recordFeatureEvaluation.test.js
 */
import assert from 'node:assert/strict';
import { buildSearchProfile } from '../search/searchProfile.js';
import { parseSearchIntent } from '../search/searchIntentParser.js';
import { enrichVehicleWithCleverRecord } from '../../data/clever/cleverDataRegistry.js';
import { evaluateVehicleForProfile } from './cleverDataEngine.js';

const profile = buildSearchProfile({
  intent: parseSearchIntent('Elektro mit Wärmepumpe mindestens 400 km Reichweite'),
  filters: { features: ['heat_pump', 'reichweite', 'elektro'], rangeKmMin: 400, fuel: 'elektro' },
});

const ev9 = enrichVehicleWithCleverRecord({
  brand: 'Kia', model: 'EV9', modelKey: 'ev9', trimId: 'air',
  title: 'Kia EV9 Air', powertrain: 'elektro',
});

const evaluation = evaluateVehicleForProfile(profile, ev9);
const heatCheck = evaluation.checks.find((c) => c.id === 'heat_pump');

assert.ok(heatCheck, 'Wärmepumpe-Check vorhanden');
assert.equal(heatCheck.status, 'fulfilled', 'EV9 Air hat Wärmepumpe im Clever Record');
assert.equal(evaluation.fulfilledCount, evaluation.totalChecks, 'EV9 erfüllt alle Wünsche');

console.log('recordFeatureEvaluation.test.js: ok');
