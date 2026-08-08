/**
 * Slice 3: Global Customer → Offer → Message
 * node --test src/services/cleverSeller/globalComposer.slice3.test.js
 */
import assert from 'node:assert/strict';
import { runCleverSellerTurn } from './runCleverSellerTurn.js';
import { interpretSellerInput } from './interpretSellerInput.js';
import { SELLER_TURN_INTENTS } from './sellerFactTypes.js';
import {
  buildUniversalReviewModel,
  shouldShowUniversalReview,
} from './buildUniversalReviewModel.js';
import { containsSellerCommandInMessage } from './validateSellerCommandMessage.js';
import { resolveWorkingLeadForTurn } from './resolveWorkingLeadForTurn.js';

function createGarritanoLead(overrides = {}) {
  return {
    id: 'lead-demo-garritano',
    name: 'Herr Garritano',
    contact: { name: 'Herr Garritano' },
    paymentType: 'cash',
    vehicle: { model: 'Picanto', label: 'Kia Picanto' },
    wish: { paymentType: 'cash' },
    crm: {
      needProfile: {
        priorities: ['Platz für Hund wichtig', 'attraktives Preis-Leistungs-Verhältnis'],
        labels: ['Hund / Platz hinten', 'Preis-Leistung'],
      },
      kundenhelfer: {
        conversationNotes: ['Kunde hat Hund – Platz hinten wichtig'],
      },
      ...(overrides.crm || {}),
    },
    ...overrides,
  };
}

const GOLDEN = 'Erstelle Herrn Garritano ein Angebot für den Picanto GT-Line für 17.000 €.';
const garritano = createGarritanoLead();
const leads = [garritano];

// --- Intents ---
{
  const interpreted = interpretSellerInput(GOLDEN);
  const types = interpreted.intents.map((i) => i.type);
  assert.ok(types.includes(SELLER_TURN_INTENTS.FIND_CUSTOMER));
  assert.ok(types.includes(SELLER_TURN_INTENTS.PREPARE_OFFER));
  // „Erstelle … Angebot“ = Arbeit, kein Message-Default
  assert.ok(!types.includes(SELLER_TURN_INTENTS.DRAFT_MESSAGE));
  assert.ok(!types.includes(SELLER_TURN_INTENTS.UPDATE_CUSTOMER_CONTEXT));
  const price = interpreted.facts.find((f) => f.field === 'purchasePrice');
  assert.equal(price?.value, 17000);
  const pay = interpreted.facts.find((f) => f.field === 'paymentType');
  assert.ok(pay?.value === 'cash' || pay?.value === 'purchase');
}

// --- Customer resolution ---
{
  const resolved = resolveWorkingLeadForTurn({
    lead: {},
    sellerInput: GOLDEN,
    leadsSnapshot: leads,
  });
  assert.equal(resolved.resolved, true);
  assert.equal(resolved.workingLead.id, garritano.id);
}

// --- Golden turn: Angebot vorbereiten (ohne Kundennachricht) ---
{
  const before = JSON.stringify(garritano);
  const turn = runCleverSellerTurn({
    lead: {},
    sellerInput: GOLDEN,
    leadsSnapshot: leads,
    scopeHint: 'dashboard',
  });
  assert.equal(JSON.stringify(garritano), before, 'keine Customer-Truth-Mutation');
  assert.equal(turn.proposedUpdates?.length || 0, 0);
  assert.equal(turn.autoSent, false);
  assert.ok(turn.resolvedCustomer?.id === garritano.id);
  assert.ok(turn.intents.some((i) => i.type === SELLER_TURN_INTENTS.PREPARE_OFFER));
  assert.ok(!turn.intents.some((i) => i.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE));

  const offer = turn.preparedActions.find((a) => a.type === SELLER_TURN_INTENTS.PREPARE_OFFER);
  assert.ok(offer);
  assert.equal(offer.needsSellerConfirmation, true);
  assert.equal(offer.payload?.purchasePrice, 17000);
  assert.ok(offer.payload?.offerType === 'cash' || offer.payload?.paymentType === 'cash');
  assert.match(String(offer.payload?.vehicleLabel || ''), /Picanto/i);
  assert.match(String(offer.payload?.vehicleLabel || ''), /GT-Line/i);
  assert.equal(offer.payload?.mutatesCustomer, false);

  assert.ok(
    !turn.preparedActions.some((a) => a.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE),
    'kein Message-Draft ohne Schreib-Cue',
  );

  assert.ok(shouldShowUniversalReview(turn));
  const review = buildUniversalReviewModel(turn);
  assert.ok(review);
  assert.ok(
    review.actionSections.some((s) => (
      s.kind === 'offer_prepare'
      || s.kind === 'offer_change'
      || s.kind === 'offer_and_message_review'
    )),
  );
  assert.ok(turn.handoffWorkingContext);
  assert.match(turn.handoffWorkingContext.shortLabel || turn.handoffWorkingContext.label, /17\.000|Kauf|Picanto/i);
  assert.ok(turn.uiEffects?.progressLines?.some((l) => /gefunden|erkannt|vorbereitet/i.test(l)));
}

// --- Explizit schreiben → Angebot + Nachricht ---
{
  const turn = runCleverSellerTurn({
    lead: {},
    sellerInput: 'Schreibe Garritano ein Angebot für den Picanto GT-Line für 17.000 €.',
    leadsSnapshot: leads,
    scopeHint: 'dashboard',
  });
  assert.ok(turn.intents.some((i) => i.type === SELLER_TURN_INTENTS.PREPARE_OFFER));
  assert.ok(turn.intents.some((i) => i.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE));
  const body = typeof turn.messageDraft === 'string'
    ? turn.messageDraft
    : turn.messageDraft?.body;
  assert.ok(body);
  assert.match(body, /17\.000|17000/);
  assert.match(body, /Picanto/i);
  assert.equal(containsSellerCommandInMessage(body), false);
}

