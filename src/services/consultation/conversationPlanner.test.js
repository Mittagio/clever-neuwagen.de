/**
 * Conversation Planner – Phase 1 Testfälle (Spec experiments/conversation-planner)
 */
import assert from 'node:assert/strict';
import {
  evaluateRecommendationReadiness,
  isQuestionAllowed,
  planNextQuestion,
} from './conversationPlanner.js';
import {
  applyAnswerToNeedProfile,
  getHappyPathNextQuestion,
  submitOpeningMessage,
  createHappyPathSession,
} from './consultationHappyPath.js';
import { buildSellerThoughtBeforeQuestion } from '../clever/sellerReasoningEngine.js';
import { mergeTextIntoNeedProfile } from './needProfileService.js';
import { CLEVER_WORLD } from './consultationWorlds.js';

function testSportageBenzinNoWallbox() {
  const profile = mergeTextIntoNeedProfile('Sportage Benzin 2 Kinder AHK');
  const result = planNextQuestion({ needProfile: profile, answers: {} });

  assert.notEqual(result.question?.id, 'chargingAtHome', 'Keine Wallbox-Frage bei Benziner');
  assert.equal(isQuestionAllowed('chargingAtHome', { needProfile: profile }), false);
  assert.ok(profile.understoodLabels.includes('Benzin'), `Label Benzin: ${profile.understoodLabels.join(', ')}`);
  console.log('✓ Sportage Benzin 2 Kinder AHK → keine Wallbox-Frage');
}

function testSuvBenzinNoWallbox() {
  const profile = mergeTextIntoNeedProfile('SUV Benzin Automatik bis 40.000 € Allrad');
  const result = planNextQuestion({ needProfile: profile, answers: {} });

  assert.notEqual(result.question?.id, 'chargingAtHome');
  assert.notEqual(result.question?.id, 'allradNeed');
  assert.equal(isQuestionAllowed('chargingAtHome', { needProfile: profile }), false);
  assert.equal(isQuestionAllowed('allradNeed', { needProfile: profile }), false);
  assert.ok(profile.understoodLabels.includes('Allrad'));
  console.log('✓ SUV Benzin Automatik bis 40.000 € Allrad → keine Wallbox-Frage');
}

function testSportageFamilyFuelFirst() {
  const profile = mergeTextIntoNeedProfile('Sportage Familie 2 Kinder AHK');
  const result = planNextQuestion({ needProfile: profile, answers: {} });
  const readiness = evaluateRecommendationReadiness({ needProfile: profile });

  assert.equal(result.question?.id, 'towingUsage', `Erwartet towingUsage bei AHK, bekam ${result.question?.id}`);
  assert.notEqual(result.question?.id, 'fuel_type', 'Keine generische Antriebsfrage bei Sportage');
  assert.equal(readiness.ready, false);
  assert.equal(readiness.blocker, 'fuel_unknown');
  console.log('✓ Sportage Familie ohne Antrieb → Anhängerart bei erkanntem AHK');
}

function testElectricFamilyChargingAllowed() {
  const profile = mergeTextIntoNeedProfile('Elektro Familie 2 Kinder 350 Euro');
  const afterLongDistance = planNextQuestion({
    needProfile: profile,
    answers: { longDistance: 'rarely' },
  });

  assert.equal(afterLongDistance.question?.id, 'evModelPriority');
  assert.equal(
    isQuestionAllowed('chargingAtHome', { needProfile: profile, answers: { longDistance: 'rarely' } }),
    true,
  );

  const afterPriority = planNextQuestion({
    needProfile: profile,
    answers: { longDistance: 'rarely', evModelPriority: 'balanced' },
  });
  assert.equal(afterPriority.question?.id, 'chargingAtHome');
  console.log('✓ Elektro Familie → Alltag/Urlaub, Priorität, dann Ladefrage');
}

function testEv3HeatPumpAllowed() {
  const ctx = {
    world: CLEVER_WORLD.VEHICLE_CONSULTATION,
    needProfile: { fuel: 'electric', selectedModelKey: 'ev3' },
    selectedModelKey: 'ev3',
    answers: {},
  };
  assert.equal(isQuestionAllowed('heatPump', ctx), true);
  console.log('✓ EV3 gewählt → Wärmepumpe erlaubt');
}

function testSportageBenzinNoHeatPump() {
  const ctx = {
    world: CLEVER_WORLD.VEHICLE_CONSULTATION,
    needProfile: { fuel: 'verbrenner', modelHint: 'sportage', selectedModelKey: 'sportage' },
    selectedModelKey: 'sportage',
    answers: {},
  };
  assert.equal(isQuestionAllowed('heatPump', ctx), false);
  console.log('✓ Sportage Benzin → Wärmepumpe nicht erlaubt');
}

function testCombustionLongDistanceLabel() {
  let profile = mergeTextIntoNeedProfile('Sportage Benzin 2 Kinder AHK');
  profile = applyAnswerToNeedProfile(profile, 'longDistance', 'often');

  assert.ok(!profile.understoodLabels.includes('Reichweite wichtig'));
  assert.ok(profile.understoodLabels.includes('Langstrecke'));
  console.log('✓ Benziner + Langstrecke → Label „Langstrecke“, nicht „Reichweite wichtig“');
}

function testHappyPathElectricStillWorks() {
  const profile = mergeTextIntoNeedProfile(
    'Ich suche ein Elektroauto für zwei Kinder bis etwa 350 € im Monat.',
  );
  const q1 = getHappyPathNextQuestion(profile, { answers: {} });
  assert.equal(q1?.id, 'longDistance');

  const q2 = getHappyPathNextQuestion(profile, { answers: { longDistance: 'often' } });
  assert.equal(q2?.id, 'evModelPriority');

  const q3 = getHappyPathNextQuestion(profile, { answers: { longDistance: 'often', evModelPriority: 'balanced' } });
  assert.equal(q3?.id, 'chargingAtHome');
  console.log('✓ Elektro-Happy-Path: Langstrecke → Priorität → Laden zuhause');
}

