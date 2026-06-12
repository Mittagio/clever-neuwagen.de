import assert from 'node:assert/strict';
import { evaluateJourneyBudgetFit } from './journeyBudgetFit.js';

const fits = evaluateJourneyBudgetFit(
  { budget: { maxMonthlyRate: 500, label: 'bis 500 €' }, purchaseType: 'leasing' },
  { pricing: { leasingRate: 420, financeRate: 450 } },
);
assert.ok(fits?.fits);

const over = evaluateJourneyBudgetFit(
  { budget: { maxMonthlyRate: 300, label: 'bis 300 €' }, purchaseType: 'leasing' },
  { pricing: { leasingRate: 420 } },
);
assert.equal(over?.fits, false);
assert.equal(over?.delta, 120);

console.log('journeyBudgetFit.test.js: ok');
