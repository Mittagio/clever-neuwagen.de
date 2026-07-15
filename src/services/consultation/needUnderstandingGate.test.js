/**
 * Sprint 2 – Verständnis nicht kaputtfragen
 */
import assert from 'node:assert/strict';
import { mergeTextIntoNeedProfile } from './needProfileService.js';
import { planNextQuestion } from './conversationPlanner.js';
import {
  CONVERSATION_PHASE,
  createHappyPathSession,
  resolveNextHappyPathQuestion,
  submitConversationInput,
  submitOpeningMessage,
  submitQuestionAnswer,
  TURN_TYPE,
} from './consultationHappyPath.js';
import {
  NEED_DIRECTION_QUESTION_ID,
  SELLER_READINESS_QUESTION_ID,
  buildNeedDirectionQuestion,
  buildSellerReadinessQuestion,
  hasCompleteVehicleBrief,
  hasEssentialSellerGaps,
  hasRichNeedPicture,
  questionImprovesUnderstanding,
  shouldOfferDirectionChoice,
  shouldOfferSellerReadinessGate,
} from './needUnderstandingGate.js';

function testSportageStrongMessageSkipsComfortQuestion() {
  const profile = mergeTextIntoNeedProfile(
    'Sportage Diesel mit Allrad und Automatik bis 45.000 €',
  );
  assert.ok(hasRichNeedPicture(profile));
  const planned = planNextQuestion({ needProfile: profile, answers: {} });
  assert.equal(planned.question?.id, 'longDistance');
  assert.ok(hasCompleteVehicleBrief(profile));
  assert.equal(hasEssentialSellerGaps(profile, {}), false);
  assert.ok(shouldOfferSellerReadinessGate(profile, { answers: {} }));

  const sellerQ = buildSellerReadinessQuestion(profile);
  assert.match(sellerQ.prompt, /Fehlt Ihrem Berater noch etwas Wesentliches/i);
  assert.match(sellerQ.prompt, /Sportage/i);
  console.log('✓ Sportage stark erkannt → Verkäufer-Bereitschaft statt Optimierungsfrage');
}

function testSportageOpeningShowsSellerReadinessNotCatalog() {
  let session = createHappyPathSession('Autohaus Trinkle');
  session = submitOpeningMessage(
    session,
    'Sportage Diesel mit Allrad und Automatik bis 45.000 €',
  );

  assert.equal(session.pendingQuestion?.id, SELLER_READINESS_QUESTION_ID);
  const cleverTurn = session.turns.find(
    (t) => t.type === TURN_TYPE.CLEVER && t.questionId === SELLER_READINESS_QUESTION_ID,
  );
  assert.match(cleverTurn?.text ?? '', /Fehlt Ihrem Berater noch etwas Wesentliches/i);
  assert.doesNotMatch(cleverTurn?.text ?? '', /Antrieb schon einen Favoriten/i);
  assert.doesNotMatch(cleverTurn?.text ?? '', /komfortabel/i);
  console.log('✓ Eröffnung Sportage → Verkäufer-Bereitschaft statt Katalogfrage');
}

function testSellerReadyEntersHandoffState() {
  let session = createHappyPathSession('Autohaus Trinkle');
  session = submitOpeningMessage(
    session,
    'Sportage Diesel mit Allrad und Automatik bis 45.000 €',
  );
  session = submitQuestionAnswer(session, { answerId: 'seller_ready' });

  assert.equal(session.phase, CONVERSATION_PHASE.HANDOFF);
  assert.equal(session.sellerReady, true);
  assert.equal(session.consultationProfile?.sellerReady, true);
  assert.equal(session.pendingQuestion, null);
  assert.match(
    session.turns.at(-1)?.text ?? '',
    /Berater kann direkt einsteigen/i,
  );
  console.log('✓ seller_ready → Übergabezustand ohne weitere Optimierungsfragen');
}

