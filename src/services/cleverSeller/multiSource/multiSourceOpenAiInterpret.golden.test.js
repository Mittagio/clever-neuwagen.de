/**
 * Multi-Source OpenAI Interpret – gemockt, kein Live-Call
 * node --test src/services/cleverSeller/multiSource/multiSourceOpenAiInterpret.golden.test.js
 */
import assert from 'node:assert/strict';
import {
  evaluateComplexSellerTurn,
  shouldUseSemanticInterpreter,
} from './evaluateComplexSellerTurn.js';
import { interpretMultiSourceWithOpenAi } from './interpretMultiSourceWithOpenAi.js';
import { mergeMultiSourceIntakePlan } from './mergeMultiSourceIntakePlan.js';
import { extractMinimalContractContext } from './extractMinimalContractContext.js';
import { buildMultiSourceIntake, shouldBuildMultiSourceIntake } from './buildMultiSourceIntake.js';
import { runCleverSellerTurnAsync } from '../runCleverSellerTurn.js';
import { evaluateSellerInterpretEscalation } from '../cleverSellerOrchestratorConfig.js';
import {
  buildUniversalReviewModel,
  shouldShowUniversalReview,
} from '../buildUniversalReviewModel.js';
import { applyAcceptedSellerTurn } from '../applyAcceptedSellerTurn.js';
import { interpretSellerInput } from '../interpretSellerInput.js';
import {
  extractPurchasePriceUnitAware,
  parseTermAndMileageShorthand,
} from '../normalizeSellerUnits.js';
import {
  extractTradeInCandidates,
  isSecondVehicleInterestCue,
} from '../detectTradeInFromSellerInput.js';
import {
  MAZZEI_CONTRACT_REDACT_TEST_EXTRACT,
  MAZZEI_SELLER_DUMP,
  buildMazzeiContractAttachment,
} from './fixtures/mazzeiContractFixture.js';

const MAZZEI_DUMP = MAZZEI_SELLER_DUMP;
const CONTRACT_FIXTURE = MAZZEI_CONTRACT_REDACT_TEST_EXTRACT;
const ATTACHMENTS = [buildMazzeiContractAttachment({ extractedText: CONTRACT_FIXTURE })];

