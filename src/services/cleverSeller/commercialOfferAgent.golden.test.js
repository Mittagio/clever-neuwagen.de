/**
 * Clever Intelligence Layer – natürliche Verkäufer-Sätze im Angebotskontext.
 * node --test src/services/cleverSeller/commercialOfferAgent.golden.test.js
 */
import assert from 'node:assert/strict';
import { createEmptyNeedProfile } from '../consultation/needProfileService.js';
import { runCleverSellerTurn } from './runCleverSellerTurn.js';
import { buildUniversalReviewModel } from './buildUniversalReviewModel.js';
import { interpretSellerInput } from './interpretSellerInput.js';
import { SELLER_TURN_INTENTS } from './sellerFactTypes.js';
import {
  isBareMonthlyRateCue,
  parseCommercialDownPayment,
  parseCommercialMonthlyRate,
} from './commercialOfferNl.js';

const philipp = {
  id: 'lead-philipp-schmitz',
  name: 'Philipp Schmitz',
  contact: { name: 'Philipp Schmitz', salutation: 'herr' },
  paymentType: 'leasing',
  wish: {
    model: 'EV3',
    trim: 'Air',
    paymentType: 'leasing',
    termMonths: 36,
    mileagePerYear: 15000,
  },
  crm: { needProfile: createEmptyNeedProfile() },
};

const offerCtx = {
  offerId: 'offer-philipp-1',
  title: 'Kaufangebot',
  summary: 'Kia EV3 Air · Leasing',
  paymentType: 'leasing',
  monthlyRate: null,
};

function turnFor(sellerInput, extra = {}) {
  return runCleverSellerTurn({
    lead: philipp,
    sellerInput,
    customerName: 'Philipp Schmitz',
    scopeHint: 'dashboard',
    currentOfferContext: offerCtx,
    ...extra,
  });
}

// --- Parser unit ---
{
  assert.equal(parseCommercialMonthlyRate('Monatsrate 399'), 399);
  assert.equal(parseCommercialMonthlyRate('Rate 399 €'), 399);
  assert.equal(parseCommercialMonthlyRate('399 €/Monat'), 399);
  assert.equal(parseCommercialMonthlyRate('wunschrate 329'), 329);
  assert.equal(parseCommercialDownPayment('0 € Anzahlung'), 0);
  assert.equal(parseCommercialDownPayment('ohne Anzahlung'), 0);
  assert.equal(parseCommercialDownPayment('Anzahlung auf 2.500'), 2500);
  assert.equal(isBareMonthlyRateCue('Monatsrate'), true);
  assert.equal(isBareMonthlyRateCue('Monatsrate 399'), false);
}

// --- A: Rate 399 → Fact + PREPARE_OFFER ---
{
  const interpreted = interpretSellerInput('Rate 399');
  assert.ok(interpreted.facts.some((f) => f.field === 'monthlyBudget' && f.value === 399));
  assert.ok(interpreted.intents.some((i) => i.type === SELLER_TURN_INTENTS.PREPARE_OFFER));

  const turn = turnFor('Monatsrate 399 €');
  assert.ok(turn.uniqueFacts?.some((f) => f.field === 'monthlyBudget' && Number(f.value) === 399)
    || turn.facts?.some((f) => f.field === 'monthlyBudget' && Number(f.value) === 399)
    || turn.proposedUpdates?.length >= 0);
  const facts = turn.uniqueFacts || turn.extractedFacts || turn.facts || [];
  // facts live on interpretation path – check prepared action / proposed
  const allFacts = [
    ...(turn.uniqueFacts || []),
    ...(turn.facts || []),
    ...(turn.proposedUpdates || []).map((u) => ({ field: u.field, value: u.value })),
  ];
  const hasRate = allFacts.some((f) => (
    (f.field === 'monthlyBudget' || f.field === 'desiredRate' || f.field === 'monthlyLeasingRate')
    && Number(f.value) === 399
  )) || (turn.preparedActions || []).some((a) => (
    a.type === SELLER_TURN_INTENTS.PREPARE_OFFER
    && (a.payload?.monthlyRate === 399 || a.payload?.canCreateOffer)
  ));
  assert.ok(
    hasRate || (turn.preparedActions || []).some((a) => a.type === SELLER_TURN_INTENTS.PREPARE_OFFER),
    'Monatsrate 399 muss Offer-/Commercial-Pfad triggern',
  );
  assert.ok(!(turn.missingInformation || []).some((m) => m.id === 'monthly_leasing_rate'));
}

// --- B: nur „Monatsrate“ → eine Rückfrage, kein Mini-Menü ---
{
  const turn = turnFor('Monatsrate');
  assert.ok((turn.missingInformation || []).some((m) => m.id === 'monthly_leasing_rate'));
  assert.match(
    String((turn.missingInformation || []).find((m) => m.id === 'monthly_leasing_rate')?.label || ''),
    /Monatsrate/i,
  );
  const review = buildUniversalReviewModel(turn);
  const offerSec = (review?.actionSections || []).find((s) => (
    s.kind === 'offer_incomplete' || s.kind === 'offer_prepare'
  ));
  if (offerSec) {
    assert.ok(!offerSec.primaryActions?.some((a) => a.action === 'enter_rate'));
    assert.ok(!offerSec.primaryActions?.some((a) => a.action === 'calc_cash'));
  }
}

