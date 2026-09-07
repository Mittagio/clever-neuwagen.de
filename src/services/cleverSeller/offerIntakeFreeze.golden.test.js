/**
 * Offer Intake Freeze – Golden A–D
 * Manual + PDF refinement on the same offerDraftId.
 *
 * node --test src/services/cleverSeller/offerIntakeFreeze.golden.test.js
 */
import assert from 'node:assert/strict';
import { createEmptyNeedProfile } from '../consultation/needProfileService.js';
import { VEHICLE_TRACK_STATUS } from '../crm/vehicleTrack.js';
import {
  createEmptyAgentWorkingMemory,
  updateMemoryFromSellerTurn,
  buildSellerTurnMemoryParams,
} from '../cleverAgent/cleverAgentWorkingMemory.js';
import { resolveSellerResponsePolicy } from '../cleverAgent/cleverAssistantResponse.js';
import { applyAcceptedSellerTurn } from './applyAcceptedSellerTurn.js';
import { runCleverSellerTurn } from './runCleverSellerTurn.js';
import { SELLER_FACT_CLASS, SELLER_FACT_SOURCE, SELLER_TURN_INTENTS } from './sellerFactTypes.js';
import { getOfferDraftById } from './cleverWorkingDraft.js';
import { buildUniversalReviewModel } from './buildUniversalReviewModel.js';
import {
  mergePdfIntoActiveOfferDraft,
  mergeIdentitySlot,
} from './offerDraftIntakeMerge.js';
import { createExtractedFact } from './cleverSellerTurnResultSchema.js';

function baseLead(overrides = {}) {
  return {
    id: 'lead-intake-freeze',
    name: 'Test Kunde',
    contact: { name: 'Test Kunde' },
    paymentType: 'leasing',
    wish: {
      paymentType: 'leasing',
      termMonths: 48,
      mileagePerYear: 15000,
      downPayment: 0,
    },
    crm: {
      needProfile: createEmptyNeedProfile(),
      focusedVehicleTrackId: 'vc-ev2-air',
      vehicleConfigurations: [
        {
          id: 'vc-ev2-air',
          brand: 'Kia',
          model: 'EV2',
          modelKey: 'ev2',
          // Absichtlich vorhandenes Track-Trim – darf bei „EV2 Angebot“ NICHT einfließen
          trimLabel: 'Air',
          vehicleTrack: { status: VEHICLE_TRACK_STATUS.ACTIVE },
        },
      ],
      vehicleOffers: {},
      ...(overrides.crm || {}),
    },
    ...overrides,
  };
}

function prepOffer(turn) {
  return (turn.preparedActions || []).find((a) => a.type === SELLER_TURN_INTENTS.PREPARE_OFFER);
}

