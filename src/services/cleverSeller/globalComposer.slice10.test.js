/**
 * Slice 10: Vergleichsnachricht (Contract Compare + Message)
 * node --test src/services/cleverSeller/globalComposer.slice10.test.js
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
  isContractCompareMessageCue,
  draftContractCompareCustomerMessage,
} from './draftContractCompareCustomerMessage.js';
import { isContractOfferCompareQuery } from './compareContractWithOffer.js';
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

const GOLDEN_COMPARE_ONLY = 'Vergleiche den Vertrag mit meinem neuen Angebot.';
const GOLDEN_COMPARE_MESSAGE = 'Schreib Brandes eine Nachricht zum Vergleich mit dem neuen Angebot.';

function brandesWithContract() {
  const brandes = createBrandesGoldenCaseLead({ phase: 'golden' });
  const turn = runCleverSellerTurn({
    lead: brandes,
    sellerInput: GOLDEN_CONTRACT,
    customerName: 'Brandes',
  });
  const applied = applyAcceptedSellerTurn(brandes, turn, { postFeedCard: false });
  assert.ok(applied.ok);
  return applied.lead;
}

// --- Detection ---
{
  assert.equal(isContractCompareMessageCue(GOLDEN_COMPARE_MESSAGE), true);
  assert.equal(isContractCompareMessageCue(GOLDEN_COMPARE_ONLY), false);
  assert.equal(isContractOfferCompareQuery(GOLDEN_COMPARE_ONLY), true);
}

// --- Intent: message+compare vs compare-only ---
{
  const withMsg = interpretSellerInput(GOLDEN_COMPARE_MESSAGE);
  assert.ok(withMsg.intents.some((i) => i.type === SELLER_TURN_INTENTS.COMPARE_CONTRACT_WITH_OFFER));
  assert.ok(withMsg.intents.some((i) => i.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE));

  const only = interpretSellerInput(GOLDEN_COMPARE_ONLY);
  assert.ok(only.intents.some((i) => i.type === SELLER_TURN_INTENTS.COMPARE_CONTRACT_WITH_OFFER));
  assert.ok(!only.intents.some((i) => i.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE));
}

// --- Draft helper from compare rows ---
{
  const drafted = draftContractCompareCustomerMessage({
    compareResult: {
      customerName: 'Herr Brandes',
      contractSide: { vehicleLabel: 'Ford Kuga', monthlyRate: 329 },
      offerSide: { vehicleLabel: 'Kia XCeed', monthlyRate: 347 },
      rows: [
        {
          field: 'monthlyRate',
          label: 'Rate',
          contractDisplay: '329 €',
          offerDisplay: '347 €',
          delta: 18,
          status: 'changed',
        },
        {
          field: 'termMonths',
          label: 'Laufzeit',
          contractDisplay: '48 Monate',
          offerDisplay: '48 Monate',
          status: 'same',
        },
      ],
    },
  });
  assert.equal(drafted.ok, true);
  assert.match(drafted.messageDraft, /329/);
  assert.match(drafted.messageDraft, /347/);
  assert.match(drafted.messageDraft, /Herr Brandes/);
  assert.equal(drafted.autoSend, false);
  assert.ok(!/^schreib/i.test(drafted.messageDraft));
}

// --- Pure compare: still no message (Slice 9 regress) ---
{
  const lead = brandesWithContract();
  const turn = runCleverSellerTurn({
    lead,
    sellerInput: GOLDEN_COMPARE_ONLY,
    customerName: 'Brandes',
  });
  assert.ok(turn.preparedActions.some((a) => (
    a.type === SELLER_TURN_INTENTS.COMPARE_CONTRACT_WITH_OFFER && a.status === 'prepared'
  )));
  assert.ok(!turn.preparedActions.some((a) => (
    a.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE && a.status === 'prepared'
  )));
  assert.equal(buildUniversalReviewModel(turn).reviewType, 'contract_offer_compare_result');
}

// --- Golden: compare + message ---
{
  const lead = brandesWithContract();
  const turn = runCleverSellerTurn({
    lead,
    sellerInput: GOLDEN_COMPARE_MESSAGE,
    customerName: 'Brandes',
  });
  assert.ok(turn.preparedActions.some((a) => (
    a.type === SELLER_TURN_INTENTS.COMPARE_CONTRACT_WITH_OFFER && a.status === 'prepared'
  )));
  const draftAction = turn.preparedActions.find((a) => (
    a.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE && a.status === 'prepared'
  ));
  assert.ok(draftAction);
  assert.equal(draftAction.payload?.contractCompareLinked, true);
  assert.equal(draftAction.payload?.autoSend, false);
  assert.match(String(turn.messageDraft || draftAction.payload?.messageDraft || ''), /329/);
  assert.match(String(turn.messageDraft || draftAction.payload?.messageDraft || ''), /347/);
  assert.ok(shouldShowUniversalReview(turn));
  const review = buildUniversalReviewModel(turn);
  assert.equal(review.reviewType, 'contract_compare_and_message_review');
  assert.match(String(review.messageDraft || ''), /347/);
  assert.equal(turn.proposedUpdates?.length || 0, 0);
}

// --- No contract: compare blocked, no invented message ---
{
  const lead = createBrandesGoldenCaseLead({ phase: 'golden' });
  const turn = runCleverSellerTurn({
    lead,
    sellerInput: GOLDEN_COMPARE_MESSAGE,
    customerName: 'Brandes',
  });
  assert.equal(
    turn.preparedActions.find((a) => a.type === SELLER_TURN_INTENTS.COMPARE_CONTRACT_WITH_OFFER)?.status,
    'blocked',
  );
  assert.ok(!turn.preparedActions.some((a) => (
    a.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE
    && a.status === 'prepared'
    && a.payload?.contractCompareLinked
  )));
}

console.log('globalComposer.slice10.test.js: ok');
