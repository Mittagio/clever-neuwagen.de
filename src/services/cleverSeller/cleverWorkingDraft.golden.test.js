/**
 * Persistent Working Draft + Conversation Continuity – Golden Tests
 * node --test src/services/cleverSeller/cleverWorkingDraft.golden.test.js
 */
import assert from 'node:assert/strict';
import { createEmptyNeedProfile } from '../consultation/needProfileService.js';
import { VEHICLE_TRACK_STATUS } from '../crm/vehicleTrack.js';
import {
  createEmptyAgentWorkingMemory,
  updateMemoryFromSellerTurn,
  buildSellerTurnMemoryParams,
  getConversationHistoryForAgent,
} from '../cleverAgent/cleverAgentWorkingMemory.js';
import { resolveSellerResponsePolicy } from '../cleverAgent/cleverAssistantResponse.js';
import { applyAcceptedSellerTurn } from './applyAcceptedSellerTurn.js';
import { isBatchOfferCue } from './commercialOfferNl.js';
import { runCleverSellerTurn } from './runCleverSellerTurn.js';
import { SELLER_TURN_INTENTS } from './sellerFactTypes.js';
import {
  buildHandoffFromOfferDraftId,
  getOfferDraftById,
  isMessageRewriteCue,
  isMessageSendCue,
} from './cleverWorkingDraft.js';

function christinaLead() {
  return {
    id: 'lead-christina-wd',
    name: 'Christina Deuschle',
    contact: { name: 'Christina Deuschle' },
    paymentType: 'leasing',
    desiredRate: 324,
    vehicle: { brand: 'Kia', model: 'EV4', trim: 'Air', modelKey: 'ev4' },
    wish: {
      model: 'EV4',
      modelKey: 'ev4',
      trim: 'Air',
      paymentType: 'leasing',
      termMonths: 48,
      mileagePerYear: 15000,
      downPayment: 0,
      desiredRate: 324,
    },
    crm: {
      needProfile: { ...createEmptyNeedProfile(), selectedModelKey: 'ev4' },
      focusedVehicleTrackId: 'vc-ev4',
      vehicleConfigurations: [{
        id: 'vc-ev4',
        brand: 'Kia',
        model: 'EV4',
        modelKey: 'ev4',
        trimLabel: 'Air',
        desiredRate: 324,
        vehicleTrack: { status: VEHICLE_TRACK_STATUS.ACTIVE },
      }],
      vehicleOffers: {},
    },
  };
}

function prepOffer(turn) {
  return (turn.preparedActions || []).find((a) => a.type === SELLER_TURN_INTENTS.PREPARE_OFFER);
}

function draftMsg(turn) {
  return (turn.preparedActions || []).find((a) => a.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE);
}

// --- Batch cues: drei / 3 / beide / alle ---
assert.equal(isBatchOfferCue('mach die 3 Angebote'), true);
assert.equal(isBatchOfferCue('mach die drei Angebote'), true);
assert.equal(isBatchOfferCue('mach die beiden Angebote'), true);
assert.equal(isBatchOfferCue('Angebote für alle'), true);
assert.equal(isMessageRewriteCue('kürzer'), true);
assert.equal(isMessageSendCue('senden'), true);

