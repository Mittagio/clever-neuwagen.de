/**
 * Regression: jede voll beantwortbare Matching-Frage → Parser + Profil.
 * node src/data/search/customerQuestionCatalog.regression.test.js
 */
import assert from 'node:assert/strict';
import { FULLY_ANSWERABLE } from './customerQuestionCatalog.js';
import { parseSearchIntent } from '../../services/search/searchIntentParser.js';
import { buildSearchProfile } from '../../services/search/searchProfile.js';
import { passesHardRules } from '../../services/search/hardExclusionRules.js';
import { enrichVehicleWithCleverRecord } from '../clever/cleverDataRegistry.js';

const matchQuestions = FULLY_ANSWERABLE.filter((q) => q.scope === 'match');

function assertProfileField(profile, question, intent) {
  const field = question.profileField;
  if (field === 'requiredFeatures' && question.featureId) {
    const ok = profile.requiredFeatures?.includes(question.featureId)
      || intent.features?.includes(question.featureId);
    assert.ok(ok, `${question.id}: feature ${question.featureId} fehlt nach „${question.exampleQueries[0]}“`);
    return;
  }
  const value = profile[field];
  assert.ok(
    value != null && value !== '',
    `${question.id}: ${field} fehlt nach „${question.exampleQueries[0]}“`,
  );
}

for (const question of matchQuestions) {
  const query = question.exampleQueries[0];
  const intent = parseSearchIntent(query);
  const profile = buildSearchProfile({ intent, query });

  if (question.profileField) {
    assertProfileField(profile, question, intent);
  }

  if (question.featureId && !question.profileField) {
    const inFeatures = profile.requiredFeatures?.includes(question.featureId)
      || intent.features?.includes(question.featureId);
    assert.ok(inFeatures, `${question.id}: feature ${question.featureId} nicht erkannt`);
  }
}

// Golden Cases aus Demo-Queries
const goldenCases = [
  {
    query: 'Familienauto mit 3 Isofix',
    assert: (p) => p.isofixRearMin === 3,
    vehiclePass: enrichVehicleWithCleverRecord({
      brand: 'Kia', model: 'Sorento', modelKey: 'sorento-phev', powertrain: 'plugin-hybrid',
    }),
    vehicleFail: enrichVehicleWithCleverRecord({
      brand: 'Kia', model: 'EV9', modelKey: 'ev9', powertrain: 'elektro',
    }),
  },
  {
    query: '2 Tonnen Anhängelast',
    assert: (p) => (p.towCapacityKg ?? 0) >= 2000,
    vehiclePass: enrichVehicleWithCleverRecord({
      brand: 'Kia', model: 'Sorento', modelKey: 'sorento', powertrain: 'verbrenner',
    }),
    vehicleFail: enrichVehicleWithCleverRecord({
      brand: 'Kia', model: 'EV6', modelKey: 'ev6', powertrain: 'elektro',
    }),
  },
  {
    query: '5 sitze bis 4 Meter länge',
    assert: (p) => p.seatsMin === 5 && p.maxLengthMm === 4000,
    vehiclePass: enrichVehicleWithCleverRecord({
      brand: 'Kia', model: 'Picanto', modelKey: 'picanto', powertrain: 'verbrenner', seats: 5,
    }),
    vehicleFail: enrichVehicleWithCleverRecord({
      brand: 'Kia', model: 'Sportage', modelKey: 'sportage-hybrid', powertrain: 'hybrid', seats: 5,
    }),
  },
];

for (const golden of goldenCases) {
  const profile = buildSearchProfile({ intent: parseSearchIntent(golden.query), query: golden.query });
  assert.ok(golden.assert(profile), `Golden-Profil: ${golden.query}`);
  assert.equal(passesHardRules(golden.vehiclePass, profile), true, `Pass: ${golden.query}`);
  assert.equal(passesHardRules(golden.vehicleFail, profile), false, `Fail: ${golden.query}`);
}

console.log(`customerQuestionCatalog.regression.test.js: ok (${matchQuestions.length} volle Fragen + ${goldenCases.length} Golden Cases)`);