// --- Kein Aufpreis aus 17.000 ---
{
  const turn = runCleverSellerTurn({
    lead: {},
    sellerInput: GOLDEN,
    leadsSnapshot: leads,
  });
  const facts = turn.extractedFacts || [];
  assert.ok(!facts.some((f) => f.field === 'aufpreis' || f.field === 'surcharge'));
  assert.equal(facts.find((f) => f.field === 'purchasePrice')?.value, 17000);
  assert.equal(facts.find((f) => f.field === 'purchasePrice')?.source, 'seller_input');
}

// --- Leasing-Gegenprobe ---
{
  const turn = runCleverSellerTurn({
    lead: {},
    sellerInput: 'Erstelle Garritano ein Leasingangebot für den Picanto GT-Line.',
    leadsSnapshot: [createGarritanoLead({ paymentType: 'leasing', wish: { paymentType: 'leasing', termMonths: 48, mileagePerYear: 15000 } })],
    scopeHint: 'dashboard',
  });
  const pay = turn.extractedFacts.find((f) => f.field === 'paymentType');
  assert.equal(pay?.value, 'leasing');
  const offer = turn.preparedActions.find((a) => a.type === SELLER_TURN_INTENTS.PREPARE_OFFER);
  assert.ok(offer);
  // Keine erfundene Rate
  assert.ok(
    offer.payload?.missingRate
    || offer.payload?.canCreateOffer === false
    || offer.status === 'blocked'
    || offer.payload?.monthlyRate == null,
  );
  const body = typeof turn.messageDraft === 'string' ? turn.messageDraft : turn.messageDraft?.body;
  if (body) {
    assert.doesNotMatch(body, /\b\d{2,3}\s*€\/Monat\b/);
  }
}

// --- Reine Message-Gegenprobe ---
{
  const turn = runCleverSellerTurn({
    lead: {},
    sellerInput: 'Schreib Garritano, dass der Picanto GT-Line 17.000 € kostet.',
    leadsSnapshot: leads,
    scopeHint: 'dashboard',
  });
  assert.ok(turn.intents.some((i) => i.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE));
  assert.ok(!turn.intents.some((i) => i.type === SELLER_TURN_INTENTS.PREPARE_OFFER));
  assert.ok(!turn.preparedActions.some((a) => a.type === SELLER_TURN_INTENTS.PREPARE_OFFER));
}

// --- Ambiguous: Angebot oder Nachricht? (nur Modell + Preis, kein Trim/Farbe/Angebot-Wort) ---
{
  const turn = runCleverSellerTurn({
    lead: {},
    sellerInput: 'Picanto 17.000 €',
    leadsSnapshot: leads,
    scopeHint: 'dashboard',
  });
  assert.ok(
    (turn.missingInformation || []).some((m) => m.id === 'clarify_offer_or_message')
    || turn.intents.some((i) => i.type === SELLER_TURN_INTENTS.UNKNOWN)
    || !turn.preparedActions.some((a) => (
      a.type === SELLER_TURN_INTENTS.PREPARE_OFFER && a.status === 'prepared'
    )),
  );
}

// --- Mehrere Kunden ---
{
  const leadsMulti = [
    createGarritanoLead({ id: 'g1', contact: { name: 'Marco Garritano' }, name: 'Marco Garritano' }),
    createGarritanoLead({ id: 'g2', contact: { name: 'Luca Garritano' }, name: 'Luca Garritano' }),
  ];
  const turn = runCleverSellerTurn({
    lead: {},
    sellerInput: 'Erstelle Herrn Garritano ein Angebot für den Picanto GT-Line für 17.000 €.',
    leadsSnapshot: leadsMulti,
    scopeHint: 'dashboard',
  });
  assert.ok((turn.customerSearchResults || []).length >= 2
    || (turn.missingInformation || []).some((m) => m.id === 'clarify_customer'));
  assert.ok(!turn.preparedActions.some((a) => (
    a.type === SELLER_TURN_INTENTS.PREPARE_OFFER && a.status === 'prepared' && a.payload?.canCreateOffer
  )));
}

// --- Handoff package / kein Doppel-Composer Guard ---
{
  const turn = runCleverSellerTurn({
    lead: {},
    sellerInput: GOLDEN,
    leadsSnapshot: leads,
  });
  assert.ok(turn.handoffWorkingContext?.preparedOffer);
  assert.equal(turn.handoffWorkingContext.preparedOffer.needsSellerConfirmation, true);
  assert.equal(turn.handoffWorkingContext.preparedOffer.purchasePrice, 17000);

  function shouldShowGlobal(pathname) {
    const path = String(pathname).split('?')[0];
    return path === '/backend' || path === '/backend/';
  }
  assert.equal(shouldShowGlobal('/backend'), true);
  assert.equal(shouldShowGlobal('/backend/kundenakte/lead-demo-garritano'), false);
}

// --- Sources / Evidence ---
{
  const turn = runCleverSellerTurn({
    lead: {},
    sellerInput: GOLDEN,
    leadsSnapshot: leads,
  });
  assert.ok(Array.isArray(turn.evidence));
  assert.ok(turn.evidence.some((e) => e.kind === 'extracted_fact' || e.kind === 'tool'));
  const price = turn.extractedFacts.find((f) => f.field === 'purchasePrice');
  assert.equal(price?.source, 'seller_input');
}

console.log('globalComposer.slice3.test.js: ok');
