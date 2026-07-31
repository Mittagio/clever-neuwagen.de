/**
 * Slice 15: Dual-Accept-Execute / Dual-pendingAction
 * node --test src/services/cleverSeller/globalComposer.slice15.test.js
 */
import assert from 'node:assert/strict';
import { runCleverSellerTurn } from './runCleverSellerTurn.js';
import { SELLER_TURN_INTENTS } from './sellerFactTypes.js';
import {
  buildUniversalReviewModel,
  shouldShowUniversalReview,
} from './buildUniversalReviewModel.js';
import {
  DUAL_PENDING_TYPE,
  executeDualOfferAppointmentAccept,
} from './executeDualOfferAppointmentAccept.js';
import { createBrandesGoldenCaseLead } from '../crm/brandesGoldenCase.js';

const NOW = new Date('2026-07-31T10:00:00+02:00');
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

// --- Dual pending: Angebot + Termin gemeinsam ---
{
  const lead = createGarritanoCashLead();
  const turn = runCleverSellerTurn({
    lead,
    sellerInput: GOLDEN_CASH,
    customerName: 'Garritano',
    now: NOW,
  });
  assert.equal(turn.pendingAction?.type, DUAL_PENDING_TYPE);
  assert.ok(turn.pendingAction?.preparedOffer);
  assert.ok(turn.pendingAction?.preparedAppointment?.startsAt);
  assert.equal(turn.autoSent, false);
  assert.equal(turn.autoBooked ?? false, false);
  assert.equal(turn.handoffWorkingContext?.dual, true);
  assert.ok(turn.handoffWorkingContext?.preparedAppointment);
}

// --- Follow-up über Dual-pending („Lieber 16 Uhr“) ---
{
  const lead = createGarritanoCashLead();
  const first = runCleverSellerTurn({
    lead,
    sellerInput: GOLDEN_CASH,
    customerName: 'Garritano',
    now: NOW,
  });
  assert.equal(first.pendingAction?.type, DUAL_PENDING_TYPE);
  const second = runCleverSellerTurn({
    lead,
    sellerInput: 'Lieber 16 Uhr.',
    customerName: 'Garritano',
    pendingAction: first.pendingAction,
    now: NOW,
  });
  assert.ok(second.preparedAppointment?.startsAt);
  assert.equal(new Date(second.preparedAppointment.startsAt).getHours(), 16);
  assert.equal(new Date(second.preparedAppointment.startsAt).getDate(), 3);
  assert.equal(second.autoBooked ?? false, false);
}

// --- Dual-Accept-Execute: ein Klick, kein Auto-Send/Book ---
{
  const lead = createGarritanoCashLead();
  const turn = runCleverSellerTurn({
    lead,
    sellerInput: GOLDEN_CASH,
    customerName: 'Garritano',
    now: NOW,
  });
  assert.ok(shouldShowUniversalReview(turn));
  const review = buildUniversalReviewModel(turn);
  assert.equal(review.reviewType, 'offer_and_appointment_review');
  const composite = review.actionSections.find((s) => s.kind === 'offer_and_appointment_review');
  assert.ok(composite?.primaryActions?.some((a) => a.action === 'accept_offer_and_appointment'));
  // Getrennte CTAs bleiben
  assert.ok(composite.primaryActions.some((a) => a.action === 'open_offer_handoff'));
  assert.ok(composite.primaryActions.some((a) => a.action === 'send_appointment_proposal'));

  const executed = executeDualOfferAppointmentAccept({ lead, turn });
  assert.equal(executed.ok, true);
  assert.equal(executed.autoSent, false);
  assert.equal(executed.autoBooked, false);
  assert.equal(executed.leadId, lead.id);
  assert.deepEqual(executed.acceptedActions, ['prepare_offer', 'propose_appointment']);
  assert.ok(executed.pendingAction?.preparedAppointment);
  assert.ok(executed.messageDraft);
}

// --- Brandes (Klärung): kein Dual-Accept-CTA, Termin-Follow-up ok ---
{
  const brandes = createBrandesGoldenCaseLead({ phase: 'golden' });
  const turn = runCleverSellerTurn({
    lead: brandes,
    sellerInput: 'Erstelle Brandes ein XCeed-Angebot für 28.000 € und schlag ihm Montag 15 Uhr einen Termin vor.',
    customerName: 'Brandes',
    now: NOW,
  });
  assert.notEqual(turn.pendingAction?.type, DUAL_PENDING_TYPE);
  assert.ok(turn.pendingAction?.preparedAppointment || turn.preparedAppointment);
  const review = buildUniversalReviewModel(turn);
  const composite = review.actionSections.find((s) => s.kind === 'offer_and_appointment_review');
  assert.ok(composite);
  assert.ok(!composite.primaryActions?.some((a) => a.action === 'accept_offer_and_appointment'));

  const follow = runCleverSellerTurn({
    lead: brandes,
    sellerInput: 'Lieber 16 Uhr.',
    customerName: 'Brandes',
    pendingAction: turn.pendingAction,
    now: NOW,
  });
  assert.equal(new Date(follow.preparedAppointment.startsAt).getHours(), 16);
}

// --- Offer-only: kein Dual ---
{
  const lead = createGarritanoCashLead();
  const turn = runCleverSellerTurn({
    lead,
    sellerInput: 'Erstelle Herrn Garritano ein Angebot für den Picanto GT-Line für 17.000 €.',
    customerName: 'Garritano',
  });
  assert.equal(turn.pendingAction?.type, SELLER_TURN_INTENTS.PREPARE_OFFER);
  const executed = executeDualOfferAppointmentAccept({ lead, turn });
  assert.equal(executed.ok, false);
}

console.log('globalComposer.slice15.test.js: ok');
