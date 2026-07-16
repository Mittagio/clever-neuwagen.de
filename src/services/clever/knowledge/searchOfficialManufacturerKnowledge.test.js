/**
 * Controlled Learning & Official Knowledge – Unit Tests (keine Live-API).
 */
import assert from 'node:assert/strict';
import {
  getAllowedDomainsForBrand,
  isAllowedOfficialDomain,
} from '../../../config/officialManufacturerDomains.js';
import { redactPersonalData, buildOfficialSearchQuery } from './redactVehicleQuery.js';
import {
  clearOfficialWebSearchCache,
  getOfficialWebCacheEntry,
  setOfficialWebCacheEntry,
  buildOfficialWebCacheKey,
} from './officialWebSearchCache.js';
import {
  searchOfficialManufacturerKnowledge,
  normalizeOfficialWebHit,
  detectInternalOfficialConflicts,
} from './searchOfficialManufacturerKnowledge.js';
import {
  deriveKnowledgeGapsFromTurn,
  upsertKnowledgeGap,
  KNOWLEDGE_GAP_STATUSES,
} from './knowledgeGapService.js';
import { executeCleverTool } from '../openai/tools/executeTool.js';
import { getVerifiedVehicleFacts } from '../openai/tools/getVerifiedVehicleFacts.js';
import { assertGroundedCleverTurn } from '../openai/assertGroundedCleverTurn.js';
import { buildToolEvidence } from '../openai/openAiResponsesClient.js';
import {
  evaluateCleverModelEscalation,
  isSimpleInternalKnowledgeQuestion,
} from '../openai/cleverModelEscalation.js';
import { getCleverAiConfig } from '../openai/cleverConversationConfig.js';
import { processAcceptedSellerFeedback } from '../learning/feedbackReviewService.js';
import { buildSellerFeedbackRecord, SELLER_FEEDBACK_CATEGORIES } from '../learning/sellerConversationFeedbackService.js';
import { buildFactId } from '../openai/tools/findMatchingVehicles.js';

clearOfficialWebSearchCache();

// 1. Interner Fakt verhindert Websuche
{
  let searchCalled = false;
  const result = await searchOfficialManufacturerKnowledge({
    brandKey: 'kia',
    modelKey: 'ev9',
    requestedFacts: ['towingCapacity'],
  }, {
    env: { CLEVER_OFFICIAL_WEB_SEARCH_ENABLED: 'true', OPENAI_API_KEY: 'test' },
    performOfficialWebSearch: async () => {
      searchCalled = true;
      return [];
    },
  });
  assert.equal(result.skippedReason, 'internal_verified_available');
  assert.equal(searchCalled, false);
  console.log('✓ interner verifizierter Fakt verhindert Websuche');
}

// 2. Fehlender interner Fakt erlaubt offizielle Websuche
{
  let searchCalled = false;
  const result = await searchOfficialManufacturerKnowledge({
    brandKey: 'byd',
    modelKey: 'ev9',
    requestedFacts: ['headUpDisplay'],
  }, {
    env: { CLEVER_OFFICIAL_WEB_SEARCH_ENABLED: 'true', OPENAI_API_KEY: 'test' },
    performOfficialWebSearch: async () => {
      searchCalled = true;
      return [{
        factKey: 'headUpDisplay',
        value: 'package',
        sourceUrl: 'https://www.byd.com/ev/specs',
        sourceTitle: 'BYD Specs',
      }];
    },
  });
  assert.equal(searchCalled, true);
  assert.equal(result.status, 'found');
  console.log('✓ fehlender interner Fakt erlaubt offizielle Websuche');
}

// 3. Websuche nur allowed_domains
{
  const allowed = getAllowedDomainsForBrand('kia');
  assert.ok(allowed.includes('kia.com'));
  assert.equal(isAllowedOfficialDomain('https://www.kia.com/de/ev9', 'kia'), true);
  assert.equal(isAllowedOfficialDomain('https://www.mobile.de/ev9', 'kia'), false);
  console.log('✓ Websuche verwendet nur erlaubte Domains');
}

// 4. Drittanbieterquelle wird abgelehnt
{
  const hit = normalizeOfficialWebHit({
    modelKey: 'ev9',
    variantKey: null,
    factKey: 'towingCapacity',
    value: 1800,
    sourceUrl: 'https://www.carwow.de/kia-ev9',
  }, 'kia');
  assert.equal(hit, null);
  console.log('✓ Drittanbieterquelle wird abgelehnt');
}

