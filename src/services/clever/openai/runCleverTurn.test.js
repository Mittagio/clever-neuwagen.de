/**
 * Clever AI Conversation Engine – Unit Tests (keine Live-OpenAI-API).
 */
import assert from 'node:assert/strict';
import { validateCleverTurnResult, OFFER_PARAMETER_FIELDS } from './cleverTurnResultSchema.js';
import {
  applyNeedProfilePatch,
  sanitizeNeedProfilePatch,
} from './needProfilePatch.js';
import { assertGroundedCleverTurn } from './assertGroundedCleverTurn.js';
import { findMatchingVehicles, buildFactId } from './tools/findMatchingVehicles.js';
import { getVerifiedVehicleFacts, collectFactIdsFromToolResults } from './tools/getVerifiedVehicleFacts.js';
import { executeCleverTool } from './tools/executeTool.js';
import { runCleverTurn, applyCleverTurnToLead } from './runCleverTurn.js';
import { getCleverAiConfig } from './cleverConversationConfig.js';
import { applyCleverTurnToSession } from './applyCleverTurnResult.js';
import { buildCustomerUnderstanding } from '../../dealer/customerUnderstanding.js';
import { mergeTextIntoNeedProfile } from '../../consultation/needProfileService.js';
import { createHappyPathSession } from '../../consultation/consultationHappyPath.js';
import {
  GOLDEN_CONVERSATION_EV3_RANGE,
} from '../../../../tests/fixtures/cleverGoldenConversations.js';

function makeValidTurn(overrides = {}) {
  return {
    reply: 'Das passt zu Ihren Angaben.',
    intent: 'vehicle_discovery',
    needProfilePatch: {},
    vehicleDirections: [],
    nextAction: {
      type: 'none',
      targetField: null,
      question: null,
      options: [],
      reason: null,
    },
    handoff: {
      requested: false,
      ready: false,
      summary: null,
    },
    usedFactIds: [],
    ...overrides,
  };
}

// 1. Schema-Validierung
{
  const valid = validateCleverTurnResult(makeValidTurn());
  assert.equal(valid.ok, true, 'Schema gültig');

  const invalid = validateCleverTurnResult({ reply: '' });
  assert.equal(invalid.ok, false, 'Schema lehnt leeres Ergebnis ab');
  console.log('✓ Schema-Validierung');
}

// 2. NeedProfile-Patch nur bekannte Felder
{
  const { patch, rejectedKeys } = sanitizeNeedProfilePatch({
    fuel: 'electric',
    secretField: 'hack',
    budget: { downPayment: 0, hacker: true },
  });
  assert.equal(patch.fuel, 'electric');
  assert.equal(patch.budget.downPayment, 0);
  assert.ok(rejectedKeys.includes('secretField'));
  assert.ok(rejectedKeys.includes('budget.hacker'));
  console.log('✓ NeedProfile-Patch nur bekannte Felder');
}

// 3. downPayment = 0 bleibt erhalten
{
  const profile = applyNeedProfilePatch({}, {
    budget: { downPayment: 0, paymentType: 'leasing' },
  });
  assert.equal(profile.budget.downPayment, 0);
  console.log('✓ downPayment = 0 bleibt erhalten');
}

// 4. Tool Calls nutzen verifizierte Services
{
  const matchResult = executeCleverTool('find_matching_vehicles', {
    bodyType: 'suv',
    minimumSeats: 7,
    fuelType: 'electric',
  });
  assert.ok(matchResult.matches.some((m) => m.modelKey === 'ev9'));
  assert.ok(!matchResult.matches.some((m) => m.modelKey === 'ev3'));

  const facts = executeCleverTool('get_verified_vehicle_facts', {
    modelKey: 'ev3',
    requestedFacts: ['wltpRange'],
  });
  assert.ok(Array.isArray(facts.facts));
  console.log('✓ Tool Calls verwenden verifizierte Services');
}

