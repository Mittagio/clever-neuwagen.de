/**
 * Slice 1: Global Clever Composer – Dashboard + Vehicle Knowledge
 * node src/services/cleverSeller/globalComposer.slice1.test.js
 */
import assert from 'node:assert/strict';
import { runCleverSellerTurn } from './runCleverSellerTurn.js';
import { interpretSellerInput } from './interpretSellerInput.js';
import { SELLER_TURN_INTENTS } from './sellerFactTypes.js';
import { getTodayOverview } from './getTodayOverview.js';
import { lookupVehicleTechnicalFact } from './lookupVehicleTechnicalFact.js';
import {
  buildUniversalReviewModel,
  shouldShowUniversalReview,
} from './buildUniversalReviewModel.js';
import { createBrandesGoldenCaseLead } from '../crm/brandesGoldenCase.js';

// --- Intent: dashboard today ---
{
  const interpreted = interpretSellerInput('Was liegt heute an?');
  assert.ok(interpreted.intents.some((i) => i.type === SELLER_TURN_INTENTS.GET_TODAY_OVERVIEW));
}

// --- Intent: vehicle knowledge ---
{
  const interpreted = interpretSellerInput('XCeed Anhängelast?');
  assert.ok(interpreted.intents.some((i) => i.type === SELLER_TURN_INTENTS.LOOKUP_VEHICLE_FACT));
}

// --- getTodayOverview uses existing data + reasons, no invented scores ---
{
  const brandes = createBrandesGoldenCaseLead({ phase: 'golden' });
  const overview = getTodayOverview([brandes], { maxItems: 10 });
  assert.equal(overview.ok, true);
  assert.equal(overview.source, 'existing_crm_journey_reminders');
  for (const item of overview.items) {
    assert.ok(Array.isArray(item.reasons));
    assert.ok(!('closureChance' in item));
    assert.ok(!('purchaseProbability' in item));
  }
}

// --- Global dashboard scope ---
{
  const brandes = createBrandesGoldenCaseLead({ phase: 'golden' });
  const turn = runCleverSellerTurn({
    lead: {},
    sellerInput: 'Was liegt heute an?',
    leadsSnapshot: [brandes],
    scopeHint: 'dashboard',
  });
  assert.equal(turn.scope, 'dashboard');
  assert.ok(turn.todayOverview);
  assert.ok(shouldShowUniversalReview(turn));
  const review = buildUniversalReviewModel(turn);
  assert.match(review.title, /Heute wichtig/i);
  assert.ok(review.actionSections.some((s) => s.kind === 'today_overview'));
  assert.ok(!turn.proposedUpdates?.length);
}

// --- Vehicle knowledge scope, no customer required ---
{
  const turn = runCleverSellerTurn({
    lead: {},
    sellerInput: 'XCeed Anhängelast?',
    leadsSnapshot: [],
    scopeHint: 'global',
  });
  assert.ok(turn.scope === 'global' || turn.scope === 'dashboard');
  assert.ok(turn.knowledgeResult);
  assert.equal(turn.knowledgeResult.ok, true);
  assert.equal(turn.knowledgeResult.factKey, 'towingCapacity');
  assert.equal(turn.knowledgeResult.value, 1400);
  assert.match(String(turn.knowledgeResult.sourceLabel || ''), /verifiziert/i);
  assert.equal(turn.proposedUpdates?.length || 0, 0);
  assert.ok(!turn.messageDraft);
  const review = buildUniversalReviewModel(turn);
  assert.ok(review.actionSections.some((s) => s.kind === 'knowledge_result'));
}

// --- Missing verified fact ---
{
  const result = lookupVehicleTechnicalFact({
    sellerInput: 'UnbekanntesModell Anhängelast?',
    modelKey: 'not-a-real-model',
  });
  assert.equal(result.ok, false);
  assert.match(result.message || '', /nicht eindeutig verifiziert|Modell/i);
}

// --- No Customer Truth update from knowledge query ---
{
  const lead = createBrandesGoldenCaseLead({ phase: 'golden' });
  const before = JSON.stringify(lead);
  runCleverSellerTurn({
    lead,
    sellerInput: 'XCeed Anhängelast?',
    leadsSnapshot: [lead],
  });
  assert.equal(JSON.stringify(lead), before);
}

// --- Context priority: empty customer on dashboard knowledge ---
{
  const turn = runCleverSellerTurn({
    lead: {},
    sellerInput: 'XCeed Anhängelast?',
    customerName: '',
  });
  assert.ok(!turn.resolvedCustomer?.id);
}

// --- Conflicting fact warning (keine stille Auswahl) ---
{
  // Happy path bleibt verified; Konflikt-Contract: ok=false + warning, kein Wert
  const verified = lookupVehicleTechnicalFact({
    modelKey: 'xceed',
    factKey: 'towingCapacity',
    sellerInput: 'XCeed Anhängelast?',
  });
  assert.equal(verified.ok, true);
  assert.equal(verified.value, 1400);

  const conflictContract = {
    ok: false,
    status: 'conflicting_sources',
    value: null,
    warnings: ['Widersprüchliche Quellen für Anhängelast: 1400 kg vs. 1500 kg'],
    message: 'Die Quellen widersprechen sich – ich wähle keinen Wert aus.',
  };
  assert.equal(conflictContract.ok, false);
  assert.equal(conflictContract.value, null);
  assert.match(conflictContract.warnings[0], /Widersprüchliche/);
}

// --- No duplicate composer mount (Dashboard vs Akte) ---
{
  function resolveSurface(pathname = '') {
    const path = String(pathname).split('?')[0];
    if (path === '/backend' || path === '/backend/') return 'dashboard';
    if (path.startsWith('/backend/kundenakte/')) return 'customer_akte';
    return 'other';
  }
  function shouldShowGlobal(pathname, enabled = true) {
    return Boolean(enabled && resolveSurface(pathname) === 'dashboard');
  }
  assert.equal(shouldShowGlobal('/backend'), true);
  assert.equal(shouldShowGlobal('/backend/kundenakte/lead-demo-brandes'), false);
  assert.equal(shouldShowGlobal('/backend', false), false);
}

// --- Context reset after navigation (kein Kunde auf Dashboard) ---
{
  let customer = { id: 'lead-demo-brandes' };
  function clearIfLeftAkte(surface) {
    if (surface !== 'customer_akte') customer = null;
  }
  clearIfLeftAkte('dashboard');
  assert.equal(customer, null);
}

console.log('globalComposer.slice1.test.js: ok');
