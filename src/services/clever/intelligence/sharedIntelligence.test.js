/**
 * Shared Clever Intelligence – Unit Tests (keine Live-API).
 */
import assert from 'node:assert/strict';
import {
  CLEVER_SURFACES,
  getCleverIntelligenceConfig,
  isCleverLexiconAiEnabled,
  isCleverSellerCopilotEnabled,
} from './cleverIntelligenceConfig.js';
import { buildCleverIntelligenceInstructions } from './cleverBaseInstructions.js';
import {
  validateCleverLexiconResult,
  assertGroundedLexiconResult,
} from './lexiconResultSchema.js';
import {
  validateCleverSellerCopilotResult,
  assertGroundedSellerCopilotResult,
} from './sellerCopilotResultSchema.js';
import { runCleverLexiconQuery, mapLexiconResultToSearchState, buildLexiconSourceStatus } from './runCleverLexiconQuery.js';
import {
  runCleverSellerCopilot,
  buildSellerCopilotSafeContext,
} from './runCleverSellerCopilot.js';
import {
  buildLexiconTransferPreview,
  applyLexiconTransferToLead,
  LEXICON_TRANSFER_MODES,
} from './lexiconTransferService.js';
import {
  buildLexiconCacheKey,
  getLexiconCacheEntry,
  setLexiconCacheEntry,
  clearLexiconQueryCache,
} from './lexiconQueryCache.js';
import {
  buildCustomerUnderstandingSnapshotId,
  getSellerCopilotCache,
  setSellerCopilotCache,
  clearSellerCopilotCache,
  markSellerCopilotStale,
} from './sellerCopilotCache.js';
import { buildFactId } from '../openai/tools/findMatchingVehicles.js';
import { getVerifiedVehicleFacts } from '../openai/tools/getVerifiedVehicleFacts.js';
import { buildToolEvidence } from '../openai/openAiResponsesClient.js';
import { runCleverIntelligenceCore } from './runCleverIntelligenceCore.js';
import { CLEVER_LEXICON_RESULT_JSON_SCHEMA } from './lexiconResultSchema.js';

clearLexiconQueryCache();
clearSellerCopilotCache();

function makeLexiconResult(overrides = {}) {
  const factId = buildFactId('ev9', 'default', 'seats');
  return {
    answer: 'Bei Kia sind intern verifizierte 7-Sitzer u. a. der EV9.',
    intent: 'model_discovery',
    facts: [{ label: 'Sitze', value: '7', evidenceIds: [factId] }],
    vehicleDirections: [{
      modelKey: 'ev9',
      variantKey: null,
      reason: '7 Sitze',
      evidenceIds: [factId],
    }],
    evidence: [{
      evidenceId: factId,
      sourceTier: 'internal_verified',
      status: 'verified',
      factKey: 'seats',
      modelKey: 'ev9',
      variantKey: null,
      sourceId: 'kia:ev9',
      sourceUrl: null,
      sourceTitle: 'Clever Stammdaten',
    }],
    knowledgeGap: { created: false, reason: null },
    suggestedActions: [{ type: 'transfer_to_customer', label: 'Für Kundenakte übernehmen' }],
    usedFactIds: [factId],
    ...overrides,
  };
}

function makeSellerResult(overrides = {}) {
  return {
    answer: 'Der Kunde sucht einen elektrischen 7-Sitzer im Leasing.',
    intent: 'customer_summary',
    customerSummary: 'Elektro-SUV, 7 Sitze, Leasing.',
    openPoints: [{ field: 'trim', label: 'Ausstattung', reason: 'Noch nicht gewählt' }],
    vehicleDirections: [],
    recommendedAction: {
      type: 'prepare_offer',
      label: 'Angebot vorbereiten',
      reason: 'Leasingparameter sind vollständig.',
    },
    draft: { channel: null, subject: null, body: null },
    evidence: [],
    requiresSellerConfirmation: false,
    usedFactIds: [],
    ...overrides,
  };
}

// 1. Shared config surfaces
{
  assert.equal(isCleverLexiconAiEnabled({ CLEVER_LEXICON_AI_ENABLED: 'false' }), false);
  assert.equal(isCleverSellerCopilotEnabled({ CLEVER_SELLER_COPILOT_ENABLED: 'false' }), false);
  const cfg = getCleverIntelligenceConfig(CLEVER_SURFACES.LEXICON, {
    CLEVER_LEXICON_AI_ENABLED: 'true',
    OPENAI_API_KEY: 'test',
  });
  assert.equal(cfg.enabled, true);
  console.log('✓ Feature-Flags standardmäßig aus / surface config');
}

