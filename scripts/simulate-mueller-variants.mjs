/**
 * Variant B: klassischer Phone-Dump (wie Golden) + Name separat
 * + Variant C: strukturierter Inbound mit klarem Namen
 * node scripts/simulate-mueller-variants.mjs
 */
import { createEmptyNeedProfile, getNeedProfileFromLead } from '../src/services/consultation/needProfileService.js';
import {
  createEmptyAgentWorkingMemory,
  getConversationHistoryForAgent,
  updateMemoryFromSellerTurn,
} from '../src/services/cleverAgent/cleverAgentWorkingMemory.js';
import { resolveSellerResponsePolicy } from '../src/services/cleverAgent/cleverAssistantResponse.js';
import { listCustomerVehicleTracks } from '../src/services/crm/vehicleTrack.js';
import {
  applyAcceptedSellerTurn,
  applyStructuredFactsToLead,
} from '../src/services/cleverSeller/applyAcceptedSellerTurn.js';
import { runCleverSellerTurn } from '../src/services/cleverSeller/runCleverSellerTurn.js';
import { SELLER_TURN_INTENTS } from '../src/services/cleverSeller/sellerFactTypes.js';
import { buildUniversalReviewModel } from '../src/services/cleverSeller/buildUniversalReviewModel.js';

const ENV = {
  VITE_CLEVER_SELLER_ORCHESTRATOR: 'true',
  CLEVER_SELLER_ORCHESTRATOR: 'true',
};

function emptyLead(id, name = 'Kunde noch offen') {
  return {
    id,
    name,
    contact: { name, kind: 'private' },
    wish: {},
    crm: {
      needProfile: createEmptyNeedProfile(),
      vehicleConfigurations: [],
      vehicleOffers: {},
      openOfferOrders: [],
    },
  };
}

function tracksOf(lead) {
  return listCustomerVehicleTracks(lead).map((t) => ({
    modelKey: t.config?.modelKey,
    trim: t.config?.trimLabel,
    color: t.preferredColor || t.config?.colorLabel || null,
    displayName: t.displayName,
  }));
}

function softOf(lead) {
  const p = getNeedProfileFromLead(lead) || {};
  return {
    name: lead.contact?.name || lead.name,
    email: lead.contact?.email || lead.email || null,
    children: p.household?.childrenCount ?? p.children,
    towbar: p.towbar,
    decidesWith: p.household?.decidesWith,
    desiredRate: lead.desiredRate ?? lead.wish?.desiredRate,
  };
}

console.log('\n===== VARIANT B: Phone golden dump auf leerem Lead mit Name voraus =====');
{
  let lead = emptyLead('lead-var-b', 'Familie Müller');
  let memory = createEmptyAgentWorkingMemory();
  const dump = 'EV2 Air, EV3 Earth weiß, EV5 Elite schwarz — AHK, max 350 €, 2 Kinder, entscheidet mit Frau. 48 Monate, 15.000 km, 0 € AZ.';
  const turn = runCleverSellerTurn({
    lead,
    sellerInput: dump,
    workingMemory: memory,
    conversationHistory: [],
    scopeHint: 'akte',
    env: ENV,
  });
  const policy = resolveSellerResponsePolicy(turn);
  memory = updateMemoryFromSellerTurn(memory, turn, dump, policy);
  console.log({
    ok: turn.ok,
    remember: turn.rememberDecision?.mode,
    policy: policy.kind,
    captureNextStep: turn.captureNextStep || policy.nextStep || null,
    intents: (turn.intents || []).map((i) => i.type),
    facts: (turn.extractedFacts || []).map((f) => `${f.field}=${f.label}`),
    prepareOffer: (turn.preparedActions || []).some((a) => a.type === SELLER_TURN_INTENTS.PREPARE_OFFER),
  });

  const applied = applyAcceptedSellerTurn(lead, turn, { postFeedCard: false });
  lead = applied.lead || applyStructuredFactsToLead(lead, turn.extractedFacts || []);
  console.log('after apply', { soft: softOf(lead), tracks: tracksOf(lead) });

  const batch = runCleverSellerTurn({
    lead,
    sellerInput: 'mach die 3 Angebote',
    workingMemory: memory,
    conversationHistory: getConversationHistoryForAgent(memory),
    scopeHint: 'akte',
    env: ENV,
  });
  const batchAction = (batch.preparedActions || []).find((a) => a.payload?.batch);
  console.log('batch', {
    policy: resolveSellerResponsePolicy(batch).kind,
    trackIds: batchAction?.payload?.trackIds?.length,
    monthlyRate: batchAction?.payload?.monthlyRate ?? null,
    name: softOf(lead).name,
  });
  const accepted = applyAcceptedSellerTurn(lead, { ...batch, extractedFacts: [] }, { postFeedCard: false });
  console.log('orders', (accepted.lead?.crm?.openOfferOrders || []).filter((o) => o.source === 'seller_batch_offers').length);
  console.log('name after', softOf(accepted.lead || lead).name);
}

