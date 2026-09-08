/**
 * Golden 22–24: Semantic-First OpenAI (Mock-LLM)
 *
 * Clever versteht unterschiedliche Formulierungen derselben Bedeutung.
 * node --test src/services/cleverSeller/semanticInterpret.golden.test.js
 */
import assert from 'node:assert/strict';
import { createEmptyNeedProfile, getNeedProfileFromLead } from '../consultation/needProfileService.js';
import { runCleverSellerTurnAsync } from './runCleverSellerTurn.js';
import { applyAcceptedSellerTurn } from './applyAcceptedSellerTurn.js';
import { buildSellerWorkBriefing } from './buildSellerWorkBriefing.js';
import { getOfferDraftById } from './cleverWorkingDraft.js';
import { getTradeIn } from '../customerAkteTradeIn.js';
import { SELLER_FACT_CLASS, SELLER_TURN_INTENTS } from './sellerFactTypes.js';
import { evaluateSellerInterpretEscalation } from './cleverSellerOrchestratorConfig.js';
import { mergeSellerInterpretation, aiFactNeedsConfirmation } from './mergeSellerInterpretation.js';
import { buildSellerInterpretSafeContext } from './buildSellerInterpretSafeContext.js';
import { interpretSellerInput } from './interpretSellerInput.js';

const ENV_ON = {
  CLEVER_SELLER_OPENAI_INTERPRET_ENABLED: 'true',
  OPENAI_API_KEY: 'sk-test-semantic',
  CLEVER_SELLER_ORCHESTRATOR_ENABLED: 'true',
};

function baseLead() {
  return {
    id: 'lead-semantic-g22',
    name: 'Test Kunde',
    contact: { name: 'Test Kunde' },
    crm: {
      needProfile: createEmptyNeedProfile(),
      vehicleConfigurations: [],
      vehicleOffers: {},
      sellerInsights: [],
    },
  };
}

/** Identisches semantisches Ergebnis für alle Paraphrasen (Mock-LLM). */
const PARAPHRASE_FACTS = {
  confidence: 0.96,
  intents: [{ type: SELLER_TURN_INTENTS.UPDATE_CUSTOMER_CONTEXT, confidence: 0.95 }],
  facts: [
    {
      factClass: SELLER_FACT_CLASS.VEHICLE_REQUIREMENT,
      field: 'fuelPreference',
      value: 'electric',
      label: 'Elektroauto',
      confidence: 0.98,
      evidence: 'elektro',
    },
    {
      factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
      field: 'paymentType',
      value: 'leasing',
      label: 'Leasing',
      confidence: 0.97,
      evidence: 'leasn',
    },
    {
      factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
      field: 'termMonths',
      value: 48,
      label: '48 Monate',
      confidence: 0.98,
      evidence: '4 jahre',
    },
    {
      factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
      field: 'annualMileage',
      value: 15000,
      label: '15.000 km',
      confidence: 0.97,
      evidence: '15 tausend',
    },
  ],
};

const COLOR_WHITE_FACTS = {
  confidence: 0.97,
  intents: [{ type: SELLER_TURN_INTENTS.UPDATE_CUSTOMER_CONTEXT, confidence: 0.94 }],
  facts: [
    {
      factClass: SELLER_FACT_CLASS.VEHICLE_REQUIREMENT,
      field: 'colorPreference',
      value: {
        color: 'weiß',
        targetScope: 'offer_vehicle',
      },
      label: 'Weiß',
      confidence: 0.97,
      evidence: 'weiß',
    },
  ],
};

