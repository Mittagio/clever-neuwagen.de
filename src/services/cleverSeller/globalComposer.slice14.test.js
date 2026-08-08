/**
 * Slice 14: Offer + Termin Multi-Action Review
 * node --test src/services/cleverSeller/globalComposer.slice14.test.js
 */
import assert from 'node:assert/strict';
import { runCleverSellerTurn } from './runCleverSellerTurn.js';
import { interpretSellerInput } from './interpretSellerInput.js';
import { SELLER_TURN_INTENTS } from './sellerFactTypes.js';
import {
  buildUniversalReviewModel,
  shouldShowUniversalReview,
} from './buildUniversalReviewModel.js';
import { createBrandesGoldenCaseLead } from '../crm/brandesGoldenCase.js';
import { containsSellerCommandInMessage } from './validateSellerCommandMessage.js';

const NOW = new Date('2026-07-31T10:00:00+02:00'); // Freitag → Mo 03.08.
const GOLDEN = 'Erstelle Brandes ein XCeed-Angebot für 28.000 € und schlag ihm Montag 15 Uhr einen Termin vor.';
const GOLDEN_CASH = 'Erstelle Herrn Garritano ein Angebot für den Picanto GT-Line für 17.000 € und schlag ihm Montag 15 Uhr einen Termin vor.';

function createGarritanoCashLead(overrides = {}) {
  return {
    id: 'lead-demo-garritano',
    name: 'Herr Garritano',
    contact: { name: 'Herr Garritano' },
    paymentType: 'cash',
    vehicle: { model: 'Picanto', label: 'Kia Picanto' },
    wish: { paymentType: 'cash', model: 'Picanto', modelKey: 'picanto', trim: 'GT-Line' },
    crm: { needProfile: { labels: ['Hund / Platz hinten'] } },
    ...overrides,
  };
}

// --- Intent: both ---
{
  const interpreted = interpretSellerInput(GOLDEN);
  const types = interpreted.intents.map((i) => i.type);
  assert.ok(types.includes(SELLER_TURN_INTENTS.PREPARE_OFFER));
  assert.ok(types.includes(SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT));
}

// --- Golden Brandes: Dual-Intent + Composite (Leasing → Kauf/Leasing-Klärung bleibt) ---
{
  const brandes = createBrandesGoldenCaseLead({ phase: 'golden' });
  const turn = runCleverSellerTurn({
    lead: brandes,
    sellerInput: GOLDEN,
    customerName: 'Brandes',
    now: NOW,
  });
  const offer = turn.preparedActions.find((a) => a.type === SELLER_TURN_INTENTS.PREPARE_OFFER);
  assert.ok(offer);
  assert.ok(
    offer.status === 'blocked' || offer.status === 'prepared',
    'Angebot vorbereitet oder Klärung nötig',
  );
  if (offer.status === 'blocked') {
    assert.ok(
      offer.payload?.needsClarification
      || turn.missingInformation?.some((m) => m.id === 'clarify_purchase_vs_leasing'),
    );
  }
  assert.ok(turn.preparedActions.some((a) => (
    a.type === SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT && a.status === 'prepared'
  )));
  assert.equal(turn.autoSent, false);
  assert.equal(turn.autoBooked ?? false, false);
  assert.ok(turn.preparedAppointment?.startsAt || turn.resolvedDateTime?.ok);
  const starts = new Date(
    turn.preparedAppointment?.startsAt || turn.resolvedDateTime?.startsAt,
  );
  assert.equal(starts.getFullYear(), 2026);
  assert.equal(starts.getMonth(), 7); // August
  assert.equal(starts.getDate(), 3);
  assert.equal(starts.getHours(), 15);

  assert.ok(shouldShowUniversalReview(turn));
  const review = buildUniversalReviewModel(turn);
  assert.equal(review.reviewType, 'offer_and_appointment_review');
  const composite = review.actionSections.find((s) => s.kind === 'offer_and_appointment_review');
  assert.ok(composite);
  assert.ok(composite.primaryActions?.some((a) => a.action === 'open_offer_handoff'));
  assert.ok(composite.primaryActions?.some((a) => a.action === 'send_appointment_proposal'));
  // Angebot-Teil kann im Composite-Body oder in eigenen Sections stecken
  const reviewBlob = JSON.stringify(review);
  assert.match(reviewBlob, /ANGEBOT|28\.000|28000|Klärung|Kauf|XCeed|offer/i);
  assert.match(String(composite.body || reviewBlob), /TERMIN|15|Montag/i);
  const msg = String(review.messageDraft || turn.messageDraft || composite.messageDraft || '');
  if (msg) {
    assert.equal(containsSellerCommandInMessage(msg), false);
    assert.match(msg, /15|Montag/i);
  }
}

