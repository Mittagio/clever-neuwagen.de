/**
 * Master Golden Flows – Definition of Done für den zentralen Clever Composer.
 * node src/services/cleverSeller/masterGoldenFlows.test.js
 *
 * Deckt: Interpret → Turn → Review → Multi-Accept-Shape → (Legacy-Bridge).
 * Kein Auto-Send: requiresSellerConfirmation / Review vor Persistenz.
 */
import assert from 'node:assert/strict';
import { runCleverSellerTurn } from './runCleverSellerTurn.js';
import { interpretSellerInput } from './interpretSellerInput.js';
import {
  shouldShowUniversalReview,
  buildUniversalReviewModel,
} from './buildUniversalReviewModel.js';
import { SELLER_TURN_INTENTS } from './sellerFactTypes.js';
import { applyAcceptedSellerTurn } from './applyAcceptedSellerTurn.js';
import { createBrandesGoldenCaseLead } from '../crm/brandesGoldenCase.js';
import { listCustomerVehicleTracks } from '../crm/vehicleTrack.js';
import {
  mapUniversalTurnToAssistantResult,
  runSellerAssistantTurn,
} from '../dealer/sellerAssistantOrchestrator.js';
import { SELLER_ACTION_INTENTS } from '../dealer/sellerActionIntent.js';
import { createEmptyNeedProfile } from '../consultation/needProfileService.js';

const leadKauf = {
  id: 'lead-garritano',
  contact: { name: 'Garritano', salutation: 'herr' },
  name: 'Garritano',
  wish: { model: 'Picanto', modelKey: 'picanto', trim: 'gt-line' },
  paymentType: 'purchase',
  crm: {
    needProfile: {
      ...createEmptyNeedProfile(),
      selectedModelKey: 'picanto',
      modelHint: 'picanto',
      paymentType: 'purchase',
      understoodLabels: ['Picanto', 'Hund', 'Platz'],
      rawMessages: [],
    },
    sellerInsights: [
      { text: 'Platz für den Hund wichtig', understoodLabels: ['Hund', 'Platz'] },
    ],
  },
};

function assertNoAutoSend(turn) {
  assert.equal(turn.ok, true);
  assert.ok(shouldShowUniversalReview(turn), 'Review vor Ausführung');
  const review = buildUniversalReviewModel(turn);
  assert.ok(review?.primaryCta, 'Seller muss bestätigen');
  assert.ok(
    !/gesendet|auto.?send/i.test(String(review.primaryCta)),
    'kein Auto-Send-CTA',
  );
}

function multiAcceptShape(turn) {
  const prepared = turn.preparedActions ?? [];
  return {
    offer: prepared.find((a) => (
      a.type === SELLER_TURN_INTENTS.PREPARE_OFFER && a.status === 'prepared'
    )) || null,
    message: prepared.find((a) => (
      a.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE && a.status === 'prepared'
    )) || null,
    appointment: prepared.find((a) => (
      a.type === SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT && a.status === 'prepared'
    )) || null,
    messageBody: turn.messageDraft
      || prepared.find((a) => a.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE)?.payload?.messageDraft
      || null,
  };
}

// --- Flow 1: Angebot + Nachricht (Multi-Accept) ---
{
  const input = 'Schreibe Garritano ein Angebot für den Picanto GT-Line für 17.000 €.';
  const interpreted = interpretSellerInput(input, { lead: leadKauf });
  assert.ok(interpreted.intents.some((i) => i.type === SELLER_TURN_INTENTS.PREPARE_OFFER));
  assert.ok(interpreted.intents.some((i) => i.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE));

  const turn = runCleverSellerTurn({
    lead: leadKauf,
    sellerInput: input,
    customerName: 'Garritano',
  });
  assertNoAutoSend(turn);
  assert.ok(turn.turnId || turn.interpretedGoal != null || turn.ok);

  const shape = multiAcceptShape(turn);
  assert.ok(shape.offer, 'prepared offer action');
  assert.ok(shape.message || shape.messageBody, 'message draft for multi-accept');
  assert.match(String(shape.messageBody), /17\.000|17000/);

  const review = buildUniversalReviewModel(turn);
  assert.match(review.primaryCta, /Angebot und Nachricht prüfen|Angebot prüfen|Änderungen prüfen|Übernehmen/);
  assert.ok(review.actionSections.some((s) => s.kind === 'offer_prepare' || s.kind === 'offer_change'));
  assert.ok(review.actionSections.some((s) => s.kind === 'message_draft'));

  // Legacy-Bridge: gleicher Turn → offer_draft inkl. messageDraft
  const mapped = mapUniversalTurnToAssistantResult(turn, leadKauf, {
    intent: SELLER_ACTION_INTENTS.PREPARE_OFFER,
    sellerFacts: [],
  });
  assert.equal(mapped?.type, 'offer_draft');
  assert.ok(mapped?.fromUniversal);
  assert.ok(mapped?.messageDraft);

  const legacyEntry = runSellerAssistantTurn(leadKauf, input, { modeHint: 'offer' });
  assert.equal(legacyEntry.path, 'universal');
  assert.equal(legacyEntry.requiresSellerConfirmation, true);
  assert.equal(legacyEntry.result?.type, 'offer_draft');
  assert.ok(legacyEntry.universal?.preparedActions?.length >= 1);
}

