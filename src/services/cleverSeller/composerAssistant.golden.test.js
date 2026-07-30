/**
 * node src/services/cleverSeller/composerAssistant.golden.test.js
 * Golden Cases: Clever Composer als zentraler Verkaufsassistent.
 */
import assert from 'node:assert/strict';
import { runCleverSellerTurn } from './runCleverSellerTurn.js';
import { interpretSellerInput } from './interpretSellerInput.js';
import { shouldShowUniversalReview, buildUniversalReviewModel } from './buildUniversalReviewModel.js';
import { SELLER_TURN_INTENTS } from './sellerFactTypes.js';
import { extractNamedCustomerFromInput } from './resolveAssistantContext.js';

const leadGarritano = {
  id: 'lead-garritano',
  contact: { name: 'Garritano', salutation: 'herr' },
  wish: { model: 'Picanto', modelKey: 'picanto', trim: 'gt-line' },
  paymentType: 'leasing',
  crm: {
    needProfile: {
      selectedModelKey: 'picanto',
      modelHint: 'picanto',
      paymentType: 'leasing',
      rawMessages: [],
    },
    sellerInsights: [
      { text: 'Platz für den Hund wichtig', understoodLabels: ['Hund', 'Platz'] },
      { text: 'gutes Preis-Leistungs-Verhältnis', understoodLabels: ['Preis-Leistung'] },
    ],
  },
};

const leadKauf = {
  ...leadGarritano,
  paymentType: 'purchase',
  crm: {
    ...leadGarritano.crm,
    needProfile: {
      ...leadGarritano.crm.needProfile,
      paymentType: 'purchase',
      rawMessages: [],
    },
  },
};

// --- Named customer ---
assert.equal(extractNamedCustomerFromInput('Schreibe Garritano ein Angebot'), 'Garritano');

// --- Golden Case 1: Angebot + Nachricht ---
const input1 = 'Schreibe Garritano ein Angebot für den Picanto GT-Line für 17.000 €.';
const interpreted1 = interpretSellerInput(input1, { lead: leadKauf });
assert.ok(interpreted1.intents.some((i) => i.type === SELLER_TURN_INTENTS.PREPARE_OFFER), 'prepare_offer');
assert.ok(interpreted1.intents.some((i) => i.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE), 'draft_message');
assert.ok(interpreted1.facts.some((f) => f.field === 'purchasePrice' && f.value === 17000), 'purchase 17000');
assert.ok(interpreted1.facts.some((f) => f.field === 'vehicleInterest'), 'vehicle');
assert.ok(interpreted1.facts.some((f) => f.field === 'customerName'), 'customer name');

const turn1 = runCleverSellerTurn({
  lead: leadKauf,
  sellerInput: input1,
  customerName: 'Garritano',
});
assert.equal(turn1.ok, true);
assert.ok(turn1.resolvedCustomer?.namedInInput === 'Garritano' || turn1.resolvedCustomer?.name);
assert.ok(turn1.preparedActions.some((a) => a.type === SELLER_TURN_INTENTS.PREPARE_OFFER));
assert.ok(turn1.preparedActions.some((a) => a.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE));
assert.ok(turn1.messageDraft, 'message draft body');
assert.match(turn1.messageDraft, /17\.000|17000/);
assert.match(turn1.messageDraft, /Picanto/i);
assert.ok(shouldShowUniversalReview(turn1));

const review1 = buildUniversalReviewModel(turn1);
assert.ok(review1);
assert.ok(review1.actionSections.some((s) => s.kind === 'offer_prepare' || s.kind === 'offer_change'));
assert.ok(review1.actionSections.some((s) => s.kind === 'message_draft'));
assert.ok(turn1.uiEffects?.progressLines?.length >= 2);

// Ambiguity: Leasing-Lead + Kaufpreis
const turnAmbiguous = runCleverSellerTurn({
  lead: leadGarritano,
  sellerInput: input1,
  customerName: 'Garritano',
});
assert.ok(
  turnAmbiguous.missingInformation.some((m) => m.id === 'clarify_purchase_vs_leasing'),
  'clarify purchase vs leasing',
);

assert.ok(!turn1.missingInformation.some((m) => m.id === 'clarify_purchase_vs_leasing'));
assert.ok(turn1.preparedActions.find((a) => a.type === 'prepare_offer')?.status === 'prepared');

// --- Golden Case 2: Fahrzeugwissen + Nachricht (Intent) ---
const input2 = `Schreib Garritano, dass wir einen schwarzen Picanto GT-Line
mit Technologie-Paket und Schiebedach da haben.
Erklär ihm kurz das Technologie-Paket.`;
const interpreted2 = interpretSellerInput(input2);
assert.ok(interpreted2.intents.some((i) => i.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE));
assert.ok(interpreted2.facts.some((f) => /schwarz/i.test(f.label || '')));

// --- Golden Case 3: Termin ---
const input3 = 'Schlag ihm vor, dass er am Montag um 15 Uhr kommen soll.';
const interpreted3 = interpretSellerInput(input3);
assert.ok(
  interpreted3.intents.some((i) => i.type === SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT),
  'appointment intent',
);
const turn3 = runCleverSellerTurn({
  lead: leadKauf,
  sellerInput: input3,
  customerName: 'Garritano',
});
assert.ok(turn3.preparedActions.some((a) => a.type === SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT));
assert.ok(shouldShowUniversalReview(turn3));
const review3 = buildUniversalReviewModel(turn3);
assert.ok(review3?.actionSections.some((s) => s.kind === 'appointment_propose'));

// --- Golden Case 4: History Search ---
const input4 = 'Was hatte ich Garritano damals zur Lieferzeit geschrieben?';
const interpreted4 = interpretSellerInput(input4);
assert.ok(interpreted4.intents.some((i) => i.type === SELLER_TURN_INTENTS.SEARCH_CUSTOMER_HISTORY));
assert.ok(!interpreted4.intents.some((i) => i.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE), 'no draft on history');

const leadWithHistory = {
  ...leadKauf,
  crm: {
    ...leadKauf.crm,
    needProfile: { ...leadKauf.crm.needProfile, rawMessages: [] },
  },
  messages: [{
    id: 'msg-liefer',
    direction: 'outbound',
    createdAt: '2026-07-18T14:32:00.000Z',
    body: 'Aktuell rechnen wir beim Picanto mit einer Lieferzeit von ungefähr 8 Wochen.',
  }],
};
const turn4 = runCleverSellerTurn({
  lead: leadWithHistory,
  sellerInput: input4,
  customerName: 'Garritano',
});
assert.ok(turn4.preparedActions.some((a) => a.type === SELLER_TURN_INTENTS.SEARCH_CUSTOMER_HISTORY));
assert.ok(shouldShowUniversalReview(turn4));
const review4 = buildUniversalReviewModel(turn4);
assert.ok(review4?.actionSections.some((s) => s.kind === 'history_search'));

console.log('composerAssistant.golden.test.js: ok');
