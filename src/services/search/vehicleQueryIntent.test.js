import assert from 'node:assert/strict';
import { analyzeVehicleQuery, mapAdvisoryToFactField } from './vehicleQueryIntent.js';
import { parseSearchIntent } from './searchIntentParser.js';
import { buildSearchProfile } from './searchProfile.js';
import { parseAdvisoryQuestion } from './advisoryQuestionParser.js';

function analyze(query) {
  const intent = parseSearchIntent(query);
  const profile = buildSearchProfile({ intent, query });
  return analyzeVehicleQuery(query, intent, profile);
}

assert.equal(analyze('EV2 Batterie').intent, 'vehicle_fact_question');
assert.equal(analyze('EV2 Batterie').fact?.field, 'batteryKwh');
assert.equal(analyze('EV2 Batterie').fact?.modelKey, 'ev2');

assert.equal(analyze('Wie lang ist der EV3?').intent, 'vehicle_fact_question');
assert.equal(analyze('Wie lang ist der EV3?').fact?.field, 'length');

assert.equal(analyze('EV9 Anhängelast').intent, 'vehicle_fact_question');
assert.equal(analyze('EV9 Anhängelast').fact?.field, 'towingCapacity');

assert.equal(analyze('EV3 oder EV4').intent, 'vehicle_compare_question');
assert.ok(analyze('EV3 oder EV4').compare);

assert.equal(analyze('Elektro 300 km').intent, 'vehicle_search');
assert.equal(analyze('2 Tonnen Anhängelast 7-Sitzer').intent, 'vehicle_search');
assert.equal(analyze('Fahrzeug mit meiste Reichweite').intent, 'vehicle_fact_question');

const dimAdvisory = parseAdvisoryQuestion('Wie lang ist der EV3?');
assert.equal(mapAdvisoryToFactField(dimAdvisory), 'length');

console.log('vehicleQueryIntent.test.js: ok');
