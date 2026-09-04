/**
 * Golden A–F: Batch-Angebote nutzen exakten Gesprächs-Track-Scope (kein EV4/CRM-Primary).
 */
import assert from 'node:assert/strict';
import { createEmptyNeedProfile } from '../consultation/needProfileService.js';
import {
  ensureVehicleTrack,
  listCustomerVehicleTracks,
  VEHICLE_TRACK_STATUS,
} from '../crm/vehicleTrack.js';
import {
  createEmptyAgentWorkingMemory,
  updateMemoryFromSellerTurn,
  buildSellerTurnMemoryParams,
} from '../cleverAgent/cleverAgentWorkingMemory.js';
import { applyAcceptedSellerTurn, applyStructuredFactsToLead } from './applyAcceptedSellerTurn.js';
import { runCleverSellerTurn } from './runCleverSellerTurn.js';
import { resolveSellerResponsePolicy } from '../cleverAgent/cleverAssistantResponse.js';
import { getOfferDraftById, mutateActiveOfferDraft, upsertOfferDraftOnLead } from './cleverWorkingDraft.js';
import { routeSellerRequest } from '../cleverAgent/routeSellerRequest.js';
import {
  resolveBatchOfferTracks,
  parseBatchOfferScope,
} from './batchOfferTrackScope.js';

function emptyLead(id = 'lead-batch-scope') {
  return {
    id,
    name: 'Batch Scope',
    contact: { name: 'Batch Scope' },
    wish: {},
    crm: {
      needProfile: createEmptyNeedProfile(),
      vehicleConfigurations: [],
      vehicleOffers: {},
    },
  };
}

function prepBatch(turn) {
  return (turn.preparedActions || []).find((a) => (
    a.type === 'prepare_offer' && a.payload?.batch === true
  ));
}

function modelKeysFromBatch(action) {
  return (action?.payload?.offers || []).map((o) => String(o.focusModelKey || '').toLowerCase()).sort();
}

{
  assert.equal(parseBatchOfferScope('mach die drei Angebote').kind, 'count');
  assert.equal(parseBatchOfferScope('mach die drei Angebote').count, 3);
  assert.equal(parseBatchOfferScope('mach 3 Angebote').count, 3);
  assert.equal(parseBatchOfferScope('mach beide').kind, 'beide');
  assert.equal(routeSellerRequest('mach die drei Angebote'), 'deterministic_fast_path');
  console.log('✓ Scope parse + Agent→Deterministik Route');
}

// A + B: PV5 EV2 EV3 → drei / 3 Angebote
for (const cue of ['mach die drei Angebote', 'mach 3 Angebote']) {
  let lead = emptyLead(`lead-${cue.slice(0, 12)}`);
  let memory = createEmptyAgentWorkingMemory();
  const dump = runCleverSellerTurn({
    sellerInput: 'PV5 EV2 EV3 interessieren ihn.',
    lead,
    leads: [lead],
  });
  lead = applyAcceptedSellerTurn(lead, dump, { postFeedCard: false }).lead;
  memory = updateMemoryFromSellerTurn(
    memory,
    dump,
    'PV5 EV2 EV3 interessieren ihn.',
    resolveSellerResponsePolicy(dump),
  );
  assert.ok(
    (lead.crm?.cleverWorkingState?.recentVehicleTrackIds || []).length >= 3,
    'recentVehicleTrackIds nach Multi-Interest',
  );

  const batch = runCleverSellerTurn({
    sellerInput: cue,
    lead,
    leads: [lead],
    ...buildSellerTurnMemoryParams(memory, lead),
  });
  const action = prepBatch(batch);
  assert.ok(action, `${cue}: Batch-Action`);
  assert.equal(action.payload.offerDraftIds.length, 3, `${cue}: 3 Drafts`);
  assert.deepEqual(modelKeysFromBatch(action), ['ev2', 'ev3', 'pv5']);
  for (const od of action.payload.offers) {
    assert.equal(od.rate, null, 'rate null');
  }

  lead = applyAcceptedSellerTurn(lead, batch, { postFeedCard: false }).lead;
  for (const id of action.payload.offerDraftIds) {
    assert.ok(getOfferDraftById(lead, id), `persist ${id}`);
  }
  console.log(`✓ A/B ${cue}`);
}

