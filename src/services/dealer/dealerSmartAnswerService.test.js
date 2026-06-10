import assert from 'node:assert/strict';
import { buildDealerSmartAnswer } from './dealerSmartAnswerService.js';
import { analyzeVehicleQuery } from '../search/vehicleQueryIntent.js';
import { parseSearchIntent } from '../search/searchIntentParser.js';
import { buildSearchProfile } from '../search/searchProfile.js';
import { getKiaTrinklePilotStock } from '../../data/kia/kiaTrinkleStock.js';

const stock = getKiaTrinklePilotStock();

function analyze(query) {
  const intent = parseSearchIntent(query);
  const profile = buildSearchProfile({ intent, query });
  return analyzeVehicleQuery(query, intent, profile);
}

assert.equal(analyze('2 Tonnen Anhängelast 7-Sitzer').intent, 'vehicle_search');
assert.equal(buildDealerSmartAnswer('2 Tonnen Anhängelast 7-Sitzer', stock), null);

const range = buildDealerSmartAnswer('Fahrzeug mit meiste Reichweite', stock);
assert.equal(range.mode, 'info');
assert.equal(range.intent, 'vehicle_fact_question');
assert.equal(range.highlights[0].modelKey, 'ev4-fastback');
assert.ok(range.highlights.length <= 3);

const ev9 = buildDealerSmartAnswer('ev9 reichweite', stock);
assert.equal(ev9.mode, 'info');
assert.equal(ev9.kicker, 'Clever Antwort');
assert.match(ev9.lead ?? '', /541 km/);

const ev3 = buildDealerSmartAnswer('Wie lang ist der EV3?', stock);
assert.equal(ev3.mode, 'info');
assert.match(ev3.title, /lang/i);
assert.ok(ev3.lead?.includes('4,30 m'));

const heat = buildDealerSmartAnswer('Hat der EV3 Wärmepumpe?', stock);
assert.match(heat.title, /Wärmepumpe/i);

const ev2Battery = buildDealerSmartAnswer('EV2 batterie', stock);
assert.equal(ev2Battery.mode, 'info');
assert.equal(ev2Battery.intent, 'vehicle_fact_question');
assert.equal(ev2Battery.primaryModelKey, 'ev2');
assert.ok(ev2Battery.relatedTopics?.length >= 3);
assert.match(ev2Battery.fitPrompt ?? '', /Passt der EV2/);
assert.match(ev2Battery.lead ?? '', /42,2.*kWh/i);
assert.match(ev2Battery.lead ?? '', /350 km/);

const ev9Tow = buildDealerSmartAnswer('EV9 Anhängelast', stock);
assert.equal(ev9Tow.intent, 'vehicle_fact_question');
assert.match(ev9Tow.lead ?? '', /2,5 t.*Anhängelast/i);

const ev3ev4 = buildDealerSmartAnswer('EV3 oder EV4', stock);
assert.equal(ev3ev4.intent, 'vehicle_compare_question');
assert.ok(ev3ev4.modelCards?.length === 2);

console.log('dealerSmartAnswerService.test.js: ok');
