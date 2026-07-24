/**
 * Magic Offer – Golden Tests (Safe Boundary)
 */
import assert from 'node:assert/strict';
import { prepareMagicOffer, applyMagicOfferCorrection, overlayMagicOntoOfferDraft } from './magicOfferService.js';
import { computeSafeCashOffer, computePercentDiscount } from './magicOfferSafeCalculation.js';
import { parseMagicOfferIntent } from './magicOfferIntentParser.js';
import { decideMagicOfferAction, MAGIC_DECISION } from './magicOfferDecision.js';

// Deterministic percent helper
const pct = computePercentDiscount(53250, 21);
assert.equal(pct.discountAmount, 11182.5);
assert.equal(pct.afterDiscount, 42067.5);

const GOLDEN = 'EV3 GT-Line mit P10 P11 P12 in Terracotta, 21 Prozent plus 1290 Überführung.';
const prepared = prepareMagicOffer(GOLDEN, { modelKey: 'ev3' });
assert.equal(prepared.mode, 'cash_magic', `mode: ${prepared.mode}`);
assert.ok(prepared.canCreateOffer, 'can create');
assert.equal(prepared.calculation.listPrice, 53250, `list ${prepared.calculation.listPrice}`);
assert.equal(prepared.calculation.discountAmount, 11182.5);
assert.equal(prepared.calculation.vehiclePrice, 42067.5);
assert.equal(prepared.calculation.transferCost, 1290);
assert.equal(prepared.calculation.endPrice, 43357.5);
assert.ok(prepared.positionLines.some((row) => /P10/i.test(row.label)));
assert.ok(prepared.positionLines.some((row) => /Terracotta/i.test(row.label)));

// A) P11 raus
const withoutP11 = applyMagicOfferCorrection(prepared, 'P11 raus');
assert.ok(withoutP11.calculation.listPrice < 53250, 'UPE sinkt ohne P11');
assert.ok(!withoutP11.grounded.packageIds.includes('ev3-p11'));

// B) 22 Prozent
const pct22 = applyMagicOfferCorrection(prepared, 'Mach 22 Prozent.');
assert.equal(pct22.calculation.discountPercent, 22);

// C) Überführung 990
const transfer990 = applyMagicOfferCorrection(prepared, 'Überführung 990.');
assert.equal(transfer990.calculation.transferCost, 990);

// D) unbekanntes Paket
const unknown = prepareMagicOffer('EV3 GT-Line P99 Terracotta 21%', { modelKey: 'ev3' });
assert.equal(unknown.ok, false);
assert.ok(unknown.unresolvedPackages.includes('P99'));

// F) Leasing mit Rate
const leasing = prepareMagicOffer('EV3 GT-Line, 329 Euro, 36 Monate, 15.000 Kilometer, keine Sonderzahlung, 1.290 Überführung.');
assert.equal(leasing.mode, 'leasing_intake');
assert.equal(leasing.calculation.monthlyRate, 329);
assert.equal(leasing.intent.commercialInput.durationMonths, 36);
assert.equal(leasing.canCreateOffer, true);

// G) Leasing ohne Rate
const leasingNoRate = prepareMagicOffer('EV3 GT-Line, 36 Monate, 15.000 km.');
assert.equal(leasingNoRate.decision.action, MAGIC_DECISION.ASK_RATE);
assert.ok(/Leasingrate/i.test(leasingNoRate.promptMessage ?? leasingNoRate.decision.message ?? ''));

// I) Finanzierung intake
const financing = prepareMagicOffer('EV3 Finanzierung 349 Euro, 48 Monate, 3.000 Euro Anzahlung, 17.900 Euro Schlussrate, 5,99 Prozent effektiv');
assert.equal(financing.mode, 'financing_intake');
assert.equal(financing.calculation.monthlyRate, 349);
assert.equal(financing.calculation.finalPayment, 17900);

// Decision matrix: no free finance calc
const blocked = decideMagicOfferAction({
  offerType: 'financing',
  groundedOk: true,
  hasVerifiedPrices: true,
  monthlyRate: null,
});
assert.equal(blocked.action, MAGIC_DECISION.BLOCKED);

const intent = parseMagicOfferIntent(GOLDEN);
assert.equal(intent.offerType, 'purchase');
assert.deepEqual(intent.vehicleRequest.packageKeys, ['P10', 'P11', 'P12']);
assert.equal(intent.commercialInput.discountPercent, 21);
assert.equal(intent.commercialInput.transferCost, 1290);

const cashOnly = computeSafeCashOffer({
  lineItems: [
    { label: 'base', amount: 48690 },
    { label: 'P10', amount: 1290 },
    { label: 'P11', amount: 1490 },
    { label: 'P12', amount: 990 },
    { label: 'Terracotta', amount: 790 },
  ],
  discountPercent: 21,
  transferCost: 1290,
});
assert.equal(cashOnly.endPrice, 43357.5);

const overlay = overlayMagicOntoOfferDraft(
  {
    payment: { type: 'leasing', calculatedRate: 999, budget: null },
    offerPreview: { monthlyRate: 999 },
    offerCalculation: { monthlyRate: 999 },
    source: {},
  },
  leasing,
);
assert.equal(overlay.payment.calculatedRate, 329);
assert.equal(overlay.offerPreview.monthlyRate, 329);
assert.equal(overlay.source.createdFrom, 'magic_offer');

const cashOverlay = overlayMagicOntoOfferDraft(
  {
    payment: { type: 'cash', calculatedRate: 1 },
    offerPreview: {},
    offerCalculation: {},
    source: {},
  },
  prepared,
);
assert.equal(cashOverlay.payment.calculatedRate, 43357.5);
assert.equal(cashOverlay.payment.discountAmount, 11182.5);

console.log('magicOfferService.test.js: ok');
