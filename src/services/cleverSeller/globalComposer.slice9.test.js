/**
 * Slice 9: Contract ↔ Offer Compare
 * node --test src/services/cleverSeller/globalComposer.slice9.test.js
 */
import assert from 'node:assert/strict';
import { runCleverSellerTurn } from './runCleverSellerTurn.js';
import { interpretSellerInput } from './interpretSellerInput.js';
import { SELLER_TURN_INTENTS } from './sellerFactTypes.js';
import {
  buildUniversalReviewModel,
  shouldShowUniversalReview,
} from './buildUniversalReviewModel.js';
import { applyAcceptedSellerTurn } from './applyAcceptedSellerTurn.js';
import {
  isContractOfferCompareQuery,
  compareContractWithOffer,
  resolveOfferSideForCompare,
} from './compareContractWithOffer.js';
import { isCustomerContractQuery } from './searchCustomerContracts.js';
import { createBrandesGoldenCaseLead } from '../crm/brandesGoldenCase.js';

const GOLDEN_CONTRACT = `Leasingvertrag
Kunde Herr Brandes
Ford Kuga
Vertragsbeginn 01.12.2022
Laufzeit 48 Monate
15.000 km jährlich
Rate 329 Euro
Sonderzahlung 0 Euro
Vertragsende 30.11.2026
Mehrkilometer 8 Cent
Minderkilometer 3 Cent`;

const GOLDEN_COMPARE = 'Vergleiche den Vertrag mit meinem neuen Angebot.';

function brandesWithContract() {
  const brandes = createBrandesGoldenCaseLead({ phase: 'golden' });
  const turn = runCleverSellerTurn({
    lead: brandes,
    sellerInput: GOLDEN_CONTRACT,
    customerName: 'Brandes',
  });
  const applied = applyAcceptedSellerTurn(brandes, turn, { postFeedCard: false });
  assert.ok(applied.ok);
  assert.ok(applied.lead.crm?.customerContracts?.length >= 1);
  return applied.lead;
}

// --- Detection ---
{
  assert.equal(isContractOfferCompareQuery(GOLDEN_COMPARE), true);
  assert.equal(isContractOfferCompareQuery('Vergleiche den Altvertrag mit dem Angebot'), true);
  assert.equal(isContractOfferCompareQuery('Wann läuft Brandes aus?'), false);
  assert.equal(isContractOfferCompareQuery(GOLDEN_CONTRACT), false);
  assert.equal(isCustomerContractQuery(GOLDEN_COMPARE), false);
}

// --- Intent: compare, not search ---
{
  const interpreted = interpretSellerInput(GOLDEN_COMPARE);
  assert.ok(interpreted.intents.some((i) => i.type === SELLER_TURN_INTENTS.COMPARE_CONTRACT_WITH_OFFER));
  assert.ok(!interpreted.intents.some((i) => i.type === SELLER_TURN_INTENTS.SEARCH_CUSTOMER_CONTRACTS));
  assert.ok(!interpreted.intents.some((i) => i.type === SELLER_TURN_INTENTS.IMPORT_CUSTOMER_CONTRACT));
}

// --- Offer side from favorite track (not wish) ---
{
  const lead = createBrandesGoldenCaseLead({ phase: 'golden' });
  const offer = resolveOfferSideForCompare({ lead });
  assert.ok(offer);
  assert.equal(offer.source, 'favorite_track');
  assert.equal(offer.monthlyRate, 347);
  assert.match(String(offer.vehicleLabel || ''), /XCeed/i);
}

// --- Direct helper: rate delta 329 → 347 ---
{
  const lead = brandesWithContract();
  const result = compareContractWithOffer({
    lead,
    sellerInput: GOLDEN_COMPARE,
  });
  assert.equal(result.ok, true);
  assert.equal(result.status, 'compared');
  const rateRow = result.contractOfferCompareResult.rows.find((r) => r.field === 'monthlyRate');
  assert.equal(rateRow.contractValue, 329);
  assert.equal(rateRow.offerValue, 347);
  assert.equal(rateRow.status, 'changed');
  assert.equal(rateRow.delta, 18);
  assert.match(result.contractOfferCompareResult.body, /329/);
  assert.match(result.contractOfferCompareResult.body, /347/);
  assert.equal(result.contractOfferCompareResult.mutatesCustomerTruth, false);
}