const CONSULTATION_FACTS = {
  confidence: 0.95,
  intents: [{ type: SELLER_TURN_INTENTS.UPDATE_CUSTOMER_CONTEXT, confidence: 0.96 }],
  facts: [
    {
      factClass: SELLER_FACT_CLASS.CUSTOMER_FACT,
      field: 'childrenCount',
      value: 2,
      label: '2 Kinder',
      confidence: 0.98,
      evidence: 'zwei kinder',
    },
    {
      factClass: SELLER_FACT_CLASS.CUSTOMER_FACT,
      field: 'pet',
      value: { type: 'dog', count: 1 },
      label: '1 Hund',
      confidence: 0.97,
      evidence: 'hund',
    },
    {
      factClass: SELLER_FACT_CLASS.VEHICLE_REQUIREMENT,
      field: 'fuelPreference',
      value: 'electric',
      label: 'Elektroauto',
      confidence: 0.97,
      evidence: 'elektro auto',
    },
    {
      factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
      field: 'paymentType',
      value: 'leasing',
      label: 'Leasing',
      confidence: 0.96,
      evidence: 'leasn',
    },
    {
      factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
      field: 'termMonths',
      value: 48,
      label: '48 Monate',
      confidence: 0.97,
      evidence: 'vier jahre',
    },
    {
      factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
      field: 'annualMileage',
      value: 15000,
      label: '15.000 km',
      confidence: 0.96,
      evidence: '15 tausend',
    },
    {
      factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
      field: 'downPayment',
      value: 3000,
      label: '3.000 € Sonderzahlung',
      confidence: 0.95,
      evidence: '3000 anzalung',
    },
    {
      factClass: SELLER_FACT_CLASS.VEHICLE_REQUIREMENT,
      field: 'equipmentWish',
      value: { id: 'heat_pump', label: 'Wärmepumpe', priority: 'important' },
      label: 'Wärmepumpe · wichtig',
      confidence: 0.94,
      evidence: 'wärme pumpe',
    },
    {
      factClass: SELLER_FACT_CLASS.VEHICLE_REQUIREMENT,
      field: 'towHitchRequired',
      value: true,
      label: 'AHK wichtig',
      confidence: 0.95,
      evidence: 'ahk',
    },
    {
      factClass: SELLER_FACT_CLASS.EXISTING_VEHICLE,
      field: 'existingVehicle',
      value: { make: 'VW', model: 'Polo', color: 'schwarz' },
      label: 'VW Polo · Schwarz',
      confidence: 0.96,
      evidence: 'schwarzen vw polo',
    },
    {
      factClass: SELLER_FACT_CLASS.CUSTOMER_NEED,
      field: 'deliveryDeadline',
      value: { endDate: '2026-12', precision: 'month' },
      label: 'Geplant Dezember 2026',
      confidence: 0.93,
      evidence: 'dezember',
    },
  ],
};

function mockInterpretForParaphrase() {
  return async () => ({ ok: true, ...PARAPHRASE_FACTS });
}

function mockInterpretForColor() {
  return async () => ({ ok: true, ...COLOR_WHITE_FACTS });
}

function mockInterpretForConsultation() {
  return async () => ({ ok: true, ...CONSULTATION_FACTS });
}

function assertCommercialCore(facts) {
  assert.ok(facts.some((f) => f.field === 'fuelPreference' && f.value === 'electric'));
  assert.ok(facts.some((f) => f.field === 'paymentType' && f.value === 'leasing'));
  assert.ok(facts.some((f) => f.field === 'termMonths' && Number(f.value) === 48));
  assert.ok(facts.some((f) => f.field === 'annualMileage' && Number(f.value) === 15000));
  assert.ok(!facts.some((f) => f.field === 'vehicleInterest'));
  assert.ok(!facts.some((f) => (
    f.field === 'desiredRate' || (f.field === 'monthlyBudget' && f.source === 'openai_interpretation')
  )));
}

{
  // Gate: freier Clever-Input + Flag → semantic_first auch bei Partial Regex Success
  const interpreted = interpretSellerInput(
    'kunde will elektro leasn 4 jahre 15 tausend kilometer',
  );
  const gate = evaluateSellerInterpretEscalation(interpreted, ENV_ON, {
    sellerInput: interpreted.normalized,
  });
  assert.equal(gate.shouldEscalate, true);
  assert.equal(gate.path, 'facts');
  assert.equal(gate.reason, 'semantic_first');
  assert.equal(gate.semanticFirst, true);
  console.log('✓ Gate semantic_first trotz Partial Regex');
}

