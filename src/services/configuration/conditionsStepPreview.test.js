/**
 * Tests: Angebotskalkulator – Preview-Modelle & Verkäufer-Hinweise
 */
import assert from 'node:assert/strict';
import {
  buildCompactVehicleSummary,
  buildConditionsFooterAction,
  buildConditionsFooterSummary,
  buildConditionsSellerHints,
  computeConditionsStepPreview,
} from './conditionsStepPreview.js';

const vehicleConfiguration = {
  model: 'EV6',
  trimLabel: 'Vision',
  motorLabel: 'Hybrid',
  colorLabel: 'Clear White',
  uvpConfigurationPrice: 47190,
};

const leasingDraft = {
  paymentType: 'leasing',
  termMonths: 48,
  mileagePerYear: 15000,
  downPayment: 0,
  preparationFee: 1290,
};

// A) Kompakte Fahrzeugzeile
const summary = buildCompactVehicleSummary(vehicleConfiguration, {});
assert.equal(summary.modelLine, 'EV6 Vision');
assert.equal(summary.metaLine, 'Hybrid · Clear White');
assert.equal(summary.uvpFormatted, '47.190 €');

// B) Footer-Aktion
const footerAction = buildConditionsFooterAction();
assert.equal(footerAction.label, 'Angebot speichern');
assert.equal(footerAction.previewLabel, 'Vorschau ansehen');

// C) Footer-Summary Leasing
const dealerConditions = {
  preparationFee: 1290,
  leasingFactors: { 48: { 15000: 0.85 } },
  discounts: { standard: 18 },
};
const preview = computeConditionsStepPreview(vehicleConfiguration, leasingDraft, dealerConditions);
const footerSummary = buildConditionsFooterSummary(preview, leasingDraft, summary);
assert.ok(footerSummary.chips.includes('Leasing'));
assert.ok(footerSummary.contextLine?.includes('EV6 Vision'));
assert.ok(footerSummary.contextLine?.includes('48 Monate'));
assert.ok(footerSummary.hasLiveResult === false || footerSummary.result != null);

// D) Footer-Summary Kauf
const cashDraft = { paymentType: 'cash', customerGroup: 'standard', preparationFee: 1290 };
const cashPreview = computeConditionsStepPreview(vehicleConfiguration, cashDraft, dealerConditions);
const cashFooter = buildConditionsFooterSummary(cashPreview, cashDraft);
assert.ok(cashFooter.chips.includes('Barangebot'));
assert.ok(cashFooter.result);

// E) Verkäufer-Hinweise
const wishChips = ['Leasing', '48 Monate', 'bis 386 €/Monat'];
const hintsMissingDelivery = buildConditionsSellerHints(preview, leasingDraft, wishChips);
assert.ok(hintsMissingDelivery.some((h) => h.message.includes('Lieferzeit fehlt')));

const hintsWithDelivery = buildConditionsSellerHints(
  preview,
  { ...leasingDraft, desiredDeliveryDate: 'sofort' },
  wishChips,
);
assert.ok(!hintsWithDelivery.some((h) => h.message.includes('Lieferzeit fehlt')));

const overBudgetPreview = {
  ...preview,
  canShowLiveLeasingRate: true,
  monthlyRate: 408,
  isLeasing: true,
};
const overHints = buildConditionsSellerHints(overBudgetPreview, leasingDraft, wishChips);
assert.ok(overHints.some((h) => h.message.includes('über Kundenwunsch')));

const okHints = buildConditionsSellerHints(
  { ...overBudgetPreview, monthlyRate: 380 },
  { ...leasingDraft, desiredDeliveryDate: 'sofort' },
  wishChips,
);
assert.ok(okHints.some((h) => h.message.includes('Rate passt zum Kundenwunsch')));
assert.ok(okHints.some((h) => h.message.includes('Überführung enthalten')));
assert.ok(okHints.some((h) => h.message.includes('Wartung nicht in Rate')));

const cashHints = buildConditionsSellerHints(
  { ...cashPreview, discountPercent: 0 },
  { ...cashDraft, customerGroup: 'standard' },
  [],
);
assert.ok(cashHints.some((h) => h.message.includes('Zielgruppe')));

console.log('conditionsStepPreview.test.js: ok');
