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
  getOpeningCopy,
  getConversationInputPlaceholder,
  mapFreetextToQuestionAnswer,
  applyQuickHandoffEnrichment,
  submitConversationInput,
  submitOpeningMessage,
  submitQuestionAnswer,
  WARM_QUESTION_PROMPTS,
  selectRecommendedModel,
  submitVehicleAnswer,
  submitDealerHandoff,
  submitPersonalHandoff,
  isInVehicleWorld,
  OFFER_CONVERSATION_PHASE,
  OFFER_TURN_TYPE,
} from './consultationHappyPath.js';
import { buildEv3MiniRecommendation } from './consultationEv3HappyPath.js';
import { mergeTextIntoNeedProfile } from './needProfileService.js';
import { CLEVER_WORLD } from './consultationWorlds.js';
import { JOURNEY_PHASE } from '../journey/journeyTypes.js';
import { buildWishProfilePresentation } from './consultationOfferHandoff.js';

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
  assert.ok(!session.turns.some((t) => t.type === TURN_TYPE.LEARNED));
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

  session = submitDealerHandoff(session, { dealerId: 'autohaus-trinkle', contact: { name: 'Mike Quach' } });
  assert.equal(session.phase, OFFER_CONVERSATION_PHASE.OFFER_HANDOFF);
  const prepTurn = session.turns.find((t) => t.type === OFFER_TURN_TYPE.PERSONAL_HANDOFF);
  assert.ok(prepTurn?.handoffView?.advisor?.name);
  assert.ok(prepTurn?.handoffView?.preparedItems?.includes('Ihr Wunschprofil'));
  assert.ok(session.notepadLabels.length >= 4);

  const handoffResult = submitPersonalHandoff(session, {
    firstName: 'Tom',
    lastName: 'Kunde',
    email: 'tom@example.de',
    contactPreference: 'phone',
    contactTiming: 'today',
  }, { dealerId: 'autohaus-trinkle', contact: { name: 'Mike Quach' } });
  assert.equal(handoffResult.session.phase, OFFER_CONVERSATION_PHASE.OFFER_COMPLETE);
  assert.equal(handoffResult.session.needProfile.world, CLEVER_WORLD.OFFER);
  assert.equal(handoffResult.journey?.phase, JOURNEY_PHASE.FIRST_CONTACT);
  assert.ok(handoffResult.lead.crm.needProfile.world === 'offer');

  console.log('✓ Welt 2: EV3-Fragen → getrennte Notizen → Mini-Empfehlung → Welt 3 Übergabe');
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

function testFreetextNarrativeDuringOpenQuestion() {
  let session = createHappyPathSession('Autohaus Trinkle');
  session = submitOpeningMessage(session, HAPPY_PATH_EXAMPLE_MESSAGE);
  assert.equal(session.pendingQuestion?.id, 'longDistance');

  const tangential = 'Wir fahren übrigens zweimal im Jahr nach Kroatien.';
  session = submitConversationInput(session, tangential);

  assert.ok(
    session.turns.some((t) => t.type === TURN_TYPE.CUSTOMER && t.text === tangential),
    'Freitext wird als Kundenturn aufgenommen',
  );
  assert.equal(session.pendingQuestion, null, 'offene Rückfrage wird nicht erzwungen');
  console.log('✓ Freitext während Rückfrage: erzählen statt blockieren');
}

function testContextualPlaceholders() {
  const opening = createHappyPathSession('Test');
  assert.match(getConversationInputPlaceholder(opening), /Ich suche/);

  let session = submitOpeningMessage(opening, HAPPY_PATH_EXAMPLE_MESSAGE);
  const afterFirst = getConversationInputPlaceholder(session);
  assert.ok(
    /weiter|wissen|Urlaub/i.test(afterFirst),
    `nach erstem Turn: ${afterFirst}`,
  );

  session = submitQuestionAnswer(session, { answerId: 'often' });
  assert.match(getConversationInputPlaceholder(session), /Urlaub|wissen/i);

  console.log('✓ Placeholder wechselt kontextabhängig');
}

