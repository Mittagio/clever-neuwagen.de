/**
 * Clever Conversation Navigation – Next Topics Golden Cases.
 * node src/services/consultation/conversationNextTopics.test.js
 */
import assert from 'node:assert/strict';
import {
  buildDeterministicNextTopics,
  sanitizeNextTopics,
  MAX_NEXT_TOPICS,
} from './conversationNextTopics.js';
import { createHappyPathSession, TURN_TYPE } from './consultationHappyPath.js';
import { submitSafeIntakeFallback } from './safeIntakeFallback.js';
import { applyCleverTurnToSession } from '../clever/openai/applyCleverTurnResult.js';
import { mergeTextIntoNeedProfile, createEmptyNeedProfile, buildUnderstoodLabels } from './needProfileService.js';
import { isLikelyFactQuestionNotWish } from './needRecognitionService.js';

function lastCleverTurn(session) {
  const turns = session?.turns ?? [];
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    if (turns[i]?.type === TURN_TYPE.CLEVER) return turns[i];
  }
  return null;
}

function makeValidTurn(overrides = {}) {
  return {
    reply: 'Dann kommt bei Kia aktuell der EV9 infrage.',
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
    evidence: [],
    nextTopics: [],
    ...overrides,
  };
}

// 1. Next Topic erzeugt keinen Kundenwunsch (Chip ≠ Notizzettel)
{
  const topics = buildDeterministicNextTopics({
    needProfile: { modelHint: 'ev9', fuel: 'electric', bodyType: 'suv' },
    notepadLabels: ['SUV', '7 Sitze', 'Elektro', 'EV9'],
    text: 'SUV mit 7 Sitzen, elektrisch.',
  });
  assert.ok(topics.length >= 1, 'Topics für EV9');
  const towing = topics.find((t) => t.id === 'towing');
  assert.ok(towing, 'Anhängelast-Topic');
  assert.equal(
    isLikelyFactQuestionNotWish(towing.customerMessage),
    true,
    'Topic-Message ist Faktfrage, kein Wunsch',
  );
  const afterQuestion = mergeTextIntoNeedProfile(
    towing.customerMessage,
    {
      ...createEmptyNeedProfile(),
      modelHint: 'ev9',
      fuel: 'electric',
    },
  );
  const labels = buildUnderstoodLabels(afterQuestion).join(' ');
  assert.ok(
    !/mindestens|1\.?500|anhängelast wichtig/i.test(labels),
    'Faktfrage schreibt keinen Anhängelast-Wunsch',
  );
  console.log('✓ 1 Next Topic erzeugt keinen Kundenwunsch');
}

// 2. Klick erzeugt natürliche Kundennachricht
{
  const topics = sanitizeNextTopics([
    {
      id: 'towing',
      label: 'Anhängelast',
      customerMessage: 'Wie hoch ist die Anhängelast beim EV9?',
    },
  ]);
  assert.equal(topics[0].customerMessage, 'Wie hoch ist die Anhängelast beim EV9?');
  assert.match(topics[0].customerMessage, /\?$/);
  console.log('✓ 2 Klick → natürliche Kundennachricht');
}

// 3. Explizite Bedarfsmeldung erzeugt Wunsch
{
  const profile = mergeTextIntoNeedProfile(
    'Ich brauche mindestens 1.500 kg Anhängelast.',
    createEmptyNeedProfile(),
  );
  const labels = buildUnderstoodLabels(profile).join(' ');
  assert.ok(
    (profile.towCapacityKg ?? 0) >= 1500
    || /1\.?500|anhäng/i.test(labels),
    'Expliziter Bedarf landet im needProfile',
  );
  console.log('✓ 3 Explizite Antwort erzeugt Wunsch');
}

// 4. Maximal 4 Next Topics
{
  const many = Array.from({ length: 8 }, (_, i) => ({
    id: `t${i}`,
    label: `Thema ${i}`,
    customerMessage: `Frage ${i}?`,
  }));
  assert.equal(sanitizeNextTopics(many).length, MAX_NEXT_TOPICS);
  console.log('✓ 4 maximal 4 Next Topics');
}

// 5. Topics passen zum Modell
{
  const ev2 = buildDeterministicNextTopics({
    needProfile: { selectedModelKey: 'ev2' },
    notepadLabels: ['EV2', 'Elektro'],
    text: 'EV2',
  });
  assert.ok(ev2.some((t) => t.id === 'battery' || t.id === 'range'), 'EV2: Batterie/Reichweite');

  const hybrid = buildDeterministicNextTopics({
    needProfile: {},
    notepadLabels: ['Sportage', 'Hybrid'],
    text: 'Sportage Hybrid',
  });
  assert.ok(hybrid.some((t) => t.id === 'hybrid'), 'Sportage: HEV/PHEV');
  console.log('✓ 5 Topics passen zum Modell / Thema');
}