// 5. Offizieller Webfakt erhält provisional-Status
{
  const hit = normalizeOfficialWebHit({
    modelKey: 'ev9',
    variantKey: null,
    factKey: 'towingCapacity',
    value: 2500,
    sourceUrl: 'https://www.kia.com/de/ev9',
    sourceTitle: 'Kia EV9',
  }, 'kia');
  assert.equal(hit.status, 'provisional_official_source');
  assert.equal(hit.sourceTier, 'official_web');
  console.log('✓ offizieller Webfakt erhält provisional-Status');
}

// 6. Webfakt wird nicht automatisch in Registry gespeichert
{
  const before = getVerifiedVehicleFacts({ modelKey: 'ev9', requestedFacts: ['headUpDisplay'] });
  await searchOfficialManufacturerKnowledge({
    brandKey: 'kia',
    modelKey: 'ev9',
    requestedFacts: ['headUpDisplay'],
  }, {
    env: { CLEVER_OFFICIAL_WEB_SEARCH_ENABLED: 'true', OPENAI_API_KEY: 'test' },
    performOfficialWebSearch: async () => [{
      factKey: 'headUpDisplay',
      value: 'standard',
      sourceUrl: 'https://www.kia.com/de/ev9',
    }],
  });
  const after = getVerifiedVehicleFacts({ modelKey: 'ev9', requestedFacts: ['headUpDisplay'] });
  assert.deepEqual(before.facts, after.facts);
  console.log('✓ Webfakt wird nicht automatisch in Registry gespeichert');
}

// 7. Technische Antwort ohne Evidence schlägt Grounding fehl
{
  const grounded = assertGroundedCleverTurn({
    reply: 'Die Anhängelast beträgt 2500 kg.',
    usedFactIds: [],
    evidence: [],
    vehicleDirections: [],
    needProfilePatch: {},
    nextAction: { type: 'none', targetField: null, question: null, options: [], reason: null },
    handoff: { requested: false, ready: false, summary: null },
    intent: 'knowledge_question',
  }, { factIds: new Set(), evidenceIds: new Set() });
  assert.equal(grounded.ok, false);
  console.log('✓ technische Antwort ohne Evidence schlägt Grounding fehl');
}

// 8. Datenkonflikt erzeugt Knowledge Gap
{
  const conflicts = detectInternalOfficialConflicts(
    [{ key: 'towingCapacity', value: 1500 }],
    [{ factKey: 'towingCapacity', value: 1800, evidenceId: 'evidence:web:kia:ev9:default:towingCapacity:x' }],
  );
  assert.equal(conflicts.length, 1);
  const gaps = deriveKnowledgeGapsFromTurn({
    toolResults: [{
      name: 'search_official_manufacturer_knowledge',
      arguments: { modelKey: 'ev9', requestedFacts: ['towingCapacity'] },
      output: {
        status: 'conflicting',
        conflicts,
        evidence: [{ factKey: 'towingCapacity', sourceUrl: 'https://www.kia.com/de/ev9', sourceDomain: 'kia.com' }],
        missingFacts: ['towingCapacity'],
      },
    }],
    customerMessage: 'Wie viel Anhängelast hat der EV9?',
  });
  assert.ok(gaps.length >= 1);
  console.log('✓ Datenkonflikt erzeugt Knowledge Gap');
}

// 9. Verkäuferfeedback verändert nicht automatisch den Prompt
{
  const feedback = buildSellerFeedbackRecord({
    category: SELLER_FEEDBACK_CATEGORIES.UNNECESSARY_QUESTION,
    sellerCorrection: 'Erst Modell zeigen.',
    originalCleverReply: 'Haupt- oder Zweitwagen?',
  });
  const result = processAcceptedSellerFeedback({ ...feedback, status: 'accepted' });
  assert.equal(result.promptChanged, false);
  assert.ok(result.goldenCandidate);
  console.log('✓ Verkäuferfeedback verändert nicht automatisch den Prompt');
}

// 10. Akzeptiertes Feedback erzeugt Golden-Conversation-Kandidat
{
  const result = processAcceptedSellerFeedback(buildSellerFeedbackRecord({
    category: SELLER_FEEDBACK_CATEGORIES.UNNECESSARY_QUESTION,
    sellerCorrection: 'Modell zuerst.',
    originalCustomerMessage: 'Elektro-Kleinwagen gesucht',
    originalCleverReply: 'Hauptauto?',
    originalNextAction: { type: 'ask_vehicle_disambiguation', question: 'Hauptauto?' },
  }));
  assert.equal(result.kind, 'conversation_case');
  assert.ok(result.goldenCandidate?.desiredBehavior);
  console.log('✓ akzeptiertes Feedback erzeugt Golden-Conversation-Kandidat');
}