// C: beide → EV2 + EV3
{
  let lead = emptyLead('lead-beide');
  let memory = createEmptyAgentWorkingMemory();
  const dump = runCleverSellerTurn({
    sellerInput: 'EV2 und EV3 interessieren ihn',
    lead,
    leads: [lead],
  });
  lead = applyAcceptedSellerTurn(lead, dump, { postFeedCard: false }).lead;
  memory = updateMemoryFromSellerTurn(
    memory,
    dump,
    'EV2 und EV3 interessieren ihn',
    resolveSellerResponsePolicy(dump),
  );
  const batch = runCleverSellerTurn({
    sellerInput: 'mach beide',
    lead,
    leads: [lead],
    ...buildSellerTurnMemoryParams(memory, lead),
  });
  const action = prepBatch(batch);
  assert.ok(action);
  assert.equal(action.payload.offerDraftIds.length, 2);
  assert.deepEqual(modelKeysFromBatch(action), ['ev2', 'ev3']);
  console.log('✓ C beide EV2+EV3');
}

// D: EV4 History darf nicht in „die drei“
{
  let lead = emptyLead('lead-ev4-history');
  const ensured = ensureVehicleTrack(lead, {
    vehicleKey: 'kia-ev4',
    displayName: 'Kia EV4',
    model: 'EV4',
    modelKey: 'ev4',
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
      needProfile: {
        ...createEmptyNeedProfile(),
        selectedModelKey: 'ev4',
        modelHint: 'ev4',
        modelCandidates: ['ev4'],
      },
    },
    vehicle: { brand: 'Kia', model: 'EV4', modelKey: 'ev4', label: 'Kia EV4' },
  };

  let memory = createEmptyAgentWorkingMemory();
  const dump = runCleverSellerTurn({
    sellerInput: 'PV5 EV2 EV3 interessieren ihn.',
    lead,
    leads: [lead],
  });
  lead = applyAcceptedSellerTurn(lead, dump, { postFeedCard: false }).lead;
  memory = updateMemoryFromSellerTurn(
    memory,
    dump,
    'PV5 EV2 EV3 interessieren ihn.',
    resolveSellerResponsePolicy(dump),
  );

  const resolved = resolveBatchOfferTracks({
    lead,
    sellerInput: 'mach die drei Angebote',
    workingMemory: memory,
    conversationHistory: buildSellerTurnMemoryParams(memory, lead).conversationHistory,
    ensureMissingTracks: false,
  });
  assert.equal(resolved.ok, true);
  assert.equal(resolved.tracks.length, 3);
  assert.ok(!resolved.modelKeys.includes('ev4'), 'EV4 nicht im Batch-Scope');

  const batch = runCleverSellerTurn({
    sellerInput: 'mach die drei Angebote',
    lead,
    leads: [lead],
    ...buildSellerTurnMemoryParams(memory, lead),
  });
  const action = prepBatch(batch);
  assert.ok(action);
  assert.equal(action.payload.offerDraftIds.length, 3);
  assert.deepEqual(modelKeysFromBatch(action), ['ev2', 'ev3', 'pv5']);
  assert.ok(!modelKeysFromBatch(action).includes('ev4'));
  console.log('✓ D EV4 History ausgeschlossen');
}

// E: Reload – Draft IDs erhalten
{
  let lead = emptyLead('lead-reload');
  const dump = runCleverSellerTurn({
    sellerInput: 'PV5 EV2 EV3 interessieren ihn.',
    lead,
    leads: [lead],
  });
  lead = applyAcceptedSellerTurn(lead, dump, { postFeedCard: false }).lead;
  const batch = runCleverSellerTurn({
    sellerInput: 'mach die drei Angebote',
    lead,
    leads: [lead],
    ...buildSellerTurnMemoryParams(createEmptyAgentWorkingMemory(), lead),
  });
  const action = prepBatch(batch);
  lead = applyAcceptedSellerTurn(lead, batch, { postFeedCard: false }).lead;
  const ids = [...(action.payload.offerDraftIds || [])];
  const reloaded = {
    ...lead,
    crm: {
      ...lead.crm,
      cleverWorkingState: JSON.parse(JSON.stringify(lead.crm.cleverWorkingState)),
    },
  };
  for (const id of ids) {
    assert.ok(getOfferDraftById(reloaded, id), `reload ${id}`);
  }
  console.log('✓ E reload Draft IDs');
}

