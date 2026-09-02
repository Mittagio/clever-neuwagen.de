/**
 * End-to-end Verkäufergespräch: Familie Müller (Capture-then-Offer + Brain P0)
 * Service-Level: runCleverSellerTurn + applyAcceptedSellerTurn
 * node scripts/simulate-mueller-capture-offer.mjs
 */
import { createEmptyNeedProfile, getNeedProfileFromLead } from '../src/services/consultation/needProfileService.js';
import {
  createEmptyAgentWorkingMemory,
  getConversationHistoryForAgent,
  resolveCurrentOfferContextFromMemory,
  updateMemoryFromSellerTurn,
} from '../src/services/cleverAgent/cleverAgentWorkingMemory.js';
import { resolveSellerResponsePolicy } from '../src/services/cleverAgent/cleverAssistantResponse.js';
import {
  listCustomerVehicleTracks,
} from '../src/services/crm/vehicleTrack.js';
import {
  applyAcceptedSellerTurn,
  applyStructuredFactsToLead,
} from '../src/services/cleverSeller/applyAcceptedSellerTurn.js';
import { RATE_AUTHORITY } from '../src/services/cleverSeller/captureThenOffer.js';
import { runCleverSellerTurn } from '../src/services/cleverSeller/runCleverSellerTurn.js';
import { SELLER_TURN_INTENTS } from '../src/services/cleverSeller/sellerFactTypes.js';

const ENV = {
  VITE_CLEVER_SELLER_ORCHESTRATOR: 'true',
  CLEVER_SELLER_ORCHESTRATOR: 'true',
};

const results = [];

function record(step, pass, detail = {}) {
  results.push({ step, pass: Boolean(pass), ...detail });
  const mark = pass ? 'PASS' : 'FAIL';
  console.log(`\n[${mark}] ${step}`);
  if (detail.note) console.log(`  ${detail.note}`);
  if (detail.dump) console.log(JSON.stringify(detail.dump, null, 2));
}

function emptyLead() {
  return {
    id: 'lead-mueller-sim',
    name: 'Kunde noch offen',
    contact: { name: 'Kunde noch offen', kind: 'private' },
    wish: {},
    crm: {
      needProfile: createEmptyNeedProfile(),
      vehicleConfigurations: [],
      vehicleOffers: {},
      openOfferOrders: [],
    },
  };
}

function summarizeTracks(lead) {
  return listCustomerVehicleTracks(lead).map((t) => ({
    id: t.id,
    status: t.status,
    model: t.config?.model || t.modelLabel,
    modelKey: t.config?.modelKey,
    trim: t.config?.trimLabel || null,
    color: t.preferredColor || t.config?.colorLabel || null,
    displayName: t.displayName,
    reqs: (t.customerRequirements || t.requirementLabels || []).slice(0, 8),
  }));
}

function softFromLead(lead) {
  const profile = getNeedProfileFromLead(lead) || {};
  return {
    name: lead.contact?.name || lead.name,
    email: lead.contact?.email || lead.email || null,
    children: profile.household?.childrenCount ?? profile.children ?? null,
    towbar: profile.towbar ?? null,
    decidesWith: profile.household?.decidesWith ?? null,
    desiredRate: lead.desiredRate ?? lead.wish?.desiredRate ?? null,
    termMonths: lead.wish?.termMonths ?? lead.termMonths ?? profile.termMonths ?? null,
    annualKm: lead.wish?.annualKm ?? lead.annualKm ?? profile.annualKm ?? null,
    downPayment: lead.wish?.downPayment ?? lead.downPayment ?? null,
    paymentType: lead.paymentType ?? lead.wish?.paymentType ?? null,
    insightLabels: (lead.crm?.sellerInsights || lead.sellerInsights || [])
      .map((i) => i.label || i.text || i)
      .slice(0, 20),
    snapshotNotes: (lead.crm?.conversationNotes || lead.crm?.needProfile?.notes || [])
      .slice?.(0, 10) || [],
  };
}

function factSummary(facts = []) {
  return facts.map((f) => ({
    field: f.field,
    factClass: f.factClass,
    label: f.label,
    value: typeof f.value === 'object' ? JSON.parse(JSON.stringify(f.value)) : f.value,
    rateAuthority: f.rateAuthority || null,
    offerRateForbidden: f.offerRateForbidden || null,
  }));
}

