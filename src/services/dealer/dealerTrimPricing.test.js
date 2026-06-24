/**
 * node src/services/dealer/dealerTrimPricing.test.js
 */
import assert from 'node:assert/strict';
import {
  buildModelTrimPricePresentation,
  resolveTrimListPrice,
} from './dealerTrimPricing.js';

const conditions = {
  preparationFee: 1290,
  modelSettingsByModel: {
    ev3: {
      trimConditions: {
        air: { paymentDiscounts: { leasing: 10, cash: 10, financing: 10 } },
        earth: { paymentDiscounts: { leasing: 12, cash: 12, financing: 12 } },
        'gt-line': { paymentDiscounts: { leasing: 13, cash: 13, financing: 13 } },
      },
    },
  },
  leasingFactorsByModel: {
    ev3: {
      air: { 48: { 10000: 0.62 } },
      earth: { 48: { 10000: 0.64 } },
      'gt-line': { 48: { 10000: 0.66 } },
    },
  },
};

assert.equal(resolveTrimListPrice('ev3', 'air'), 35990);
assert.equal(resolveTrimListPrice('ev3', 'earth'), 38290);

const model = { id: 'ev3', brand: 'Kia', name: 'EV3' };
const presentation = buildModelTrimPricePresentation(conditions, model);

assert.equal(presentation.hasMultipleTrims, true);
assert.equal(presentation.trimLines.length, 3);

const air = presentation.trimLines.find((line) => line.trimId === 'air');
const earth = presentation.trimLines.find((line) => line.trimId === 'earth');
const gt = presentation.trimLines.find((line) => line.trimId === 'gt-line');

assert.equal(air.baseDiscountPercent, 10);
assert.equal(earth.baseDiscountPercent, 12);
assert.equal(gt.baseDiscountPercent, 13);

assert.ok(air.displayRate > 0);
assert.ok(earth.displayRate > air.displayRate);
assert.ok(gt.displayRate > earth.displayRate);

console.log('dealerTrimPricing.test.js: ok');
console.log(`  Air: ${air.displayRate} € · Earth: ${earth.displayRate} € · GT-Line: ${gt.displayRate} €`);
