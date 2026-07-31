/**
 * German money parsing + seller confirm gate + PDF review skip
 */
import assert from 'node:assert/strict';
import {
  parseGermanMoney,
  parseGermanMoneyDetailed,
  assessCommercialPlausibility,
} from './parseGermanMoney.js';
import { parseMagicOfferIntent } from './magicOfferIntentParser.js';
import {
  prepareMagicOffer,
  shouldSkipMagicOfferReview,
  overlayMagicOntoOfferDraft,
  resolveMagicModelKey,
  resolveMagicVehicleFields,
  magicPreparationHasCommercialPreviewFields,
  magicPreparationToConfigurePatch,
} from './magicOfferService.js';
import {
  evaluateSellerConfirmGate,
  applyCommercialConfirmPatch,
  resolveLowConfidenceFields,
  buildHighConfidenceConfirmedMap,
} from './sellerOfferConfirmGate.js';

// --- parseGermanMoney core ---
assert.equal(parseGermanMoney('152,36'), 152.36);
assert.equal(parseGermanMoney('6.000'), 6000);
assert.equal(parseGermanMoney('1.290,00'), 1290);
assert.equal(parseGermanMoney('6.000,00'), 6000);
assert.equal(parseGermanMoney('329'), 329);
assert.equal(parseGermanMoney('5,99'), 5.99);
assert.equal(parseGermanMoney('347,00 EUR'), 347);

// Classic bug path must NOT explode decimals into integers
assert.notEqual(parseGermanMoney('152,36'), 15236);
assert.notEqual(parseGermanMoney('6.000,00'), 600000);

// 15.236 as thousand → 15236, flagged ambiguous (possible cent-shift of 152,36)
{
  const detailed = parseGermanMoneyDetailed('15.236');
  assert.equal(detailed.value, 15236);
  assert.equal(detailed.ambiguous, true);
  assert.ok(detailed.candidates.includes(152.36));
}

// Intent parser: decimal rates
{
  const intent = parseMagicOfferIntent('Sportage Leasing 152,36 €/Monat, 48 Monate, 6.000 € Anzahlung');
  assert.equal(intent.commercialInput.monthlyRate, 152.36);
  assert.equal(intent.commercialInput.downPayment, 6000);
  assert.equal(intent.offerType, 'leasing');
}

{
  const intent = parseMagicOfferIntent('EV3 Finanzierung 349 Euro, 48 Monate, 3.000 Euro Anzahlung, 5,99 Prozent effektiv');
  assert.equal(intent.commercialInput.monthlyRate, 349);
  assert.equal(intent.commercialInput.downPayment, 3000);
  assert.equal(intent.commercialInput.effectiveInterestRate, 5.99);
}

// Plausibility
{
  const bad = assessCommercialPlausibility({
    monthlyRate: 15236,
    downPayment: 600000,
    offerType: 'leasing',
  });
  assert.equal(bad.flags.monthlyRateImplausible, true);
  assert.equal(bad.flags.downPaymentImplausible, true);
  assert.ok(bad.warnings.length >= 2);
}

{
  const ok = assessCommercialPlausibility({
    monthlyRate: 152.36,
    downPayment: 6000,
    offerType: 'leasing',
  });
  assert.equal(ok.flags.monthlyRateImplausible, false);
  assert.equal(ok.flags.downPaymentImplausible, false);
}

// Confirm gate: cannot save without confirmation
{
  const blocked = evaluateSellerConfirmGate({
    confirmed: {},
    values: { monthlyRate: 152.36, offerType: 'leasing' },
  });
  assert.equal(blocked.canSave, false);
  assert.ok(blocked.missing.includes('monthlyRate'));
  assert.ok(blocked.missing.includes('offerType'));
}

{
  const allowed = evaluateSellerConfirmGate({
    confirmed: { monthlyRate: true, offerType: true },
    values: { monthlyRate: 152.36, offerType: 'leasing' },
  });
  assert.equal(allowed.canSave, true);
  assert.deepEqual(allowed.missing, []);
}

// Central confirm covers high-confidence required fields
{
  const viaCentral = evaluateSellerConfirmGate({
    confirmed: {},
    values: { monthlyRate: 152.36, offerType: 'leasing' },
    centralConfirmed: true,
    lowConfidenceFields: [],
  });
  assert.equal(viaCentral.canSave, true);
}

// Low-confidence still blocks even after central confirm
{
  const blockedLow = evaluateSellerConfirmGate({
    confirmed: { monthlyRate: true },
    values: { monthlyRate: 152.36, offerType: 'leasing' },
    centralConfirmed: true,
    lowConfidenceFields: ['offerType'],
  });
  assert.equal(blockedLow.canSave, false);
  assert.deepEqual(blockedLow.missing, ['offerType']);
}