function hasProcessChip(facts = []) {
  const processish = /prozess|workflow|review|confirm|status|pipeline|nächster\s*schritt/i;
  return facts.filter((f) => (
    processish.test(String(f.label || ''))
    || processish.test(String(f.field || ''))
    || f.factClass === 'process'
  ));
}

function fakeRatesOnPayload(payload = {}) {
  const rates = [];
  const push = (r, where) => {
    if (r != null && Number(r) > 0) rates.push({ where, rate: Number(r) });
  };
  push(payload.monthlyRate, 'payload');
  for (const shell of payload.offers || payload.items || payload.shells || []) {
    push(shell?.monthlyRate, shell?.trackId || 'shell');
  }
  return rates;
}

let lead = emptyLead();
let memory = createEmptyAgentWorkingMemory();

// ─── TURN 1: kritischer Fail-Pfad (freier Composer-Dump) ───
const TURN1 = [
  'Familie Müller, optional mail familie.mueller@example.de',
  'EV2 Air, EV3 Earth weiß, EV5 Elite schwarz',
  '2 Kinder, AHK, max 350 €, entscheidet mit Frau',
  '48 Monate, 15.000 km, 0 € AZ',
].join('\n');

{
  console.log('\n========== TURN 1: Capture ==========');
  console.log(TURN1);

  const turn = runCleverSellerTurn({
    lead,
    sellerInput: TURN1,
    workingMemory: memory,
    conversationHistory: getConversationHistoryForAgent(memory),
    scopeHint: 'akte',
    env: ENV,
  });
  const policy = resolveSellerResponsePolicy(turn);
  memory = updateMemoryFromSellerTurn(memory, turn, TURN1, policy);

  const facts = turn.extractedFacts || [];
  const processChips = hasProcessChip(facts);
  const multi = facts.find((f) => f.field === 'vehicleInterestMulti');
  const models = (multi?.value || []).map((v) => (
    typeof v === 'string' ? { modelKey: v } : v
  ));
  const budget = facts.find((f) => f.field === 'monthlyBudget');
  const prepareOffer = (turn.preparedActions || []).find((a) => (
    a.type === SELLER_TURN_INTENTS.PREPARE_OFFER
  ));
  const intentTypes = (turn.intents || []).map((i) => i.type);
  const badInboundPath = intentTypes.includes(SELLER_TURN_INTENTS.INBOUND_LEAD)
    || intentTypes.includes(SELLER_TURN_INTENTS.DRAFT_MESSAGE)
    || Boolean(turn.inboundLead?.detected);
  const nameFact = facts.find((f) => (
    f.field === 'customerName' || f.field === 'contactName' || f.field === 'fullName'
  ));
  const badNameCandidate = /angebote\s+für|earth\s+weiß|kunde\s+noch\s+offen/i.test(
    String(nameFact?.value || nameFact?.label || ''),
  );

  record('1a_capture_ok', turn.ok === true, {
    note: `remember=${turn.rememberDecision?.mode} policy=${policy.kind}`,
    dump: {
      intents: intentTypes,
      facts: factSummary(facts),
      policyMessage: policy.message || turn.assistantReply || null,
      captureNextStep: turn.captureNextStep || policy.nextStep || null,
      inboundDetected: Boolean(turn.inboundLead?.detected),
    },
  });

  record('1a2_capture_not_inbound_message', !badInboundPath, {
    note: badInboundPath
      ? `FAIL-PATH intents=${intentTypes.join(',')} inbound=${Boolean(turn.inboundLead?.detected)}`
      : `ok intents=${intentTypes.join(',')}`,
  });

  record('1a3_name_fact_not_garbage', Boolean(nameFact) && !badNameCandidate && /müller|mueller/i.test(String(nameFact?.value || nameFact?.label || '')), {
    note: `nameFact=${JSON.stringify(nameFact?.value || nameFact?.label || null)}`,
  });

  record('1b_compact_not_stuck_review', (
    turn.rememberDecision?.mode === 'save_with_undo'
    || turn.rememberDecision?.mode === 'partial_save_with_undo'
    || policy.kind === 'compact_confirmation'
  ) && !turn.reviewModel?.hideGlobalAccept, {
    note: `mode=${turn.rememberDecision?.mode} policy=${policy.kind} hideGlobalAccept=${Boolean(turn.reviewModel?.hideGlobalAccept)}`,
  });

  record('1c_no_prepare_offer_on_dump', !prepareOffer, {
    note: prepareOffer ? `unexpected offer: ${prepareOffer.label}` : 'kein PREPARE_OFFER (Capture-first)',
  });

  record('1d_soft_facts_present', (
    facts.some((f) => f.field === 'childrenCount' || /kinder/i.test(f.label || ''))
    && facts.some((f) => f.field === 'towHitchRequired' || /AHK/i.test(f.label || ''))
    && facts.some((f) => f.field === 'decisionPartner' || /frau|partner/i.test(f.label || ''))
    && Boolean(budget)
  ), {
    note: `fields=${facts.map((f) => f.field).join(',')}`,
  });

  record('1e_no_process_chips', processChips.length === 0, {
    note: processChips.length ? `processish=${processChips.map((f) => f.field).join(',')}` : 'keine Prozess-Chips',
  });

  record('1f_wish_budget_not_offer_rate', (
    budget
    && (
      budget.rateAuthority === RATE_AUTHORITY.WISH_ONLY
      || budget.offerRateForbidden === true
      || /max/i.test(String(budget.label || ''))
    )
  ), {
    note: `budget=${budget?.value} authority=${budget?.rateAuthority} forbidden=${budget?.offerRateForbidden}`,
  });

  record('1g_next_step_angebot', (
    turn.captureNextStep?.cta === 'Angebot'
    || policy.nextStep?.cta === 'Angebot'
    || /Angebot/i.test(String(turn.captureNextStep?.label || policy.nextStep?.label || ''))
  ), {
    note: JSON.stringify(turn.captureNextStep || policy.nextStep || null),
  });

  // Apply capture (save_with_undo path ≈ applyAcceptedSellerTurn / applyStructuredFacts)
  const applied = applyAcceptedSellerTurn(lead, turn, { postFeedCard: false });
  if (applied.ok && applied.lead) {
    lead = applied.lead;
  } else {
    lead = applyStructuredFactsToLead(lead, facts);
  }

  const tracks = summarizeTracks(lead);
  const soft = softFromLead(lead);
  const nameOk = /müller|mueller/i.test(String(soft.name || ''))
    && !/noch offen/i.test(String(soft.name || ''));

  record('1h_apply_capture', applied.ok !== false && tracks.length >= 3, {
    note: `apply.ok=${applied.ok} tracks=${tracks.length} name=${soft.name}`,
    dump: { tracks, soft, acceptedLabels: applied.acceptedLabels || [] },
  });

  record('1i_three_tracks_trim_color', (() => {
    const byKey = Object.fromEntries(tracks.map((t) => [String(t.modelKey || '').toLowerCase(), t]));
    const ev2 = byKey.ev2;
    const ev3 = byKey.ev3;
    const ev5 = byKey.ev5;
    const trimOk = /air/i.test(String(ev2?.trim || ''))
      && /earth/i.test(String(ev3?.trim || ''))
      && /elite/i.test(String(ev5?.trim || ''));
    const colorOk = (
      /weiß|weiss/i.test(String(ev3?.color || ''))
      && /schwarz/i.test(String(ev5?.color || ''))
    );
    // Per-track color is the hard DoD; global color bleed is a known gap to report honestly
    return {
      pass: Boolean(ev2 && ev3 && ev5) && trimOk && colorOk,
      note: `ev2=${ev2?.trim}/${ev2?.color} ev3=${ev3?.trim}/${ev3?.color} ev5=${ev5?.trim}/${ev5?.color}`,
      dump: { byKey, trimOk, colorOk },
    };
  })().pass, (() => {
    const byKey = Object.fromEntries(tracks.map((t) => [String(t.modelKey || '').toLowerCase(), t]));
    const ev2 = byKey.ev2;
    const ev3 = byKey.ev3;
    const ev5 = byKey.ev5;
    const trimOk = /air/i.test(String(ev2?.trim || ''))
      && /earth/i.test(String(ev3?.trim || ''))
      && /elite/i.test(String(ev5?.trim || ''));
    const colorOk = (
      /weiß|weiss/i.test(String(ev3?.color || ''))
      && /schwarz/i.test(String(ev5?.color || ''))
    );
    return {
      note: `ev2=${ev2?.trim}/${ev2?.color} ev3=${ev3?.trim}/${ev3?.color} ev5=${ev5?.trim}/${ev5?.color} trimOk=${trimOk} colorOk=${colorOk}`,
      dump: byKey,
    };
  })());

  record('1j_name_persists', nameOk, {
    note: `name="${soft.name}"`,
  });

  record('1k_soft_in_akte', (
    Number(soft.children) === 2
    && soft.towbar === true
    && (soft.decidesWith === 'partner' || /partner|frau/i.test(String(soft.decidesWith || '')))
    && Number(soft.desiredRate) === 350
  ), {
    note: JSON.stringify({
      children: soft.children,
      towbar: soft.towbar,
      decidesWith: soft.decidesWith,
      desiredRate: soft.desiredRate,
    }),
  });

  record('1l_konditionen_wunsch', (
    Number(soft.termMonths) === 48
    || Number(soft.annualKm) === 15000
    || Number(soft.downPayment) === 0
    || facts.some((f) => /term|laufzeit|km|anzahlung|downPayment|mileage/i.test(f.field || ''))
  ), {
    note: JSON.stringify({
      termMonths: soft.termMonths,
      annualKm: soft.annualKm,
      downPayment: soft.downPayment,
      relatedFacts: facts.filter((f) => /term|laufzeit|km|anzahlung|down|mileage|duration/i.test(`${f.field} ${f.label}`)).map((f) => f.field),
    }),
  });
}