// 11. Datenfeedback erzeugt Knowledge-Gap-Aufgabe
{
  const result = processAcceptedSellerFeedback(buildSellerFeedbackRecord({
    category: SELLER_FEEDBACK_CATEGORIES.WRONG_VEHICLE_FACT,
    sellerCorrection: 'Anhängelast ist 2500 kg',
    originalCustomerMessage: 'Anhängelast EV9?',
  }));
  assert.equal(result.kind, 'data_case');
  assert.ok(result.knowledgeGap);
  console.log('✓ Datenfeedback erzeugt Knowledge-Gap-Aufgabe');
}

// 12. Luna ist Standardmodell
{
  const config = getCleverAiConfig({ OPENAI_CLEVER_MODEL: 'gpt-5.6-luna' });
  assert.equal(config.model, 'gpt-5.6-luna');
  console.log('✓ Luna ist Standardmodell');
}

// 13. Terra nur bei erlaubtem Grund
{
  const off = evaluateCleverModelEscalation({
    customerMessage: 'Wie weit kommt der EV3?',
    needProfile: {},
  }, { CLEVER_AI_ESCALATION_ENABLED: 'false' });
  assert.equal(off.shouldEscalate, false);

  const on = evaluateCleverModelEscalation({
    customerMessage: 'Vergleich EV9 und Sorento oder Sportage?',
    needProfile: { fuel: 'electric', persons: 7 },
  }, { CLEVER_AI_ESCALATION_ENABLED: 'true' });
  assert.equal(on.shouldEscalate, true);
  console.log('✓ Terra wird nur bei erlaubtem Grund aufgerufen');
}

// 14. Einfache Wissensfrage ohne Eskalation
{
  assert.equal(isSimpleInternalKnowledgeQuestion('Wie weit kommt der EV3?'), true);
  console.log('✓ einfache Wissensfrage ohne Eskalation');
}

// 15. Knowledge-Gap Upsert zählt Kundenfragen
{
  const first = upsertKnowledgeGap([], {
    modelKey: 'ev9',
    requestedFact: 'headUpDisplay',
    status: KNOWLEDGE_GAP_STATUSES.NEW,
  });
  const second = upsertKnowledgeGap(first.gaps, {
    modelKey: 'ev9',
    requestedFact: 'headUpDisplay',
    status: KNOWLEDGE_GAP_STATUSES.NEW,
  });
  assert.equal(second.gap.customerQuestionCount, 2);
  console.log('✓ Knowledge-Gap Upsert zählt Kundenfragen');
}

// 16. Personenbezogene Daten werden redigiert
{
  const redacted = redactPersonalData('Ruf mich an: max@test.de oder 017612345678');
  assert.ok(!redacted.includes('max@test.de'));
  console.log('✓ personenbezogene Daten werden redigiert');
}

// 17. Suchanfrage enthält nur Fahrzeugkontext
{
  const query = buildOfficialSearchQuery({
    brandKey: 'kia',
    modelKey: 'ev9',
    requestedFacts: ['towingCapacity'],
  });
  assert.match(query, /KIA/i);
  assert.match(query, /Anhängelast/i);
  console.log('✓ Suchanfrage enthält nur Fahrzeugkontext');
}

// 18. Cache für Herstellerquellen
{
  const key = buildOfficialWebCacheKey({
    brandKey: 'kia',
    modelKey: 'ev9',
    requestedFacts: ['headUpDisplay'],
  });
  setOfficialWebCacheEntry(key, { status: 'found', evidence: [] }, 60000);
  assert.ok(getOfficialWebCacheEntry(key));
  console.log('✓ Cache für Herstellerquellen');
}

// 19. Tool-Executor ruft offizielle Suche auf
{
  const output = await executeCleverTool('search_official_manufacturer_knowledge', {
    modelKey: 'ev3',
    requestedFacts: ['wltpRange'],
  }, {
    env: { CLEVER_OFFICIAL_WEB_SEARCH_ENABLED: 'false' },
  });
  assert.equal(output.skippedReason, 'internal_verified_available');
  console.log('✓ Tool-Executor respektiert interne Priorität');
}

// 20. Evidence-IDs aus Tool-Ergebnissen
{
  const factId = buildFactId('ev3', 'default', 'wltpRange');
  const evidence = buildToolEvidence([{
    name: 'get_verified_vehicle_facts',
    output: getVerifiedVehicleFacts({ modelKey: 'ev3', requestedFacts: ['wltpRange'] }),
  }]);
  assert.ok(evidence.factIds.has(factId));
  console.log('✓ Evidence-IDs aus internen Tool-Ergebnissen');
}

console.log('\nAlle Controlled Learning Tests bestanden.');