/** Vollständiger CleverMultiSourceIntakePlan (Mock OpenAI) */
const MOCK_PLAN = {
  turnType: 'customer_contract_tradein_intake',
  customerCandidates: [{
    fullName: 'Sandro Mazzei',
    firstName: 'Sandro',
    lastName: 'Mazzei',
    email: null,
    phone: null,
    sourceType: 'seller_input',
    confidence: 0.92,
  }],
  currentCustomerFacts: [
    {
      field: 'childrenCount',
      value: 2,
      unit: null,
      temporalScope: 'current',
      role: null,
      sourceType: 'seller_input',
      sourceId: 'seller_input',
      evidence: '2 Kinder Haus',
      confidence: 0.9,
    },
    {
      field: 'housingType',
      value: 'own_house',
      unit: null,
      temporalScope: 'current',
      role: null,
      sourceType: 'seller_input',
      sourceId: 'seller_input',
      evidence: 'Haus',
      confidence: 0.88,
    },
  ],
  historicalCustomerFacts: [{
    field: 'childrenCount',
    value: 1,
    unit: null,
    temporalScope: 'historical',
    role: null,
    sourceType: 'contract_pdf',
    sourceId: 'att-contract-1',
    evidence: 'Kinder: 1',
    confidence: 0.8,
  }],
  vehicleInterests: [{
    make: 'Kia',
    model: 'EV4',
    trim: 'Air',
    color: 'weiß',
    equipment: ['AHK'],
    role: 'desired_vehicle',
    label: 'Kia EV4 Air · weiß · AHK',
    sourceType: 'seller_input',
    sourceId: 'seller_input',
    confidence: 0.93,
  }],
  commercialScenarios: [{
    type: 'leasing',
    termMonths: 48,
    annualMileage: 10000,
    purchasePrice: null,
    sourceType: 'seller_input',
    sourceId: 'seller_input',
    confidence: 0.91,
  }],
  tradeInCandidates: [{
    make: 'Kia',
    model: 'Picanto',
    label: 'Kia Picanto',
    role: 'trade_in_vehicle',
    ambiguous: false,
    sourceType: 'seller_input',
    sourceId: 'seller_input',
    confidence: 0.94,
  }],
  historicalContracts: [{
    kind: 'three_way',
    vehicleMake: 'Kia',
    vehicleModel: 'Picanto',
    vehicleRole: 'historical_contract_vehicle',
    monthlyRate: 83.07,
    finalPayment: 7796.96,
    contractEndDate: '2025-11-01',
    contractStartDate: '2021-11-30',
    totalMileage: 40000,
    annualMileage: null,
    excessMileageRate: 0.05,
    underMileageRate: 0.03,
    temporalStatusHint: 'historical_or_ended',
    sourceType: 'contract_pdf',
    sourceId: 'att-contract-1',
    confidence: 0.9,
  }],
  documentClassifications: [{
    kind: 'financing_contract',
    label: '3-Wege-Finanzierung',
    sourceId: 'att-contract-1',
    confidence: 0.87,
  }],
  conflicts: [{
    id: 'children_count_temporal',
    field: 'childrenCount',
    label: 'Im Altvertrag 1 Kind, aktuell 2 Kinder.',
    suggestedAction: 'prefer_current',
  }],
  ambiguities: [],
  missingInformation: [{
    id: 'customer_contact',
    field: 'email',
    label: 'E-Mail/Telefon für Kundenakte',
  }],
  proposedActions: [
    { type: 'find_customer', label: 'Kunde suchen', priority: 1 },
    { type: 'prepare_customer_creation', label: 'Kundenakte vorbereiten', priority: 2 },
    { type: 'import_historical_contract', label: 'Altvertrag übernehmen', priority: 3 },
    { type: 'prepare_trade_in', label: 'Inzahlungnahme vorbereiten', priority: 4 },
    { type: 'create_vehicle_interest', label: 'Fahrzeugwunsch übernehmen', priority: 5 },
    { type: 'create_commercial_scenario', label: 'Konditionen übernehmen', priority: 6 },
    { type: 'update_current_customer_facts', label: 'Aktuelle Angaben übernehmen', priority: 7 },
    { type: 'prepare_offer', label: 'Angebot vorbereiten', priority: 8 },
  ],
  evidence: [{
    id: 'ev_term',
    sourceType: 'seller_input',
    sourceId: 'seller_input',
    field: 'annualMileage',
    snippet: '48 10.000 km',
  }],
  confidence: 0.9,
};

// --- Complexity router + shouldUseSemanticInterpreter ---
{
  const complex = evaluateComplexSellerTurn({
    sellerInput: MAZZEI_DUMP,
    attachments: ATTACHMENTS,
  });
  assert.equal(complex.isComplex, true);
  assert.equal(complex.path, 'multi_source');
  assert.ok(complex.complexityReasons.includes('attachment'));
  assert.ok(complex.complexityReasons.includes('trade_in'));
  assert.ok(
    complex.complexityReasons.includes('customer_candidate')
    || complex.complexityReasons.includes('multi_intent')
    || complex.complexityReasons.includes('historical_contract'),
  );
  assert.ok(shouldBuildMultiSourceIntake({
    sellerInput: MAZZEI_DUMP,
    attachments: ATTACHMENTS,
  }));
  assert.equal(
    shouldUseSemanticInterpreter({
      sellerInput: MAZZEI_DUMP,
      attachments: ATTACHMENTS,
    }).use,
    true,
  );
  assert.equal(
    shouldUseSemanticInterpreter({ sellerInput: 'Was liegt heute an?' }).use,
    false,
  );
  assert.equal(
    shouldUseSemanticInterpreter({ sellerInput: 'XCeed Anhängelast?' }).use,
    false,
  );
}