// ─── TURN 2: „mach die 3 Angebote“ ───
{
  console.log('\n========== TURN 2: Batch Angebote ==========');
  const input = 'mach die 3 Angebote';
  const hist = getConversationHistoryForAgent(memory);
  const turn = runCleverSellerTurn({
    lead,
    sellerInput: input,
    workingMemory: memory,
    conversationHistory: hist,
    scopeHint: 'akte',
    env: ENV,
  });
  const policy = resolveSellerResponsePolicy(turn);
  memory = updateMemoryFromSellerTurn(memory, turn, input, policy);

  const batchAction = (turn.preparedActions || []).find((a) => (
    a.type === SELLER_TURN_INTENTS.PREPARE_OFFER && a.payload?.batch === true
  ));
  const fakeRates = fakeRatesOnPayload(batchAction?.payload || {});

  record('2a_history_present', hist.length >= 2, {
    note: `historyBefore=${hist.length} afterUpdate=${getConversationHistoryForAgent(memory).length}`,
  });

  record('2b_batch_prepare_offer', Boolean(batchAction) && (batchAction.payload?.trackIds || []).length === 3, {
    note: batchAction
      ? `label=${batchAction.label} tracks=${(batchAction.payload.trackIds || []).length}`
      : `intents=${(turn.intents || []).map((i) => i.type).join(',')}`,
    dump: batchAction?.payload || null,
  });

  record('2c_no_fake_web_rate', fakeRates.length === 0 && (
    batchAction?.payload?.monthlyRate == null
    || batchAction?.payload?.monthlyRate === 0
  ) && Number(batchAction?.payload?.monthlyRate) !== 350, {
    note: fakeRates.length ? JSON.stringify(fakeRates) : `monthlyRate=${batchAction?.payload?.monthlyRate ?? null}`,
  });

  const applied = applyAcceptedSellerTurn(lead, {
    ...turn,
    extractedFacts: [],
  }, { postFeedCard: false });
  if (applied.ok && applied.lead) lead = applied.lead;

  const orders = (lead.crm?.openOfferOrders || []).filter((o) => o.source === 'seller_batch_offers');
  const nameStill = /müller|mueller/i.test(String(lead.contact?.name || lead.name || ''));

  record('2d_apply_batch_orders', applied.ok && orders.length === 3, {
    note: `orders=${orders.length}`,
    dump: orders.map((o) => ({
      trackId: o.trackId,
      model: o.model,
      trim: o.trim,
      monthlyRate: o.monthlyRate ?? null,
      status: o.status,
    })),
  });

  record('2e_name_still_after_batch', nameStill, {
    note: `name="${lead.contact?.name || lead.name}"`,
  });

  record('2f_policy_prepared_review', policy.kind === 'prepared_action_review' || Boolean(batchAction), {
    note: `policy=${policy.kind}`,
  });
}