console.log('\n===== VARIANT C: Strukturierter Inbound (Dashboard, leerer Lead) =====');
{
  const inbound = [
    'Hier eine Anfrage:',
    'Name: Familie Müller',
    'E-Mail: mueller@familie.example',
    'EV2 Air',
    'EV3 Earth weiß',
    'EV5 Elite schwarz',
    '2 Kinder, AHK, max 350 €, entscheidet mit Frau',
    '48 Monate, 15.000 km, 0 € AZ',
  ].join('\n');

  const turn = runCleverSellerTurn({
    lead: {},
    sellerInput: inbound,
    leadsSnapshot: [],
    scopeHint: 'dashboard',
    env: ENV,
  });
  const review = turn.reviewModel || buildUniversalReviewModel(turn);
  console.log({
    ok: turn.ok,
    inboundDetected: turn.inboundLead?.detected,
    proposeCreate: turn.inboundLead?.proposeCreateCustomer,
    contactName: turn.inboundLead?.contact?.fullName,
    contactEmail: turn.inboundLead?.contact?.email,
    reviewType: review?.reviewType,
    hero: review?.hero?.name,
    facts: (turn.extractedFacts || []).map((f) => `${f.field}=${f.label}`).slice(0, 20),
    intents: (turn.intents || []).map((i) => i.type),
  });

  const applied = applyAcceptedSellerTurn({}, turn, {
    postFeedCard: false,
    allowCreateCustomer: true,
  });
  console.log('created', {
    ok: applied.ok,
    created: applied.created,
    id: applied.lead?.id,
    name: applied.lead?.contact?.name || applied.lead?.name,
    email: applied.lead?.contact?.email,
    tracks: tracksOf(applied.lead || {}),
    soft: softOf(applied.lead || {}),
  });

  if (applied.ok && applied.lead?.id) {
    const batch = runCleverSellerTurn({
      lead: applied.lead,
      sellerInput: 'mach die 3 Angebote',
      scopeHint: 'akte',
      env: ENV,
    });
    const batchAction = (batch.preparedActions || []).find((a) => a.payload?.batch);
    const accepted = applyAcceptedSellerTurn(applied.lead, { ...batch, extractedFacts: [] }, { postFeedCard: false });
    console.log('inbound→batch', {
      tracks: batchAction?.payload?.trackIds?.length,
      orders: (accepted.lead?.crm?.openOfferOrders || []).filter((o) => o.source === 'seller_batch_offers').length,
      name: accepted.lead?.contact?.name,
      monthlyRates: (accepted.lead?.crm?.openOfferOrders || []).map((o) => o.monthlyRate ?? null),
    });
  }
}

console.log('\n===== VARIANT D: Kurz „Familie Müller“ + Dump getrennt (2 Turns) =====');
{
  let lead = emptyLead('lead-var-d');
  const t1 = runCleverSellerTurn({
    lead,
    sellerInput: 'Kunde heißt Familie Müller, Mail mueller@familie.example',
    scopeHint: 'akte',
    env: ENV,
  });
  console.log('name turn', {
    facts: (t1.extractedFacts || []).map((f) => `${f.field}=${JSON.stringify(f.value)}`),
    remember: t1.rememberDecision?.mode,
    policy: resolveSellerResponsePolicy(t1).kind,
  });
  const a1 = applyAcceptedSellerTurn(lead, t1, { postFeedCard: false });
  lead = a1.lead || applyStructuredFactsToLead(lead, t1.extractedFacts || []);
  console.log('name after t1', softOf(lead));

  const dump = 'EV2 Air EV3 Earth weiß EV5 Elite schwarz — AHK, max 350, 2 Kinder, entscheidet mit Frau';
  const t2 = runCleverSellerTurn({
    lead,
    sellerInput: dump,
    scopeHint: 'akte',
    env: ENV,
  });
  console.log('dump turn', {
    remember: t2.rememberDecision?.mode,
    policy: resolveSellerResponsePolicy(t2).kind,
    next: t2.captureNextStep || resolveSellerResponsePolicy(t2).nextStep || null,
    facts: (t2.extractedFacts || []).map((f) => f.field),
  });
  const a2 = applyAcceptedSellerTurn(lead, t2, { postFeedCard: false });
  lead = a2.lead || applyStructuredFactsToLead(lead, t2.extractedFacts || []);
  console.log('after dump', { soft: softOf(lead), tracks: tracksOf(lead) });
}