// F: Cross-Draft Isolation
{
  let lead = emptyLead('lead-cross');
  let memory = createEmptyAgentWorkingMemory();
  const dump = runCleverSellerTurn({
    sellerInput: 'PV5 EV2 EV3 interessieren ihn.',
    lead,
    leads: [lead],
  });
  lead = applyAcceptedSellerTurn(lead, dump, { postFeedCard: false }).lead;
  memory = updateMemoryFromSellerTurn(
    memory,
    dump,
    'PV5 EV2 EV3 interessieren ihn.',
    resolveSellerResponsePolicy(dump),
  );
  const batch = runCleverSellerTurn({
    sellerInput: 'mach die drei Angebote',
    lead,
    leads: [lead],
    ...buildSellerTurnMemoryParams(memory, lead),
  });
  const action = prepBatch(batch);
  lead = applyAcceptedSellerTurn(lead, batch, { postFeedCard: false }).lead;
  memory = updateMemoryFromSellerTurn(
    memory,
    batch,
    'mach die drei Angebote',
    resolveSellerResponsePolicy(batch),
  );

  const byKey = Object.fromEntries(
    (action.payload.offers || []).map((o) => [String(o.focusModelKey).toLowerCase(), o]),
  );
  const ev2Id = byKey.ev2.offerDraftId;
  const ev3Id = byKey.ev3.offerDraftId;
  const pv5Id = byKey.pv5.offerDraftId;

  // EV2: Air weiß via Working-Draft-Mutation
  memory = {
    ...memory,
    currentOfferDraftId: ev2Id,
    currentOfferDraft: {
      ...getOfferDraftById(lead, ev2Id),
      vehicleIdentityDraft: lead.crm.cleverWorkingState.vehicleIdentityDrafts[
        getOfferDraftById(lead, ev2Id).vehicleIdentityDraftId
      ],
    },
  };
  const mutEv2a = mutateActiveOfferDraft({
    lead,
    workingMemory: memory,
    sellerInput: 'doch Air',
  });
  assert.ok(mutEv2a?.offerDraft, 'EV2 Air');
  lead = upsertOfferDraftOnLead(lead, mutEv2a.offerDraft);

  // EV3: Earth
  memory = {
    ...memory,
    currentOfferDraftId: ev3Id,
    currentOfferDraft: {
      ...getOfferDraftById(lead, ev3Id),
      vehicleIdentityDraft: lead.crm.cleverWorkingState.vehicleIdentityDrafts[
        getOfferDraftById(lead, ev3Id).vehicleIdentityDraftId
      ],
    },
  };
  const mutEv3a = mutateActiveOfferDraft({
    lead,
    workingMemory: memory,
    sellerInput: 'doch Earth',
  });
  assert.ok(mutEv3a?.offerDraft, 'EV3 Earth');
  lead = upsertOfferDraftOnLead(lead, mutEv3a.offerDraft);

  const dEv2 = getOfferDraftById(lead, ev2Id);
  const dEv3 = getOfferDraftById(lead, ev3Id);
  const dPv5 = getOfferDraftById(lead, pv5Id);
  const id2 = lead.crm.cleverWorkingState.vehicleIdentityDrafts[dEv2.vehicleIdentityDraftId];
  const id3 = lead.crm.cleverWorkingState.vehicleIdentityDrafts[dEv3.vehicleIdentityDraftId];
  const idPv5 = lead.crm.cleverWorkingState.vehicleIdentityDrafts[dPv5.vehicleIdentityDraftId];

  assert.match(String(id2?.trim?.canonical || id2?.trim?.raw || ''), /air/i);
  assert.match(String(id3?.trim?.canonical || id3?.trim?.raw || ''), /earth/i);
  assert.equal(String(idPv5?.modelKey || dPv5.focusModelKey).toLowerCase(), 'pv5');
  assert.ok(!/air/i.test(String(idPv5?.trim?.canonical || '')));
  assert.ok(!/earth/i.test(String(id2?.trim?.canonical || '')), 'kein Earth-Leak auf EV2');
  assert.ok(!/air/i.test(String(id3?.trim?.canonical || '')), 'kein Air-Leak auf EV3');
  console.log('✓ F cross-draft isolation');
}

{
  // phoneMultiCapture-Pfad: applyStructuredFacts setzt recent, Batch ohne Memory
  let lead = emptyLead('lead-phone-path');
  const capture = runCleverSellerTurn({
    lead,
    sellerInput: 'PV5 EV2 EV3 interessieren ihn. AHK, 2 Kinder, max 350.',
  });
  lead = applyStructuredFactsToLead(lead, capture.extractedFacts || []);
  assert.equal(listCustomerVehicleTracks(lead).length, 3);
  assert.ok((lead.crm?.cleverWorkingState?.recentVehicleTrackIds || []).length >= 3);
  const batch = runCleverSellerTurn({ lead, sellerInput: 'mach die 3 Angebote' });
  const action = prepBatch(batch);
  assert.ok(action);
  assert.equal(action.payload.trackIds.length, 3);
  assert.deepEqual(modelKeysFromBatch(action), ['ev2', 'ev3', 'pv5']);
  console.log('✓ phone path ohne Session-Memory');
}

console.log('✓ batchOfferTrackScope golden A–F PASS');