function pdfFactsForEarthOffer() {
  return [
    createExtractedFact({
      field: 'vehicleInterest',
      factClass: SELLER_FACT_CLASS.VEHICLE_INTEREST,
      source: SELLER_FACT_SOURCE.OFFER_PDF,
      label: 'Kia EV2 Earth',
      value: {
        modelKey: 'ev2',
        model: 'EV2',
        trim: 'Earth',
        fromOfferPdf: true,
      },
      confidence: 0.95,
    }),
    createExtractedFact({
      field: 'trimPreference',
      factClass: SELLER_FACT_CLASS.VEHICLE_INTEREST,
      source: SELLER_FACT_SOURCE.OFFER_PDF,
      label: 'Earth',
      value: { trim: 'Earth' },
      confidence: 0.95,
    }),
    createExtractedFact({
      field: 'colorPreference',
      factClass: SELLER_FACT_CLASS.VEHICLE_INTEREST,
      source: SELLER_FACT_SOURCE.OFFER_PDF,
      label: 'Aurora Black Pearl',
      value: { color: 'Aurora Black Pearl' },
      confidence: 0.9,
    }),
    createExtractedFact({
      field: 'powertrain',
      factClass: SELLER_FACT_CLASS.VEHICLE_REQUIREMENT,
      source: SELLER_FACT_SOURCE.OFFER_PDF,
      label: 'Long Range 61,0 kWh',
      value: { raw: 'Long Range 61,0 kWh' },
      confidence: 0.9,
    }),
    createExtractedFact({
      field: 'equipmentWish',
      factClass: SELLER_FACT_CLASS.VEHICLE_REQUIREMENT,
      source: SELLER_FACT_SOURCE.OFFER_PDF,
      label: 'Winterpaket',
      value: { label: 'Winterpaket' },
      confidence: 0.9,
    }),
    createExtractedFact({
      field: 'termMonths',
      factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
      source: SELLER_FACT_SOURCE.OFFER_PDF,
      label: '48 Monate',
      value: 48,
      confidence: 0.95,
    }),
    createExtractedFact({
      field: 'annualMileage',
      factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
      source: SELLER_FACT_SOURCE.OFFER_PDF,
      label: '15.000 km',
      value: 15000,
      confidence: 0.95,
    }),
    createExtractedFact({
      field: 'downPayment',
      factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
      source: SELLER_FACT_SOURCE.OFFER_PDF,
      label: '1.000 € AZ',
      value: 1000,
      confidence: 0.95,
    }),
    createExtractedFact({
      field: 'desiredRate',
      factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
      source: SELLER_FACT_SOURCE.OFFER_PDF,
      label: '289 €/Monat',
      value: { amount: 289 },
      confidence: 0.98,
    }),
    createExtractedFact({
      field: 'paymentType',
      factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
      source: SELLER_FACT_SOURCE.OFFER_PDF,
      label: 'Leasing',
      value: 'leasing',
      confidence: 0.95,
    }),
  ];
}

// ========== GOLDEN A: EV2 Angebot – keine Defaults ==========
{
  const lead = baseLead();
  const turn = runCleverSellerTurn({
    sellerInput: 'EV2 Angebot',
    lead,
    leads: [lead],
  });
  const action = prepOffer(turn);
  assert.ok(action, 'A: PREPARE_OFFER');
  const id = action.payload?.vehicleIdentityDraft;
  assert.equal(id?.modelKey, 'ev2');
  assert.equal(id?.model?.canonical, 'EV2');
  assert.equal(id?.trim?.status, 'open', 'A: kein Track-Trim Air');
  assert.equal(id?.trim?.raw, null);
  assert.equal(id?.color?.status, 'open');
  assert.equal(id?.powertrainVariant?.status, 'open');
  assert.deepEqual(id?.packages || [], []);
  assert.equal(action.payload?.monthlyRate ?? action.payload?.offerDraft?.rate ?? null, null);
  assert.ok(action.payload?.offerDraftId, 'A: offerDraftId');
  console.log('✓ Golden A – EV2 Konzept ohne Defaults');
}

// ========== GOLDEN A2: EV2 Angebot trotz offenem Fremd-Angebot → Concept, kein updateOnly ==========
{
  const lead = baseLead({
    crm: {
      needProfile: createEmptyNeedProfile(),
      focusedVehicleTrackId: 'vc-ev3',
      vehicleConfigurations: [
        {
          id: 'vc-ev3',
          brand: 'Kia',
          model: 'EV3',
          modelKey: 'ev3',
          trimLabel: 'Earth',
          vehicleTrack: { status: VEHICLE_TRACK_STATUS.ACTIVE },
        },
      ],
      vehicleOffers: {
        'vo-ev3': {
          id: 'vo-ev3',
          vehicleCardId: 'vc-ev3',
          monthlyRate: 438.59,
        },
      },
    },
  });
  const turn = runCleverSellerTurn({
    sellerInput: 'EV2 Angebot',
    lead,
    leads: [lead],
    currentOfferContext: {
      offerId: 'vo-ev3',
      title: 'EV3 Earth',
      modelKey: 'ev3',
      vehicleTrackId: 'vc-ev3',
      summary: 'EV3 Earth · 36 M',
      monthlyRate: 438.59,
    },
  });
  const action = prepOffer(turn);
  assert.ok(action, 'A2: PREPARE_OFFER');
  assert.notEqual(action.payload?.updateOnly, true, 'A2: kein updateOnly am EV3');
  assert.ok(action.payload?.offerDraftId, 'A2: neues Concept offerDraftId');
  assert.equal(action.payload?.vehicleIdentityDraft?.modelKey, 'ev2');
  const review = buildUniversalReviewModel(turn);
  assert.ok(
    (review.actionSections || []).some((s) => s.kind === 'offer_incomplete' || s.kind === 'offer_prepare'),
    'A2: Offer-Sektion statt nur Interesse',
  );
  assert.ok(!review.understandingFactReview, 'A2: kein Interest-only Fallback');
  console.log('✓ Golden A2 – Concept trotz offenem Fremd-Angebot');
}

