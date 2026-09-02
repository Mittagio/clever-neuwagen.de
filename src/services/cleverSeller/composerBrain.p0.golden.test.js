/**
 * Clever Composer Brain P0 – Session-Gedächtnis + Capture→Batch + Identity-Follow-up
 * node src/services/cleverSeller/composerBrain.p0.golden.test.js
 */
import assert from 'node:assert/strict';
import { createEmptyNeedProfile } from '../consultation/needProfileService.js';
import {
  listCustomerVehicleTracks,
  VEHICLE_TRACK_STATUS,
} from '../crm/vehicleTrack.js';
import {
  createEmptyAgentWorkingMemory,
  getConversationHistoryForAgent,
  resolveCurrentOfferContextFromMemory,
  updateMemoryFromSellerTurn,
} from '../cleverAgent/cleverAgentWorkingMemory.js';
import { resolveSellerResponsePolicy } from '../cleverAgent/cleverAssistantResponse.js';
import {
  applyStructuredFactsToLead,
} from './applyAcceptedSellerTurn.js';
import { RATE_AUTHORITY } from './captureThenOffer.js';
import { interpretSellerInput } from './interpretSellerInput.js';
import { runCleverSellerTurn } from './runCleverSellerTurn.js';
import { SELLER_TURN_INTENTS } from './sellerFactTypes.js';

const PHONE_DUMP = 'PV5 EV2 EV3 — AHK, max 350 €, 2 Kinder, entscheidet mit Frau';

function emptyLead(id = 'lead-brain-p0') {
  return {
    id,
    name: 'Session Kunde',
    contact: { name: 'Session Kunde', kind: 'private' },
    wish: {},
    crm: {
      needProfile: createEmptyNeedProfile(),
      vehicleConfigurations: [],
      vehicleOffers: {},
    },
  };
}

// --- A: History nicht leer nach deterministischem Turn ---
{
  let memory = createEmptyAgentWorkingMemory();
  assert.equal(getConversationHistoryForAgent(memory).length, 0);

  const turn = runCleverSellerTurn({
    lead: emptyLead(),
    sellerInput: PHONE_DUMP,
  });
  const policy = resolveSellerResponsePolicy(turn);
  memory = updateMemoryFromSellerTurn(memory, turn, PHONE_DUMP, policy);

  const hist = getConversationHistoryForAgent(memory);
  assert.ok(hist.length >= 2, `History nach Capture ≥2, got ${hist.length}`);
  assert.equal(hist[0].role, 'user');
  assert.match(hist[0].text, /EV2|PV5/i);
  assert.equal(hist[hist.length - 1].role, 'assistant');
  console.log('✓ History nicht leer nach Capture-Turn');
}

// --- B: Capture → „mach die 3 Angebote“ mit Memory/History, keine Fake-Rate ---
{
  let lead = emptyLead('lead-batch-mem');
  let memory = createEmptyAgentWorkingMemory();

  const capture = runCleverSellerTurn({
    lead,
    sellerInput: PHONE_DUMP,
    workingMemory: memory,
    conversationHistory: getConversationHistoryForAgent(memory),
  });
  memory = updateMemoryFromSellerTurn(
    memory,
    capture,
    PHONE_DUMP,
    resolveSellerResponsePolicy(capture),
  );
  lead = applyStructuredFactsToLead(lead, capture.extractedFacts || []);
  assert.equal(listCustomerVehicleTracks(lead).length, 3);

  const hist = getConversationHistoryForAgent(memory);
  assert.ok(hist.length >= 2, 'History vor Batch vorhanden');

  const batch = runCleverSellerTurn({
    lead,
    sellerInput: 'mach die 3 Angebote',
    workingMemory: memory,
    conversationHistory: hist,
  });
  assert.ok(
    batch.intents.some((i) => i.type === SELLER_TURN_INTENTS.PREPARE_OFFER),
    'Batch → PREPARE_OFFER',
  );
  const batchAction = (batch.preparedActions || []).find((a) => (
    a.type === SELLER_TURN_INTENTS.PREPARE_OFFER && a.payload?.batch === true
  ));
  assert.ok(batchAction, 'Batch-Action');
  assert.equal(batchAction.payload.trackIds.length, 3);
  // Keine Fake-Web-Rate auf Einzel-Offers im Batch
  const shells = batchAction.payload?.offers || batchAction.payload?.items || [];
  for (const shell of shells) {
    if (shell?.monthlyRate != null) {
      assert.notEqual(shell.monthlyRate, 339);
      assert.notEqual(shell.monthlyRate, 369);
    }
  }
  memory = updateMemoryFromSellerTurn(
    memory,
    batch,
    'mach die 3 Angebote',
    resolveSellerResponsePolicy(batch),
  );
  assert.ok(getConversationHistoryForAgent(memory).length >= 4);
  console.log('✓ Capture→Batch mit History, ohne Fake-Rate');
}

