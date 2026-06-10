import assert from 'node:assert/strict';
import { buildVehicleLexicon, answerVehicleLexiconQuery } from './vehicleLexiconService.js';
import { getKiaTrinklePilotStock } from '../../data/kia/kiaTrinkleStock.js';

const lexicon = buildVehicleLexicon();
assert.ok(lexicon.length >= 27, `Lexikon: ${lexicon.length} Modelllinien`);
assert.ok(lexicon.some((e) => e.modelKey === 'sorento' && e.facts.trunkL === 616));
assert.ok(lexicon.some((e) => e.modelKey === 'pv5-cargo' && e.facts.trunkL >= 4000));

const trunkVolume = answerVehicleLexiconQuery('Kofferraum mindestens 500 Liter', getKiaTrinklePilotStock());
assert.equal(trunkVolume.kind, 'matches');
assert.ok(trunkVolume.matches.length >= 3);
assert.ok(trunkVolume.matches.every((m) => m.facts == null || m.facts.trunkL >= 500));

const trunkCm = answerVehicleLexiconQuery('Kofferraum Länge über 100 cm');
assert.equal(trunkCm.kind, 'data_gap');
assert.ok(trunkCm.topByVolume?.length >= 3);
assert.match(trunkCm.explanation, /Liter/);

const garage = answerVehicleLexiconQuery('Garage Höhe 2 Meter', getKiaTrinklePilotStock());
assert.equal(garage.kind, 'matches');
assert.ok(garage.queryInterpretation.includes('Höhe'));

const maxRange = answerVehicleLexiconQuery('Fahrzeug mit meister Reichweite', getKiaTrinklePilotStock());
assert.equal(maxRange.kind, 'ranking');
assert.equal(maxRange.matches[0].modelKey, 'ev4-fastback');
assert.ok(maxRange.matches[0].facts.rangeKm >= 600);
assert.ok(maxRange.matches.every((m, i, arr) => i === 0 || m.facts.rangeKm <= arr[i - 1].facts.rangeKm));

console.log('vehicleLexiconService.test.js: ok');
