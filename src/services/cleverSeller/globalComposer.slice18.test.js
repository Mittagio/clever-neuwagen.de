/**
 * Slice 18: Nachfolgeangebot aus Favorit + Altvertrag vorbereiten
 * node --test src/services/cleverSeller/globalComposer.slice18.test.js
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
  isPrepareSuccessionOfferCue,
  prepareSuccessionOfferFromLead,
} from './prepareSuccessionOfferFromLead.js';
import { createBrandesGoldenCaseLead } from '../crm/brandesGoldenCase.js';
import { containsSellerCommandInMessage } from './validateSellerCommandMessage.js';

const NOW = new Date('2026-07-31T10:00:00+02:00');
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
const GOLDEN = 'Bereite ein Nachfolgeangebot vor.';

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

// --- Cue detection ---
{
  assert.equal(isPrepareSuccessionOfferCue(GOLDEN), true);
  assert.equal(isPrepareSuccessionOfferCue('Was ist der nächste Schritt?'), false);
  assert.equal(isPrepareSuccessionOfferCue('Erstelle ein Nachfolgeangebot'), true);
}

// --- Intent ---
{
  const interpreted = interpretSellerInput(GOLDEN);
  const types = interpreted.intents.map((i) => i.type);
  assert.ok(types.includes(SELLER_TURN_INTENTS.PREPARE_OFFER));
}

// --- Facts from favorite track ---
{
  const lead = brandesWithContract();
  const prep = prepareSuccessionOfferFromLead(lead, { now: NOW });
  assert.equal(prep.ok, true);
  assert.equal(prep.monthlyRate, 347);
  assert.match(String(prep.vehicleLabel), /XCeed/i);
  assert.ok(prep.facts.some((f) => f.field === 'vehicleInterest'));
  assert.ok(prep.facts.some((f) => f.field === 'desiredRate' && f.value === 347));
}

// --- Golden turn: prepare offer + message, no auto-send ---
{
  const lead = brandesWithContract();
  const before = JSON.stringify(lead.crm?.customerContracts || []);
  const turn = runCleverSellerTurn({
    lead,
    sellerInput: GOLDEN,
    customerName: 'Brandes',
    now: NOW,
  });
  assert.equal(JSON.stringify(lead.crm?.customerContracts || []), before);
  assert.equal(turn.autoSent, false);
  assert.ok(turn.preparedActions.some((a) => (
    a.type === SELLER_TURN_INTENTS.PREPARE_OFFER && a.status === 'prepared'
  )));
  const offer = turn.preparedActions.find((a) => a.type === SELLER_TURN_INTENTS.PREPARE_OFFER);
  assert.equal(offer.payload?.canCreateOffer, true);
  assert.equal(offer.payload?.offerType, 'leasing');
  assert.equal(offer.payload?.monthlyRate, 347);
  assert.match(String(offer.payload?.vehicleLabel), /XCeed/i);
  assert.equal(offer.payload?.mutatesCustomer, false);

  const body = typeof turn.messageDraft === 'string'
    ? turn.messageDraft
    : turn.messageDraft?.body;
  assert.ok(body);
  assert.match(body, /XCeed/i);
  assert.match(body, /347/);
  assert.equal(containsSellerCommandInMessage(body), false);

  assert.ok(shouldShowUniversalReview(turn));
  const review = buildUniversalReviewModel(turn);
  assert.equal(review.reviewType, 'offer_and_message_review');
  assert.ok(review.actionSections.some((s) => s.kind === 'offer_prepare' || s.kind === 'offer_and_message_review'));
}

// --- Ohne Favorit: blocked / missing ---
{
  const lead = brandesWithContract();
  lead.crm.vehicleConfigurations = (lead.crm.vehicleConfigurations || []).map((c) => ({
    ...c,
    vehicleTrack: { ...(c.vehicleTrack || {}), status: 'open' },
  }));
  const turn = runCleverSellerTurn({
    lead,
    sellerInput: GOLDEN,
    customerName: 'Brandes',
    now: NOW,
  });
  const offer = turn.preparedActions.find((a) => a.type === SELLER_TURN_INTENTS.PREPARE_OFFER);
  assert.ok(
    !offer
    || offer.status === 'blocked'
    || offer.payload?.canCreateOffer === false
    || turn.missingInformation?.some((m) => m.id === 'succession_favorite'),
  );
}

// --- CTA auf Golden Moment / Contract Memory ---
{
  const lead = brandesWithContract();
  const turn = runCleverSellerTurn({
    lead,
    sellerInput: 'Was ist der nächste Schritt?',
    customerName: 'Brandes',
    now: NOW,
  });
  const review = buildUniversalReviewModel(turn);
  const golden = review.actionSections.find((s) => s.kind === 'golden_moment');
  assert.ok(golden?.primaryActions?.some((a) => a.action === 'prepare_followup_offer'));
}

console.log('globalComposer.slice18.test.js: ok');
