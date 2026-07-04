/**
 * Happy Path 1 – „Elektroauto für zwei Kinder bis 350 €“
 */
import assert from 'node:assert/strict';
import {
  CONVERSATION_PHASE,
  HAPPY_PATH_EXAMPLE_MESSAGE,
  TURN_TYPE,
  advanceFromThinking,
  createHappyPathSession,
  getHappyPathNextQuestion,
  mapFreetextToQuestionAnswer,
  submitOpeningMessage,
  submitQuestionAnswer,
  selectRecommendedModel,
} from './consultationHappyPath.js';
import { mergeTextIntoNeedProfile } from './needProfileService.js';

function testInitialParse() {
  const profile = mergeTextIntoNeedProfile(HAPPY_PATH_EXAMPLE_MESSAGE);
  const labels = profile.understoodLabels ?? [];
  assert.ok(labels.includes('Elektro'), `Elektro fehlt: ${labels.join(', ')}`);
  assert.ok(labels.includes('Familie'), `Familie fehlt: ${labels.join(', ')}`);
  assert.ok(labels.includes('2 Kinder'), `2 Kinder fehlt: ${labels.join(', ')}`);
  assert.ok(labels.some((l) => l.includes('350')), `Budget fehlt: ${labels.join(', ')}`);
  console.log('✓ Parser erkennt Elektro, Familie, 2 Kinder, Budget');
}

function testHappyPathFlow() {
  let session = createHappyPathSession('Autohaus Trinkle');
  session = submitOpeningMessage(session, HAPPY_PATH_EXAMPLE_MESSAGE);

  assert.equal(session.phase, CONVERSATION_PHASE.CONVERSATION);
  assert.ok(session.notepadLabels.length >= 4, 'Notizleiste soll wachsen');
  assert.ok(session.turns.some((t) => t.type === TURN_TYPE.CUSTOMER));
  assert.ok(session.turns.some((t) => t.type === TURN_TYPE.LEARNED));
  assert.ok(session.turns.some((t) => t.type === TURN_TYPE.CLEVER));
  assert.equal(session.pendingQuestion?.id, 'longDistance');

  session = submitQuestionAnswer(session, { answerId: 'often' });
  assert.equal(session.pendingQuestion?.id, 'chargingAtHome');
  assert.ok(session.notepadLabels.includes('Langstrecke'));

  session = submitQuestionAnswer(session, { text: 'Ja, Garage' });
  assert.equal(session.phase, CONVERSATION_PHASE.THINKING);

  session = advanceFromThinking(session);
  assert.equal(session.phase, CONVERSATION_PHASE.RECOMMENDATION);
  assert.ok(session.recommendation?.ready);
  assert.equal(session.recommendation.primary.modelKey, 'ev3');
  assert.match(session.recommendation.modelName ?? '', /EV3/i);
  assert.ok(session.recommendation.personalLead);
  assert.ok(session.recommendation.primary.whyLines?.some((l) => /Familie/i.test(l)));

  session = selectRecommendedModel(session, 'ev3');
  assert.equal(session.phase, CONVERSATION_PHASE.HANDOFF);
  assert.ok(session.turns.some((t) => t.type === TURN_TYPE.HANDOFF && t.chapterTitle));

  console.log('✓ Happy Path: Eröffnung → 2 Fragen → EV3-Empfehlung → Handoff');
}

function testOnlyTwoGapQuestions() {
  const needProfile = mergeTextIntoNeedProfile(HAPPY_PATH_EXAMPLE_MESSAGE);
  const consultationProfile = { answers: {} };
  const q1 = getHappyPathNextQuestion(needProfile, consultationProfile);
  assert.equal(q1?.id, 'longDistance');

  const afterFirst = { answers: { longDistance: 'often' } };
  const q2 = getHappyPathNextQuestion(needProfile, afterFirst);
  assert.equal(q2?.id, 'chargingAtHome');

  const afterSecond = { answers: { longDistance: 'often', chargingAtHome: 'yes' } };
  const q3 = getHappyPathNextQuestion(needProfile, afterSecond);
  assert.equal(q3, null);

  console.log('✓ Nur Langstrecke + Laden zuhause – kein erneutes Budget/Familie');
}

function testFreetextMapping() {
  assert.equal(mapFreetextToQuestionAnswer('longDistance', 'Auch im Urlaub'), 'often');
  assert.equal(mapFreetextToQuestionAnswer('chargingAtHome', 'Ja, Garage'), 'yes');
  console.log('✓ Freitext-Antworten werden erkannt');
}

function testOpeningIsNotAQuestion() {
  const session = createHappyPathSession('Test');
  const cleverTurns = session.turns.filter((t) => t.type === TURN_TYPE.CLEVER);
  assert.equal(cleverTurns.length, 0, 'Eröffnung: Clever fragt nicht zuerst');
  console.log('✓ Erster Clever-Satz ist keine Frage (Kunde beginnt)');
}

testInitialParse();
testHappyPathFlow();
testOnlyTwoGapQuestions();
testFreetextMapping();
testOpeningIsNotAQuestion();
console.log('\nAlle Happy-Path-Tests bestanden.');