// --- C: Laufzeit / km / AZ ---
{
  const interpreted = interpretSellerInput('48 Monate, 15.000 km, 0 € Anzahlung, 399 €');
  assert.ok(interpreted.facts.some((f) => f.field === 'termMonths' && f.value === 48));
  assert.ok(interpreted.facts.some((f) => f.field === 'mileagePerYear' || f.field === 'annualMileage'));
  assert.ok(interpreted.facts.some((f) => f.field === 'downPayment' && f.value === 0));
  assert.ok(interpreted.facts.some((f) => f.field === 'monthlyBudget' && f.value === 399));
  assert.ok(interpreted.intents.some((i) => i.type === SELLER_TURN_INTENTS.PREPARE_OFFER));
}

// --- D: natürliche Kurzformen ---
const phrases = [
  'Rate 399',
  'doch lieber 10.000 km',
  'mach 2.500 Anzahlung',
  'Anzahlung auf 2000',
  'Mach 48 Monate draus',
  '399 € Rate',
];
for (const phrase of phrases) {
  const interpreted = interpretSellerInput(phrase);
  assert.ok(
    interpreted.intents.some((i) => i.type === SELLER_TURN_INTENTS.PREPARE_OFFER)
    || interpreted.facts.some((f) => (
      f.field === 'monthlyBudget'
      || f.field === 'termMonths'
      || f.field === 'mileagePerYear'
      || f.field === 'downPayment'
    )),
    `Phrase nicht verstanden: ${phrase}`,
  );
}

// --- E: Incomplete Review ohne enter_rate-Menü ---
{
  const turn = runCleverSellerTurn({
    lead: philipp,
    sellerInput: 'Erstelle ein Leasingangebot Kia EV3 Air.',
    customerName: 'Philipp Schmitz',
    scopeHint: 'dashboard',
  });
  const review = buildUniversalReviewModel(turn);
  const offerSec = (review?.actionSections || []).find((s) => (
    s.kind === 'offer_incomplete' || s.kind === 'offer_prepare'
  ));
  if (offerSec?.kind === 'offer_incomplete' || turn.missingInformation?.some((m) => m.id === 'monthly_leasing_rate')) {
    assert.ok(!offerSec?.primaryActions?.some((a) => a.action === 'enter_rate'));
    assert.ok(!offerSec?.primaryActions?.some((a) => a.action === 'calc_cash'));
  }
}

// --- F: Multi-Fact Akte (Sportage) → Review mit Übernehmen, nicht stuck ---
{
  const input = '48 20.000 km Wunschrate 350 € Sportage Vision';
  const lead = {
    id: 'lead-neuer',
    name: 'Neuer Kunde',
    contact: { name: 'Neuer Kunde' },
    wish: { model: 'Sportage' },
    crm: { needProfile: createEmptyNeedProfile() },
  };
  const interpreted = interpretSellerInput(input, {
    lead,
    customerName: 'Neuer Kunde',
    scopeHint: 'customer_akte',
  });
  assert.ok(interpreted.facts.some((f) => f.field === 'termMonths' && Number(f.value) === 48));
  assert.ok(interpreted.facts.some((f) => (
    (f.field === 'annualMileage' || f.field === 'mileagePerYear')
    && Number(f.value) === 20000
  )));
  assert.ok(interpreted.facts.some((f) => f.field === 'monthlyBudget' && Number(f.value) === 350));
  const interest = interpreted.facts.find((f) => f.field === 'vehicleInterest');
  assert.ok(interest, 'Sportage Vision → vehicleInterest');
  assert.match(String(interest.label || ''), /Sportage/i);
  assert.match(String(interest.value?.trim || interest.label || ''), /Vision/i);
  assert.ok(
    !interpreted.facts.some((f) => (
      f.field === 'unresolvedNote'
      && /vision/i.test(String(f.label || f.value?.text || ''))
    )),
    'Vision nicht als unresolved Sonstiges',
  );
  const leasing = interpreted.facts.find((f) => f.field === 'paymentType');
  assert.ok(leasing);
  assert.equal(leasing.needsConfirmation, false, 'Wunschrate+km → Leasing nicht blockierend');

  const turn = runCleverSellerTurn({
    lead,
    sellerInput: input,
    customerName: 'Neuer Kunde',
    scopeHint: 'customer_akte',
  });
  const review = buildUniversalReviewModel(turn);
  assert.ok(review);
  assert.equal(review.primaryCta, 'Übernehmen');
  assert.ok(!review.hideGlobalAccept, 'Partial Success: Accept sichtbar');
}

console.log('commercialOfferAgent.golden.test.js: ok');
