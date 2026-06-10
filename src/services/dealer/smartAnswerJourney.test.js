import assert from 'node:assert/strict';
import { parseSearchIntent } from '../search/searchIntentParser.js';
import { buildSearchProfile } from '../search/searchProfile.js';
import { analyzeVehicleQuery } from '../search/vehicleQueryIntent.js';
import { buildDealerSmartAnswer } from './dealerSmartAnswerService.js';
import {
  buildRelatedTopics,
  enrichSmartAnswerJourney,
  filterSearchBundleToModels,
} from './smartAnswerJourney.js';

const topics = buildRelatedTopics('ev2', 'batteryKwh');
assert.ok(topics.some((t) => t.label === 'Reichweite'));
assert.ok(topics.some((t) => t.label === 'Kofferraum'));
assert.equal(topics.find((t) => t.label === 'Batterie'), undefined);

const q = 'EV2 batterie';
const intent = parseSearchIntent(q);
const profile = buildSearchProfile({ intent, query: q });
const analysis = analyzeVehicleQuery(q, intent, profile);
const answer = enrichSmartAnswerJourney(buildDealerSmartAnswer(q), analysis);

assert.equal(answer.primaryModelKey, 'ev2');
assert.equal(answer.journeyKind, 'fact');
assert.ok(answer.relatedTopics.length >= 3);
assert.match(answer.fitPrompt ?? '', /Passt der EV2/);
assert.equal(answer.showFitCheck, true);
assert.equal(answer.showOffersCta, false);

const filtered = filterSearchBundleToModels({
  hasExactMatch: true,
  exact: {
    modelLineGroups: [
      { modelLineKey: 'ev2', primaryMatch: { vehicle: { modelKey: 'ev2' } } },
      { modelLineKey: 'ev3', primaryMatch: { vehicle: { modelKey: 'ev3' } } },
    ],
  },
  alternatives: [],
}, 'ev2');

assert.equal(filtered.exact.modelLineGroups.length, 1);
assert.equal(filtered.exact.modelLineGroups[0].modelLineKey, 'ev2');

console.log('smartAnswerJourney.test.js: ok');