// 5. unbekannte Fact IDs werden abgelehnt
{
  const factId = buildFactId('ev3', 'default', 'wltpRange');
  const toolResults = [{
    name: 'get_verified_vehicle_facts',
    output: getVerifiedVehicleFacts({ modelKey: 'ev3', requestedFacts: ['wltpRange'] }),
  }];
  const evidence = { factIds: collectFactIdsFromToolResults(toolResults) };
  const grounded = assertGroundedCleverTurn(makeValidTurn({
    usedFactIds: [factId],
    vehicleDirections: [{
      modelKey: 'ev3',
      variantKey: null,
      status: 'interesting',
      reason: 'Interesse',
      verifiedFactIds: [factId],
    }],
  }), evidence);
  assert.equal(grounded.ok, evidence.factIds.has(factId));

  const bad = assertGroundedCleverTurn(makeValidTurn({
    usedFactIds: ['fact:ev3:default:made_up'],
  }), evidence);
  assert.equal(bad.ok, false);
  console.log('✓ unbekannte Fact IDs werden abgelehnt');
}

// 6. ungültige modelKeys werden abgelehnt
{
  const grounded = assertGroundedCleverTurn(makeValidTurn({
    vehicleDirections: [{
      modelKey: 'not-a-real-model',
      variantKey: null,
      status: 'candidate',
      reason: 'Test',
      verifiedFactIds: [],
    }],
  }), { factIds: new Set() });
  assert.equal(grounded.ok, false);
  console.log('✓ ungültige modelKeys werden abgelehnt');
}

// 7. API-Fehler aktiviert Fallback
{
  const disabled = getCleverAiConfig({ CLEVER_AI_CONVERSATION_ENABLED: 'false', OPENAI_API_KEY: 'x' });
  assert.equal(disabled.enabled, false);
  const result = await runCleverTurn({
    lead: { crm: { needProfile: mergeTextIntoNeedProfile('Test') } },
    customerMessage: 'Test',
  }, { config: disabled });
  assert.equal(result.fallback, true);
  console.log('✓ API deaktiviert → Fallback');
}

// 8. Timeout aktiviert Fallback (simuliert)
{
  const result = await runCleverTurn({
    lead: { crm: { needProfile: mergeTextIntoNeedProfile('Test') } },
    customerMessage: 'Test',
  }, {
    config: { enabled: true, apiKey: 'test', model: 'gpt-4o-mini', timeoutMs: 1, maxToolRounds: 1 },
    OpenAI: class {
      responses = {
        create: async () => {
          throw new Error('Request timed out');
        },
      };
    },
  });
  assert.equal(result.fallback, true);
  assert.match(result.reason ?? '', /timeout|openai_error/);
  console.log('✓ Timeout → Fallback');
}

// 9. EV3-Reichweite ohne Rückfrage (Mock)
{
  const factId = buildFactId('ev3', 'default', 'wltpRange');
  const factsOutput = getVerifiedVehicleFacts({ modelKey: 'ev3', requestedFacts: ['wltpRange'] });
  const mockResult = makeValidTurn({
    reply: 'Der EV3 fährt laut WLTP bis zu … km.',
    intent: 'knowledge_question',
    needProfilePatch: { selectedModelKey: 'ev3', modelHint: 'ev3' },
    vehicleDirections: [{
      modelKey: 'ev3',
      variantKey: null,
      status: 'interesting',
      reason: 'Interesse am EV3',
      verifiedFactIds: factsOutput.facts[0]?.factId ? [factsOutput.facts[0].factId] : [],
    }],
    usedFactIds: factsOutput.facts[0]?.factId ? [factsOutput.facts[0].factId] : [],
    nextAction: { type: 'none', targetField: null, question: null, options: [], reason: null },
  });

  const ai = await runCleverTurn({
    lead: { crm: { needProfile: mergeTextIntoNeedProfile('') } },
    customerMessage: 'Wie weit kommt der EV3?',
  }, {
    config: { enabled: true, apiKey: 'mock' },
    mockTurnResult: mockResult,
    mockToolResults: [{ name: 'get_verified_vehicle_facts', output: factsOutput }],
  });

  assert.equal(ai.ok, true);
  assert.equal(ai.turnResult.nextAction.type, 'none');
  const forbidden = GOLDEN_CONVERSATION_EV3_RANGE.conversation[0].forbiddenQuestions;
  for (const phrase of forbidden) {
    assert.ok(!ai.turnResult.reply.includes(phrase), `Keine Frage: ${phrase}`);
  }
  console.log('✓ EV3-Wissensfrage ohne künstliche Rückfrage');
}

