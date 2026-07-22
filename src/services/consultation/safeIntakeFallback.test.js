/**
 * Safe Intake Fallback – Golden Cases A–E (öffentlicher Kundendialog).
 * node src/services/consultation/safeIntakeFallback.test.js
 */
import assert from 'node:assert/strict';
import { createHappyPathSession, TURN_TYPE } from './consultationHappyPath.js';
import { applyCleverTurnToSession } from '../clever/openai/applyCleverTurnResult.js';
import {
  humanizeFallbackReason,
  sessionContainsForbiddenPlannerQuestion,
  sessionEnteredAutoRecommendation,
  submitSafeIntakeFallback,
  SAFE_ANNUAL_KM_QUESTION_ID,
} from './safeIntakeFallback.js';

function cleverTexts(session) {
  return (session.turns ?? [])
    .filter((t) => t.type === TURN_TYPE.CLEVER)
    .map((t) => String(t.text ?? ''))
    .join('\n');
}

function hasApprox(labels, re) {
  return (labels ?? []).some((label) => re.test(String(label)));
}

// --- A: Kleinwagen Elektro ---
{
  let session = createHappyPathSession('Autohaus Test');
  session = submitSafeIntakeFallback(session, 'Kleinwagen Elektro', {
    reason: 'feature_disabled',
  });

  assert.ok(hasApprox(session.notepadLabels, /^Elektro$/i), 'A: Elektro notiert');
  assert.ok(hasApprox(session.notepadLabels, /Kleinwagen/i), 'A: Kleinwagen notiert');
  assert.match(cleverTexts(session), /EV2/i, 'A: EV2 erklären');
  assert.match(cleverTexts(session), /EV3.*größer|Kompakt-SUV/i, 'A: EV3 Abgrenzung');
  assert.equal(session.pendingQuestion, null, 'A: keine automatische Folgefrage');
  assert.equal(sessionContainsForbiddenPlannerQuestion(session), false, 'A: kein Alltag-Fragebogen');
  assert.equal(sessionEnteredAutoRecommendation(session), false, 'A: keine Empfehlungsseite');
  assert.equal(session.conversationMode, 'fallback');
  assert.equal(session.fallbackReason, 'feature disabled');
  console.log('✓ A Kleinwagen Elektro → EV2, Notizen, kein Fragebogen');
}

// --- B: EV3 Leasing Familie ---
{
  let session = createHappyPathSession('Autohaus Test');
  session = submitSafeIntakeFallback(session, 'EV3 Leasing für Familie', {
    reason: 'api_key_missing',
  });

  assert.ok(hasApprox(session.notepadLabels, /EV3/i), 'B: EV3');
  assert.ok(hasApprox(session.notepadLabels, /Leasing/i), 'B: Leasing');
  assert.ok(hasApprox(session.notepadLabels, /Familie/i), 'B: Familie');
  assert.match(cleverTexts(session), /EV3.*Leasing.*Familie|notiert/i, 'B: Ack mit Notizen');
  assert.ok(
    !/wallbox|garage|rate möglichst|ausstattung wichtiger/i.test(cleverTexts(session)),
    'B: keine Wallbox-/Preis-vs-Ausstattung-Frage',
  );
  assert.equal(sessionContainsForbiddenPlannerQuestion(session), false, 'B: kein Legacy Planner');
  if (session.pendingQuestion) {
    assert.equal(session.pendingQuestion.id, SAFE_ANNUAL_KM_QUESTION_ID, 'B: nur Leasing-km erlaubt');
    assert.match(cleverTexts(session), /Kilometer.*Jahr/i, 'B: km-Frage');
  }
  assert.equal(session.fallbackReason, 'API key missing');
  console.log('✓ B EV3 Leasing Familie → Notizen, ggf. km, kein Wallbox-Flow');
}

// --- C: Wärmepumpe ---
{
  let session = createHappyPathSession('Autohaus Test');
  session = submitSafeIntakeFallback(session, 'Wärmepumpe wäre mir wichtig.', {
    reason: 'api_error',
  });

  assert.ok(
    hasApprox(session.notepadLabels, /Wärmepumpe/i),
    'C: Wärmepumpe notiert',
  );
  assert.match(cleverTexts(session), /Wärmepumpe|serienmäßig|Ausstattung/i, 'C: Varianten-Hinweis');
  assert.ok(!/EV3|empfehl|perfekt für Sie|Match/i.test(cleverTexts(session)), 'C: keine Kaufempfehlung');
  assert.equal(session.pendingQuestion, null, 'C: keine erzwungene Frage');
  assert.equal(sessionEnteredAutoRecommendation(session), false, 'C: Messenger bleibt offen');
  assert.equal(session.phase, 'conversation', 'C: Phase conversation');
  console.log('✓ C Wärmepumpe → notiert, keine EV3-Kaufempfehlung, offen');
}

