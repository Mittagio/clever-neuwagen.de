/**
 * Multi-Source Confirm → Apply (Mazzei)
 * node --test src/services/cleverSeller/multiSource/multiSourceApply.golden.test.js
 */
import assert from 'node:assert/strict';
import { runCleverSellerTurn } from '../runCleverSellerTurn.js';
import { buildUniversalReviewModel } from '../buildUniversalReviewModel.js';
import { applyAcceptedSellerTurn } from '../applyAcceptedSellerTurn.js';
import { listCustomerContracts } from '../../crm/customerContracts.js';
import { getTradeIn } from '../../customerAkteTradeIn.js';
import { getNeedProfileFromLead } from '../../consultation/needProfileService.js';
import { listCustomerVehicleTracks } from '../../crm/vehicleTrack.js';
import { getSellerInsightsFromLead } from '../../dealer/sellerInsights.js';
import { buildCustomerSnapshotModel } from '../../dealer/buildCustomerSnapshotModel.js';
import {
  applyConfirmedMultiSourceIntakePlan,
  buildMultiSourceIdempotencyKey,
  buildPersistableContractDraft,
} from './applyConfirmedMultiSourceIntakePlan.js';
import { buildMultiSourceApplyResultReview } from './buildMultiSourceApplyResultReview.js';
import {
  MAZZEI_CONTRACT_REDACT_TEST_EXTRACT,
  MAZZEI_SELLER_DUMP,
  buildMazzeiContractAttachment,
} from './fixtures/mazzeiContractFixture.js';
import { SENSITIVE_FIELD_BLOCKLIST } from './mergeMultiSourceIntakePlan.js';

const ENV = {
  VITE_CLEVER_SELLER_ORCHESTRATOR: 'true',
  CLEVER_SELLER_ORCHESTRATOR: 'true',
};

const MAZZEI_DUMP = [
  'TEST+ Abgleich!',
  '',
  MAZZEI_SELLER_DUMP,
].join('\n');

function runMazzeiTurn(overrides = {}) {
  return runCleverSellerTurn({
    lead: {},
    sellerInput: MAZZEI_DUMP,
    attachments: [buildMazzeiContractAttachment({
      extractedText: MAZZEI_CONTRACT_REDACT_TEST_EXTRACT,
    })],
    leadsSnapshot: [],
    scopeHint: 'dashboard',
    now: new Date('2026-08-04T12:00:00Z'),
    env: ENV,
    ...overrides,
  });
}

// --- Review allein persistiert nichts ---
{
  const turn = runMazzeiTurn();
  assert.ok(turn.multiSourceIntake?.detected);
  assert.equal(turn.autoSent, false);
  const review = turn.reviewModel || buildUniversalReviewModel(turn);
  assert.equal(review.reviewType, 'customer_contract_tradein_intake_review');

  const blocked = applyAcceptedSellerTurn({}, turn, {
    postFeedCard: false,
    allowCreateCustomer: false,
  });
  assert.equal(blocked.ok, false);
  assert.ok(!blocked.created);
  assert.ok(!blocked.lead?.id);
}