// ========== GOLDEN B: Manual Refinement gleicher Draft ==========
{
  let lead = baseLead();
  let memory = createEmptyAgentWorkingMemory();
  const t1 = runCleverSellerTurn({
    sellerInput: 'EV2 Angebot',
    lead,
    leads: [lead],
  });
  const a1 = prepOffer(t1);
  const offerDraftId = a1.payload.offerDraftId;
  const vehicleIdentityDraftId = a1.payload.vehicleIdentityDraftId;
  lead = applyAcceptedSellerTurn(lead, t1, { postFeedCard: false }).lead;
  memory = updateMemoryFromSellerTurn(
    memory,
    t1,
    'EV2 Angebot',
    resolveSellerResponsePolicy(t1),
  );

  const t2 = runCleverSellerTurn({
    sellerInput: 'Earth Long Range schwarz Winterpaket',
    lead,
    leads: [lead],
    ...buildSellerTurnMemoryParams(memory, lead),
  });
  const a2 = prepOffer(t2);
  assert.ok(a2, 'B: Follow-up Action');
  assert.equal(a2.payload?.offerDraftId, offerDraftId, 'B: gleicher offerDraftId');
  assert.equal(
    a2.payload?.vehicleIdentityDraftId || a2.payload?.vehicleIdentityDraft?.id,
    vehicleIdentityDraftId,
    'B: gleiche vehicleIdentityDraftId',
  );
  const id = a2.payload.vehicleIdentityDraft;
  assert.equal(String(id?.trim?.canonical || id?.trim?.raw), 'Earth');
  assert.ok(/schwarz/i.test(String(id?.color?.raw || '')), 'B: schwarz');
  assert.ok(
    (id?.packages || []).some((p) => /winter/i.test(p.raw || p.canonical || '')),
    'B: Winterpaket',
  );
  assert.ok(
    /long\s*range/i.test(String(id?.powertrainVariant?.raw || '')),
    'B: Long Range',
  );

  lead = applyAcceptedSellerTurn(lead, t2, { postFeedCard: false }).lead;
  const stored = getOfferDraftById(lead, offerDraftId);
  assert.equal(stored?.offerDraftId, offerDraftId);
  assert.equal(String(stored?.vehicleIdentityDraft?.trim?.canonical), 'Earth');
  console.log('✓ Golden B – Manual Refinement gleicher Draft');
}