{
  // Confidence-Policy: hohe Confidence + Evidence → kein Review
  assert.equal(aiFactNeedsConfirmation({
    field: 'termMonths',
    value: 48,
    confidence: 0.96,
    evidence: 'vier Jahre',
  }), false);
  assert.equal(aiFactNeedsConfirmation({
    field: 'monthlyBudget',
    value: 350,
    confidence: 0.9,
    evidence: '350',
  }), true);
  console.log('✓ Confidence-/Review-Policy');
}

{
  // Safe Context enthält Working-State für Korrekturen
  const lead = baseLead();
  lead.crm.needProfile.colorPreference = 'schwarz';
  lead.crm.needProfile.selectedModelKey = 'ev3';
  lead.wish = { paymentType: 'leasing', termMonths: 36 };
  const ctx = buildSellerInterpretSafeContext(lead, {
    sellerInput: 'doch weiß',
    workingMemory: { currentOfferDraftId: 'draft-1', focusedVehicleTrackId: 'track-1' },
  });
  assert.equal(ctx.workingState.colorPreference, 'schwarz');
  assert.equal(ctx.workingState.modelKey, 'ev3');
  assert.equal(ctx.workingState.offerDraftId, 'draft-1');
  console.log('✓ Safe Context Working-State');
}

{
  // Golden 22 – Paraphrase / Typo Robustheit
  const variants = [
    'Der Kunde möchte ein Elektroauto leasen, vier Jahre, 15.000 Kilometer im Jahr.',
    'kunde will elektro leasn 4 jahre 15 tausend kilometer',
    'der will nen stromer für vier jahre und 15tkm',
    'elektrisch leasing 48 monate 15k im jahr',
    'Elektroauto. Leasing. Laufzeit wären vier Jahre. Fährt ca 15.000 im Jahr.',
  ];

  for (const text of variants) {
    const lead0 = baseLead();
    const turn = await runCleverSellerTurnAsync({
      lead: lead0,
      sellerInput: text,
      env: ENV_ON,
      openAiOptions: {
        apiKey: 'sk-test',
        forceEscalate: true,
        interpretImpl: mockInterpretForParaphrase(),
      },
    });
    assert.equal(turn.openaiEscalation?.used, true, text);
    assert.equal(turn.openaiEscalation?.semanticFirst, true, text);
    const facts = turn.extractedFacts || [];
    assertCommercialCore(facts);
    assert.ok(!(turn.preparedActions || []).some((a) => (
      a.type === 'prepare_offer' && a.status === 'prepared' && a.payload?.offerDraftId
    )), `kein Concept-Draft: ${text}`);
    assert.ok(
      turn.rememberDecision?.mode === 'save_with_undo'
      || turn.rememberDecision?.mode === 'partial_save_with_undo'
      || facts.every((f) => !f.needsConfirmation || f.field === 'unresolvedNote'),
      `kein globales Review nur wegen Semantik: ${text}`,
    );
  }

  // Integration: Semantic-Pfad ohne forceEscalate (Gate semantic_first)
  const turnGate = await runCleverSellerTurnAsync({
    lead: baseLead(),
    sellerInput: 'kunde will elektro leasn 4 jahre 15 tausend kilometer',
    env: ENV_ON,
    openAiOptions: {
      apiKey: 'sk-test',
      interpretImpl: mockInterpretForParaphrase(),
    },
  });
  assert.equal(turnGate.openaiEscalation?.used, true);
  assert.equal(turnGate.openaiEscalation?.reason, 'semantic_first');
  assertCommercialCore(turnGate.extractedFacts || []);

  console.log('✓ Golden 22 – Paraphrase / Typo Robustheit');
}