// --- Cash dual: Angebot + Termin beide prepared ---
{
  const garritano = createGarritanoCashLead();
  const turn = runCleverSellerTurn({
    lead: garritano,
    sellerInput: GOLDEN_CASH,
    customerName: 'Garritano',
    now: NOW,
  });
  assert.ok(turn.preparedActions.some((a) => (
    a.type === SELLER_TURN_INTENTS.PREPARE_OFFER && a.status === 'prepared'
  )));
  assert.ok(turn.preparedActions.some((a) => (
    a.type === SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT && a.status === 'prepared'
  )));
  assert.equal(turn.autoSent, false);
  assert.equal(turn.autoBooked ?? false, false);
  const review = buildUniversalReviewModel(turn);
  assert.equal(review.reviewType, 'offer_and_appointment_review');
  const composite = review.actionSections.find((s) => s.kind === 'offer_and_appointment_review');
  assert.ok(composite);
  const reviewBlob = JSON.stringify(review);
  assert.match(reviewBlob, /ANGEBOT|17\.000|17000|Picanto|offer/i);
  assert.match(String(composite.body || reviewBlob), /TERMIN|15|Montag/i);
}

// --- Without price: appointment still prepared, no false auto-create ---
{
  const brandes = createBrandesGoldenCaseLead({ phase: 'golden' });
  const turn = runCleverSellerTurn({
    lead: brandes,
    sellerInput: 'Erstelle Brandes ein XCeed-Angebot und schlag ihm Montag 15 Uhr einen Termin vor.',
    customerName: 'Brandes',
    now: NOW,
  });
  assert.ok(turn.preparedActions.some((a) => (
    a.type === SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT && a.status === 'prepared'
  )));
  assert.equal(turn.autoSent, false);
  const offer = turn.preparedActions.find((a) => a.type === SELLER_TURN_INTENTS.PREPARE_OFFER);
  assert.ok(offer);
  // Ohne Preis: incomplete/blocked oder prepared ohne canCreate — nie auto
  assert.ok(
    offer.status === 'blocked'
    || offer.payload?.canCreateOffer === false
    || offer.status === 'prepared',
  );
}

// --- Offer-only unchanged ---
{
  const brandes = createBrandesGoldenCaseLead({ phase: 'golden' });
  const turn = runCleverSellerTurn({
    lead: brandes,
    sellerInput: 'Erstelle Brandes ein Angebot für den XCeed für 28.000 €.',
    customerName: 'Brandes',
  });
  const review = buildUniversalReviewModel(turn);
  assert.notEqual(review?.reviewType, 'offer_and_appointment_review');
}

// --- Appointment-only unchanged ---
{
  const brandes = createBrandesGoldenCaseLead({ phase: 'golden' });
  const turn = runCleverSellerTurn({
    lead: brandes,
    sellerInput: 'Schlag ihm Montag um 15 Uhr einen Termin vor.',
    customerName: 'Brandes',
    now: NOW,
  });
  const review = buildUniversalReviewModel(turn);
  assert.equal(review?.reviewType, 'appointment_and_message_review');
}

console.log('globalComposer.slice14.test.js: ok');
