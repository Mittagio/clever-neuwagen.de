/**
 * Happy Path 1 – „Elektroauto für zwei Kinder bis 350 €“
 */
import assert from 'node:assert/strict';
import {
  CONVERSATION_PHASE,
  HAPPY_PATH_EXAMPLE_MESSAGE,
  TURN_TYPE,
  VEHICLE_CONVERSATION_PHASE,
  VEHICLE_TURN_TYPE,
  advanceFromThinking,
  advanceFromVehicleThinking,
  createHappyPathSession,
  getHappyPathNextQuestion,
  mapFreetextToQuestionAnswer,
  submitOpeningMessage,
  submitQuestionAnswer,
  selectRecommendedModel,
  submitVehicleAnswer,
  submitDealerHandoff,
  isInVehicleWorld,
} from './consultationHappyPath.js';
import { buildEv3MiniRecommendation } from './consultationEv3HappyPath.js';
import { mergeTextIntoNeedProfile } from './needProfileService.js';
import { CLEVER_WORLD } from './consultationWorlds.js';

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
  assert.equal(session.phase, VEHICLE_CONVERSATION_PHASE.VEHICLE_CONVERSATION);
  assert.ok(isInVehicleWorld(session));
  assert.ok(session.notepadLabels.length >= 4, 'NeedProfile bleibt erhalten');
  assert.equal(session.vehicleChapterTitle, 'Fahrzeugberatung · Kia EV3');
  assert.ok(session.turns.some((t) => t.type === TURN_TYPE.HANDOFF));
  assert.ok(session.turns.some((t) => t.type === TURN_TYPE.CLEVER && t.questionId === 'ev3Priority'));
  assert.equal(session.pendingQuestion?.id, 'ev3Priority');
  assert.equal(session.pendingQuestion?.world, CLEVER_WORLD.VEHICLE_CONSULTATION);

  console.log('✓ Happy Path: Eröffnung → 2 Fragen → EV3-Empfehlung → Fahrzeugberatung');
}

function testEv3VehicleConsultationFlow() {
  let session = createHappyPathSession('Autohaus Trinkle');
  session = submitOpeningMessage(session, HAPPY_PATH_EXAMPLE_MESSAGE);
  session = submitQuestionAnswer(session, { answerId: 'often' });
  session = submitQuestionAnswer(session, { text: 'Ja, Garage' });
  session = advanceFromThinking(session);
  session = selectRecommendedModel(session, 'ev3');

  const world1CleverCount = session.turns.filter(
    (t) => t.type === TURN_TYPE.CLEVER && t.questionId !== 'ev3Priority' && t.questionId !== 'ev3Equipment',
  ).length;
  assert.ok(world1CleverCount >= 2, 'Welt-1-Fragen vor Modellwahl');

  session = submitVehicleAnswer(session, { answerId: 'range' });
  assert.ok(session.vehicleNotepadLabels.includes('Größere Reichweite'));
  assert.ok(session.turns.some((t) => t.type === VEHICLE_TURN_TYPE.CLEVER_REFLECTION));
  assert.equal(session.pendingQuestion?.id, 'ev3Equipment');

  session = submitVehicleAnswer(session, { answerId: 'heatPump' });
  assert.equal(session.phase, VEHICLE_CONVERSATION_PHASE.VEHICLE_THINKING);
  assert.ok(session.vehicleNotepadLabels.includes('Wärmepumpe'));

  session = advanceFromVehicleThinking(session);
  assert.equal(session.phase, VEHICLE_CONVERSATION_PHASE.VEHICLE_MINI_REC);
  assert.ok(session.vehicleMiniRecommendation?.ready);
  assert.equal(session.vehicleMiniRecommendation.hasRate, false);
  assert.equal(session.vehicleMiniRecommendation.hasOffer, false);
  assert.ok(!JSON.stringify(session.vehicleMiniRecommendation).match(/€\s*\d|leasing|angebot/i));

  session = submitDealerHandoff(session);
  assert.equal(session.phase, VEHICLE_CONVERSATION_PHASE.DEALER_PREP);
  const prepTurn = session.turns.find((t) => t.type === VEHICLE_TURN_TYPE.DEALER_PREP_CARD);
  assert.ok(prepTurn?.summary?.items?.includes('Ihr Wunschprofil'));
  assert.ok(prepTurn?.summary?.items?.includes('Die EV3-Richtung'));
  assert.ok(session.notepadLabels.length >= 4);

  console.log('✓ Welt 2: EV3-Fragen → getrennte Notizen → Mini-Empfehlung → Handoff-Karte');
}

function testEv3MiniRecommendationContent() {
  const rec = buildEv3MiniRecommendation(
    { answers: { ev3Priority: 'range', ev3Equipment: 'heatPump' } },
    { priorities: ['family'], children: 2, longDistance: 'often' },
  );
  assert.ok(rec.batteryLine.includes('großer Batterie'));
  assert.ok(rec.trimLine.includes('Earth'));
  assert.ok(rec.whyLines.some((l) => /Familie|Strecken|Ausstattung/i.test(l)));
  console.log('✓ EV3 Mini-Empfehlung ohne Rate und ohne Angebot');
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
testEv3VehicleConsultationFlow();
testEv3MiniRecommendationContent();
testOnlyTwoGapQuestions();
testFreetextMapping();
testOpeningIsNotAQuestion();
console.log('\nAlle Happy-Path-Tests bestanden.');