// 2. Shared instructions
{
  const lexicon = buildCleverIntelligenceInstructions(CLEVER_SURFACES.LEXICON);
  assert.match(lexicon, /LEXIKON/);
  assert.match(lexicon, /keine Bedarfsanalyse/i);
  const seller = buildCleverIntelligenceInstructions(CLEVER_SURFACES.SELLER);
  assert.match(seller, /VERKÄUFER/);
  assert.match(seller, /requiresSellerConfirmation/);
  console.log('✓ Shared Base + Surface Instructions');
}

// 3. Lexikon ohne Lead-Kontext / kein needProfile
{
  const result = await runCleverLexiconQuery({
    query: 'Welche Kia haben sieben Sitze?',
  }, {
    config: { enabled: false, apiKey: null },
  });
  assert.equal(result.needProfileChanged, undefined);
  assert.equal(result.fallback, true);
  assert.ok(result.searchState);
  console.log('✓ Lexikon ohne AI → Legacy-Fallback, kein needProfile');
}

// 4. Lexikon Schema + Grounding
{
  const facts = getVerifiedVehicleFacts({ modelKey: 'ev9', requestedFacts: ['seats'] });
  const factId = facts.facts[0]?.factId ?? buildFactId('ev9', 'default', 'seats');
  const valid = validateCleverLexiconResult(makeLexiconResult({
    facts: [{ label: 'Sitze', value: '7', evidenceIds: [factId] }],
    usedFactIds: [factId],
    evidence: [{
      evidenceId: factId,
      sourceTier: 'internal_verified',
      status: 'verified',
      factKey: 'seats',
      modelKey: 'ev9',
      variantKey: null,
      sourceId: 'kia',
      sourceUrl: null,
      sourceTitle: 'intern',
    }],
    vehicleDirections: [{
      modelKey: 'ev9',
      variantKey: null,
      reason: '7 Sitze',
      evidenceIds: [factId],
    }],
  }));
  assert.equal(valid.ok, true);
  const evidence = buildToolEvidence([{
    name: 'get_verified_vehicle_facts',
    output: facts,
  }]);
  const grounded = assertGroundedLexiconResult(valid.result, evidence);
  assert.equal(grounded.ok, evidence.factIds.has(factId));

  const bad = assertGroundedLexiconResult(makeLexiconResult({
    answer: 'Die Anhängelast beträgt 2500 kg.',
    usedFactIds: [],
    facts: [],
    evidence: [],
  }), { factIds: new Set(), evidenceIds: new Set() });
  assert.equal(bad.ok, false);
  console.log('✓ Lexikon Schema und Grounding');
}

// 5. Transfer braucht Bestätigung
{
  const preview = buildLexiconTransferPreview({
    lexiconResult: makeLexiconResult(),
    mode: LEXICON_TRANSFER_MODES.CUSTOMER_INTEREST,
    query: 'EV9 HUD?',
  });
  const denied = applyLexiconTransferToLead({ crm: {} }, preview, { confirmed: false });
  assert.equal(denied.ok, false);
  assert.equal(denied.error, 'confirmation_required');

  const applied = applyLexiconTransferToLead({ crm: { needProfile: {} } }, preview, { confirmed: true });
  assert.equal(applied.ok, true);
  assert.ok((applied.lead.crm.sellerInsights ?? []).length >= 1);
  console.log('✓ Lexikon-Transfer benötigt Bestätigung');
}

// 6. Dashboard liest Customer Understanding / Safe Context
{
  const lead = {
    id: 'lead-1',
    crm: {
      needProfile: {
        fuel: 'electric',
        persons: 7,
        bodyType: 'suv',
        annualKm: 15000,
        leaseDurationMonths: 48,
        budget: { paymentType: 'leasing', downPayment: 0 },
        timelineLabel: 'Bedarf in 1–3 Monaten',
        rawMessages: ['Ich suche einen elektrischen SUV mit 7 Sitzen.'],
        understoodLabels: ['Elektro', 'SUV', '7 Sitze', 'Leasing'],
      },
      sellerInsights: [{ text: 'Kunde will EV9', understoodLabels: ['EV9'], createdAt: new Date().toISOString() }],
    },
  };
  const safe = buildSellerCopilotSafeContext(lead);
  assert.equal(safe.needProfile.fuel, 'electric');
  assert.equal(safe.needProfile.persons, 7);
  assert.ok(!('documents' in safe));
  assert.ok(!JSON.stringify(safe).includes('Gehalt'));
  console.log('✓ Seller Safe Context aus Customer Understanding');
}

// 7. Snapshot Cache stale
{
  clearSellerCopilotCache();
  const understanding = { verstaendnis: { labels: ['SUV', '7 Sitze'] }, gespraechseinstieg: 'Test' };
  const snap = buildCustomerUnderstandingSnapshotId(understanding, []);
  setSellerCopilotCache('lead-1', snap, { ok: true, answer: 'cached' });
  assert.ok(getSellerCopilotCache('lead-1', snap));
  markSellerCopilotStale('lead-1');
  assert.equal(getSellerCopilotCache('lead-1', snap), null);
  console.log('✓ veralteter Snapshot wird invalidiert');
}