// --- Composer golden ---
{
  const lead = brandesWithContract();
  const turn = runCleverSellerTurn({
    lead,
    sellerInput: GOLDEN_COMPARE,
    customerName: 'Brandes',
  });
  assert.ok(turn.preparedActions.some((a) => (
    a.type === SELLER_TURN_INTENTS.COMPARE_CONTRACT_WITH_OFFER && a.status === 'prepared'
  )));
  assert.ok(!turn.preparedActions.some((a) => (
    a.type === SELLER_TURN_INTENTS.SEARCH_CUSTOMER_CONTRACTS
  )));
  assert.equal(turn.contractOfferCompareResult?.rows?.find((r) => r.field === 'monthlyRate')?.offerValue, 347);
  assert.ok(shouldShowUniversalReview(turn));
  const review = buildUniversalReviewModel(turn);
  assert.equal(review.reviewType, 'contract_offer_compare_result');
  assert.match(String(review.actionSections.find((s) => s.kind === 'contract_offer_compare_result')?.body || ''), /329/);
  assert.match(String(review.actionSections.find((s) => s.kind === 'contract_offer_compare_result')?.body || ''), /347/);
  assert.equal(turn.proposedUpdates?.length || 0, 0);
  assert.ok(!turn.messageDraft || turn.preparedActions.every((a) => (
    a.type !== SELLER_TURN_INTENTS.DRAFT_MESSAGE || a.payload?.autoSend !== true
  )));
}

// --- Explicit working context overrides track ---
{
  const lead = brandesWithContract();
  const turn = runCleverSellerTurn({
    lead,
    sellerInput: GOLDEN_COMPARE,
    customerName: 'Brandes',
    currentOfferContext: {
      offerId: 'offer-test',
      title: 'Kia Sportage',
      monthlyRate: 389,
      termMonths: 48,
      mileagePerYear: 15000,
    },
  });
  const rateRow = turn.contractOfferCompareResult?.rows?.find((r) => r.field === 'monthlyRate');
  assert.equal(rateRow?.offerValue, 389);
  assert.equal(turn.contractOfferCompareResult?.offerSide?.source, 'current_offer');
}

// --- No contract → blocked ---
{
  const lead = createBrandesGoldenCaseLead({ phase: 'golden' });
  const turn = runCleverSellerTurn({
    lead,
    sellerInput: GOLDEN_COMPARE,
    customerName: 'Brandes',
  });
  const action = turn.preparedActions.find((a) => (
    a.type === SELLER_TURN_INTENTS.COMPARE_CONTRACT_WITH_OFFER
  ));
  assert.equal(action?.status, 'blocked');
  assert.match(String(action?.payload?.message || ''), /Kein bestätigter/i);
}

// --- No offer → blocked (strip tracks) ---
{
  const lead = brandesWithContract();
  lead.crm = {
    ...lead.crm,
    vehicleConfigurations: [],
    vehicleOffers: {},
  };
  delete lead.desiredRate;
  const result = compareContractWithOffer({
    lead,
    sellerInput: GOLDEN_COMPARE,
    currentOfferContext: null,
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, 'no_offer');
  assert.match(String(result.message || ''), /Kein Angebot/i);
}

// --- Same rate with matching context ---
{
  const lead = brandesWithContract();
  const result = compareContractWithOffer({
    lead,
    sellerInput: GOLDEN_COMPARE,
    currentOfferContext: {
      offerId: 'same',
      title: 'Ford Kuga Nachfolge',
      monthlyRate: 329,
      termMonths: 48,
      mileagePerYear: 15000,
    },
  });
  const rateRow = result.contractOfferCompareResult.rows.find((r) => r.field === 'monthlyRate');
  assert.equal(rateRow.status, 'same');
}

// --- Global dashboard resolve ---
{
  const lead = brandesWithContract();
  const turn = runCleverSellerTurn({
    lead: {},
    sellerInput: 'Vergleiche den Vertrag von Brandes mit dem neuen Angebot',
    leadsSnapshot: [lead],
    scopeHint: 'dashboard',
  });
  assert.ok(
    turn.contractOfferCompareResult?.rows?.some((r) => r.field === 'monthlyRate' && r.offerValue === 347)
    || turn.preparedActions.some((a) => (
      a.type === SELLER_TURN_INTENTS.COMPARE_CONTRACT_WITH_OFFER
      && a.payload?.contractOfferCompareResult?.rows?.some((r) => r.offerValue === 347)
    )),
  );
}

console.log('globalComposer.slice9.test.js: ok');