function testEv3OpeningNoFuelQuestion() {
  const profile = mergeTextIntoNeedProfile('mir gefällt der ev3');
  const q = getHappyPathNextQuestion(profile, { answers: {} });

  assert.equal(profile.selectedModelKey, 'ev3');
  assert.ok(profile.understoodLabels.includes('EV3'), `EV3-Chip fehlt: ${profile.understoodLabels.join(', ')}`);
  assert.ok(profile.understoodLabels.includes('Elektro'), `Elektro-Chip fehlt: ${profile.understoodLabels.join(', ')}`);
  assert.equal(q?.id, 'evModelPriority', `Erwartet evModelPriority, bekam ${q?.id}`);
  assert.equal(isQuestionAllowed('fuel_type', { needProfile: profile }), false);
  assert.match(q?.prompt ?? '', /günstigste Rate|Ausstattung/i);
  assert.doesNotMatch(q?.prompt ?? '', /Benzin, Hybrid oder Elektro/i);
  console.log('✓ „mir gefällt der ev3“ → EV3 + Elektro Chips, Rate/Ausstattung, keine Antriebsfrage');
}

function testSportageTowingContextualQuestion() {
  const profile = mergeTextIntoNeedProfile('Ich suche einen Sportage mit Anhängerkupplung');
  const q = getHappyPathNextQuestion(profile, { answers: {} });

  assert.ok(profile.understoodLabels.includes('Sportage'), `Sportage fehlt: ${profile.understoodLabels.join(', ')}`);
  assert.ok(profile.understoodLabels.includes('Anhängerkupplung'), `AHK fehlt: ${profile.understoodLabels.join(', ')}`);
  assert.equal(q?.id, 'towingUsage');
  assert.match(q?.prompt ?? '', /ziehen|Anhänger/i);
  const thought = buildSellerThoughtBeforeQuestion({ needProfile: profile, answers: {} });
  assert.match(thought ?? '', /Sportage|Richtung/i);
  assert.notEqual(q?.id, 'fuel_type');
  console.log('✓ Sportage mit AHK → Sportage + AHK Chips, Anhängerart-Frage');
}

function testMinimalWishPrimaryUsage() {
  const profile = mergeTextIntoNeedProfile('Ich suche ein Auto');
  const q = getHappyPathNextQuestion(profile, { answers: {} });

  assert.equal(q?.id, 'primaryUsage');
  assert.match(q?.prompt ?? '', /Familie|Zweitwagen|selbst/i);
  assert.equal(isQuestionAllowed('fuel_type', { needProfile: profile }), false);
  console.log('✓ „Ich suche ein Auto“ → Nutzungsfrage, nicht Antriebsfrage');
}

function testAllradRecognizedNoAllradQuestion() {
  const profile = mergeTextIntoNeedProfile('SUV Benzin Automatik Allrad');
  const result = planNextQuestion({ needProfile: profile, answers: {} });

  assert.ok(profile.understoodLabels.includes('Allrad'));
  assert.notEqual(result.question?.id, 'allradNeed');
  assert.equal(isQuestionAllowed('allradNeed', { needProfile: profile }), false);
  console.log('✓ Allrad erkannt → keine Allrad-Grundsatzfrage');
}

function testTowingRecognizedNoTowingYesNo() {
  const profile = mergeTextIntoNeedProfile('Sportage mit Anhängerkupplung');
  const result = planNextQuestion({ needProfile: profile, answers: {} });

  assert.ok(profile.understoodLabels.includes('Anhängerkupplung'));
  assert.notEqual(result.question?.id, 'towingNeed', 'Keine AHK-Grundsatzfrage');
  const allowedIds = ['sportagePowertrain', 'towingUsage'];
  assert.ok(allowedIds.includes(result.question?.id), `Unerwartete Frage: ${result.question?.id}`);
  console.log('✓ AHK erkannt → keine AHK-Grundsatzfrage, höchstens Nutzung oder Antrieb');
}

function testEv3OpeningSessionFlow() {
  let session = createHappyPathSession('Autohaus Trinkle');
  session = submitOpeningMessage(session, 'mir gefällt der ev3');

  assert.ok(session.notepadLabels.includes('EV3'));
  assert.ok(session.notepadLabels.includes('Elektro'));
  assert.equal(session.pendingQuestion?.id, 'evModelPriority');
  const cleverTurn = session.turns.find((t) => t.type === 'clever' && t.questionId === 'evModelPriority');
  assert.match(cleverTurn?.text ?? '', /günstigste Rate|Ausstattung/i);
  console.log('✓ Session: EV3-Eingang → Chips wachsen, nächste Frage Rate/Ausstattung');
}

testSportageBenzinNoWallbox();
testSuvBenzinNoWallbox();
testSportageFamilyFuelFirst();
testElectricFamilyChargingAllowed();
testEv3HeatPumpAllowed();
testSportageBenzinNoHeatPump();
testCombustionLongDistanceLabel();
testHappyPathElectricStillWorks();
testEv3OpeningNoFuelQuestion();
testSportageTowingContextualQuestion();
testMinimalWishPrimaryUsage();
testAllradRecognizedNoAllradQuestion();
testTowingRecognizedNoTowingYesNo();
testEv3OpeningSessionFlow();
console.log('\nAlle Conversation-Planner-Tests bestanden.');
