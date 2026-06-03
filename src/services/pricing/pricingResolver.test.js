import assert from 'node:assert/strict';
import {
  getDisplayPrice,
  getPaymentLabel,
  getDeltaPrice,
  normalizePaymentModeInput,
} from './pricingResolver.js';

const vehicle = { monthlyRate: 348, cashPrice: 38065 };
const offer = { monthlyRate: 348, financeRate: 482, cashPrice: 38065 };

const leasingSelection = {
  paymentMode: 'leasing',
  termMonths: 48,
  mileagePerYear: 10000,
  downPayment: 0,
};

const financeSelection = {
  paymentMode: 'financing',
  termMonths: 48,
  mileagePerYear: 10000,
  financeDown: 5000,
};

const cashSelection = { paymentMode: 'cash' };

// Test 1: Leasing
const leasingPrice = getDisplayPrice(leasingSelection, offer, {
  basePricing: { leasingRate: 348, financeRate: 482, cashPrice: 38065 },
  vehicle,
});
assert.equal(leasingPrice.type, 'monthly');
assert.match(leasingPrice.label, /348.*€\/Monat/);
assert.match(leasingPrice.subtitle, /Leasing/);

// Test 2: Kaufpreis – keine Monatsrate
const cashPrice = getDisplayPrice(cashSelection, offer, {
  basePricing: { leasingRate: 348, cashPrice: 38065 },
  vehicle,
});
assert.equal(cashPrice.type, 'cash');
assert.ok(!cashPrice.label.includes('/Monat'));
assert.match(cashPrice.label, /38\.065/);

// Test 3: Finanzierung
const financePrice = getDisplayPrice(financeSelection, offer, {
  basePricing: { leasingRate: 348, financeRate: 482, cashPrice: 38065 },
  vehicle,
});
assert.equal(financePrice.type, 'monthly');
assert.match(financePrice.label, /€\/Monat/);
assert.equal(getPaymentLabel('financing'), 'Finanzierung');

// Delta cash
const delta = getDeltaPrice(
  cashSelection,
  cashSelection,
  offer,
  {
    basePricing: { cashPrice: 38065 },
    vehicle,
  },
);
assert.equal(delta.delta, 0);

assert.equal(normalizePaymentModeInput('financing'), 'finance');

console.log('✓ pricingResolver Acceptance Tests bestanden.');