// --- C: Nach Offer „schwarz“ trifft Identity über Working Memory ---
{
  let memory = createEmptyAgentWorkingMemory();
  const lead = {
    id: 'lead-identity-mem',
    name: 'Philipp',
    contact: { name: 'Philipp' },
    paymentType: 'leasing',
    crm: {
      needProfile: createEmptyNeedProfile(),
      focusedVehicleTrackId: 'vc-ev3',
      vehicleConfigurations: [{
        id: 'vc-ev3',
        brand: 'Kia',
        model: 'EV3',
        modelKey: 'ev3',
        trimLabel: 'Earth',
        vehicleTrack: { status: VEHICLE_TRACK_STATUS.ACTIVE, preferredColor: null },
      }],
    },
  };

  const offerTurn = runCleverSellerTurn({
    lead,
    sellerInput: 'Angebot',
    currentOfferContext: {
      offerId: 'offer-sess',
      title: 'Kaufangebot',
      modelKey: 'ev3',
      vehicleTrackId: 'vc-ev3',
      monthlyRate: null,
    },
  });
  memory = updateMemoryFromSellerTurn(
    memory,
    offerTurn,
    'Angebot',
    resolveSellerResponsePolicy(offerTurn),
  );
  assert.ok(memory.previousOfferPreparation || memory.currentOffer || memory.pendingAction);

  const fromMem = resolveCurrentOfferContextFromMemory(memory);
  assert.ok(fromMem, 'Offer-Kontext aus Memory');
  assert.equal(fromMem.vehicleTrackId, 'vc-ev3');

  const colorTurn = runCleverSellerTurn({
    lead,
    sellerInput: 'schwarz.',
    workingMemory: memory,
    conversationHistory: getConversationHistoryForAgent(memory),
    // bewusst kein currentOfferContext – nur Memory
  });
  assert.ok(
    colorTurn.intents.some((i) => i.type === SELLER_TURN_INTENTS.PREPARE_OFFER)
    || (colorTurn.extractedFacts || []).some((f) => (
      f.field === 'colorPreference'
      && (f.value?.targetScope === 'offer_vehicle' || f.value?.vehicleTrackId === 'vc-ev3')
    )),
    'schwarz bindet an Session-Offer/Track',
  );
  const colorFact = (colorTurn.extractedFacts || []).find((f) => f.field === 'colorPreference');
  assert.ok(colorFact);
  assert.match(String(colorFact.value?.color || colorFact.value || ''), /schwarz/i);
  console.log('✓ Follow-up „schwarz“ über Working Memory');
}

// --- D: Per-Spur Trim/Farbe/Paket im Multi-Dump ---
{
  const dump = 'EV3 Elite weiß, EV2 Air Upgrade';
  const interpreted = interpretSellerInput(dump);
  const multi = interpreted.facts.find((f) => f.field === 'vehicleInterestMulti');
  assert.ok(multi, 'vehicleInterestMulti');
  const entries = multi.value || [];
  const ev3 = entries.find((e) => String(e.modelKey || e).toLowerCase() === 'ev3');
  const ev2 = entries.find((e) => String(e.modelKey || e).toLowerCase() === 'ev2');
  assert.ok(ev3 && ev2);
  assert.match(String(ev3.trim || ''), /Elite/i);
  assert.match(String(ev3.color || ev3.preferredColor || ''), /weiß|weiss/i);
  assert.match(String(ev2.trim || ''), /Air/i);
  assert.match(String(ev2.package || ev2.equipmentPackage || ''), /Upgrade/i);

  const lead = applyStructuredFactsToLead(emptyLead('lead-per-track'), interpreted.facts);
  const tracks = listCustomerVehicleTracks(lead);
  assert.equal(tracks.length, 2);
  const t3 = tracks.find((t) => /ev3/i.test(t.config?.modelKey || ''));
  const t2 = tracks.find((t) => /ev2/i.test(t.config?.modelKey || ''));
  assert.match(String(t3?.config?.trimLabel || ''), /Elite/i);
  assert.match(String(t3?.preferredColor || t3?.config?.colorLabel || ''), /weiß|weiss/i);
  assert.ok(
    (t2?.customerRequirements || []).some((r) => /Upgrade/i.test(String(r))),
    'Upgrade auf EV2-Spur',
  );
  console.log('✓ Per-Spur Elite/weiß + Air/Upgrade');
}

// --- E: Wish-Rate bleibt non-authoritative (Regression Capture-then-Offer) ---
{
  const turn = runCleverSellerTurn({ lead: emptyLead(), sellerInput: PHONE_DUMP });
  const budget = (turn.extractedFacts || []).find((f) => f.field === 'monthlyBudget');
  assert.ok(budget);
  assert.ok(
    budget.rateAuthority === RATE_AUTHORITY.WISH_ONLY
    || budget.offerRateForbidden === true,
  );
  assert.ok(turn.captureNextStep?.cta === 'Angebot' || !turn.intents.some((i) => (
    i.type === SELLER_TURN_INTENTS.PREPARE_OFFER
  )));
  console.log('✓ Capture-then-Offer: Wish-Rate + Next-Step');
}

console.log('composerBrain.p0.golden.test.js: ok');
