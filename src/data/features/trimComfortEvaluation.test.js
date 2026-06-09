/**
 * Ausstattung: Trim-Mapping + Clever Record Merge
 * node src/data/features/trimComfortEvaluation.test.js
 */
import assert from 'node:assert/strict';
import { parseSearchIntent } from '../../services/search/searchIntentParser.js';
import { buildSearchProfile } from '../../services/search/searchProfile.js';
import { evaluateVehicleForProfile } from '../../services/cleverData/cleverDataEngine.js';
import { enrichVehicleWithCleverRecord } from '../clever/cleverDataRegistry.js';
import { normalizeModelKey, getTrimConfig } from './trimFeatureMapping.js';
import { mergeProfileChecks } from '../../services/cleverData/recordFeatureEvaluation.js';

assert.equal(normalizeModelKey('Kia', 'Sorento Hybrid'), 'sorento-hybrid');
assert.equal(normalizeModelKey('Kia', 'Sportage Plug-in Hybrid'), 'sportage-phev');
assert.ok(getTrimConfig('sorento', 'gt-line')?.standardFeatures.includes('camera_360'));

const cameraProfile = buildSearchProfile({
  intent: parseSearchIntent('360 Kamera'),
  filters: { features: ['camera_360'] },
});

const sportageGt = enrichVehicleWithCleverRecord({
  brand: 'Kia',
  model: 'Sportage',
  modelKey: 'sportage-hybrid',
  title: 'Kia Sportage GT-Line Hybrid',
  powertrain: 'hybrid',
});
const sportageEval = evaluateVehicleForProfile(cameraProfile, sportageGt);
assert.equal(
  sportageEval.checks.find((c) => c.id === 'camera_360')?.status,
  'fulfilled',
  'Sportage GT-Line: 360° aus Trim',
);

const sorentoSpirit = enrichVehicleWithCleverRecord({
  brand: 'Kia',
  model: 'Sorento',
  modelKey: 'sorento',
  title: 'Kia Sorento Spirit',
  powertrain: 'verbrenner',
});
const sorentoEval = evaluateVehicleForProfile(cameraProfile, sorentoSpirit);
assert.equal(
  sorentoEval.checks.find((c) => c.id === 'camera_360')?.status,
  'package',
  'Sorento Spirit: 360° als Paket',
);

const tailgateProfile = buildSearchProfile({
  intent: parseSearchIntent('elektrische Heckklappe'),
  filters: { features: ['power_tailgate'] },
});
const sorentoGt = enrichVehicleWithCleverRecord({
  brand: 'Kia',
  model: 'Sorento',
  modelKey: 'sorento-phev',
  trimId: 'gt-line',
  title: 'Kia Sorento GT-Line PHEV',
  powertrain: 'plugin-hybrid',
});
const tailgateEval = evaluateVehicleForProfile(tailgateProfile, sorentoGt);
assert.equal(
  tailgateEval.checks.find((c) => c.id === 'power_tailgate')?.status,
  'fulfilled',
  'Sorento PHEV GT-Line: Heckklappe',
);

const merged = mergeProfileChecks(
  [{ id: 'camera_360', status: 'unknown', label: '360°' }],
  [{ id: 'camera_360', status: 'fulfilled', label: '360° Kamera' }],
);
assert.equal(merged[0].status, 'fulfilled');

console.log('trimComfortEvaluation.test.js: ok');
