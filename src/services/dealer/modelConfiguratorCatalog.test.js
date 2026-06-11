import assert from 'node:assert/strict';
import {
  buildInterestOptions,
  createDefaultConfiguration,
  hasConfigurator,
  resolveConfiguratorCatalog,
  summarizeConfiguration,
} from './modelConfiguratorCatalog.js';
import { enrichSmartAnswerJourney } from './smartAnswerJourney.js';
import { buildDealerSmartAnswer } from './dealerSmartAnswerService.js';
import { analyzeVehicleQuery } from '../search/vehicleQueryIntent.js';
import { parseSearchIntent } from '../search/searchIntentParser.js';
import { buildSearchProfile } from '../search/searchProfile.js';

assert.equal(hasConfigurator('sorento'), true);
assert.equal(hasConfigurator('sorento-hybrid'), true);
assert.equal(hasConfigurator('ev9'), false);

const catalog = resolveConfiguratorCatalog('sorento-phev');
assert.equal(catalog?.id, 'sorento');
assert.equal(catalog.trims.length, 3);

const config = createDefaultConfiguration('sorento');
assert.equal(config.trimId, 'spirit');

const summary = summarizeConfiguration({
  ...config,
  packageIds: ['ahk', 'wartung'],
});
assert.equal(summary.modelLabel, 'Sorento Hybrid');
assert.deepEqual(summary.packageLabels, ['AHK', 'Wartung']);

const compareQ = 'EV9 oder Sorento';
const intent = parseSearchIntent(compareQ);
const profile = buildSearchProfile({ intent, query: compareQ });
const analysis = analyzeVehicleQuery(compareQ, intent, profile);
const answer = enrichSmartAnswerJourney(buildDealerSmartAnswer(compareQ), analysis);

assert.equal(answer.journeyKind, 'compare');
assert.equal(answer.interestOptions.length, 2);
assert.ok(answer.interestOptions.find((o) => o.modelKey === 'ev9'));
assert.ok(answer.interestOptions.find((o) => o.modelKey === 'sorento' || o.hasConfigurator));

const sorentoInterest = answer.interestOptions.find((o) => o.hasConfigurator);
assert.equal(sorentoInterest?.cta, 'Sorento konfigurieren');

const options = buildInterestOptions({
  compareModelKeys: ['ev9', 'sorento'],
  modelCards: [{ modelKey: 'ev9' }, { modelKey: 'sorento' }],
});
assert.equal(options.length, 2);

console.log('modelConfiguratorCatalog.test.js: ok');
