/**
 * Capture then Offer – Golden Tests
 * node src/services/cleverSeller/captureThenOffer.golden.test.js
 */
import assert from 'node:assert/strict';
import { createEmptyNeedProfile } from '../consultation/needProfileService.js';
import {
  listCustomerVehicleTracks,
  VEHICLE_TRACK_STATUS,
} from '../crm/vehicleTrack.js';
import { resolveSellerResponsePolicy } from '../cleverAgent/cleverAssistantResponse.js';
import { enrichOfferTextWithCustomerWish } from '../dealer/sellerOfferAssistFlow.js';
import {
  applyAcceptedSellerTurn,
  applyStructuredFactsToLead,
} from './applyAcceptedSellerTurn.js';
import {
  RATE_AUTHORITY,
  extractAuthoritativeOfferRateFromFacts,
  isWishBudgetFact,
  resolveAuthoritativeOfferMonthlyRate,
  shouldCaptureBeforeOffer,
  stripNonAuthoritativeOfferRates,
} from './captureThenOffer.js';
import { interpretSellerInput } from './interpretSellerInput.js';
import { runCleverSellerTurn } from './runCleverSellerTurn.js';
import { SELLER_TURN_INTENTS } from './sellerFactTypes.js';
import {
  extractNamedCustomerFromInput,
} from './resolveAssistantContext.js';
import { extractPersonNameFromDump } from './multiSource/buildMultiSourceIntake.js';
import { isInboundLeadPaste, isSellerFreestyleCaptureDump } from './inboundLeadIntake.js';

const PHONE_DUMP = 'PV5 EV2 EV3 — AHK, max 350 €, 2 Kinder, entscheidet mit Frau';

const MUELLER_DUMP = [
  'Familie Müller, optional mail: mueller@familie.example',
  'Will Angebote für EV2 Air, EV3 Earth weiß, EV5 Elite schwarz (oder PV5).',
  '2 Kinder, AHK, max 350 €, entscheidet mit Frau.',
  'Wunsch Konditionen: 48 Monate, 15.000 km, 0 € AZ.',
].join('\n');

function emptyLead() {
  return {
    id: 'lead-capture-offer',
    name: 'Telefon Kunde',
    contact: { name: 'Telefon Kunde', kind: 'private' },
    wish: {},
    crm: {
      needProfile: createEmptyNeedProfile(),
      vehicleConfigurations: [],
      vehicleOffers: {},
    },
  };
}

function openLead() {
  return {
    id: 'lead-mueller-open',
    name: 'Kunde noch offen',
    contact: { name: 'Kunde noch offen', kind: 'private' },
    wish: {},
    crm: {
      needProfile: createEmptyNeedProfile(),
      vehicleConfigurations: [],
      vehicleOffers: {},
    },
  };
}

// --- Unit: Wish-Budget ≠ Offer-Rate ---
{
  const wishFact = {
    field: 'monthlyBudget',
    value: 350,
    label: 'max. 350 €',
    factClass: 'commercial_preference',
  };
  assert.equal(isWishBudgetFact(wishFact), true);
  const extracted = extractAuthoritativeOfferRateFromFacts([wishFact]);
  assert.equal(extracted.amount, null, 'max-Budget nicht als Offer-Rate');

  const resolved = resolveAuthoritativeOfferMonthlyRate({
    sellerFactRate: null,
    magicCalculationRate: 339,
    magicIntentRate: null,
    fromPdf: false,
  });
  assert.equal(resolved.monthlyRate, null, 'Katalog-/Calc-Rate ohne Intent strippen');
  assert.equal(resolved.rateAuthority, RATE_AUTHORITY.NON_AUTHORITATIVE);

  const stripped = stripNonAuthoritativeOfferRates({
    monthlyRate: 369,
    rateAuthority: RATE_AUTHORITY.NON_AUTHORITATIVE,
    canCreateOffer: true,
  });
  assert.equal(stripped.monthlyRate, null);
  assert.equal(stripped.canCreateOffer, false);
  console.log('✓ Unit: Wish/Web-Raten nicht autoritativ');
}