// 8. Draft requires confirmation
{
  const draft = makeSellerResult({
    intent: 'message_draft',
    draft: { channel: 'whatsapp', subject: null, body: 'Hallo, gerne Angebot.' },
    requiresSellerConfirmation: true,
  });
  assert.equal(validateCleverSellerCopilotResult(draft).ok, true);
  const badDraft = makeSellerResult({
    intent: 'message_draft',
    draft: { channel: 'whatsapp', subject: null, body: 'Hallo' },
    requiresSellerConfirmation: false,
  });
  assert.equal(validateCleverSellerCopilotResult(badDraft).ok, false);
  console.log('✓ Antwortentwurf erfordert Verkäuferbestätigung');
}

// 9. Seller fallback when disabled
{
  const result = await runCleverSellerCopilot({
    lead: { id: 'x', crm: { needProfile: { fuel: 'electric' } } },
  }, {
    config: { enabled: false, apiKey: null },
  });
  assert.equal(result.fallback, true);
  assert.ok(result.nextStepHint || result.mode === 'legacy');
  console.log('✓ Feature-Flag aus → Seller Fallback');
}

// 10. Lexikon Cache
{
  clearLexiconQueryCache();
  const key = buildLexiconCacheKey({ query: 'Was ist V2L?', brandKey: 'kia' });
  setLexiconCacheEntry(key, { ok: true, cached: true });
  assert.equal(getLexiconCacheEntry(key).cached, true);
  console.log('✓ Lexikon-Cache');
}

// 11. Mock shared core for lexicon
{
  const facts = getVerifiedVehicleFacts({ modelKey: 'ev9', requestedFacts: ['seats'] });
  const factId = facts.facts[0]?.factId;
  const mock = makeLexiconResult({
    usedFactIds: factId ? [factId] : [],
    facts: factId ? [{ label: 'Sitze', value: '7', evidenceIds: [factId] }] : [],
    evidence: factId ? [{
      evidenceId: factId,
      sourceTier: 'internal_verified',
      status: 'verified',
      factKey: 'seats',
      modelKey: 'ev9',
      variantKey: null,
      sourceId: 'kia',
      sourceUrl: null,
      sourceTitle: 'intern',
    }] : [],
    vehicleDirections: factId ? [{
      modelKey: 'ev9',
      variantKey: null,
      reason: '7 Sitze',
      evidenceIds: [factId],
    }] : [],
  });

  const core = await runCleverIntelligenceCore({
    surface: CLEVER_SURFACES.LEXICON,
    instructions: buildCleverIntelligenceInstructions(CLEVER_SURFACES.LEXICON),
    input: [{ role: 'user', content: '{}' }],
    jsonSchema: CLEVER_LEXICON_RESULT_JSON_SCHEMA,
    validate: validateCleverLexiconResult,
    assertGrounded: assertGroundedLexiconResult,
    userMessage: '7 Sitze?',
    config: { enabled: true, apiKey: 'mock', model: 'gpt-5.6-luna' },
  }, {
    mockResult: mock,
    mockToolResults: [{ name: 'get_verified_vehicle_facts', output: facts }],
  });
  assert.equal(core.ok, true);
  assert.equal(core.result.intent, 'model_discovery');

  const mapped = mapLexiconResultToSearchState('7 Sitze?', core.result);
  assert.equal(mapped.ok, true);
  assert.ok(mapped.result.sourceStatus);
  console.log('✓ Shared Core + Lexikon-Mapping');
}

// 12. Source status helper
{
  const status = buildLexiconSourceStatus(makeLexiconResult());
  assert.equal(status.code, 'verified');
  console.log('✓ Quellenstatus sichtbar');
}

// 13. Unknown evidence fails seller grounding
{
  const bad = assertGroundedSellerCopilotResult(makeSellerResult({
    usedFactIds: ['fact:unknown'],
    answer: 'Die Reichweite beträgt 500 km.',
  }), { factIds: new Set(), evidenceIds: new Set() });
  assert.equal(bad.ok, false);
  console.log('✓ unbekannte Evidence-ID schlägt Grounding fehl');
}

// 14. Seller grounding OK for summary without technical claims
{
  const ok = assertGroundedSellerCopilotResult(makeSellerResult(), {
    factIds: new Set(),
    evidenceIds: new Set(),
  });
  assert.equal(ok.ok, true);
  console.log('✓ Seller-Zusammenfassung ohne technische Halluzination');
}

console.log('\nAlle Shared Intelligence Tests bestanden.');