function testStillMissingEntersCollectModeWithoutFollowUp() {
  let session = createHappyPathSession('Autohaus Trinkle');
  session = submitOpeningMessage(
    session,
    'Sportage Diesel mit Allrad und Automatik bis 45.000 €',
  );
  session = submitQuestionAnswer(session, { answerId: 'still_missing' });

  assert.equal(session.phase, CONVERSATION_PHASE.HANDOFF);
  assert.equal(session.advisorCollectMode, true);
  assert.equal(session.consultationProfile?.advisorCollectMode, true);
  assert.ok(session.turns.some((t) => t.type === TURN_TYPE.ADVISOR_COLLECT));
  assert.equal(session.pendingQuestion, null);
  assert.doesNotMatch(
    session.turns.at(-1)?.text ?? '',
    /erzählen Sie einfach/i,
  );

  session = submitConversationInput(session, 'farbe blau und dachreling');
  assert.equal(session.pendingQuestion, null);
  assert.equal(resolveNextHappyPathQuestion(session.needProfile, session.consultationProfile), null);
  const cleverTurns = session.turns.filter((t) => t.type === TURN_TYPE.CLEVER);
  assert.ok(
    !cleverTurns.some((t) => /reichweite|ausstattung/i.test(t.text ?? '')),
    'Keine weitere Berater-Rückfrage nach Sammelmodus',
  );
  console.log('✓ still_missing → Sammelmodus ohne weitere Clever-Fragen');
}

function testElektroFamilyStillAsksLongDistance() {
  const profile = mergeTextIntoNeedProfile(
    'Ich suche ein Elektroauto für zwei Kinder bis etwa 350 € im Monat.',
  );
  const catalog = planNextQuestion({ needProfile: profile, answers: {} });
  assert.equal(catalog.question?.id, 'longDistance');
  assert.equal(questionImprovesUnderstanding('longDistance', profile, {}), true);
  assert.equal(shouldOfferSellerReadinessGate(profile, { answers: {} }), false);

  const next = resolveNextHappyPathQuestion(profile, { answers: {} });
  assert.equal(next?.id, 'longDistance');
  console.log('✓ Elektro-Familie ohne reiches Bild → Langstrecke bleibt sinnvolle Frage');
}

function testMinimalWishStillAsksUsage() {
  const profile = mergeTextIntoNeedProfile('Ich suche ein Auto');
  const catalog = planNextQuestion({ needProfile: profile, answers: {} });
  assert.equal(catalog.question?.id, 'primaryUsage');
  assert.equal(shouldOfferSellerReadinessGate(profile, { answers: {} }), false);
  console.log('✓ Minimaler Wunsch → Nutzungsfrage bleibt');
}

function testSportageFamilyAhkStillAsksPowertrain() {
  const profile = mergeTextIntoNeedProfile('Sportage Familie 2 Kinder AHK');
  const catalog = planNextQuestion({ needProfile: profile, answers: {} });
  assert.equal(catalog.question?.id, 'towingUsage');
  assert.equal(shouldOfferSellerReadinessGate(profile, { answers: {} }), false);
  console.log('✓ Sportage mit AHK → Anhängerart vor Antrieb');
}

function testDirectionExploreModelShowsDirections() {
  const profile = mergeTextIntoNeedProfile(
    'Sportage Diesel mit Allrad und Automatik bis 45.000 €',
  );
  const direction = buildNeedDirectionQuestion(profile);
  let session = {
    ...createHappyPathSession('Test'),
    needProfile: profile,
    notepadLabels: profile.understoodLabels ?? [],
    consultationProfile: {
      answers: { [SELLER_READINESS_QUESTION_ID]: 'still_missing' },
      sellerReady: false,
    },
    pendingQuestion: { id: direction.id, options: direction.options },
    turns: [{
      type: TURN_TYPE.CLEVER,
      id: 'clever-direction',
      questionId: direction.id,
      text: direction.prompt,
      options: direction.options,
    }],
  };

  session = submitQuestionAnswer(session, { answerId: 'explore_model' });
  assert.equal(session.pendingQuestion, null);
  assert.equal(session.needProfile.selectedModelKey, 'sportage');
  const directionsTurn = session.turns.find((t) => t.type === TURN_TYPE.VEHICLE_DIRECTIONS);
  assert.ok(directionsTurn, 'Richtungsübersicht fehlt nach „genauer ansehen“');
  assert.ok(directionsTurn.directionsView.directions.some((d) => d.modelKey === 'sportage'));
  console.log('✓ Richtungswahl „genauer ansehen“ → Fahrzeugrichtungen');
}

testSportageStrongMessageSkipsComfortQuestion();
testSportageOpeningShowsSellerReadinessNotCatalog();
testSellerReadyEntersHandoffState();
testStillMissingEntersCollectModeWithoutFollowUp();
testElektroFamilyStillAsksLongDistance();
testMinimalWishStillAsksUsage();
testSportageFamilyAhkStillAsksPowertrain();
testDirectionExploreModelShowsDirections();
console.log('\nAlle Understanding-Gate-Tests bestanden.');