{
  // Golden 23 – Korrektur mit Kontext
  const variants = [
    'doch weiß',
    'nee lieber weiß',
    'ach ne, weiß wär besser',
    'mach weiß statt schwarz',
  ];

  for (const text of variants) {
    const draftEv3 = {
      offerDraftId: 'draft-ev3-1',
      vehicleTrackId: 'track-ev3-1',
      modelKey: 'ev3',
      monthlyRate: null,
      rate: null,
      vehicleIdentityDraft: {
        modelKey: 'ev3',
        model: { raw: 'EV3', canonical: 'EV3', status: 'captured' },
        color: { raw: 'schwarz', status: 'captured' },
      },
    };
    const lead0 = {
      ...baseLead(),
      id: 'lead-semantic-g23',
      wish: { paymentType: 'leasing', termMonths: 36, mileagePerYear: 10000 },
      crm: {
        needProfile: {
          ...createEmptyNeedProfile(),
          selectedModelKey: 'ev3',
          colorPreference: 'schwarz',
        },
        focusedVehicleTrackId: 'track-ev3-1',
        vehicleConfigurations: [{
          id: 'track-ev3-1',
          vehicleTrackId: 'track-ev3-1',
          modelKey: 'ev3',
          modelLabel: 'EV3',
          preferredColor: 'schwarz',
          status: 'active',
        }],
        cleverWorkingState: {
          currentOfferDraftId: 'draft-ev3-1',
          currentVehicleTrackId: 'track-ev3-1',
          offerDrafts: {
            'draft-ev3-1': draftEv3,
          },
        },
        vehicleOffers: {},
        sellerInsights: [],
      },
    };

    const draftBefore = getOfferDraftById(lead0, 'draft-ev3-1');
    assert.ok(draftBefore, 'Draft vor Turn');
    assert.match(String(draftBefore.vehicleIdentityDraft?.color?.raw || ''), /schwarz/i);

    const turn = await runCleverSellerTurnAsync({
      lead: lead0,
      sellerInput: text,
      env: ENV_ON,
      currentOfferContext: {
        offerId: 'session-offer',
        offerDraftId: 'draft-ev3-1',
        vehicleTrackId: 'track-ev3-1',
        modelKey: 'ev3',
        title: 'EV3',
      },
      workingMemory: {
        currentOfferDraftId: 'draft-ev3-1',
        focusedVehicleTrackId: 'track-ev3-1',
        currentOfferDraft: draftBefore,
      },
      openAiOptions: {
        apiKey: 'sk-test',
        interpretImpl: mockInterpretForColor(),
      },
    });

    const facts = turn.extractedFacts || [];
    const color = facts.find((f) => f.field === 'colorPreference');
    assert.ok(color, text);
    const colorVal = color.value?.color || color.value || color.label;
    assert.match(String(colorVal), /wei[sß]/i);
    assert.ok(!facts.some((f) => f.field === 'vehicleInterest'), `kein neues Interest: ${text}`);
    assert.ok(!(turn.preparedActions || []).some((a) => (
      a.type === 'prepare_offer'
      && a.status === 'prepared'
      && a.payload?.offerDraftId
      && a.payload.offerDraftId !== 'draft-ev3-1'
    )), `kein neuer Draft: ${text}`);

    const applied = applyAcceptedSellerTurn(lead0, {
      ...turn,
      extractedFacts: [...facts].reverse(),
      sellerInput: text,
    }, { postFeedCard: false });
    assert.equal(applied.ok, true);
    assert.equal(applied.lead.crm?.focusedVehicleTrackId, 'track-ev3-1');
    assert.equal(applied.lead.crm?.cleverWorkingState?.currentOfferDraftId, 'draft-ev3-1');
    const draftAfter = getOfferDraftById(applied.lead, 'draft-ev3-1');
    assert.ok(draftAfter, 'gleicher Draft nach Apply');
    assert.equal(draftAfter.monthlyRate ?? draftAfter.rate ?? null, null);
    assert.equal(draftAfter.vehicleTrackId, 'track-ev3-1');
  }

  console.log('✓ Golden 23 – Korrektur mit Kontext');
}

