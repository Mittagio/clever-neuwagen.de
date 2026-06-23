/**
 * Händler-Modellpreise – Berechnung & Kundenansicht
 */
import assert from 'node:assert/strict';
import {
  applyDealerModelPricing,
  buildCustomerPricePresentation,
  mapCustomerGroupToTargetGroup,
  resolveApplicablePromotions,
  resolvePaymentDiscountPercent,
} from './dealerModelPricing.js';
import { normalizeDealerConditions } from '../../data/dealerConditionsSchema.js';

const baseConditions = normalizeDealerConditions({
  preparationFee: 1290,
  discountsByModel: {
    sportage: { standard: 8 },
  },
  modelSettingsByModel: {
    sportage: {
      paymentDiscounts: { cash: 12, leasing: 10, financing: 9 },
      discountMin: 0,
      discountMax: 50,
      preparationFee: {
        useDealerDefault: true,
        cashDisplayMode: 'separate',
        leasingAlwaysSeparate: true,
      },
      promotions: [
        {
          id: 'promo-student',
          title: 'Studentenbonus',
          bonusAmount: 500,
          extraDiscountPercent: 2,
          targetGroup: 'studenten',
          validFrom: '2026-01-01',
          validUntil: '2026-12-31',
          active: true,
          showOnCustomerSite: true,
          badgeText: '500 € Studentenbonus',
        },
        {
          id: 'promo-all',
          title: 'Frühjahrsaktion',
          bonusAmount: 0,
          extraDiscountPercent: 3,
          targetGroup: 'all',
          validFrom: '2026-01-01',
          validUntil: '2026-12-31',
          active: true,
          showOnCustomerSite: true,
          badgeText: '3 % Frühjahrsaktion',
        },
        {
          id: 'promo-expired',
          title: 'Alt',
          bonusAmount: 1000,
          extraDiscountPercent: 5,
          targetGroup: 'all',
          validFrom: '2024-01-01',
          validUntil: '2024-12-31',
          active: true,
          showOnCustomerSite: true,
        },
      ],
    },
  },
});

assert.equal(mapCustomerGroupToTargetGroup('studenten'), 'studenten');
assert.equal(mapCustomerGroupToTargetGroup('standard'), 'all');

assert.equal(
  resolvePaymentDiscountPercent(baseConditions, 'sportage', 'leasing', 'standard'),
  10,
);
assert.equal(
  resolvePaymentDiscountPercent(baseConditions, 'sportage', 'cash', 'standard'),
  12,
);

const now = new Date('2026-06-17');
const studentPromos = resolveApplicablePromotions(
  baseConditions,
  'sportage',
  'studenten',
  now,
);
assert.equal(studentPromos.length, 2);
assert.ok(studentPromos.some((p) => p.id === 'promo-student'));
assert.ok(studentPromos.some((p) => p.id === 'promo-all'));
assert.ok(!studentPromos.some((p) => p.id === 'promo-expired'));

const standardPromos = resolveApplicablePromotions(
  baseConditions,
  'sportage',
  'standard',
  now,
);
assert.equal(standardPromos.length, 1);
assert.equal(standardPromos[0].id, 'promo-all');

const configPrice = 40000;
const leasingFactor = 0.64;
const leasing = applyDealerModelPricing({
  conditions: baseConditions,
  modelId: 'sportage',
  paymentType: 'leasing',
  customerGroup: 'studenten',
  configurationPrice: configPrice,
  leasingFactor,
  termMonths: 48,
  downPayment: 0,
  now,
});

assert.equal(leasing.baseDiscountPercent, 10);
assert.equal(leasing.extraDiscountPercent, 5);
assert.equal(leasing.discountPercent, 15);
assert.equal(leasing.promoBonusAmount, 500);
assert.equal(leasing.housePrice, configPrice - Math.round(configPrice * 0.15) - 500);
assert.ok(leasing.preparationFeeLine.includes('zzgl.'));
assert.ok(leasing.preparationFeeSeparate);
assert.ok(leasing.leasingRate > 0);
assert.ok(leasing.leasingRate < Math.round(configPrice * (leasingFactor / 100)));

const cashSeparate = applyDealerModelPricing({
  conditions: baseConditions,
  modelId: 'sportage',
  paymentType: 'cash',
  customerGroup: 'standard',
  configurationPrice: configPrice,
  now,
});
assert.equal(cashSeparate.cashPrice, cashSeparate.housePrice);
assert.ok(cashSeparate.preparationFeeLine.includes('zzgl.'));

const cashIncludedConditions = normalizeDealerConditions({
  ...baseConditions,
  modelSettingsByModel: {
    sportage: {
      ...baseConditions.modelSettingsByModel.sportage,
      preparationFee: {
        useDealerDefault: true,
        cashDisplayMode: 'included',
      },
    },
  },
});

const cashIncluded = applyDealerModelPricing({
  conditions: cashIncludedConditions,
  modelId: 'sportage',
  paymentType: 'cash',
  customerGroup: 'standard',
  configurationPrice: configPrice,
  now,
});
assert.equal(cashIncluded.cashPrice, cashIncluded.housePrice + cashIncluded.preparationFee);
assert.ok(cashIncluded.preparationFeeLine.includes('inkl.'));

const presentation = buildCustomerPricePresentation(
  baseConditions,
  'sportage',
  {
    configurationPrice: configPrice,
    leasingRate: 299,
    leasing: { factor: leasingFactor, termMonths: 48, downPayment: 0 },
  },
  'leasing',
);
assert.ok(presentation.amount > 0);
assert.ok(presentation.primaryLabel.includes('€/Monat'));
assert.ok(presentation.footnotes.length > 0);
assert.ok(presentation.preparationFeeLine);

console.log('dealerModelPricing.test.js: ok');