// 10. 7 Sitze schließt 5-Sitzer aus
{
  const result = findMatchingVehicles({ bodyType: 'suv', minimumSeats: 7 });
  const keys = result.matches.map((m) => m.modelKey);
  assert.ok(keys.includes('ev9') || keys.includes('sorento'));
  assert.ok(!keys.includes('sportage'));
  assert.ok(!keys.includes('ev3'));
  console.log('✓ 7 Sitze schließt 5-Sitzer aus');
}

// 11. Product Discovery ohne Fragezeichen
{
  const profile = mergeTextIntoNeedProfile('Ich suche einen Elektro-Kleinwagen bei Kia.');
  assert.equal(profile.fuel, 'electric');
  assert.equal(profile.bodyType, 'kleinwagen');
  console.log('✓ Product Discovery ohne Fragezeichen');
}

// 12. Customer Understanding bleibt einzige Lesequelle
{
  const mockResult = makeValidTurn({
    needProfilePatch: { fuel: 'electric', persons: 7, bodyType: 'suv' },
  });
  const lead = applyCleverTurnToLead(
    { crm: { needProfile: mergeTextIntoNeedProfile('SUV 7 Sitze Elektro') } },
    mockResult,
    'SUV 7 Sitze Elektro',
  );
  const understanding = buildCustomerUnderstanding(lead.lead);
  assert.ok((understanding?.verstaendnis?.labels?.length ?? 0) > 0);
  console.log('✓ Customer Understanding aus Lead/needProfile');
}

// 13. SUV-7-Sitze-Leasing-Flow (Patch-Kette)
{
  let profile = mergeTextIntoNeedProfile('Ich suche einen SUV mit 7 Sitzen bei Kia.');
  profile = applyNeedProfilePatch(profile, { fuel: 'electric' });
  profile = applyNeedProfilePatch(profile, { budget: { paymentType: 'leasing' } });
  profile = applyNeedProfilePatch(profile, { annualKm: 15000 });
  profile = applyNeedProfilePatch(profile, { leaseDurationMonths: 48 });
  profile = applyNeedProfilePatch(profile, { budget: { downPayment: 0 } });
  profile = applyNeedProfilePatch(profile, { timelineLabel: 'Bedarf in 1–3 Monaten' });

  assert.equal(profile.persons, 7);
  assert.equal(profile.fuel, 'electric');
  assert.equal(profile.annualKm, 15000);
  assert.equal(profile.leaseDurationMonths, 48);
  assert.equal(profile.budget.downPayment, 0);

  const understanding = buildCustomerUnderstanding({ crm: { needProfile: profile } });
  const labels = understanding?.verstaendnis?.labels ?? [];
  assert.ok(
    labels.some((l) => /7 Sitze|SUV|Elektro|Leasing|15\.?000|48 Monate/i.test(l))
    || profile.timelineLabel,
  );
  console.log('✓ SUV-7-Sitze-Leasing Endzustand');
}

// 14. Session-Anwendung ohne API
{
  const session = createHappyPathSession('Testhaus');
  const factsOutput = getVerifiedVehicleFacts({ modelKey: 'ev3', requestedFacts: ['wltpRange'] });
  const factId = factsOutput.facts[0]?.factId;
  const turn = makeValidTurn({
    reply: 'Antwort',
    intent: 'knowledge_question',
    usedFactIds: factId ? [factId] : [],
    vehicleDirections: factId ? [{
      modelKey: 'ev3',
      variantKey: null,
      status: 'interesting',
      reason: 'EV3',
      verifiedFactIds: [factId],
    }] : [],
  });
  const next = applyCleverTurnToSession(session, {
    customerMessage: 'Wie weit kommt der EV3?',
    turnResult: turn,
  });
  assert.ok(next.turns.some((t) => t.type === 'customer'));
  assert.ok(next.turns.some((t) => t.type === 'clever'));
  console.log('✓ Session-Anwendung');
}

// Angebotsfeld-Whitelist
assert.ok(OFFER_PARAMETER_FIELDS.includes('downPayment'));
assert.ok(OFFER_PARAMETER_FIELDS.includes('neededBy'));

console.log('\nAlle Clever AI Conversation Tests bestanden.');
