/**
 * Isofix + AHK für alle Kia 7-Sitzer in Clever Records
 */
import assert from 'node:assert/strict';
import { buildAllKiaCleverRecords } from './buildKiaCleverRecords.js';
import {
  KIA_SEVEN_SEATER_FAMILY_SPECS,
  KIA_SEVEN_SEATER_MODEL_KEYS,
} from '../kia/kiaFamilySpecs.js';
import { enrichVehicleWithCleverRecord } from './cleverDataRegistry.js';
import { resolveIsofixRearCount } from '../../services/cleverData/vehicleDimensions.js';
import { parseSearchIntent } from '../../services/search/searchIntentParser.js';
import { buildSearchProfile } from '../../services/search/searchProfile.js';
import { passesHardRules } from '../../services/search/hardExclusionRules.js';

const records = buildAllKiaCleverRecords();

for (const modelKey of KIA_SEVEN_SEATER_MODEL_KEYS) {
  const spec = KIA_SEVEN_SEATER_FAMILY_SPECS[modelKey];
  const base = records.find((r) => r.modelKey === modelKey && !r.trimId);
  assert.ok(base, `Basis-Record für ${modelKey}`);
  assert.equal(base.family.seats, 7, `${modelKey} seats`);
  assert.equal(base.family.isofixRearCount, spec.isofixRearCount, `${modelKey} isofix`);
  assert.equal(base.family.isofixRear, true, `${modelKey} isofixRear`);
  assert.equal(base.towing?.brakedKg, spec.towCapacityKg, `${modelKey} AHK`);
}

const isofixProfile = buildSearchProfile({
  intent: parseSearchIntent('Familienauto mit 3 Isofix'),
});
assert.equal(isofixProfile.isofixRearMin, 3);

const sorentoHybrid = enrichVehicleWithCleverRecord({
  brand: 'Kia',
  model: 'Sorento Hybrid',
  modelKey: 'sorento-hybrid',
  powertrain: 'hybrid',
});
const ev9Base = enrichVehicleWithCleverRecord({
  brand: 'Kia',
  model: 'EV9',
  modelKey: 'ev9',
  powertrain: 'elektro',
});
const sorentoDiesel = enrichVehicleWithCleverRecord({
  brand: 'Kia',
  model: 'Sorento',
  modelKey: 'sorento',
  powertrain: 'verbrenner',
});

assert.equal(resolveIsofixRearCount(sorentoHybrid), 3);
assert.equal(resolveIsofixRearCount(ev9Base), 2);
assert.equal(passesHardRules(sorentoHybrid, isofixProfile), true, 'Sorento Hybrid 3 Isofix');
assert.equal(passesHardRules(ev9Base, isofixProfile), false, 'EV9 nur 2 Isofix');

const towProfile = buildSearchProfile({
  intent: parseSearchIntent('2 Tonnen Anhängelast'),
});
assert.ok(towProfile.towCapacityKg >= 2000);
assert.equal(passesHardRules(sorentoDiesel, towProfile), true, 'Sorento Diesel 2,5 t');
assert.equal(passesHardRules(sorentoHybrid, towProfile), true, 'Sorento Hybrid 2 t');
assert.equal(
  passesHardRules(enrichVehicleWithCleverRecord({
    brand: 'Kia', model: 'EV6', modelKey: 'ev6', powertrain: 'elektro',
  }), towProfile),
  false,
  'EV6 nur 1,6 t',
);

console.log('kiaSevenSeaterSpecs.test.js: ok');