function testQuickHandoffEnrichment() {
  let session = createHappyPathSession('Autohaus Trinkle');
  session = submitOpeningMessage(session, HAPPY_PATH_EXAMPLE_MESSAGE);

  const enriched = applyQuickHandoffEnrichment(session, {
    selectedChipIds: ['horseTrailer'],
    freetext: 'Hund fährt mit.',
  });

  assert.ok(
    enriched.notepadLabels.some((l) => /pferde/i.test(l)),
    `Pferdeanhänger fehlt: ${enriched.notepadLabels.join(', ')}`,
  );
  assert.ok(
    enriched.turns.some((t) => t.type === TURN_TYPE.CUSTOMER && /Hund/i.test(t.text)),
    'Freitext landet im Gespräch',
  );

  const direct = applyQuickHandoffEnrichment(session, { selectedChipIds: [], freetext: '' });
  assert.equal(direct, session, 'leere Schnellaufnahme ändert nichts');

  console.log('✓ Schnellaufnahme nutzt mergeTextIntoNeedProfile und submitConversationInput');
}

function testUnderstandingMirrorOnOpening() {
  let session = createHappyPathSession('Autohaus Trinkle');
  session = submitOpeningMessage(session, HAPPY_PATH_EXAMPLE_MESSAGE);
  const mirror = session.turns.find((t) => t.type === TURN_TYPE.UNDERSTANDING_MIRROR);
  assert.ok(mirror, 'WOW-Moment fehlt nach erster Aussage');
  assert.ok(mirror.labels?.includes('Elektro'));
  console.log('✓ WOW-Moment spiegelt Verständnis nach erster Aussage');
}

function testWishProfileFromOpening() {
  let session = createHappyPathSession('Autohaus Trinkle');
  session = submitOpeningMessage(session, HAPPY_PATH_EXAMPLE_MESSAGE);
  const profile = buildWishProfilePresentation(session.needProfile, session.notepadLabels);
  assert.ok(profile.lines.length >= 3);
  console.log('✓ Eröffnung erzeugt kompaktes Wunschprofil');
}

function testWarmQuestionsSoundOptional() {
  const copy = WARM_QUESTION_PROMPTS.longDistance;
  assert.doesNotMatch(copy, /Darf ich|Wie viele Kilometer/i);
  assert.match(copy, /Reichweite|Stadtverkehr|Urlaub/i);
  console.log('✓ Rückfragen klingen nach Konsequenz, nicht nach Datenfeld');
}

function testFreetextMapping() {
  assert.equal(mapFreetextToQuestionAnswer('longDistance', 'Auch im Urlaub'), 'often');
  assert.equal(mapFreetextToQuestionAnswer('chargingAtHome', 'Ja, Garage'), 'yes');
  console.log('✓ Freitext-Chip-Mapping bleibt für Vorschläge erhalten');
}

function testOpeningIsNotAQuestion() {
  const session = createHappyPathSession('Test');
  const cleverTurns = session.turns.filter((t) => t.type === TURN_TYPE.CLEVER);
  assert.equal(cleverTurns.length, 0, 'Eröffnung: Clever fragt nicht zuerst');
  console.log('✓ Erster Clever-Satz ist keine Frage (Kunde beginnt)');
}

function testReceptionOpeningCopy() {
  const copy = getOpeningCopy('Autohaus Trinkle');
  assert.equal(copy.headline, 'Wonach suchen Sie?');
  assert.match(copy.placeholder, /Ich suche/);
  assert.equal(copy.voiceLabel, 'Spracheingabe');
  console.log('✓ Tool-Opening: Wonach suchen Sie? + Smart Entry');
}

testInitialParse();
testHappyPathFlow();
testEv3VehicleConsultationFlow();
testEv3MiniRecommendationContent();
testOnlyTwoGapQuestions();
testFreetextNarrativeDuringOpenQuestion();
testContextualPlaceholders();
testUnderstandingMirrorOnOpening();
testWishProfileFromOpening();
testQuickHandoffEnrichment();
testWarmQuestionsSoundOptional();
testFreetextMapping();
testOpeningIsNotAQuestion();
testReceptionOpeningCopy();
console.log('\nAlle Happy-Path-Tests bestanden.');