// ========== GOLDEN 1–4: Same Draft IDs ==========
{
  let lead = christinaLead();
  let memory = createEmptyAgentWorkingMemory();

  const t1 = runCleverSellerTurn({
    sellerInput: 'EV2 AIR Winterpaket\nweiß Angebot',
    lead,
    leads: [lead],
    ...buildSellerTurnMemoryParams(memory, lead),
  });
  const p1 = prepOffer(t1);
  assert.ok(p1?.payload?.offerDraftId, 'G1: offerDraftId');
  assert.ok(p1?.payload?.vehicleIdentityDraft?.id, 'G1: vehicleIdentityDraftId');
  assert.equal(p1.payload.vehicle?.modelKey, 'ev2');
  assert.ok(p1.payload.vehicleIdentityDraft.packages.some((p) => /winter/i.test(p.raw || '')));
  assert.equal(p1.payload.monthlyRate, null, 'G1: keine EV4-Rate');

  const offerDraftIdA = p1.payload.offerDraftId;
  const vehicleIdentityDraftIdB = p1.payload.vehicleIdentityDraft.id;

  memory = updateMemoryFromSellerTurn(memory, t1, 'EV2 AIR Winterpaket weiß Angebot', resolveSellerResponsePolicy(t1));
  assert.equal(memory.currentOfferDraftId, offerDraftIdA);
  assert.equal(memory.currentOfferDraft?.vehicleIdentityDraftId, vehicleIdentityDraftIdB);

  // Persist on lead (Accept)
  const applied1 = applyAcceptedSellerTurn(lead, t1, { postFeedCard: false });
  assert.ok(applied1.ok);
  lead = applied1.lead;
  assert.ok(getOfferDraftById(lead, offerDraftIdA), 'G1: Draft auf Lead persistiert');

  // GOLDEN 2: doch Earth
  const t2 = runCleverSellerTurn({
    sellerInput: 'doch Earth',
    lead,
    leads: [lead],
    ...buildSellerTurnMemoryParams(memory, lead),
    conversationHistory: getConversationHistoryForAgent(memory),
  });
  const p2 = prepOffer(t2);
  assert.ok(p2?.payload, 'G2: PREPARE_OFFER');
  assert.equal(p2.payload.offerDraftId, offerDraftIdA, 'G2: gleicher offerDraftId A');
  assert.equal(
    p2.payload.vehicleIdentityDraft?.id,
    vehicleIdentityDraftIdB,
    'G2: gleicher vehicleIdentityDraftId B',
  );
  assert.match(String(p2.payload.vehicleIdentityDraft?.trim?.canonical || ''), /Earth/i);
  assert.ok(
    p2.payload.vehicleIdentityDraft.packages.some((p) => /winter/i.test(p.raw || '')),
    'G2: Winterpaket bleibt',
  );
  memory = updateMemoryFromSellerTurn(memory, t2, 'doch Earth', resolveSellerResponsePolicy(t2));
  lead = applyAcceptedSellerTurn(lead, t2, { postFeedCard: false }).lead;

  // GOLDEN 3: schwarz
  const t3 = runCleverSellerTurn({
    sellerInput: 'schwarz',
    lead,
    leads: [lead],
    ...buildSellerTurnMemoryParams(memory, lead),
  });
  const p3 = prepOffer(t3);
  assert.equal(p3?.payload?.offerDraftId, offerDraftIdA, 'G3: gleicher offerDraftId');
  assert.equal(p3?.payload?.vehicleIdentityDraft?.id, vehicleIdentityDraftIdB, 'G3: gleiche identity id');
  assert.ok(/schwarz/i.test(p3.payload.vehicleIdentityDraft?.color?.raw || ''), 'G3: color schwarz');
  memory = updateMemoryFromSellerTurn(memory, t3, 'schwarz', resolveSellerResponsePolicy(t3));
  lead = applyAcceptedSellerTurn(lead, t3, { postFeedCard: false }).lead;

  // GOLDEN 4: Winterpaket raus
  const t4 = runCleverSellerTurn({
    sellerInput: 'Winterpaket raus',
    lead,
    leads: [lead],
    ...buildSellerTurnMemoryParams(memory, lead),
  });
  const p4 = prepOffer(t4);
  assert.equal(p4?.payload?.offerDraftId, offerDraftIdA, 'G4: gleicher offerDraftId');
  assert.equal(p4?.payload?.vehicleIdentityDraft?.id, vehicleIdentityDraftIdB, 'G4: gleiche identity id');
  assert.equal(
    (p4.payload.vehicleIdentityDraft.packages || []).length,
    0,
    'G4: Winterpaket entfernt',
  );
  memory = updateMemoryFromSellerTurn(memory, t4, 'Winterpaket raus', resolveSellerResponsePolicy(t4));
  lead = applyAcceptedSellerTurn(lead, t4, { postFeedCard: false }).lead;

  // Handoff by ID only – kein EV4
  const handoff = buildHandoffFromOfferDraftId(lead, offerDraftIdA);
  assert.equal(handoff.ok, true);
  assert.equal(handoff.magic.focusModelKey, 'ev2');
  assert.equal(handoff.magic.invalidateVehicleRate, true);
  assert.equal(handoff.magic.intent?.commercialInput?.monthlyRate ?? null, null);

  const missing = buildHandoffFromOfferDraftId(lead, 'ofd_does_not_exist');
  assert.equal(missing.ok, false);
  assert.equal(missing.error, 'offer_draft_not_found');

  // Reload hydrate from lead only
  const freshMem = createEmptyAgentWorkingMemory();
  const hydrated = buildSellerTurnMemoryParams(freshMem, lead);
  assert.equal(hydrated.workingMemory?.currentOfferDraftId, offerDraftIdA, 'Reload: Draft aus Lead');

  console.log('✓ Golden 1–4 Working Draft Continuity + Handoff + Reload');
}

