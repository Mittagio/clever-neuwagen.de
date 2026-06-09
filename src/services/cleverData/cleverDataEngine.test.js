/**
 * Clever Data Engine – Golden Cases EV9 vs Sorento PHEV
 */
import assert from 'node:assert/strict';
import { buildSearchProfile } from '../search/searchProfile.js';
import { parseSearchIntent } from '../search/searchIntentParser.js';
import {
  evaluateProfileAgainstRecord,
  buildTechnicalHighlights,
  queryCleverDatabase,
} from './cleverDataEngine.js';
import { passesHardRules } from '../search/hardExclusionRules.js';
import { computeCleverQuoteV2 } from '../cleverQuote/cleverQuoteV2.js';
import { KIA_CLEVER_RECORDS } from '../../data/clever/kiaCleverRecords.js';
import { enrichVehicleWithCleverRecord } from '../../data/clever/cleverDataRegistry.js';

const ev9Record = KIA_CLEVER_RECORDS.find((r) => r.id === 'kia-ev9-air');
const sorentoRecord = KIA_CLEVER_RECORDS.find((r) => r.id === 'kia-sorento-phev-gt-line');

const intent = parseSearchIntent('Elektroauto mit 7 Sitzen und 2 Tonnen Anhängelast');
const profile = buildSearchProfile({ intent });

assert.equal(profile.seatsMin, 7);
assert.ok(profile.towCapacityKg >= 2000 || intent.features.includes('towbar'));

const ev9Eval = evaluateProfileAgainstRecord(profile, ev9Record);
assert.equal(ev9Eval.wishPercent, 100, 'EV9 erfüllt alle Wünsche');
assert.ok(ev9Eval.checks.every((c) => c.status === 'fulfilled'));

const sorentoEval = evaluateProfileAgainstRecord(profile, sorentoRecord);
assert.ok(sorentoEval.wishPercent < 100, 'Sorento PHEV nicht vollelektrisch');
assert.ok(sorentoEval.checks.some((c) => c.id === 'fuel' && c.status === 'missing'));
assert.ok(sorentoEval.checks.some((c) => c.id === 'seats' && c.status === 'fulfilled'));
assert.ok(sorentoEval.checks.some((c) => c.id === 'tow_braked' && c.status === 'fulfilled'));

const ev9Vehicle = enrichVehicleWithCleverRecord({
  brand: 'Kia',
  model: 'EV9',
  modelKey: 'ev9',
  trimId: 'air',
  title: 'Kia EV9 Air',
  powertrain: 'elektro',
  monthlyRate: 599,
});

const highlights = buildTechnicalHighlights(ev9Vehicle);
assert.ok(highlights.some((h) => h.id === 'seats' && h.label.includes('7')));
assert.ok(highlights.some((h) => h.id === 'tow' && h.label.includes('2.5')));

const ev9Quote = computeCleverQuoteV2({ vehicle: ev9Vehicle }, profile);
assert.ok(ev9Quote.percent >= 90, `EV9 CleverQuote v2 ≥ 90 % (ist ${ev9Quote.percent})`);
assert.equal(ev9Quote.engineVersion, 2);

const sorentoVehicle = enrichVehicleWithCleverRecord({
  brand: 'Kia',
  model: 'Sorento',
  modelKey: 'sorento-phev',
  trimId: 'gt-line',
  title: 'Kia Sorento GT-Line PHEV',
  powertrain: 'plugin-hybrid',
  monthlyRate: 489,
});

const sorentoQuote = computeCleverQuoteV2({ vehicle: sorentoVehicle }, profile);
assert.ok(sorentoQuote.percent >= 75 && sorentoQuote.percent <= 90,
  `Sorento PHEV ~82 % (ist ${sorentoQuote.percent})`);
assert.ok(sorentoQuote.percent < ev9Quote.percent, 'EV9 schlägt Sorento PHEV');

const query = queryCleverDatabase(profile, [ev9Vehicle, sorentoVehicle]);
assert.equal(query.length, 2);

const lengthIntent = parseSearchIntent('5 sitze bis 4 Meter länge');
const lengthProfile = buildSearchProfile({ intent: lengthIntent });
assert.equal(lengthProfile.seatsMin, 5);
assert.equal(lengthProfile.maxLengthMm, 4000);

const sportageVehicle = enrichVehicleWithCleverRecord({
  brand: 'Kia',
  model: 'Sportage',
  modelKey: 'sportage-hybrid',
  title: 'Kia Sportage Spirit',
  powertrain: 'hybrid',
  seats: 5,
  monthlyRate: 299,
});
assert.equal(passesHardRules(sportageVehicle, lengthProfile), false, 'Sportage > 4 m ausgeschlossen');

const picantoVehicle = enrichVehicleWithCleverRecord({
  brand: 'Kia',
  model: 'Picanto',
  modelKey: 'picanto',
  title: 'Kia Picanto',
  powertrain: 'verbrenner',
  seats: 5,
});
assert.equal(passesHardRules(picantoVehicle, lengthProfile), true, 'Picanto < 4 m erlaubt');

const sportageQuote = computeCleverQuoteV2({ vehicle: sportageVehicle }, lengthProfile);
assert.equal(sportageQuote.fulfillmentLabel, '1 von 2 Wünschen', 'Länge fehlt bei Sportage');

const isofixIntent = parseSearchIntent('Familienauto mit 3 Isofix');
const isofixProfile = buildSearchProfile({ intent: isofixIntent });
assert.equal(isofixProfile.isofixRearMin, 3);
assert.equal(passesHardRules(sorentoVehicle, isofixProfile), true, 'Sorento 3 Isofix');
assert.equal(passesHardRules(ev9Vehicle, isofixProfile), false, 'EV9 nur 2 Isofix hinten');

const garageIntent = parseSearchIntent('Garage Höhe 2 Meter');
const garageProfile = buildSearchProfile({ intent: garageIntent });
assert.equal(garageProfile.maxHeightMm, 2000);
assert.equal(passesHardRules(ev9Vehicle, garageProfile), true, 'EV9 1,755 m passt in 2 m');
assert.equal(passesHardRules(sportageVehicle, garageProfile), true, 'Sportage passt in 2 m Garage');

const trunkIntent = parseSearchIntent('SUV großer Kofferraum');
const trunkProfile = buildSearchProfile({ intent: trunkIntent });
assert.equal(trunkProfile.trunkLMin, 500);
assert.equal(passesHardRules(sportageVehicle, trunkProfile), true, 'Sportage 587 l');
assert.equal(passesHardRules(picantoVehicle, trunkProfile), false, 'Picanto zu klein');

const towIntent = parseSearchIntent('Hybrid 2 Tonnen Anhängelast');
const towProfile = buildSearchProfile({ intent: towIntent });
const ev6Vehicle = enrichVehicleWithCleverRecord({
  brand: 'Kia',
  model: 'EV6',
  modelKey: 'ev6',
  title: 'Kia EV6',
  powertrain: 'elektro',
});
assert.equal(passesHardRules(ev6Vehicle, towProfile), false, 'EV6 nur 1,6 t');
assert.equal(passesHardRules(sorentoVehicle, towProfile), true, 'Sorento 2,5 t');

console.log('cleverDataEngine.test.js: ok');