// --- Flow 2: Ambiguity Kauf vs. Leasing ---
{
  const leasingLead = {
    ...leadKauf,
    paymentType: 'leasing',
    crm: {
      ...leadKauf.crm,
      needProfile: { ...leadKauf.crm.needProfile, paymentType: 'leasing' },
    },
  };
  const turn = runCleverSellerTurn({
    lead: leasingLead,
    sellerInput: 'Schreibe Garritano ein Angebot für den Picanto GT-Line für 17.000 €.',
    customerName: 'Garritano',
  });
  assert.ok(turn.missingInformation.some((m) => m.id === 'clarify_purchase_vs_leasing'));
}

// --- Flow 3: Termin ---
{
  const turn = runCleverSellerTurn({
    lead: leadKauf,
    sellerInput: 'Schlag ihm vor, dass er am Montag um 15 Uhr kommen soll.',
    customerName: 'Garritano',
  });
  assertNoAutoSend(turn);
  assert.ok(turn.preparedActions.some((a) => a.type === SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT));
  const review = buildUniversalReviewModel(turn);
  assert.ok(review.actionSections.some((s) => s.kind === 'appointment_propose'));
}

// --- Flow 4: History (keine Kundennachricht) ---
{
  const leadWithHistory = {
    ...leadKauf,
    messages: [{
      id: 'msg-liefer',
      direction: 'outbound',
      createdAt: '2026-07-18T14:32:00.000Z',
      body: 'Aktuell rechnen wir beim Picanto mit einer Lieferzeit von ungefähr 8 Wochen.',
    }],
  };
  const turn = runCleverSellerTurn({
    lead: leadWithHistory,
    sellerInput: 'Was hatte ich Garritano damals zur Lieferzeit geschrieben?',
    customerName: 'Garritano',
  });
  assertNoAutoSend(turn);
  assert.ok(turn.preparedActions.some((a) => (
    a.type === SELLER_TURN_INTENTS.SEARCH_CUSTOMER_HISTORY
    || a.type === SELLER_TURN_INTENTS.SEARCH_CUSTOMER_MESSAGES
  )));
  assert.ok(!turn.preparedActions.some((a) => (
    a.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE && a.status === 'prepared'
  )));
}

// --- Flow 5: Brandes Multi-Offer + Accept ---
{
  const input = `Sportage ist ihm zu teuer.
XCeed findet er gut.
Er möchte AHK, Rot
und Lieferzeit ist ihm wichtig.`;
  const brandesLead = createBrandesGoldenCaseLead({ phase: 'sent' });
  const turn = runCleverSellerTurn({
    lead: brandesLead,
    sellerInput: input,
    customerName: 'Brandes',
  });
  assertNoAutoSend(turn);
  const review = buildUniversalReviewModel(turn);
  assert.match(review.title, /einsortiert/i);
  assert.ok(review.reviseOfferCta);

  const applied = applyAcceptedSellerTurn(brandesLead, turn, { postFeedCard: false });
  assert.ok(applied.ok);
  const tracks = listCustomerVehicleTracks(applied.lead);
  assert.equal(tracks.find((t) => /sportage/i.test(t.modelLabel || t.id))?.status, 'deferred');
  assert.equal(tracks.find((t) => /xceed/i.test(t.modelLabel || t.id))?.status, 'favorite');
}

// --- Flow 6: Golden Moment ---
{
  const turn = runCleverSellerTurn({
    lead: createBrandesGoldenCaseLead({ phase: 'golden' }),
    sellerInput: 'Was ist der nächste Schritt?',
    customerName: 'Brandes',
  });
  assertNoAutoSend(turn);
  assert.ok(turn.goldenMoment);
  assert.ok(turn.preparedActions.some((a) => a.type === SELLER_TURN_INTENTS.RECOMMEND_NEXT_STEP));
}

// --- Flow 7: Legacy-Einstieg hängt Universal-Turn an ---
{
  const lead = {
    id: 'lead-notz',
    name: 'Herr Notz',
    crm: {
      needProfile: {
        ...createEmptyNeedProfile(),
        understoodLabels: ['EV3 GT-Line', 'Leasing'],
        annualKm: 15000,
        leaseDurationMonths: 48,
      },
      sellerInsights: [],
    },
    wish: { mileagePerYear: 15000, termMonths: 48 },
  };
  const turn = runSellerAssistantTurn(
    lead,
    'Ich habe sogar einen EV3 GT-Line in Schwarzmetallic da. Der wäre sofort verfügbar.',
  );
  assert.equal(turn.result?.type, 'message_draft');
  assert.equal(turn.requiresSellerConfirmation, true);
  assert.ok(turn.universal?.ok, 'Universal-Turn immer am Legacy-Einstieg');
  assert.ok(turn.path === 'universal' || turn.path === 'legacy');
}

console.log('masterGoldenFlows.test.js: ok');
