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
import { resolveAssistantContext } from './resolveAssistantContext.js';
import { createBrandesGoldenCaseLead } from '../crm/brandesGoldenCase.js';
import { applyAcceptedSellerTurn } from './applyAcceptedSellerTurn.js';
import { listCustomerVehicleTracks } from '../crm/vehicleTrack.js';

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
    status: 'sent',
    createdAt: '2026-07-18T14:32:00.000Z',
    text: 'Aktuell rechnen wir beim Picanto mit einer Lieferzeit von ungefähr 8 Wochen.',
  }],
};
const turn4 = runCleverSellerTurn({
  lead: leadWithHistory,
  sellerInput: input4,
  customerName: 'Garritano',
});
assert.ok(turn4.preparedActions.some((a) => (
  a.type === SELLER_TURN_INTENTS.SEARCH_CUSTOMER_HISTORY
  || a.type === SELLER_TURN_INTENTS.SEARCH_CUSTOMER_MESSAGES
)));
// Clever 2.0: History-Suche = Direct Answer, kein Universal Review
assert.equal(shouldShowUniversalReview(turn4), false);
assert.ok(
  turn4.historySearchResults?.length
  || turn4.searchResults?.length
  || turn4.assistantReply
  || turn4.preparedActions.some((a) => a.payload?.results?.length),
  'history results or reply present',
);

// --- Golden Case Brandes: Multi-Offer Feedback ---
const brandesInput = `Sportage ist ihm zu teuer.
XCeed findet er gut.
Er möchte AHK, Rot
und Lieferzeit ist ihm wichtig.`;
const brandesLead = createBrandesGoldenCaseLead({ phase: 'sent' });
const interpretedBrandes = interpretSellerInput(brandesInput, { lead: brandesLead });
assert.ok(interpretedBrandes.facts.some((f) => (
  f.field === 'vehicleTrackFeedback'
  && f.value?.modelKey === 'sportage'
  && f.value?.status === 'deferred'
)), 'sportage deferred');
assert.ok(interpretedBrandes.facts.some((f) => (
  f.field === 'vehicleTrackFeedback'
  && f.value?.modelKey === 'xceed'
  && f.value?.status === 'favorite'
)), 'xceed favorite');
assert.ok(interpretedBrandes.facts.some((f) => f.field === 'towHitchRequired'));
assert.ok(interpretedBrandes.facts.some((f) => /rot/i.test(f.label || '')));
assert.ok(interpretedBrandes.facts.some((f) => /lieferzeit/i.test(f.label || '')));

const turnBrandes = runCleverSellerTurn({
  lead: brandesLead,
  sellerInput: brandesInput,
  customerName: 'Brandes',
});
assert.ok(shouldShowUniversalReview(turnBrandes));
assert.ok(turnBrandes.preparedActions.some((a) => a.payload?.reviseFavoriteOffer));
const reviewBrandes = buildUniversalReviewModel(turnBrandes);
assert.match(reviewBrandes.title, /einsortiert/i);
assert.ok(reviewBrandes.actionSections.some((s) => s.kind === 'track_feedback'));
assert.ok(reviewBrandes.reviseOfferCta);

const appliedBrandes = applyAcceptedSellerTurn(brandesLead, {
  ...turnBrandes,
  extractedFacts: turnBrandes.extractedFacts,
}, { postFeedCard: false });
assert.ok(appliedBrandes.ok);
const tracks = listCustomerVehicleTracks(appliedBrandes.lead);
const sportage = tracks.find((t) => /sportage/i.test(t.modelLabel || t.id));
const xceed = tracks.find((t) => /xceed/i.test(t.modelLabel || t.id));
assert.equal(sportage?.status, 'deferred');
assert.equal(xceed?.status, 'favorite');
assert.ok(xceed?.requirementLabels?.some((l) => /ahk/i.test(l)));
assert.ok(xceed?.requirementLabels?.some((l) => /rot/i.test(l)));
assert.ok(xceed?.requirementLabels?.some((l) => /lieferzeit/i.test(l)));
assert.ok(tracks.some((t) => /tivoli/i.test(t.modelLabel || t.id)), 'tivoli track kept');

// --- Golden Moment / nächster Schritt ---
const goldenLead = createBrandesGoldenCaseLead({ phase: 'golden' });
const turnNext = runCleverSellerTurn({
  lead: goldenLead,
  sellerInput: 'Was ist der nächste Schritt?',
  customerName: 'Brandes',
});
assert.ok(turnNext.intents.some((i) => i.type === SELLER_TURN_INTENTS.RECOMMEND_NEXT_STEP));
assert.ok(turnNext.goldenMoment);
assert.ok(turnNext.preparedActions.some((a) => a.type === SELLER_TURN_INTENTS.RECOMMEND_NEXT_STEP));
// Clever 2.0: Next-Step = Direct Answer
assert.equal(shouldShowUniversalReview(turnNext), false);
assert.ok(turnNext.goldenMoment?.primaryLabel || turnNext.assistantReply);

// --- Working Context Document ---
const ctxDoc = resolveAssistantContext({
  lead: leadKauf,
  sellerInput: 'Mach das Angebot auf 20.000 km',
  customerName: 'Garritano',
  workingContextItems: [
    {
      kind: 'offer',
      offerId: 'off-1',
      label: 'XCeed Angebot',
      card: { modelKey: 'xceed', title: 'XCeed', mileagePerYear: 15000 },
    },
    {
      kind: 'document',
      id: 'doc:preisliste',
      label: 'Preisliste',
      detail: 'preisliste.pdf',
      document: { fileName: 'preisliste.pdf' },
    },
  ],
});
assert.ok(ctxDoc.resolvedWorkingContext.attachedDocument?.label);
assert.ok(ctxDoc.resolvedWorkingContext.offer || ctxDoc.offerContext);

console.log('composerAssistant.golden.test.js: ok');