// ========== GOLDEN C: PDF Merge gleicher Draft ==========
{
  let lead = baseLead();
  let memory = createEmptyAgentWorkingMemory();
  const t1 = runCleverSellerTurn({
    sellerInput: 'EV2 Angebot',
    lead,
    leads: [lead],
  });
  const a1 = prepOffer(t1);
  const offerDraftId = a1.payload.offerDraftId;
  const vehicleIdentityDraftId = a1.payload.vehicleIdentityDraftId;
  lead = applyAcceptedSellerTurn(lead, t1, { postFeedCard: false }).lead;
  memory = updateMemoryFromSellerTurn(
    memory,
    t1,
    'EV2 Angebot',
    resolveSellerResponsePolicy(t1),
  );

  const merged = mergePdfIntoActiveOfferDraft({
    lead,
    workingMemory: {
      ...memory,
      currentOfferDraftId: offerDraftId,
      previousOfferPreparation: { offerDraftId },
    },
    facts: pdfFactsForEarthOffer(),
    sellerInput: 'PDF: EV2 Leasing.pdf',
  });
  assert.equal(merged.ok, true);
  assert.equal(merged.mutation.offerDraft.offerDraftId, offerDraftId);
  assert.equal(merged.mutation.vehicleIdentityDraft.id, vehicleIdentityDraftId);
  assert.equal(merged.conflicts.length, 0, 'C: keine Konflikte bei leeren Slots');
  const id = merged.mutation.vehicleIdentityDraft;
  assert.equal(String(id.trim?.canonical || id.trim?.raw), 'Earth');
  assert.ok(/aurora|schwarz|black/i.test(String(id.color?.raw || '')), 'C: Farbe aus PDF');
  assert.ok(/long\s*range|61/i.test(String(id.powertrainVariant?.raw || '')), 'C: Powertrain');
  assert.ok(
    (id.packages || []).some((p) => /winter/i.test(p.raw || '')),
    'C: Winterpaket aus PDF',
  );
  assert.equal(merged.rate, 289);
  assert.equal(merged.commercial.termMonths, 48);
  assert.equal(merged.commercial.annualMileage, 15000);
  assert.equal(merged.commercial.downPayment, 1000);
  console.log('✓ Golden C – PDF Merge gleicher Draft');
}

// ========== GOLDEN D: Trim-Konflikt nicht still überschreiben ==========
{
  let lead = baseLead();
  const t1 = runCleverSellerTurn({
    sellerInput: 'EV2 Angebot',
    lead,
    leads: [lead],
  });
  lead = applyAcceptedSellerTurn(lead, t1, { postFeedCard: false }).lead;
  const offerDraftId = prepOffer(t1).payload.offerDraftId;

  // Manuell Air setzen
  const tAir = runCleverSellerTurn({
    sellerInput: 'Air',
    lead,
    leads: [lead],
    workingMemory: {
      currentOfferDraftId: offerDraftId,
      previousOfferPreparation: { offerDraftId },
    },
  });
  lead = applyAcceptedSellerTurn(lead, tAir, { postFeedCard: false }).lead;
  const before = getOfferDraftById(lead, offerDraftId);
  assert.equal(String(before?.vehicleIdentityDraft?.trim?.canonical), 'Air');

  const merged = mergePdfIntoActiveOfferDraft({
    lead,
    workingMemory: { currentOfferDraftId: offerDraftId },
    facts: pdfFactsForEarthOffer(),
    sellerInput: 'PDF Earth',
  });
  assert.equal(merged.ok, true);
  assert.equal(merged.mutation.offerDraft.offerDraftId, offerDraftId);
  assert.equal(
    String(merged.mutation.vehicleIdentityDraft.trim?.canonical),
    'Air',
    'D: Trim bleibt Air',
  );
  const trimConflict = merged.conflicts.find((c) => c.field === 'trim');
  assert.ok(trimConflict, 'D: Trim-Konflikt');
  assert.equal(trimConflict.draftValue, 'Air');
  assert.equal(String(trimConflict.pdfValue), 'Earth');
  // Sichere PDF-Werte trotzdem übernommen
  assert.equal(merged.rate, 289, 'D: Rate trotz Trim-Konflikt');
  assert.ok(
    (merged.mutation.vehicleIdentityDraft.packages || []).some((p) => /winter/i.test(p.raw || '')),
    'D: Winterpaket trotz Trim-Konflikt',
  );
  console.log('✓ Golden D – Trim-Konflikt ohne stille Mutation');
}

// Slot helper smoke
{
  const empty = mergeIdentitySlot({
    existingSlot: { raw: null, canonical: null, status: 'open' },
    incomingRaw: 'Earth',
    field: 'trim',
  });
  assert.equal(empty.filled, true);
  assert.equal(empty.conflict, null);

  const conflict = mergeIdentitySlot({
    existingSlot: { raw: 'Air', canonical: 'Air', status: 'captured' },
    incomingRaw: 'Earth',
    field: 'trim',
  });
  assert.ok(conflict.conflict);
  console.log('✓ Slot merge helper');
}

console.log('offerIntakeFreeze.golden.test.js: ok');