// --- Minimal contract context: no IBAN to model ---
{
  const ctx = extractMinimalContractContext({
    document: ATTACHMENTS[0],
    requestedPurpose: 'customer_contract_tradein_intake',
    now: new Date('2026-08-04T12:00:00Z'),
  });
  assert.ok(ctx.ok);
  assert.ok(['minimized_text', 'structured_extract'].includes(ctx.attachmentContextMode));
  assert.ok(!/DE89 3704/i.test(ctx.minimizedText));
  assert.ok(!/L01X00T47/i.test(ctx.minimizedText));
  assert.ok(ctx.redacted.includes('IBAN') || ctx.redacted.includes('Ausweis'));
  assert.equal(ctx.structured?.vehicleModel, 'Picanto');
  assert.ok(ctx.originalLinked);
}

// --- Merge: AI plan primary; Picanto not interest; status local ---
{
  const baseline = buildMultiSourceIntake({
    sellerInput: MAZZEI_DUMP,
    attachments: ATTACHMENTS,
    now: new Date('2026-08-04T12:00:00Z'),
  });
  const merged = mergeMultiSourceIntakePlan(MOCK_PLAN, baseline, {
    sellerInput: MAZZEI_DUMP,
    now: new Date('2026-08-04T12:00:00Z'),
  });
  assert.equal(merged.ok, true);
  assert.equal(merged.schemaValid, true);
  assert.match(merged.intake.resolvedCustomerCandidate?.fullName || '', /Mazzei|Sandro/i);
  assert.match(merged.intake.currentVehicleInterest?.label || '', /EV4/i);
  assert.match(merged.intake.currentVehicleInterest?.color || '', /weiß|weiss/i);
  assert.ok((merged.intake.currentVehicleInterest?.requestedEquipment || []).includes('AHK'));
  assert.equal(merged.intake.commercialScenario?.termMonths, 48);
  assert.equal(merged.intake.commercialScenario?.annualMileage, 10000);
  assert.equal(merged.intake.commercialScenario?.purchasePrice ?? null, null);
  assert.match(merged.intake.tradeInCandidate?.label || '', /Picanto/i);
  assert.ok(!/Picanto/i.test(merged.intake.currentVehicleInterest?.label || ''));
  assert.equal(merged.intake.historicalContract?.status, 'historical_or_ended');
  assert.equal(merged.intake.historicalContract?.monthlyRate, 83.07);
  assert.equal(merged.intake.historicalContract?.finalPayment, 7796.96);
  assert.equal(merged.intake.historicalContract?.totalMileage, 40000);
  assert.equal(merged.intake.historicalContract?.vehicleRole, 'historical_contract_vehicle');
  assert.equal(merged.intake.currentHouseholdFacts?.childrenCount, 2);
  assert.ok(merged.intake.conflicts?.some((c) => c.field === 'childrenCount'));
  assert.ok((merged.intake.preparedActions || []).some((a) => a.id === 'import_historical_contract'));
  assert.ok((merged.intake.preparedActions || []).every((a) => a.mutatesCustomer === false));
  assert.ok(!JSON.stringify(merged.intake).includes('DE89 3704'));
}

// --- Mocked OpenAI interpret ---
{
  const createResponse = async () => ({
    parsed: MOCK_PLAN,
    responseId: 'resp_mock_ms_1',
  });
  const result = await interpretMultiSourceWithOpenAi(
    { sellerInput: MAZZEI_DUMP, attachmentExcerpts: [] },
    {
      createResponse,
      apiKey: 'sk-test',
      sellerInput: MAZZEI_DUMP,
      attachments: ATTACHMENTS,
      now: new Date('2026-08-04T12:00:00Z'),
    },
  );
  assert.equal(result.ok, true);
  assert.equal(result.interpreterSource, 'openai');
  assert.equal(result.responseId, 'resp_mock_ms_1');
  assert.ok(['minimized_text', 'structured_extract'].includes(result.attachmentContextMode));
  assert.equal(result.attachmentCount, 1);
  assert.equal(result.schemaValid, true);
  assert.ok(result.intake?.detected);
  assert.match(result.intake.currentVehicleInterest?.label || '', /EV4/i);
}

