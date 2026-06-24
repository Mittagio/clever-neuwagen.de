/**
 * node src/services/dealer/dealerLeasingWizard.test.js
 */
import assert from 'node:assert/strict';
import {
  buildLeasingWizardCombos,
  comboKey,
  getLeasingWizardProgress,
  getNextPendingCombo,
  clampLeasingFactorInput,
  LEASING_WIZARD_TERMS,
  LEASING_WIZARD_MILEAGES,
} from './dealerLeasingWizard.js';

assert.equal(buildLeasingWizardCombos().length, 24);
assert.deepEqual(LEASING_WIZARD_TERMS, [24, 36, 48, 60]);
assert.deepEqual(LEASING_WIZARD_MILEAGES, [5000, 7500, 10000, 15000, 20000, 30000]);

const conditions = {
  leasingFactorsByModel: {
    ev2: {
      48: { 10000: 0.64, 15000: 0.68 },
    },
  },
};

const progress = getLeasingWizardProgress(conditions, 'ev2', { '48-5000': true });
assert.equal(progress.filled, 2);
assert.equal(progress.skipped, 1);
assert.equal(progress.total, 24);
assert.equal(progress.pending, 21);

const next = getNextPendingCombo(conditions, 'ev2', { '48-5000': true });
assert.equal(next.term, 24);
assert.equal(next.km, 5000);

assert.equal(clampLeasingFactorInput('0,64'), 0.64);
assert.equal(clampLeasingFactorInput(''), null);
assert.equal(comboKey(48, 15000), '48-15000');

console.log('dealerLeasingWizard.test.js: ok');