// --- Confirm Apply: Mazzei golden ---
{
  const turn = runMazzeiTurn();
  const intake = turn.multiSourceIntake;
  const applied = applyConfirmedMultiSourceIntakePlan({}, turn, {
    allowCreateCustomer: true,
    leadsSnapshot: [],
    now: new Date('2026-08-04T12:05:00Z'),
  });

  assert.equal(applied.ok, true);
  assert.ok(['completed', 'partial'].includes(applied.status));
  assert.ok(applied.operationId);
  assert.ok(applied.idempotencyKey);
  assert.equal(applied.idempotencyKey, buildMultiSourceIdempotencyKey(intake));
  assert.ok(Array.isArray(applied.orderedOperations));
  assert.ok(applied.orderedOperations.length >= 8);
  assert.ok(applied.orderedOperations.every((o) => o.status));
  assert.equal(applied.rollbackCapability, 'none');
  assert.ok(applied.created);
  assert.ok(applied.lead?.id);
  assert.match(applied.lead.contact?.name || applied.lead.name || '', /Mazzei|Sandro/i);

  // EV4 track + color/AHK
  const tracks = listCustomerVehicleTracks(applied.lead);
  assert.ok(tracks.some((t) => /ev4/i.test(t.modelLabel || t.model || t.displayName || '')));
  const profile = getNeedProfileFromLead(applied.lead);
  assert.ok(profile?.towbar || (profile?.priorities || []).includes('towing'));
  const trackReq = JSON.stringify(tracks.map((t) => t.customerRequirements || t.requirementLabels));
  assert.ok(/weiß|weiss|white/i.test(String(profile?.colorPreference || ''))
    || /weiß|weiss/i.test(trackReq)
    || /weiß|weiss/i.test(intake.currentVehicleInterest?.color || '')
    || /weiß|weiss/i.test(intake.currentVehicleInterest?.label || ''));
  assert.ok(/AHK/i.test(trackReq) || (intake.currentVehicleInterest?.requestedEquipment || []).includes('AHK'));

  // Commercial 48 / 10.000
  assert.equal(Number(applied.lead.wish?.termMonths), 48);
  assert.equal(Number(applied.lead.wish?.mileagePerYear), 10000);

  // Current household = 2 Kinder + Haus; historical 1 bleibt am Vertrag
  assert.equal(Number(profile?.household?.childrenCount), 2);
  assert.equal(profile?.household?.housingType, 'own_house');

  const contracts = listCustomerContracts(applied.lead);
  assert.equal(contracts.length, 1);
  const histChild = (contracts[0].evidence || []).find((e) => (
    e.field === 'childrenCount' && e.temporalScope === 'historical'
  ));
  assert.ok(histChild);
  assert.equal(Number(histChild.value), 1);

  // Trade-in Picanto
  const trade = getTradeIn(applied.lead);
  assert.match(trade.vehicle || '', /Picanto/i);
  assert.ok(applied.lead.crm?.existingVehicle?.tradeInCandidate);

  // Document link
  assert.ok((applied.lead.crm?.linkedSourceDocuments || []).length >= 1);

  // Offer order prepared
  assert.ok(applied.createdIds?.offerShellId
    || (applied.lead.crm?.openOfferOrders || []).length >= 1);

  // Audit activity
  assert.ok((applied.lead.crm?.activities || []).some((a) => (
    a.type === 'multi_source_intake_applied'
  )));

  // No sensitive fields in customer truth / contact
  const blob = JSON.stringify({
    contact: applied.lead.contact,
    customerTruth: applied.lead.crm?.customerTruth,
    needProfile: profile,
  });
  assert.ok(!/DE89\s*3704|L01X00T47/i.test(blob));
  for (const key of SENSITIVE_FIELD_BLOCKLIST) {
    assert.equal(applied.lead.contact?.[key], undefined);
    assert.equal(applied.lead.crm?.customerTruth?.[key], undefined);
  }

  // Result review
  const resultReview = buildMultiSourceApplyResultReview(applied, intake);
  assert.equal(resultReview.reviewType, 'multi_source_apply_result');
  assert.match(resultReview.title, /Vorgang angelegt|teilweise/i);
  assert.ok(resultReview.actionSections?.[0]?.primaryActions?.some((a) => (
    a.action === 'open_customer'
  )));
  assert.ok(resultReview.actionSections?.[0]?.primaryActions?.some((a) => (
    a.action === 'prepare_ev4_offer'
  )));

  // Soft/sellerInsights: Kundenfacts, keine Prozess-Labels
  const insightTexts = getSellerInsightsFromLead(applied.lead).map((i) => i.text);
  assert.ok(!insightTexts.some((t) => /Kunde angelegt|Angebotsauftrag vorbereitet|Kunde verknüpft|Altvertrag erfasst/i.test(t)),
    `Prozess-Labels in sellerInsights: ${insightTexts.join(' | ')}`);
  assert.ok(insightTexts.some((t) => /Kinder|Haus|Weiß|AHK|Elektro|Altes Auto/i.test(t)),
    `erwartete Kundenfacts fehlen: ${insightTexts.join(' | ')}`);
  assert.ok(!applied.acceptedLabels.some((l) => /Kunde angelegt|Angebotsauftrag vorbereitet/i.test(l)));

  const snap = buildCustomerSnapshotModel(applied.lead);
  const summaryLabels = (snap.soft?.summary?.tokens || []).map((t) => t.label);
  assert.ok(!summaryLabels.some((l) => (
    /Kunde angelegt|Angebotsauftrag vorbereitet|Kundenakte aus Multi-Source|Altvertrag erfasst/i.test(l)
  )), `Prozess in soft.summary: ${summaryLabels.join(' · ')}`);
  assert.ok(summaryLabels.some((l) => /Kinder|Haus|Weiß|Elektro|AHK/i.test(l)),
    `Kundenfacts fehlen in Summary: ${summaryLabels.join(' · ')}`);
}