// --- Full async turn golden ---
{
  const turnOk = await runCleverSellerTurnAsync({
    lead: {},
    sellerInput: MAZZEI_DUMP,
    attachments: ATTACHMENTS,
    now: new Date('2026-08-04T12:00:00Z'),
    env: {
      CLEVER_SELLER_ORCHESTRATOR_ENABLED: 'true',
      CLEVER_SELLER_OPENAI_INTERPRET_ENABLED: 'true',
      OPENAI_API_KEY: 'sk-test',
    },
    openAiOptions: {
      apiKey: 'sk-test',
      createResponse: async () => ({ parsed: MOCK_PLAN, responseId: 'resp_turn_ok' }),
    },
  });
  assert.equal(turnOk.interpreterDiagnostics?.interpreterSource, 'openai');
  assert.equal(turnOk.interpreterDiagnostics?.used, true);
  assert.equal(turnOk.interpreterDiagnostics?.responseId, 'resp_turn_ok');
  assert.equal(turnOk.interpreterDiagnostics?.attachmentCount, 1);
  assert.ok(['minimized_text', 'structured_extract'].includes(
    turnOk.interpreterDiagnostics?.attachmentContextMode,
  ));
  assert.equal(turnOk.interpreterDiagnostics?.schemaValid, true);
  assert.ok(Array.isArray(turnOk.interpreterDiagnostics?.complexityReasons));
  assert.ok(turnOk.interpreterDiagnostics.complexityReasons.length >= 1);
  assert.equal(turnOk.interpreterDiagnostics?.fallbackReason, null);
  assert.ok(!JSON.stringify(turnOk.interpreterDiagnostics).includes('Mazzei'));
  assert.ok(!JSON.stringify(turnOk.interpreterDiagnostics).includes('DE89'));

  assert.equal(shouldShowUniversalReview(turnOk), true);
  const review = turnOk.reviewModel || buildUniversalReviewModel(turnOk);
  assert.equal(review.reviewType, 'customer_contract_tradein_intake_review');
  assert.match(review.title || '', /Beratungsfall|Abgleich|Multi/i);
  assert.match(review.hero?.name || '', /Sandro|Mazzei/i);
  assert.ok(!/DE89 3704|L01X00T47/i.test(JSON.stringify(review.groups || [])));

  const intake = turnOk.multiSourceIntake;
  assert.match(intake.resolvedCustomerCandidate?.fullName || '', /Sandro|Mazzei/i);
  assert.match(String(intake.currentVehicleInterest?.model || ''), /EV4/i);
  assert.ok((intake.currentVehicleInterest?.requestedEquipment || []).includes('AHK'));
  assert.match(intake.currentVehicleInterest?.label || '', /AHK/i);
  assert.equal(intake.commercialScenario?.annualMileage, 10000);
  assert.ok(!intake.commercialScenario?.purchasePrice);
  assert.match(intake.tradeInCandidate?.label || '', /Picanto/i);
  assert.equal(intake.historicalContract?.status, 'historical_or_ended');

  const customerGroup = (review.groups || []).find((g) => g.id === 'customer');
  const wishGroup = (review.groups || []).find((g) => g.id === 'wish');
  assert.match(customerGroup?.line || '', /Sandro|Mazzei/i);
  assert.match(wishGroup?.line || '', /AHK/i);
  assert.ok((review.progressLines || []).length <= 2);
  assert.ok((review.progressLines || []).some((l) => /Dokument zusammengeführt/i.test(l)));
  const primary = review.actionSections?.[0]?.primaryActions || [];
  assert.equal(primary[0]?.action, 'accept_multi_source_intake');
  assert.ok(primary.some((a) => /GW.*Picanto.*erfassen/i.test(a.label || '')));

  assert.equal(turnOk.autoSent, false);
  const applied = applyAcceptedSellerTurn({}, turnOk, {
    postFeedCard: false,
    allowCreateCustomer: false,
  });
  assert.ok(applied);
}

