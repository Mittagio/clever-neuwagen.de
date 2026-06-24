/**
 * node src/services/dealer/dealerTrimConditions.test.js
 */
import assert from 'node:assert/strict';
import {
  buildTrimConditionsPatch,
  buildTrimConditionsPatchForAll,
  copyTrimSettingsPatch,
  resolveTrimSettings,
  TRIM_SCOPE_ALL,
} from './dealerTrimConditions.js';
import { getLeasingFactorValue } from './dealerLeasingWizard.js';

const baseSettings = {
  paymentDiscounts: { cash: 8, leasing: 8, financing: 8 },
  bonusAmount: 500,
  leasingFactorSkipped: { '48-5000': true },
  trimConditions: {
    earth: {
      paymentDiscounts: { cash: 12, leasing: 12, financing: 12 },
      bonusAmount: 1000,
    },
  },
};

const earth = resolveTrimSettings(baseSettings, 'earth');
assert.equal(earth.paymentDiscounts.cash, 12);
assert.equal(earth.bonusAmount, 1000);

const air = resolveTrimSettings(baseSettings, 'air');
assert.equal(air.paymentDiscounts.cash, 8);
assert.equal(air.bonusAmount, 500);
assert.equal(air.leasingFactorSkipped['48-5000'], true);

const airPatch = buildTrimConditionsPatch(baseSettings, 'air', {
  paymentDiscounts: { cash: 10 },
});
assert.equal(airPatch.trimConditions.air.paymentDiscounts.cash, 10);
assert.equal(airPatch.trimConditions.air.paymentDiscounts.leasing, 8);

const allPatch = buildTrimConditionsPatchForAll(
  baseSettings,
  ['air', 'earth'],
  { paymentDiscounts: { leasing: 11 } },
);
assert.equal(allPatch.trimConditions.air.paymentDiscounts.leasing, 11);
assert.equal(allPatch.trimConditions.earth.paymentDiscounts.leasing, 11);
assert.equal(allPatch.trimConditions.earth.paymentDiscounts.cash, 12);

const copied = copyTrimSettingsPatch(baseSettings, 'earth', 'air');
assert.equal(copied.trimConditions.air.paymentDiscounts.cash, 12);
assert.equal(copied.trimConditions.air.bonusAmount, 1000);

const trimLeasing = {
  leasingFactorsByModel: {
    ev3: {
      air: { 48: { 10000: 0.62 } },
      earth: { 48: { 10000: 0.64 } },
    },
  },
};
assert.equal(getLeasingFactorValue(trimLeasing, 'ev3', 48, 10000, 'air'), 0.62);
assert.equal(getLeasingFactorValue(trimLeasing, 'ev3', 48, 10000, 'earth'), 0.64);

assert.equal(TRIM_SCOPE_ALL, '__all__');

console.log('dealerTrimConditions.test.js: ok');
