/**
 * Sprint 2 – Verständnis nicht kaputtfragen
 */
import assert from 'node:assert/strict';
import { mergeTextIntoNeedProfile } from './needProfileService.js';
import { planNextQuestion } from './conversationPlanner.js';
import {
  createHappyPathSession,
  resolveNextHappyPathQuestion,
  submitOpeningMessage,
  submitQuestionAnswer,
} from './consultationHappyPath.js';
import {
  NEED_DIRECTION_QUESTION_ID,
  buildNeedDirectionQuestion,
  hasCompleteVehicleBrief,
  hasRichNeedPicture,
  questionImprovesUnderstanding,
  shouldOfferDirectionChoice,
} from './needUnderstandingGate.js';

function testSportageStrongMessageSkipsComfortQuestion() {
  const profile = mergeTextIntoNeedProfile(
    'Sportage Diesel mit Allrad und Automatik bis 45.000 €',
  );
  assert.ok(hasRichNeedPicture(profile));
  const planned = planNextQuestion({ needProfile: profile, answers: {} });
  assert.equal(planned.question?.id, 'longDistance');
  assert.ok(hasCompleteVehicleBrief(profile));
  assert.ok(shouldOfferDirectionChoice(profile, planned.question, {}));

  const direction = buildNeedDirectionQuestion(profile);
  assert.match(direction.prompt, /gutes Bild/i);
  assert.match(direction.prompt, /Sportage genauer ansehen/i);
  assert.match(direction.prompt, /ähnliche Fahrzeuge einordnen/i);
  console.log('✓ Sportage stark erkannt → keine Komfort-Frage, Richtungswahl');
}

function testSportageOpeningShowsDirectionNotCatalog() {
  let session = createHappyPathSession('Autohaus Trinkle');
  session = submitOpeningMessage(
    session,
    'Sportage Diesel mit Allrad und Automatik bis 45.000 €',
  );

  assert.equal(session.pendingQuestion?.id, NEED_DIRECTION_QUESTION_ID);
  const cleverTurn = session.turns.find((t) => t.type === 'clever');
  assert.match(cleverTurn?.text ?? '', /gutes Bild/i);
  assert.doesNotMatch(cleverTurn?.text ?? '', /Antrieb schon einen Favoriten/i);
  assert.doesNotMatch(cleverTurn?.text ?? '', /komfortabel/i);
  console.log('✓ Eröffnung Sportage → Richtungswahl statt Katalogfrage');
}

function testElektroFamilyStillAsksLongDistance() {
  const profile = mergeTextIntoNeedProfile(
    'Ich suche ein Elektroauto für zwei Kinder bis etwa 350 € im Monat.',
  );
  const catalog = planNextQuestion({ needProfile: profile, answers: {} });
  assert.equal(catalog.question?.id, 'longDistance');
  assert.equal(questionImprovesUnderstanding('longDistance', profile, {}), true);
  assert.equal(shouldOfferDirectionChoice(profile, catalog.question, {}), false);

  const next = resolveNextHappyPathQuestion(profile, { answers: {} });
  assert.equal(next?.id, 'longDistance');
  console.log('✓ Elektro-Familie → Langstrecke bleibt sinnvolle Frage');
}

function testMinimalWishStillAsksUsage() {
  const profile = mergeTextIntoNeedProfile('Ich suche ein Auto');
  const catalog = planNextQuestion({ needProfile: profile, answers: {} });
  assert.equal(catalog.question?.id, 'primaryUsage');
  assert.equal(shouldOfferDirectionChoice(profile, catalog.question, {}), false);
  console.log('✓ Minimaler Wunsch → Nutzungsfrage bleibt');
}

function testSportageFamilyAhkStillAsksPowertrain() {
  const profile = mergeTextIntoNeedProfile('Sportage Familie 2 Kinder AHK');
  const catalog = planNextQuestion({ needProfile: profile, answers: {} });
  assert.equal(catalog.question?.id, 'sportagePowertrain');
  assert.equal(shouldOfferDirectionChoice(profile, catalog.question, {}), false);
  console.log('✓ Sportage ohne Antrieb → modellspezifische Antriebsfrage');
}

function testDirectionExploreModelAcknowledgment() {
  let session = createHappyPathSession('Test');
  session = submitOpeningMessage(
    session,
    'Sportage Diesel mit Allrad und Automatik bis 45.000 €',
  );
  session = submitQuestionAnswer(session, { answerId: 'explore_model' });
  assert.equal(session.pendingQuestion, null);
  assert.equal(session.needProfile.selectedModelKey, 'sportage');
  const lastClever = [...session.turns].reverse().find((t) => t.type === 'clever');
  assert.match(lastClever?.text ?? '', /Sportage/i);
  console.log('✓ Richtungswahl „genauer ansehen“ → Bestätigung ohne Katalog');
}

testSportageStrongMessageSkipsComfortQuestion();
testSportageOpeningShowsDirectionNotCatalog();
testElektroFamilyStillAsksLongDistance();
testMinimalWishStillAsksUsage();
testSportageFamilyAhkStillAsksPowertrain();
testDirectionExploreModelAcknowledgment();
console.log('\nAlle Understanding-Gate-Tests bestanden.');