{
  const allowedAfterLow = evaluateSellerConfirmGate({
    confirmed: { monthlyRate: true, offerType: true },
    values: { monthlyRate: 152.36, offerType: 'leasing' },
    centralConfirmed: true,
    lowConfidenceFields: ['offerType'],
  });
  assert.equal(allowedAfterLow.canSave, true);
}

{
  const low = resolveLowConfidenceFields({
    confidence: { monthlyRate: 0.95, offerType: 0.4 },
    ambiguities: [{ field: 'offerType', message: 'Angebotsart unsicher' }],
    values: { monthlyRate: 152.36, offerType: 'leasing' },
  });
  assert.ok(low.includes('offerType'));
  assert.ok(!low.includes('monthlyRate'));

  const highMap = buildHighConfidenceConfirmedMap(undefined, low);
  assert.equal(highMap.monthlyRate, true);
  assert.equal(highMap.offerType, undefined);
}

// applyCommercialConfirmPatch
{
  const patched = applyCommercialConfirmPatch(
    {
      payment: { type: 'leasing', calculatedRate: 999, downPayment: 0 },
      offerPreview: { monthlyRate: 999 },
      offerCalculation: { monthlyRate: 999 },
    },
    { monthlyRate: 152.36, downPayment: 6000 },
  );
  assert.equal(patched.payment.calculatedRate, 152.36);
  assert.equal(patched.payment.downPayment, 6000);
  assert.equal(patched.offerPreview.monthlyRate, 152.36);
}

// Model key mapping: Sportage Vision → sportage
assert.equal(resolveMagicModelKey('Sportage Vision'), 'sportage');
assert.equal(resolveMagicModelKey('Kia Sportage'), 'sportage');
assert.equal(resolveMagicModelKey('EV3 GT-Line'), 'ev3');

// Skip Magic intermediate for PDF leasing
{
  const prep = prepareMagicOffer(
    'Kia Sportage Leasing 152,36 €/Monat, 48 Monate, 15.000 km, 6.000 € Anzahlung',
    { fromPdf: true, modelKey: 'sportage' },
  );
  assert.equal(prep.mode, 'leasing_intake');
  assert.equal(prep.calculation.monthlyRate, 152.36);
  assert.equal(shouldSkipMagicOfferReview(prep), true);
  assert.equal(prep.fromPdf, true);
  assert.equal(prep.skipMagicReview, true);
  assert.equal(magicPreparationHasCommercialPreviewFields(prep), true);

  const vehicle = resolveMagicVehicleFields(prep);
  assert.equal(vehicle.modelKey, 'sportage');
  assert.ok(/sportage/i.test(vehicle.model || ''));

  const patch = magicPreparationToConfigurePatch(prep);
  assert.equal(patch.modelKey, 'sportage');
  assert.equal(patch.desiredRate, 152.36);
  assert.equal(patch.downPayment, 6000);

  const overlay = overlayMagicOntoOfferDraft(
    {
      payment: { type: 'leasing', calculatedRate: null },
      offerPreview: {},
      offerCalculation: {},
      source: {},
    },
    prep,
  );
  assert.equal(overlay.sellerConfirm.required, true);
  assert.equal(overlay.payment.calculatedRate, 152.36);
  assert.equal(overlay.payment.downPayment, 6000);
}

// PDF leasing without prior modelKey – vehicle still resolves from text / OI
{
  const prep = prepareMagicOffer(
    'Brandes Sportage Vision Leasing 152,36 €/Monat, 48 Monate, 6.000 € Anzahlung',
    {
      fromPdf: true,
      offerInterpretation: {
        interpretation: {
          offerType: 'leasing',
          vehicle: { brand: 'Kia', model: 'Sportage', trim: 'Vision' },
          monthlyRate: 152.36,
          downPayment: 6000,
          ambiguities: [],
          warnings: [],
          evidence: {},
        },
      },
    },
  );
  assert.equal(shouldSkipMagicOfferReview(prep), true);
  assert.equal(magicPreparationHasCommercialPreviewFields(prep), true);
  const vehicle = resolveMagicVehicleFields({
    ...prep,
    grounded: null,
  });
  assert.equal(vehicle.modelKey, 'sportage');
  assert.equal(vehicle.trimLabel, 'Vision');
  const patch = magicPreparationToConfigurePatch({ ...prep, grounded: null });
  assert.equal(patch.modelKey, 'sportage');
  assert.equal(patch.desiredRate, 152.36);
}

// Cash magic (non-PDF package math) keeps review
{
  const cash = prepareMagicOffer(
    'EV3 GT-Line mit P10 P11 P12 in Terracotta, 21 Prozent plus 1290 Überführung.',
    { modelKey: 'ev3' },
  );
  assert.equal(cash.mode, 'cash_magic');
  assert.equal(shouldSkipMagicOfferReview(cash), false);
}

console.log('parseGermanMoney + confirm gate + pdf skip: ok');
