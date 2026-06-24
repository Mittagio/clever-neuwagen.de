/**
 * node src/services/dealer/dealerFinanceResiduals.test.js
 */
import assert from 'node:assert/strict';
import {
  clampResidualPercentInput,
  getFinanceResidualProgress,
  getFinanceResidualValue,
  getNextPendingResidualTerm,
  FINANCE_RESIDUAL_TERMS,
} from './dealerFinanceResiduals.js';

assert.equal(clampResidualPercentInput('55,5'), 55.5);
assert.equal(clampResidualPercentInput('150'), 100);

const conditions = {
  financeResidualsByModel: {
    ev3: {
      air: { 24: 60, 36: 55 },
      earth: { 48: 50 },
    },
  },
};

assert.equal(getFinanceResidualValue(conditions, 'ev3', 24, 'air'), 60);
assert.equal(getFinanceResidualValue(conditions, 'ev3', 48, 'air'), null);
assert.equal(getFinanceResidualValue(conditions, 'ev3', 48, 'earth'), 50);

const progress = getFinanceResidualProgress(conditions, 'ev3', {}, 'air');
assert.equal(progress.filled, 2);
assert.equal(progress.total, FINANCE_RESIDUAL_TERMS.length);
assert.equal(progress.pending, 2);

const next = getNextPendingResidualTerm(conditions, 'ev3', {}, null, 'air');
assert.equal(next, 48);

console.log('dealerFinanceResiduals.test.js: ok');
