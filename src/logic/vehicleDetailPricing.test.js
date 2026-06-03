import assert from 'node:assert/strict';
import {
  computeDetailPricing,
  buildPriceSubtitle,
  buildInquirySummary,
  buildPaymentTeaserLine,
} from './vehicleDetailPricing.js';

const vehicle = { monthlyRate: 239, cashPrice: 27990 };

const leasing = computeDetailPricing({
  payment: 'leasing',
  termMonths: 48,
  mileagePerYear: 10000,
  downPayment: 0,
  vehicle,
  basePricing: { leasingRate: 239, financeRate: 319, cashPrice: 27990 },
});
assert.match(leasing.priceLabel, /239.*€\/Monat/);
assert.match(leasing.subtitle, /48 Monate/);
assert.match(buildPaymentTeaserLine(leasing), /0 € Anzahlung/);

const finance = computeDetailPricing({
  payment: 'finance',
  termMonths: 48,
  vehicle,
  basePricing: { leasingRate: 239, financeRate: 319, cashPrice: 27990 },
});
assert.equal(finance.paymentLabel, 'Finanzierung');
assert.ok(finance.amount >= 49);

const cash = computeDetailPricing({
  payment: 'cash',
  vehicle,
  basePricing: { leasingRate: 239, cashPrice: 27990 },
});
assert.equal(cash.paymentLabel, 'Kaufpreis');
assert.equal(buildPriceSubtitle({ payment: 'cash' }), 'Kaufpreis');

const summary = buildInquirySummary({
  displayTitle: 'Kia Ceed SW Vision',
  dealerName: 'Autohaus Trinkle',
  distanceKm: 12,
  pricing: leasing,
});
assert.ok(summary.lines.some((l) => l.includes('Ceed')));

console.log('✓ vehicleDetailPricing Tests bestanden.');