// Merge-Safety: Name/AHK aus Dump, auch wenn AI sie weglässt
{
  const baseline = buildMultiSourceIntake({
    sellerInput: MAZZEI_DUMP,
    attachments: ATTACHMENTS,
    facts: interpretSellerInput(MAZZEI_DUMP).facts,
    now: new Date('2026-08-04T12:00:00Z'),
  });
  const thinPlan = {
    ...MOCK_PLAN,
    customerCandidates: [],
    vehicleInterests: [{
      make: 'Kia',
      model: 'EV4',
      trim: 'Air',
      color: 'weiß',
      equipment: [],
      role: 'desired_vehicle',
      label: 'Kia EV4 Air · weiß',
      sourceType: 'seller_input',
      confidence: 0.9,
    }],
  };
  const merged = mergeMultiSourceIntakePlan(thinPlan, baseline, {
    sellerInput: MAZZEI_DUMP,
    now: new Date('2026-08-04T12:00:00Z'),
  });
  assert.match(merged.intake.resolvedCustomerCandidate?.fullName || '', /Sandro|Mazzei/i);
  assert.ok((merged.intake.currentVehicleInterest?.requestedEquipment || []).includes('AHK'));
  assert.match(merged.intake.currentVehicleInterest?.label || '', /AHK/i);
  const review = buildUniversalReviewModel({
    multiSourceIntake: merged.intake,
    interpreterDiagnostics: { attachmentCount: 1 },
  });
  assert.match((review.groups || []).find((g) => g.id === 'customer')?.line || '', /Sandro|Mazzei/i);
  assert.match((review.groups || []).find((g) => g.id === 'wish')?.line || '', /AHK/i);
}

// --- Flag aus → deterministic ---
{
  const gate = evaluateSellerInterpretEscalation({
    sellerInput: MAZZEI_DUMP,
    facts: [{ field: 'vehicleInterest' }],
    intents: [{ type: 'update_customer_context' }],
  }, {}, { attachments: ATTACHMENTS, sellerInput: MAZZEI_DUMP });
  assert.equal(gate.shouldEscalate, false);

  const turn = await runCleverSellerTurnAsync({
    lead: {},
    sellerInput: MAZZEI_DUMP,
    attachments: ATTACHMENTS,
    now: new Date('2026-08-04T12:00:00Z'),
    env: {
      CLEVER_SELLER_ORCHESTRATOR_ENABLED: 'true',
      CLEVER_SELLER_OPENAI_INTERPRET_ENABLED: 'false',
    },
  });
  assert.equal(turn.interpreterDiagnostics?.interpreterSource, 'deterministic');
  assert.equal(turn.openaiEscalation?.used, false);
  assert.ok(turn.multiSourceIntake?.detected);
}

// --- OpenAI fail → ehrlicher Fallback + Warning ---
{
  const turnFail = await runCleverSellerTurnAsync({
    lead: {},
    sellerInput: MAZZEI_DUMP,
    attachments: ATTACHMENTS,
    now: new Date('2026-08-04T12:00:00Z'),
    env: {
      CLEVER_SELLER_ORCHESTRATOR_ENABLED: 'true',
      CLEVER_SELLER_OPENAI_INTERPRET_ENABLED: 'true',
      OPENAI_API_KEY: 'sk-test',
    },
    openAiOptions: {
      apiKey: 'sk-test',
      createResponse: async () => {
        throw new Error('simulated_openai_down');
      },
    },
  });
  assert.equal(turnFail.interpreterDiagnostics?.interpreterSource, 'fallback');
  assert.ok(turnFail.interpreterDiagnostics?.fallbackReason);
  assert.ok(turnFail.multiSourceIntake?.detected);
  assert.ok(turnFail.warnings.some((w) => /Sprachmodell|prüfen/i.test(w)));
}