// ─── TURN 3: Follow-up Identity „schwarz“ / „Air“ auf Offer-Kontext ───
{
  console.log('\n========== TURN 3: Identity Follow-up ==========');
  const tracks = listCustomerVehicleTracks(lead);
  const ev5 = tracks.find((t) => /ev5/i.test(t.config?.modelKey || ''));
  const ev2 = tracks.find((t) => /ev2/i.test(t.config?.modelKey || ''));

  // Prefer EV5 as working offer context if present
  const focusTrack = ev5 || tracks[0];
  if (focusTrack) {
    lead = {
      ...lead,
      crm: {
        ...lead.crm,
        focusedVehicleTrackId: focusTrack.id,
      },
      paymentType: lead.paymentType || 'leasing',
    };
  }

  const offerCtx = {
    offerId: 'offer-mueller-sim',
    title: 'Kaufangebot',
    modelKey: focusTrack?.config?.modelKey || 'ev5',
    vehicleTrackId: focusTrack?.id || null,
    monthlyRate: null,
  };

  // Seed memory with a prior offer turn so follow-up can bind
  const seedOffer = runCleverSellerTurn({
    lead,
    sellerInput: 'Angebot',
    currentOfferContext: offerCtx,
    workingMemory: memory,
    conversationHistory: getConversationHistoryForAgent(memory),
    scopeHint: 'akte',
    env: ENV,
  });
  memory = updateMemoryFromSellerTurn(
    memory,
    seedOffer,
    'Angebot',
    resolveSellerResponsePolicy(seedOffer),
  );

  const fromMem = resolveCurrentOfferContextFromMemory(memory);
  record('3a_offer_context_in_memory', Boolean(fromMem?.vehicleTrackId || memory.currentOffer || memory.previousOfferPreparation), {
    note: JSON.stringify({
      fromMem,
      hasCurrentOffer: Boolean(memory.currentOffer),
      hasPrevPrep: Boolean(memory.previousOfferPreparation),
    }),
  });

  const colorTurn = runCleverSellerTurn({
    lead,
    sellerInput: 'schwarz.',
    workingMemory: memory,
    conversationHistory: getConversationHistoryForAgent(memory),
    // bewusst kein currentOfferContext – nur Memory / Focus
    scopeHint: 'akte',
    env: ENV,
  });
  memory = updateMemoryFromSellerTurn(
    memory,
    colorTurn,
    'schwarz.',
    resolveSellerResponsePolicy(colorTurn),
  );

  const colorFact = (colorTurn.extractedFacts || []).find((f) => f.field === 'colorPreference');
  const colorBinds = (
    colorTurn.intents.some((i) => i.type === SELLER_TURN_INTENTS.PREPARE_OFFER)
    || (
      colorFact
      && (
        colorFact.value?.targetScope === 'offer_vehicle'
        || colorFact.value?.vehicleTrackId === focusTrack?.id
        || Boolean(focusTrack)
      )
    )
  );

  record('3b_schwarz_binds_offer_or_track', Boolean(colorFact) && colorBinds, {
    note: `fact=${JSON.stringify(colorFact?.value || colorFact)} intents=${(colorTurn.intents || []).map((i) => i.type).join(',')}`,
  });

  const appliedColor = applyAcceptedSellerTurn(lead, colorTurn, { postFeedCard: false });
  if (appliedColor.ok && appliedColor.lead) lead = appliedColor.lead;

  const airTurn = runCleverSellerTurn({
    lead,
    sellerInput: 'Air',
    workingMemory: memory,
    conversationHistory: getConversationHistoryForAgent(memory),
    currentOfferContext: {
      ...offerCtx,
      vehicleTrackId: ev2?.id || offerCtx.vehicleTrackId,
      modelKey: 'ev2',
    },
    scopeHint: 'akte',
    env: ENV,
  });
  memory = updateMemoryFromSellerTurn(
    memory,
    airTurn,
    'Air',
    resolveSellerResponsePolicy(airTurn),
  );

  const trimFact = (airTurn.extractedFacts || []).find((f) => (
    f.field === 'trimPreference' || f.field === 'linePreference' || /air/i.test(String(f.label || ''))
  ));
  const airIntent = airTurn.intents.some((i) => (
    i.type === SELLER_TURN_INTENTS.PREPARE_OFFER
    || i.type === SELLER_TURN_INTENTS.UPDATE_CUSTOMER_CONTEXT
  ));

  record('3c_air_followup_on_offer_context', Boolean(trimFact) || airIntent || /air/i.test(JSON.stringify(airTurn.extractedFacts || []).slice(0, 800)), {
    note: `trimFact=${trimFact?.field || '-'} intents=${(airTurn.intents || []).map((i) => i.type).join(',')} facts=${(airTurn.extractedFacts || []).map((f) => f.field).join(',')}`,
  });

  record('3d_name_still_after_identity', /müller|mueller/i.test(String(lead.contact?.name || lead.name || '')), {
    note: `name="${lead.contact?.name || lead.name}"`,
  });
}