// --- A: Capture-Dump → remember, keine Offer-Rate-Injection ---
{
  const lead = emptyLead();
  const turn = runCleverSellerTurn({ lead, sellerInput: PHONE_DUMP });
  assert.equal(turn.ok, true);
  assert.ok(
    turn.rememberDecision?.mode === 'save_with_undo'
    || turn.rememberDecision?.mode === 'partial_save_with_undo',
    `Capture compact, got ${turn.rememberDecision?.mode}`,
  );
  assert.ok(
    !turn.intents.some((i) => i.type === SELLER_TURN_INTENTS.PREPARE_OFFER),
    'Dump ohne Offer-Cue → kein PREPARE_OFFER',
  );
  const offer = (turn.preparedActions || []).find((a) => a.type === SELLER_TURN_INTENTS.PREPARE_OFFER);
  assert.equal(offer, undefined, 'kein Offer-Payload');

  const budget = (turn.extractedFacts || []).find((f) => f.field === 'monthlyBudget');
  assert.ok(budget);
  assert.equal(isWishBudgetFact(budget), true);
  assert.ok(
    budget.rateAuthority === RATE_AUTHORITY.WISH_ONLY
    || budget.offerRateForbidden === true,
    'Budget als wish_only markiert',
  );

  const policy = resolveSellerResponsePolicy(turn);
  assert.equal(policy.kind, 'compact_confirmation');
  assert.ok(turn.captureNextStep?.cta === 'Angebot' || policy.nextStep?.cta === 'Angebot');

  const applied = applyStructuredFactsToLead(lead, turn.extractedFacts || []);
  assert.equal(Number(applied.desiredRate ?? applied.wish?.desiredRate), 350);
  assert.equal(listCustomerVehicleTracks(applied).length, 3);

  // Enrichment darf Wunschrate nicht als Monatsrate in Offer-Text schreiben
  const enriched = enrichOfferTextWithCustomerWish(applied, 'Angebot');
  assert.doesNotMatch(enriched, /350\s*(?:€|euro)?\s*(?:\/\s*monat|pro\s+monat|rate)/i);
  console.log('✓ Capture-Dump: Akte wächst, keine Offer-Rate');
}

// --- B: „Angebot“ nach Capture → Track-Target, keine Fake-Rate ---
{
  let lead = emptyLead();
  const capture = runCleverSellerTurn({ lead, sellerInput: PHONE_DUMP });
  lead = applyStructuredFactsToLead(lead, capture.extractedFacts || []);
  lead = {
    ...lead,
    paymentType: 'leasing',
    wish: { ...lead.wish, paymentType: 'leasing', desiredRate: 350 },
    desiredRate: 350,
  };
  const tracks = listCustomerVehicleTracks(lead);
  assert.ok(tracks.length >= 1);
  assert.ok(
    tracks.some((t) => (
      t.status === VEHICLE_TRACK_STATUS.ACTIVE || t.status === VEHICLE_TRACK_STATUS.OPEN
    )),
  );

  const offerTurn = runCleverSellerTurn({ lead, sellerInput: 'Angebot' });
  assert.ok(
    offerTurn.intents.some((i) => i.type === SELLER_TURN_INTENTS.PREPARE_OFFER),
    'Offer-Cue → PREPARE_OFFER',
  );
  const offer = (offerTurn.preparedActions || []).find((a) => (
    a.type === SELLER_TURN_INTENTS.PREPARE_OFFER
  ));
  assert.ok(offer, 'prepared Offer-Action');
  assert.ok(offer.payload?.vehicleTrackId, 'Track-Target gesetzt');
  assert.equal(offer.payload?.monthlyRate, null, 'keine Fake-/Wish-Rate injecten');
  assert.equal(offer.payload?.canCreateOffer, false);
  assert.ok(
    offer.payload?.rateAuthority === RATE_AUTHORITY.NON_AUTHORITATIVE
    || offer.payload?.missingRate === true,
  );
  // Wunsch 350 darf nicht still Offer-Rate werden
  assert.notEqual(offer.payload?.monthlyRate, 350);
  console.log('✓ Angebot nach Capture: Track, keine Fake-Rate');
}