{
  // Golden 24 – Beratungsturn Typo/Diktat
  const text = 'kunde hat zwei kinder und hund will n elektro auto leasn vier jahre 15 tausend im jahr 3000 anzalung wichtig wärme pumpe und ahk fährt aktuell schwarzen vw polo und braucht auto im dezember';
  const NOW = '2026-09-08T10:00:00';
  const lead0 = baseLead();

  const turn = await runCleverSellerTurnAsync({
    lead: lead0,
    sellerInput: text,
    now: NOW,
    env: ENV_ON,
    openAiOptions: {
      apiKey: 'sk-test',
      interpretImpl: mockInterpretForConsultation(),
    },
  });

  assert.equal(turn.openaiEscalation?.used, true);
  const facts = turn.extractedFacts || [];
  assert.ok(facts.some((f) => f.field === 'childrenCount' && Number(f.value) === 2));
  assert.ok(facts.some((f) => f.field === 'pet' && f.value?.type === 'dog'));
  assert.ok(facts.some((f) => f.field === 'fuelPreference' && f.value === 'electric'));
  assert.ok(facts.some((f) => f.field === 'paymentType' && f.value === 'leasing'));
  assert.ok(facts.some((f) => f.field === 'termMonths' && Number(f.value) === 48));
  assert.ok(facts.some((f) => f.field === 'annualMileage' && Number(f.value) === 15000));
  assert.ok(facts.some((f) => f.field === 'downPayment' && Number(f.value) === 3000));
  assert.ok(facts.some((f) => (
    f.field === 'equipmentWish' && (f.value?.id === 'heat_pump' || /wärmepumpe/i.test(f.label || ''))
  )));
  assert.ok(facts.some((f) => f.field === 'towHitchRequired'));
  const existing = facts.find((f) => f.field === 'existingVehicle');
  assert.ok(existing);
  assert.match(String(existing.value?.model || existing.label), /Polo/i);
  assert.match(String(existing.value?.color || ''), /schwarz/i);
  assert.ok(!facts.some((f) => f.field === 'tradeInRequested'));
  assert.ok(!facts.some((f) => f.field === 'vehicleInterest'));
  assert.ok(!facts.some((f) => f.field === 'colorPreference'));
  assert.equal(facts.find((f) => f.field === 'deliveryDeadline')?.value?.endDate, '2026-12');

  const briefing = turn.workBriefing || buildSellerWorkBriefing({
    facts,
    lead: lead0,
    nextStepHint: turn.captureNextStep,
  });
  assert.match(String(briefing.sections?.customerPicture || ''), /2\s*Kinder/i);
  assert.match(String(briefing.sections?.sought || ''), /Elektro/i);
  assert.match(String(briefing.sections?.nextStep || ''), /Passende Fahrzeuge finden|Fahrzeugberatung|Elektrofahrzeuge/i);
  assert.ok(!/Angebot vorbereiten/i.test(String(briefing.sections?.nextStep || '')));

  const applied = applyAcceptedSellerTurn(lead0, {
    ...turn,
    extractedFacts: [...facts].reverse(),
    sellerInput: text,
  }, { postFeedCard: false });
  assert.equal(applied.ok, true);
  const profile = getNeedProfileFromLead(applied.lead);
  assert.equal(Number(profile?.household?.childrenCount ?? profile?.children), 2);
  assert.equal(profile?.dog, true);
  assert.equal(profile?.fuel, 'electric');
  assert.equal(applied.lead.wish?.termMonths, 48);
  assert.equal(applied.lead.wish?.mileagePerYear, 15000);
  assert.equal(applied.lead.wish?.desiredDeliveryDate, '2026-12');
  assert.equal(applied.lead.crm?.existingVehicle?.tradeInCandidate, false);
  const tradeIn = getTradeIn(applied.lead);
  assert.ok(!tradeIn?.vehicle && !/Polo/i.test(String(tradeIn?.notes || '')));
  assert.ok(!applied.lead.crm?.cleverWorkingState?.currentOfferDraftId);

  console.log('✓ Golden 24 – Beratungsturn Typo/Diktat');
}

{
  // Merge: AI-Semantik gewinnt über schwaches Regex bei gleichem Slot
  const merged = mergeSellerInterpretation(
    [{
      factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
      field: 'paymentType',
      value: 'financing',
      label: 'Finanzierung',
      confidence: 0.7,
    }],
    [{
      factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
      field: 'paymentType',
      value: 'leasing',
      label: 'Leasing',
      confidence: 0.97,
      evidence: 'leasn',
    }],
    { mode: 'semantic_first' },
  );
  const pay = merged.find((f) => f.field === 'paymentType');
  assert.equal(pay.value, 'leasing');
  assert.equal(pay.needsConfirmation, false);
  console.log('✓ Merge semantic_first Slot-Priorität');
}

console.log('semanticInterpret.golden.test.js: ok');