// --- Idempotency: second apply does not duplicate ---
{
  const turn = runMazzeiTurn();
  const first = applyConfirmedMultiSourceIntakePlan({}, turn, {
    allowCreateCustomer: true,
    leadsSnapshot: [],
    now: new Date('2026-08-04T12:10:00Z'),
  });
  assert.ok(first.ok && first.lead?.id);

  const second = applyConfirmedMultiSourceIntakePlan(first.lead, turn, {
    allowCreateCustomer: true,
    leadsSnapshot: [first.lead],
    now: new Date('2026-08-04T12:11:00Z'),
  });
  assert.equal(second.status, 'idempotent_replay');
  assert.equal(listCustomerContracts(second.lead).length, 1);
  assert.equal(listCustomerContracts(first.lead).length, 1);
  assert.match(getTradeIn(second.lead).vehicle || '', /Picanto/i);
  // still one trade-in vehicle string, not duplicated customers
  assert.equal(second.lead.id, first.lead.id);
}

// --- Unique existing customer is linked, not recreated ---
{
  const existing = {
    id: 'lead-mazzei-existing',
    customerId: 'cust-mazzei',
    name: 'Sandro Mazzei',
    contact: { name: 'Sandro Mazzei', email: '', phone: '' },
    wish: {},
    crm: { activities: [], customerContracts: [], tradeIn: null },
  };
  const turn = runMazzeiTurn({ leadsSnapshot: [existing] });
  const applied = applyConfirmedMultiSourceIntakePlan({}, turn, {
    allowCreateCustomer: true,
    leadsSnapshot: [existing],
    now: new Date('2026-08-04T12:20:00Z'),
  });
  assert.ok(applied.ok);
  assert.equal(applied.lead.id, 'lead-mazzei-existing');
  assert.ok(!applied.created);
  assert.equal(listCustomerContracts(applied.lead).length, 1);
}

// --- Ambiguous duplicates → seller choice, no auto create ---
{
  const a = {
    id: 'lead-a',
    name: 'Sandro Mazzei',
    contact: { name: 'Sandro Mazzei' },
    crm: {},
  };
  const b = {
    id: 'lead-b',
    name: 'Sandro Mazzei',
    contact: { name: 'Sandro Mazzei' },
    crm: {},
  };
  const turn = runMazzeiTurn({ leadsSnapshot: [a, b] });
  const applied = applyConfirmedMultiSourceIntakePlan({}, turn, {
    allowCreateCustomer: true,
    leadsSnapshot: [a, b],
  });
  assert.equal(applied.ok, false);
  assert.equal(applied.status, 'needs_seller_choice');
  assert.ok(applied.needsSellerChoice?.candidates?.length >= 2);
  assert.ok(!applied.lead?.id || applied.lead.id === a.id || applied.lead.id === b.id);
  // no silent create
  assert.ok(!applied.created);
}

// --- Contract draft strips sensitive / keeps structure ---
{
  const turn = runMazzeiTurn();
  const draft = buildPersistableContractDraft(turn.multiSourceIntake);
  assert.ok(draft);
  assert.ok(draft.vehicle?.model || draft.vehicle?.label);
  assert.ok(draft.contractEndDate);
  assert.ok(!draft.iban);
  assert.ok(!draft.idNumber);
  assert.ok((draft.evidence || []).every((e) => !SENSITIVE_FIELD_BLOCKLIST.has(e.field)));
}

console.log('multiSourceApply.golden.test.js: OK');
