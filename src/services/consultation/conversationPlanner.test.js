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
} from './consultationHappyPath.js';
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

  assert.equal(result.question?.id, 'fuel_type', `Erwartet fuel_type, bekam ${result.question?.id}`);
  assert.equal(readiness.ready, false);
  assert.equal(readiness.blocker, 'fuel_unknown');
  console.log('✓ Sportage Familie ohne Antrieb → zuerst Antrieb klären, keine Empfehlung');
}

function testElectricFamilyChargingAllowed() {
  const profile = mergeTextIntoNeedProfile('Elektro Familie 2 Kinder 350 Euro');
  const afterLongDistance = planNextQuestion({
    needProfile: profile,
    answers: { longDistance: 'rarely' },
  });

  assert.equal(isQuestionAllowed('chargingAtHome', { needProfile: profile }), true);
  assert.equal(afterLongDistance.question?.id, 'chargingAtHome');
  console.log('✓ Elektro Familie 2 Kinder 350 € → Ladefrage erlaubt');
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
  assert.equal(q2?.id, 'chargingAtHome');
  console.log('✓ Elektro-Happy-Path: Langstrecke → Laden zuhause');
}

testSportageBenzinNoWallbox();
testSuvBenzinNoWallbox();
testSportageFamilyFuelFirst();
testElectricFamilyChargingAllowed();
testEv3HeatPumpAllowed();
testSportageBenzinNoHeatPump();
testCombustionLongDistanceLabel();
testHappyPathElectricStillWorks();
console.log('\nAlle Conversation-Planner-Tests bestanden.');