// --- Gegenproben ---
{
  assert.equal(extractPurchasePriceUnitAware('EV4 für 48.000 €')?.value, 48000);
  const shorthand = parseTermAndMileageShorthand('EV4 48 Monate 10.000 km');
  assert.equal(shorthand.termMonths, 48);
  assert.equal(shorthand.annualMileage, 10000);
  assert.equal(extractTradeInCandidates('GW Picanto').length, 1);
  assert.equal(isSecondVehicleInterestCue('Er interessiert sich auch für Picanto', 'Picanto'), true);

  // Picanto-Vertrag liegt bei → nicht als Wunsch uminterpretieren (Validator)
  const contractOnlyPlan = {
    ...MOCK_PLAN,
    vehicleInterests: [{
      make: 'Kia',
      model: 'Picanto',
      trim: null,
      color: null,
      equipment: [],
      role: 'desired_vehicle',
      label: 'Kia Picanto',
      sourceType: 'seller_input',
      sourceId: 'seller_input',
      confidence: 0.5,
    }],
    tradeInCandidates: [],
    commercialScenarios: [],
    currentCustomerFacts: [],
    historicalCustomerFacts: [],
    customerCandidates: [],
  };
  const guarded = mergeMultiSourceIntakePlan(contractOnlyPlan, {}, {
    sellerInput: 'Picanto Vertrag liegt bei',
    now: new Date('2026-08-04T12:00:00Z'),
  });
  assert.ok(!guarded.intake?.currentVehicleInterest
    || !/Picanto/i.test(guarded.intake.currentVehicleInterest?.model || ''));

  // Money≠Mileage Schutz auch wenn AI falsch liefert
  const badPricePlan = {
    ...MOCK_PLAN,
    commercialScenarios: [{
      type: 'leasing',
      termMonths: 48,
      annualMileage: null,
      purchasePrice: 10000,
      sourceType: 'seller_input',
      sourceId: 'seller_input',
      confidence: 0.4,
    }],
  };
  const priceGuard = mergeMultiSourceIntakePlan(badPricePlan, {}, {
    sellerInput: MAZZEI_DUMP,
    now: new Date('2026-08-04T12:00:00Z'),
  });
  assert.equal(priceGuard.intake?.commercialScenario?.purchasePrice ?? null, null);
  assert.equal(priceGuard.intake?.commercialScenario?.annualMileage, 10000);

  // AI lässt Household/3-Wege weg → lokale Safety aus Seller-Dump + Baseline
  const sparsePlan = {
    ...MOCK_PLAN,
    currentCustomerFacts: [],
    historicalCustomerFacts: [],
    conflicts: [],
    historicalContracts: [{
      ...MOCK_PLAN.historicalContracts[0],
      kind: 'financing',
    }],
  };
  const baselineWithFacts = buildMultiSourceIntake({
    sellerInput: MAZZEI_DUMP,
    attachments: ATTACHMENTS,
    facts: interpretSellerInput(MAZZEI_DUMP).facts,
    now: new Date('2026-08-04T12:00:00Z'),
  });
  const sparseMerged = mergeMultiSourceIntakePlan(sparsePlan, baselineWithFacts, {
    sellerInput: MAZZEI_DUMP,
    now: new Date('2026-08-04T12:00:00Z'),
  });
  assert.equal(sparseMerged.intake?.currentHouseholdFacts?.childrenCount, 2);
  assert.equal(sparseMerged.intake?.currentHouseholdFacts?.housingType, 'own_house');
  assert.ok(sparseMerged.intake?.conflicts?.some((c) => c.field === 'childrenCount'));
  assert.equal(sparseMerged.intake?.historicalContract?.contractKindId, 'financing_three_way');

  const interpGw = interpretSellerInput('GW Kia Picanto und EV4 Air');
  assert.ok(interpGw.facts.some((f) => f.field === 'tradeInVehicle'));
  assert.ok(!interpGw.facts.some((f) => (
    f.factClass === 'vehicle_interest' && /Picanto/i.test(f.label)
  )));
}

console.log('multiSourceOpenAiInterpret.golden.test.js: OK');