// --- D: API-Fehler mitten im Gespräch ---
{
  let session = createHappyPathSession('Autohaus Test');
  session = {
    ...session,
    phase: 'conversation',
    conversationMode: 'ai',
    aiModel: 'gpt-5.6-luna',
    notepadLabels: ['EV3', 'Leasing', 'Familie'],
    needProfile: {
      ...(session.needProfile ?? {}),
      modelHint: 'ev3',
      budget: { paymentType: 'leasing' },
      priorities: ['family'],
    },
    turns: [
      { type: TURN_TYPE.CUSTOMER, id: 'c1', text: 'EV3 Leasing für Familie' },
      { type: TURN_TYPE.CLEVER, id: 'a1', text: 'Verstanden.', aiTurn: true, mode: 'ai' },
    ],
  };

  session = submitSafeIntakeFallback(session, 'Wärmepumpe wäre mir auch wichtig.', {
    reason: 'grounding_failed',
  });

  assert.ok(hasApprox(session.notepadLabels, /EV3/i), 'D: EV3 bleibt');
  assert.ok(hasApprox(session.notepadLabels, /Leasing/i), 'D: Leasing bleibt');
  assert.ok(hasApprox(session.notepadLabels, /Familie/i), 'D: Familie bleibt');
  assert.ok(hasApprox(session.notepadLabels, /Wärmepumpe/i), 'D: neue Notiz');
  assert.equal(sessionContainsForbiddenPlannerQuestion(session), false, 'D: kein Fragenkatalog');
  assert.equal(session.conversationMode, 'fallback');
  assert.equal(session.fallbackReason, 'grounding rejected');
  console.log('✓ D API-Fehler → Notizen bleiben, Safe Fallback');
}

// --- E: OpenAI erfolgreich → kein Legacy Planner parallel ---
{
  const base = createHappyPathSession('Autohaus Test');
  const session = applyCleverTurnToSession(base, {
    customerMessage: 'EV3 Leasing für Familie',
    turnResult: {
      reply: 'Verstanden. Ich habe EV3, Leasing und Familie notiert.',
      intent: 'need_statement',
      needProfilePatch: {},
      vehicleDirections: [],
      nextAction: {
        type: 'ask_offer_parameter',
        targetField: 'annualKm',
        question: 'Wie viele Kilometer fahren Sie ungefähr im Jahr?',
        options: [
          { value: '15000', label: 'ca. 15.000 km' },
        ],
        reason: 'leasing',
      },
      handoff: { requested: false, ready: false, summary: null },
      usedFactIds: [],
      evidence: [],
    },
  });

  assert.equal(session.conversationMode, 'ai', 'E: AI-Mode');
  assert.ok(session.turns.some((t) => t.aiTurn), 'E: AI-Turn vorhanden');
  assert.equal(sessionContainsForbiddenPlannerQuestion(session), false, 'E: kein Legacy Planner');
  assert.ok(
    !session.turns.some((t) => t.fallbackTurn),
    'E: kein Fallback-Turn parallel',
  );
  assert.ok(
    !session.turns.some((t) => t.questionId === 'chargingAtHome' || t.questionId === 'vehicleNeedTiming'),
    'E: keine Planner-IDs',
  );
  console.log('✓ E AI-Erfolg → nur CleverTurnResult, kein Legacy parallel');
}

// --- humanize ---
{
  assert.equal(humanizeFallbackReason('feature_disabled'), 'feature disabled');
  assert.equal(humanizeFallbackReason('api_key_missing'), 'API key missing');
  assert.equal(humanizeFallbackReason('grounding_failed'), 'grounding rejected');
  assert.equal(humanizeFallbackReason('disabled_or_missing_key'), 'API key missing');
  console.log('✓ Fallback-Reason Labels');
}

console.log('\nsafeIntakeFallback.test.js: ok');