// --- C: paymentType-Guess allein blockiert nicht als Offer-Stuck ---
{
  assert.equal(
    shouldCaptureBeforeOffer({
      facts: [{
        field: 'paymentType',
        value: 'leasing',
        factClass: 'commercial_preference',
        label: 'Leasing',
      }],
      sellerInput: 'Leasing',
    }),
    true,
  );
  console.log('✓ paymentType-only → Capture-first');
}

// --- D: Negativ – Vehicle/Commercial-Cues nicht als customerName ---
{
  assert.equal(extractNamedCustomerFromInput('Angebote für EV2 Air'), null);
  assert.equal(extractPersonNameFromDump('Angebote für EV2 Air'), null);
  assert.equal(extractNamedCustomerFromInput('Earth weiß'), null);
  assert.equal(extractPersonNameFromDump('Earth weiß'), null);
  assert.equal(extractNamedCustomerFromInput('Will Angebote für EV3 Earth weiß'), null);
  assert.match(extractNamedCustomerFromInput('Kunde heißt Familie Müller') || '', /Familie\s+Müller/i);
  assert.match(extractNamedCustomerFromInput('Familie Müller, optional mail') || '', /Familie\s+Müller/i);
  console.log('✓ Negativ: Angebote für / Earth weiß ≠ Name; Familie/heißt ok');
}

// --- E: Familie-Müller-Dump → Name + Capture-Pfad + Spuren ---
{
  assert.equal(isSellerFreestyleCaptureDump(MUELLER_DUMP), true);
  assert.equal(isInboundLeadPaste(MUELLER_DUMP), false);

  const interpreted = interpretSellerInput(MUELLER_DUMP);
  assert.ok(interpreted.facts.some((f) => (
    f.field === 'customerName' && /Müller|Mueller/i.test(String(f.value || f.label || ''))
  )));
  assert.ok(!interpreted.intents.some((i) => i.type === SELLER_TURN_INTENTS.INBOUND_LEAD));
  assert.ok(!interpreted.intents.some((i) => i.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE));
  assert.ok(interpreted.intents.some((i) => i.type === SELLER_TURN_INTENTS.UPDATE_CUSTOMER_CONTEXT));

  const lead = openLead();
  const turn = runCleverSellerTurn({
    lead,
    sellerInput: MUELLER_DUMP,
    scopeHint: 'akte',
    env: {
      VITE_CLEVER_SELLER_ORCHESTRATOR: 'true',
      CLEVER_SELLER_ORCHESTRATOR: 'true',
    },
  });
  assert.equal(turn.ok, true);
  assert.ok(
    turn.rememberDecision?.mode === 'save_with_undo'
    || turn.rememberDecision?.mode === 'partial_save_with_undo',
    `Capture remember, got ${turn.rememberDecision?.mode}`,
  );
  assert.ok(!turn.inboundLead?.detected, 'kein Inbound-Miss');
  assert.ok(!turn.intents.some((i) => i.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE));
  assert.ok(!turn.intents.some((i) => i.type === SELLER_TURN_INTENTS.PREPARE_OFFER));
  const policy = resolveSellerResponsePolicy(turn);
  assert.equal(policy.kind, 'compact_confirmation');
  assert.ok(turn.captureNextStep?.cta === 'Angebot' || policy.nextStep?.cta === 'Angebot');

  const applied = applyAcceptedSellerTurn(lead, turn, { postFeedCard: false });
  assert.ok(applied.ok);
  assert.match(String(applied.lead?.contact?.name || ''), /Müller|Mueller/i);
  assert.doesNotMatch(String(applied.lead?.contact?.name || ''), /noch offen/i);
  assert.ok(listCustomerVehicleTracks(applied.lead).length >= 3, '≥3 Spuren');
  console.log('✓ Familie Müller Dump: Name + Capture + Spuren');
}

console.log('captureThenOffer.golden.test.js: ok');