// ========== MULTI-TRACK + drei Angebote ==========
{
  let lead = {
    id: 'lead-multi',
    name: 'Session',
    contact: { name: 'Session' },
    wish: {},
    crm: { needProfile: createEmptyNeedProfile(), vehicleConfigurations: [], vehicleOffers: {} },
  };
  let memory = createEmptyAgentWorkingMemory();
  const dump = runCleverSellerTurn({
    sellerInput: 'PV5 EV2 EV3 interessieren ihn.',
    lead,
    leads: [lead],
  });
  const applied = applyAcceptedSellerTurn(lead, dump, { postFeedCard: false });
  lead = applied.lead;
  memory = updateMemoryFromSellerTurn(memory, dump, 'PV5 EV2 EV3 interessieren ihn.', resolveSellerResponsePolicy(dump));
  const tracks = lead.crm?.vehicleConfigurations || [];
  assert.ok(tracks.length >= 3, '≥3 Tracks');

  const batch = runCleverSellerTurn({
    sellerInput: 'mach die drei Angebote',
    lead,
    leads: [lead],
    ...buildSellerTurnMemoryParams(memory, lead),
  });
  const batchAction = prepOffer(batch);
  assert.ok(batchAction?.payload?.batch, 'Batch-Action');
  assert.ok(batchAction.payload.offerDraftIds?.length >= 3, '3 getrennte offerDraftIds');
  const batchKeys = (batchAction.payload.offers || [])
    .map((o) => String(o.focusModelKey || '').toLowerCase())
    .sort();
  assert.deepEqual(batchKeys, ['ev2', 'ev3', 'pv5'], 'exakt PV5 + EV2 + EV3');
  assert.ok(!batchKeys.includes('ev4'), 'kein EV4');
  const ids = new Set(batchAction.payload.offerDraftIds);
  assert.equal(ids.size, batchAction.payload.offerDraftIds.length, 'IDs unique');

  lead = applyAcceptedSellerTurn(lead, batch, { postFeedCard: false }).lead;
  for (const id of batchAction.payload.offerDraftIds) {
    assert.ok(getOfferDraftById(lead, id), `Batch draft ${id} persistiert`);
  }

  // current = letzter Batch-Draft (EV3) – „EV2 Air weiß“ darf EV3 nicht zu EV2 machen
  const byKey = Object.fromEntries(
    (batchAction.payload.offers || []).map((o) => [String(o.focusModelKey).toLowerCase(), o.offerDraftId]),
  );
  lead = {
    ...lead,
    crm: {
      ...lead.crm,
      cleverWorkingState: {
        ...lead.crm.cleverWorkingState,
        currentOfferDraftId: byKey.ev3,
      },
    },
  };
  const crossEv2 = runCleverSellerTurn({
    sellerInput: 'EV2 Air weiß',
    lead,
    leads: [lead],
    ...buildSellerTurnMemoryParams(memory, lead),
  });
  lead = applyAcceptedSellerTurn(lead, crossEv2, { postFeedCard: false }).lead;
  const dEv2 = getOfferDraftById(lead, byKey.ev2);
  const dEv3 = getOfferDraftById(lead, byKey.ev3);
  const dPv5 = getOfferDraftById(lead, byKey.pv5);
  assert.equal(String(dEv2?.focusModelKey || '').toLowerCase(), 'ev2', 'EV2 bleibt EV2');
  assert.equal(String(dEv3?.focusModelKey || '').toLowerCase(), 'ev3', 'EV3 bleibt EV3 (kein Leak)');
  assert.equal(String(dPv5?.focusModelKey || '').toLowerCase(), 'pv5', 'PV5 unverändert');
  const idEv2 = dEv2?.vehicleIdentityDraft;
  assert.ok(
    /air/i.test(String(idEv2?.trim?.canonical || idEv2?.trim?.raw || '')),
    'EV2: Air gesetzt',
  );
  assert.ok(
    /wei(ss|ß)/i.test(String(idEv2?.color?.canonical || idEv2?.color?.raw || '')),
    'EV2: weiß gesetzt',
  );

  const crossEv3 = runCleverSellerTurn({
    sellerInput: 'EV3 Earth schwarz',
    lead,
    leads: [lead],
    ...buildSellerTurnMemoryParams(memory, lead),
  });
  lead = applyAcceptedSellerTurn(lead, crossEv3, { postFeedCard: false }).lead;
  const dEv2b = getOfferDraftById(lead, byKey.ev2);
  const dEv3b = getOfferDraftById(lead, byKey.ev3);
  const dPv5b = getOfferDraftById(lead, byKey.pv5);
  assert.equal(String(dEv2b?.focusModelKey || '').toLowerCase(), 'ev2');
  assert.equal(String(dEv3b?.focusModelKey || '').toLowerCase(), 'ev3');
  assert.equal(String(dPv5b?.focusModelKey || '').toLowerCase(), 'pv5');
  const idEv3 = dEv3b?.vehicleIdentityDraft;
  assert.ok(/earth/i.test(String(idEv3?.trim?.canonical || idEv3?.trim?.raw || '')), 'EV3: Earth');
  assert.ok(/schwarz/i.test(String(idEv3?.color?.canonical || idEv3?.color?.raw || '')), 'EV3: schwarz');
  assert.ok(
    /air/i.test(String(dEv2b?.vehicleIdentityDraft?.trim?.canonical || dEv2b?.vehicleIdentityDraft?.trim?.raw || '')),
    'EV2 Air bleibt nach EV3-Edit',
  );
  assert.ok(
    !dPv5b?.vehicleIdentityDraft?.trim?.canonical && !dPv5b?.vehicleIdentityDraft?.color?.canonical,
    'PV5 ohne Fact-Leak',
  );

  console.log('✓ Multi-Track + drei Angebote + Cross-Draft Isolation');
}

