import assert from 'node:assert/strict';
import {
  getSpecialConditionLabels,
  hasSpecialConditions,
  resolvePrimaryDiscountGroup,
  toggleSpecialCondition,
} from './specialConditionOptions.js';
import { buildDealerJourneySnapshot } from './purchaseTypeOptions.js';

assert.deepEqual(toggleSpecialCondition([], 'gewerbe'), ['gewerbe']);
assert.deepEqual(toggleSpecialCondition(['gewerbe'], 'corporateBenefits'), ['gewerbe', 'corporateBenefits']);
assert.deepEqual(toggleSpecialCondition(['gewerbe'], 'gewerbe'), []);
assert.deepEqual(toggleSpecialCondition(['gewerbe', 'corporateBenefits'], 'none'), ['none']);
assert.deepEqual(toggleSpecialCondition(['none'], 'none'), []);
assert.deepEqual(toggleSpecialCondition(['none'], 'gewerbe'), ['gewerbe']);

assert.deepEqual(
  getSpecialConditionLabels(['corporateBenefits', 'beamter']),
  ['Corporate Benefits', 'Beamter'],
);
assert.deepEqual(getSpecialConditionLabels(['none']), ['Keine Sonderkondition']);

assert.equal(resolvePrimaryDiscountGroup(['corporateBenefits', 'gewerbe']), 'corporateBenefits');
assert.equal(resolvePrimaryDiscountGroup(['none']), 'standard');
assert.equal(hasSpecialConditions(['gewerbe']), true);
assert.equal(hasSpecialConditions(['none']), false);

const snap = buildDealerJourneySnapshot({
  configSummary: { modelLabel: 'Sorento', trimLabel: 'Platinum' },
  purchaseType: 'leasing',
  specialConditions: ['corporateBenefits'],
});
assert.equal(snap.discountGroup, 'corporateBenefits');
assert.deepEqual(snap.specialConditionLabels, ['Corporate Benefits']);

console.log('specialConditionOptions.test.js: ok');
