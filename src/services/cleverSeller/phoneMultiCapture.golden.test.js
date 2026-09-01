/**
 * Telefon-Capture DoD:
 * „PV5 EV2 EV3 — AHK, max 350 €, 2 Kinder, entscheidet mit Frau“
 * → Soft-Facts + 3 Spuren, compact path (kein Stuck-Review).
 * Später: „mach die 3 Angebote“ → Batch-Shells je Spur.
 */
import assert from 'node:assert/strict';
import { interpretSellerInput } from './interpretSellerInput.js';
import {
  applyAcceptedSellerTurn,
  applyStructuredFactsToLead,
} from './applyAcceptedSellerTurn.js';
import { evaluateRememberDecision } from './composerIntentChips.js';
import { runCleverSellerTurn } from './runCleverSellerTurn.js';
import { SELLER_TURN_INTENTS } from './sellerFactTypes.js';
import {
  ensureVehicleTrack,
  listCustomerVehicleTracks,
  VEHICLE_TRACK_STATUS,
} from '../crm/vehicleTrack.js';
import { getNeedProfileFromLead } from '../consultation/needProfileService.js';
import { isBatchOfferCue } from './commercialOfferNl.js';

const PHONE_DUMP = 'PV5 EV2 EV3 — AHK, max 350 €, 2 Kinder, entscheidet mit Frau';

function emptyLead() {
  return {
    id: 'lead-phone-capture',
    name: 'Telefon Kunde',
    contact: { name: 'Telefon Kunde', kind: 'private' },
    wish: {},
    crm: {
      needProfile: {},
      vehicleConfigurations: [],
      vehicleOffers: {},
    },
  };
}

{
  const interpreted = interpretSellerInput(PHONE_DUMP);
  const fields = new Set(interpreted.facts.map((f) => f.field));

  assert.ok(fields.has('vehicleInterestMulti'), '3 Modelle → vehicleInterestMulti');
  const multi = interpreted.facts.find((f) => f.field === 'vehicleInterestMulti');
  const keys = (multi.value || [])
    .map((v) => String(typeof v === 'string' ? v : v?.modelKey || '').toLowerCase())
    .filter(Boolean)
    .sort();
  assert.deepEqual(keys, ['ev2', 'ev3', 'ev5'], 'PV5→EV5 Alias + EV2 + EV3');

  assert.ok(fields.has('towHitchRequired'), 'AHK');
  assert.ok(fields.has('childrenCount'), '2 Kinder');
  assert.ok(fields.has('decisionPartner'), 'entscheidet mit Frau');
  assert.ok(fields.has('monthlyBudget'), 'max 350 €');
  const rate = interpreted.facts.find((f) => f.field === 'monthlyBudget');
  assert.equal(Number(rate.value), 350);
  assert.match(String(rate.label || ''), /max/i);
  assert.equal(rate.needsConfirmation, false);

  const decision = evaluateRememberDecision(interpreted.facts, emptyLead());
  assert.ok(
    decision.mode === 'save_with_undo' || decision.mode === 'partial_save_with_undo',
    `compact remember, got ${decision.mode}`,
  );
  assert.ok(
    decision.safeFacts.some((f) => f.field === 'vehicleInterestMulti'),
    'Multi-Modelle sind safe (kein Stuck-Review nur wegen Multi)',
  );
  console.log('✓ Interpret: 3 Modelle + Soft-Facts, compact remember');
}

{
  const lead = emptyLead();
  const turn = runCleverSellerTurn({ lead, sellerInput: PHONE_DUMP });
  assert.equal(turn.ok, true);
  assert.ok(
    turn.rememberDecision?.mode === 'save_with_undo'
    || turn.rememberDecision?.mode === 'partial_save_with_undo',
    `Turn compact, got ${turn.rememberDecision?.mode}`,
  );
  assert.ok(
    !turn.reviewModel?.hideGlobalAccept,
    'Partial Success: kein hideGlobalAccept-Stuck',
  );

  const applied = applyStructuredFactsToLead(lead, turn.extractedFacts || []);
  const tracks = listCustomerVehicleTracks(applied);
  assert.equal(tracks.length, 3, '3 Fahrzeugspuren');
  const keys = tracks.map((t) => String(t.config?.modelKey || '').toLowerCase()).sort();
  assert.deepEqual(keys, ['ev2', 'ev3', 'ev5']);

  const profile = getNeedProfileFromLead(applied);
  assert.equal(profile.towbar, true);
  assert.equal(Number(profile.household?.childrenCount ?? profile.children), 2);
  assert.equal(profile.household?.decidesWith, 'partner');
  assert.equal(Number(applied.desiredRate ?? applied.wish?.desiredRate), 350);

  for (const track of tracks) {
    const reqs = track.customerRequirements || track.requirementLabels || [];
    assert.ok(
      reqs.some((r) => /AHK/i.test(String(r))),
      `AHK auf Spur ${track.displayName}`,
    );
  }

  const statuses = new Set(tracks.map((t) => t.status));
  assert.ok(
    statuses.has(VEHICLE_TRACK_STATUS.ACTIVE) || statuses.has(VEHICLE_TRACK_STATUS.OPEN),
    'Spuren ACTIVE/OPEN',
  );
  console.log('✓ Apply: 3 Spuren + Soft shared, Wunschrate 350');
}