// ========== MESSAGE CONTINUITY ==========
{
  let lead = christinaLead();
  let memory = createEmptyAgentWorkingMemory();
  const f1 = runCleverSellerTurn({
    sellerInput: 'schreib ihm dass ich morgen nach dem EV2 schaue',
    lead,
    leads: [lead],
  });
  const d1 = draftMsg(f1);
  assert.ok(d1?.payload?.messageDraft, 'Message Draft');
  assert.ok(d1.payload.messageDraftId, 'messageDraftId M');
  const messageDraftIdM = d1.payload.messageDraftId;
  memory = updateMemoryFromSellerTurn(
    memory,
    f1,
    'schreib ihm dass ich morgen nach dem EV2 schaue',
    resolveSellerResponsePolicy(f1),
  );
  assert.equal(memory.lastMessageDraft?.messageDraftId, messageDraftIdM);
  lead = applyAcceptedSellerTurn(lead, f1, { postFeedCard: false }).lead;

  const f2 = runCleverSellerTurn({
    sellerInput: 'kürzer',
    lead,
    leads: [lead],
    ...buildSellerTurnMemoryParams(memory, lead),
  });
  const d2 = draftMsg(f2);
  assert.equal(d2?.payload?.messageDraftId, messageDraftIdM, 'kürzer: gleicher messageDraftId');
  assert.ok(d2.payload.messageDraft, 'kürzer: body vorhanden');
  assert.notEqual(d2.payload.messageDraft, d1.payload.messageDraft, 'kürzer: body geändert');
  memory = updateMemoryFromSellerTurn(memory, f2, 'kürzer', resolveSellerResponsePolicy(f2));

  const f3 = runCleverSellerTurn({
    sellerInput: 'senden',
    lead,
    leads: [lead],
    ...buildSellerTurnMemoryParams(memory, lead),
  });
  const d3 = draftMsg(f3);
  assert.equal(d3?.payload?.messageDraftId, messageDraftIdM, 'senden: gleicher Draft');
  assert.equal(d3?.payload?.intendSend, true, 'senden: intendSend');
  assert.equal(d3?.needsSellerConfirmation, true, 'senden: Confirmation');
  console.log('✓ Message Continuity kürzer/senden');
}

console.log('cleverWorkingDraft.golden.test.js: ok');