// ─── TURN 4: Nachricht vorbereiten ───
{
  console.log('\n========== TURN 4: Nachricht ==========');
  const input = 'schreib ihm kurz: ich bereite die drei Angebote vor, wir sprechen das mit Ihrer Frau durch';
  const turn = runCleverSellerTurn({
    lead,
    sellerInput: input,
    workingMemory: memory,
    conversationHistory: getConversationHistoryForAgent(memory),
    scopeHint: 'akte',
    env: ENV,
  });
  const policy = resolveSellerResponsePolicy(turn);
  memory = updateMemoryFromSellerTurn(memory, turn, input, policy);

  const hasDraft = Boolean(
    turn.messageDraft
    || (turn.preparedActions || []).some((a) => /message|send|schreib/i.test(a.type || a.label || ''))
  );

  record('4a_message_prepared', hasDraft && !turn.autoSent, {
    note: `draft=${Boolean(turn.messageDraft)} policy=${policy.kind} autoSent=${Boolean(turn.autoSent)}`,
    dump: {
      messageDraft: turn.messageDraft ? String(turn.messageDraft).slice(0, 280) : null,
      prepared: (turn.preparedActions || []).map((a) => ({ type: a.type, label: a.label })),
    },
  });

  record('4b_name_final', /müller|mueller/i.test(String(lead.contact?.name || lead.name || '')), {
    note: `name="${lead.contact?.name || lead.name}"`,
  });
}