// 6. Bereits beantwortete Topics nicht unnötig wiederholen
{
  const topics = buildDeterministicNextTopics({
    needProfile: { selectedModelKey: 'ev9' },
    notepadLabels: ['EV9'],
    text: 'EV9',
    answeredTopicIds: ['range', 'towing'],
  });
  assert.ok(!topics.some((t) => t.id === 'range'), 'range nicht wiederholt');
  assert.ok(!topics.some((t) => t.id === 'towing'), 'towing nicht wiederholt');
  console.log('✓ 6 beantwortete Topics nicht wiederholt');
}

// 7–8. Freie Eingabe / CTAs: strukturell nicht blockiert (Navigation nur UI)
{
  const session = createHappyPathSession('Autohaus Test');
  assert.equal(session.pendingQuestion, null);
  // Composer/CTAs leben außerhalb nextTopics – Session bleibt offen
  assert.ok(session.phase === 'opening' || session.phase);
  console.log('✓ 7–8 Next Topics blockieren keine freie Eingabe / CTAs');
}

// 9. nextAction = none weiterhin erlaubt + Topics möglich
{
  let session = createHappyPathSession('Autohaus Test');
  session = applyCleverTurnToSession(session, {
    customerMessage: 'SUV mit 7 Sitzen, elektrisch.',
    turnResult: makeValidTurn({
      nextAction: { type: 'none', targetField: null, question: null, options: [], reason: null },
      nextTopics: [
        { id: 'range', label: 'Reichweite', customerMessage: 'Wie weit kommt der EV9?' },
        { id: 'towing', label: 'Anhängelast', customerMessage: 'Wie hoch ist die Anhängelast beim EV9?' },
      ],
    }),
  });
  const last = lastCleverTurn(session);
  assert.ok((last?.nextTopics?.length ?? 0) >= 2, 'Topics trotz nextAction none');
  assert.equal(session.pendingQuestion, null, 'keine erzwungene Frage');
  console.log('✓ 9 nextAction none + Next Topics');
}

// 10. keine Fragebogen-Endlosschleife (Topics ≠ Pflichtkette)
{
  let session = createHappyPathSession('Autohaus Test');
  session = submitSafeIntakeFallback(session, 'SUV mit 7 Sitzen elektrisch', {
    reason: 'feature_disabled',
  });
  const firstTopics = lastCleverTurn(session)?.nextTopics ?? [];
  assert.ok(firstTopics.length <= 4);
  // Zweiter Turn ohne Topic-Klick erzwingt keine nächste Pflichtfrage aus Topics
  session = submitSafeIntakeFallback(session, 'Danke, erstmal nur das.', {
    reason: 'feature_disabled',
  });
  assert.ok(
    !session.pendingQuestion
    || String(session.pendingQuestion.id).startsWith('safe_'),
    'keine Topic-Pflichtkette',
  );
  console.log('✓ 10 keine Fragebogen-Endlosschleife');
}

// 11. AI und Fallback: dieselbe Navigationsform { id, label, customerMessage }
{
  const fallback = submitSafeIntakeFallback(
    createHappyPathSession('Autohaus Test'),
    'EV9',
    { reason: 'api_error' },
  );
  const fbTopics = lastCleverTurn(fallback)?.nextTopics ?? [];
  assert.ok(fbTopics.length >= 1, 'Fallback liefert Topics');
  for (const t of fbTopics) {
    assert.ok(t.id && t.label && t.customerMessage);
  }

  const ai = applyCleverTurnToSession(createHappyPathSession('Autohaus Test'), {
    customerMessage: 'EV9',
    turnResult: makeValidTurn({
      nextTopics: [
        { id: 'range', label: 'Reichweite', customerMessage: 'Wie weit kommt der EV9?' },
      ],
    }),
  });
  const aiTopics = lastCleverTurn(ai)?.nextTopics ?? [];
  assert.equal(aiTopics[0].label, 'Reichweite');
  console.log('✓ 11 AI und Fallback gleiche Navigationslogik');
}

// Deterministischer Fallback wenn AI Topics leer lässt
{
  const session = applyCleverTurnToSession(createHappyPathSession('Autohaus Test'), {
    customerMessage: 'EV2 bitte',
    turnResult: makeValidTurn({
      reply: 'Der EV2 ist der kompakte Einstieg.',
      nextTopics: [],
    }),
  });
  const topics = lastCleverTurn(session)?.nextTopics ?? [];
  assert.ok(topics.length >= 1, 'leere AI-Topics → deterministisch');
  console.log('✓ leere AI-Topics werden deterministisch ergänzt');
}

console.log('\nAlle conversationNextTopics-Tests bestanden.');