{
  assert.equal(isBatchOfferCue('mach die 3 Angebote'), true);
  assert.equal(isBatchOfferCue('Angebote für alle'), true);

  let lead = emptyLead();
  const captureTurn = runCleverSellerTurn({ lead, sellerInput: PHONE_DUMP });
  lead = applyStructuredFactsToLead(lead, captureTurn.extractedFacts || []);
  assert.equal(listCustomerVehicleTracks(lead).length, 3);

  const batchTurn = runCleverSellerTurn({
    lead,
    sellerInput: 'mach die 3 Angebote',
  });
  assert.ok(
    batchTurn.intents.some((i) => i.type === SELLER_TURN_INTENTS.PREPARE_OFFER),
    'Batch → PREPARE_OFFER',
  );
  const batchAction = (batchTurn.preparedActions || []).find((a) => (
    a.type === SELLER_TURN_INTENTS.PREPARE_OFFER && a.payload?.batch === true
  ));
  assert.ok(batchAction, 'Batch prepared action');
  assert.equal(batchAction.payload.trackIds.length, 3);
  assert.match(String(batchAction.label || ''), /3 Angebote/i);

  const accepted = applyAcceptedSellerTurn(lead, {
    ...batchTurn,
    extractedFacts: [],
  }, { postFeedCard: false });
  assert.equal(accepted.ok, true, 'Batch-Accept ohne Facts');
  const batchOrders = (accepted.lead?.crm?.openOfferOrders || [])
    .filter((o) => o.source === 'seller_batch_offers');
  assert.equal(batchOrders.length, 3, '3 Angebotsaufträge (Shells)');
  console.log('✓ Batch: 3 Angebotsaufträge ohne Modell-Kleben');
}

{
  // Regression: einzelnes EV4 focus bleibt (kein Multi-Kill)
  let lead = emptyLead();
  const ensured = ensureVehicleTrack(lead, {
    vehicleKey: 'kia-ev3',
    displayName: 'Kia EV3',
    model: 'EV3',
    modelKey: 'ev3',
  });
  lead = ensured.lead;
  lead = {
    ...lead,
    crm: {
      ...lead.crm,
      focusedVehicleTrackId: ensured.trackId,
      vehicleConfigurations: (lead.crm.vehicleConfigurations || []).map((c) => (
        c.id === ensured.trackId
          ? {
            ...c,
            vehicleTrack: {
              ...(c.vehicleTrack || {}),
              status: VEHICLE_TRACK_STATUS.ACTIVE,
            },
          }
          : c
      )),
      needProfile: { selectedModelKey: 'ev3', modelHint: 'ev3' },
    },
    vehicle: { brand: 'Kia', model: 'EV3', modelKey: 'ev3', label: 'Kia EV3' },
  };

  const interpreted = interpretSellerInput('EV4');
  const fact = interpreted.facts.find((f) => f.field === 'vehicleInterest');
  assert.equal(fact?.value?.modelKey, 'ev4');
  const after = applyStructuredFactsToLead(lead, [fact]);
  const tracks = listCustomerVehicleTracks(after);
  const ev4 = tracks.find((t) => /ev4/i.test(t.modelLabel));
  const ev3 = tracks.find((t) => /ev3/i.test(t.modelLabel));
  assert.ok(ev4 && ev3);
  assert.equal(ev4.status, VEHICLE_TRACK_STATUS.ACTIVE);
  assert.equal(ev3.status, VEHICLE_TRACK_STATUS.OPEN);
  console.log('✓ Regression: EV4 Focus demoted EV3, kein Multi-Kill');
}

console.log('phoneMultiCapture.golden ok');