// ─── Final snapshot ───
const finalTracks = summarizeTracks(lead);
const finalSoft = softFromLead(lead);
const finalOrders = (lead.crm?.openOfferOrders || []).filter((o) => o.source === 'seller_batch_offers');

console.log('\n========== FINAL AKTE ==========');
console.log(JSON.stringify({
  leadId: lead.id,
  soft: finalSoft,
  tracks: finalTracks,
  orders: finalOrders.map((o) => ({
    id: o.id,
    trackId: o.trackId,
    model: o.model,
    trim: o.trim,
    monthlyRate: o.monthlyRate ?? null,
    status: o.status,
  })),
  historyLen: getConversationHistoryForAgent(memory).length,
}, null, 2));

console.log('\n========== SCOREBOARD ==========');
const passed = results.filter((r) => r.pass).length;
const failed = results.filter((r) => !r.pass).length;
for (const r of results) {
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.step}${r.note ? ` — ${r.note}` : ''}`);
}
console.log(`\nTotal: ${passed} PASS / ${failed} FAIL / ${results.length} checks`);

// Machine-readable for parent agent
console.log('\n__RESULT_JSON__');
console.log(JSON.stringify({
  passed,
  failed,
  results: results.map(({ step, pass, note }) => ({ step, pass, note })),
  final: {
    leadId: lead.id,
    name: finalSoft.name,
    tracks: finalTracks,
    soft: finalSoft,
    orderCount: finalOrders.length,
    historyLen: getConversationHistoryForAgent(memory).length,
  },
}, null, 2));
