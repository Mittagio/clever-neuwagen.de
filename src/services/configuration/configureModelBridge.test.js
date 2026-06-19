/**
 * Tests: Konfigurator-Brücke – alle Modelle
 */
import assert from 'node:assert/strict';
import { parseDealerAiInput } from '../dealerAiParser.js';
import { buildConfigureDraft, buildConfigureOptions, computeLiveRateForDraft } from '../dealerAiVehicleConfigureFlow.js';
import {
  listResolvableConfigureModelKeys,
  resolveConfigureModel,
} from './configureModelBridge.js';
import { getDealerSeed } from '../../data/dealers/index.js';

const conditions = getDealerSeed('autohaus-trinkle');

function assertModelWorks(modelKey, label) {
  const mfg = resolveConfigureModel(modelKey);
  assert.ok(mfg, `${label}: resolveConfigureModel`);
  const options = buildConfigureOptions(modelKey);
  assert.ok(options.trims.length >= 1, `${label}: mindestens eine Linie`);
  assert.ok(options.engines.length >= 1, `${label}: Motor/Batterie`);
  assert.ok(options.colors.length >= 1, `${label}: Farben`);
}

const coreModels = ['ev2', 'ev3', 'ev4', 'ev5', 'ev6', 'ev9', 'sportage', 'sportage-hybrid', 'picanto', 'niro', 'ceed', 'seltos', 'xceed'];
for (const key of coreModels) {
  assertModelWorks(key, key);
}

const ev2Parsed = parseDealerAiInput('Kia EV2 Earth Winter Connect schwarz, Leasing, 48 Monate, 15.000 km');
const ev2Draft = buildConfigureDraft(ev2Parsed, conditions);
assert.equal(ev2Draft.trimId, 'earth');
assert.ok(ev2Draft.options.trims.length >= 3);
assert.ok(ev2Draft.options.packages.some((p) => /winter.?connect/i.test(p.label)));
assert.ok(computeLiveRateForDraft(ev2Draft, conditions)?.amount != null);

const ev6Parsed = parseDealerAiInput('Kia EV6 Earth 84 kWh, Leasing, 48 Monate, 15.000 km');
const ev6Draft = buildConfigureDraft(ev6Parsed, conditions);
assert.equal(ev6Draft.modelKey, 'ev6');
assert.equal(ev6Draft.trimId, 'earth');
assert.ok(ev6Draft.options.trims.length >= 3);
assert.ok(computeLiveRateForDraft(ev6Draft, conditions)?.amount != null);

const keys = listResolvableConfigureModelKeys();
assert.ok(keys.length >= 20, 'genug auflösbare Modell-Keys');

console.log(`configureModelBridge.test.js: ok (${keys.length} Modelle)`);
