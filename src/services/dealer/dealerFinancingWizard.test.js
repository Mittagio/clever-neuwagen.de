/**
 * node src/services/dealer/dealerFinancingWizard.test.js
 */
import assert from 'node:assert/strict';
import {
  buildFinancingWizardCombos,
  calcFinanceMonthlyRate,
  financeComboKey,
  getFinancingWizardProgress,
  getFinanceConditionValue,
  getNextPendingFinanceCombo,
  isFinanceConditionComplete,
} from './dealerFinancingWizard.js';

assert.equal(buildFinancingWizardCombos().length, 24);
assert.equal(financeComboKey(48, 3000), '48-3000');

const conditions = {
  financeConditionsByModel: {
    ev3: {
      air: {
        48: {
          3000: {
            effectiveRate: 4.99,
            finalPaymentPercent: 35,
          },
        },
      },
    },
  },
};

const value = getFinanceConditionValue(conditions, 'ev3', 48, 3000, 'air');
assert.equal(value.effectiveRate, 4.99);
assert.equal(value.finalPaymentPercent, 35);
assert.equal(isFinanceConditionComplete(value), true);

const progress = getFinancingWizardProgress(conditions, 'ev3', { '24-0': true }, 'air');
assert.equal(progress.filled, 1);
assert.equal(progress.skipped, 1);
assert.equal(progress.total, 24);

const next = getNextPendingFinanceCombo(conditions, 'ev3', { '24-0': true }, null, 'air');
assert.equal(next.term, 24);
assert.equal(next.downPayment, 1000);

const rate = calcFinanceMonthlyRate(40000, 3000, 48, {
  effectiveRate: 4.99,
  finalPaymentPercent: 35,
});
assert.ok(rate > 0);

console.log('dealerFinancingWizard.test.js: ok');
