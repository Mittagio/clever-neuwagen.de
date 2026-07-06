/**
 * Need Recognition – Testfälle für semantische Wunscherkennung
 */
import assert from 'node:assert/strict';
import {
  evaluateRecommendationReadiness,
  isQuestionAllowed,
  planNextQuestion,
} from './conversationPlanner.js';
import { mergeTextIntoNeedProfile } from './needProfileService.js';
import {
  getRecognitionQuestionBlocks,
  shouldSkipEv3EquipmentQuestion,
} from './needRecognitionService.js';
import { beginEv3VehicleConsultation, submitVehicleQuestionAnswer } from './consultationEv3HappyPath.js';
import { createHappyPathSession } from './consultationHappyPath.js';
import { CLEVER_WORLD } from './consultationWorlds.js';

function assertLabelsInclude(profile, expected = []) {
  for (const label of expected) {
    assert.ok(
      profile.understoodLabels.includes(label),
      `Label „${label}“ fehlt in: ${profile.understoodLabels.join(', ')}`,
    );
  }
}

function testSuvBenzinAllrad() {
  const profile = mergeTextIntoNeedProfile('SUV Benzin Automatik bis 40.000 € Allrad');
  assertLabelsInclude(profile, ['Benzin', 'SUV', 'Kauf', 'Allrad']);
  assert.equal(profile.drive, 'awd');

  const result = planNextQuestion({ needProfile: profile, answers: {} });
  assert.notEqual(result.question?.id, 'chargingAtHome');
  assert.notEqual(result.question?.id, 'allradNeed');
  assert.equal(isQuestionAllowed('allradNeed', { needProfile: profile }), false);
  console.log('✓ SUV Benzin Allrad → Chips + keine Wallbox/Allrad-Frage');
}

function testSportageFamilyAhk() {
  const profile = mergeTextIntoNeedProfile('Sportage Familie 2 Kinder AHK');
  assertLabelsInclude(profile, ['Familie', '2 Kinder', 'Anhängerkupplung', 'Sportage']);
  assert.equal(profile.towbar, true);
  assert.equal(profile.modelHint, 'sportage');

  const result = planNextQuestion({ needProfile: profile, answers: {} });
  assert.equal(result.question?.id, 'sportagePowertrain');
  const readiness = evaluateRecommendationReadiness({ needProfile: profile });
  assert.equal(readiness.ready, false);
  console.log('✓ Sportage Familie AHK → Chips + Antrieb zuerst, keine EV-Empfehlung');
}

function testElectricEquipmentBundle() {
  const profile = mergeTextIntoNeedProfile(
    'Elektroauto Allrad Anhängerkupplung Wärmepumpe 360° Kamera',
  );
  assertLabelsInclude(profile, [
    'Elektro',
    'Allrad',
    'Anhängerkupplung',
    'Wärmepumpe',
    '360° Kamera',
  ]);
  assert.ok(profile.equipmentWishes.includes('heat_pump'));
  assert.ok(profile.equipmentWishes.includes('camera_360'));
  assert.equal(profile.drive, 'awd');

  const blocks = getRecognitionQuestionBlocks(profile);
  assert.ok(blocks.has('allradNeed'));
  assert.ok(blocks.has('heatPump'));
  assert.ok(blocks.has('towCapacity'));

  const result = planNextQuestion({ needProfile: profile, answers: {} });
  assert.notEqual(result.question?.id, 'allradNeed');
  assert.notEqual(result.question?.id, 'chargingAtHome');
  console.log('✓ Elektro + Ausstattungswünsche → Chips, keine Doppel-Fragen');
}

function testEv3HudHeatPumpWorld2() {
  const profile = mergeTextIntoNeedProfile('EV3 mit Head-up-Display und Wärmepumpe');
  assertLabelsInclude(profile, ['EV3', 'Head-up-Display', 'Wärmepumpe']);
  assert.equal(profile.modelHint, 'ev3');
  assert.ok(shouldSkipEv3EquipmentQuestion(profile));

  let session = createHappyPathSession('Test');
  session = {
    ...session,
    needProfile: profile,
    notepadLabels: profile.understoodLabels,
  };
  session = beginEv3VehicleConsultation(session, 'ev3');
  assert.equal(session.pendingQuestion?.id, 'ev3Priority');
  assert.ok(session.vehicleNotepadLabels.includes('Wärmepumpe'));

  session = submitVehicleQuestionAnswer(session, { answerId: 'balanced' });
  assert.notEqual(session.pendingQuestion?.id, 'ev3Equipment');
  assert.equal(session.phase, 'vehicle_thinking');

  const vehicleCtx = {
    world: CLEVER_WORLD.VEHICLE_CONSULTATION,
    needProfile: profile,
    selectedModelKey: 'ev3',
    answers: {},
  };
  assert.equal(isQuestionAllowed('heatPump', vehicleCtx), false);
  assert.equal(isQuestionAllowed('hud', vehicleCtx), false);
  console.log('✓ EV3 + HUD/Wärmepumpe → Welt 2 ohne erneute Ausstattungsfrage');
}

function testPickupBenzinAutomatik() {
  const profile = mergeTextIntoNeedProfile('Pickup Benzin Automatik');
  assertLabelsInclude(profile, ['Pickup', 'Benzin', 'Automatik']);
  assert.equal(profile.bodyType, 'pickup');

  assert.equal(isQuestionAllowed('chargingAtHome', { needProfile: profile }), false);
  assert.equal(isQuestionAllowed('trunkImportance', { needProfile: profile }), false);

  const result = planNextQuestion({ needProfile: profile, answers: {} });
  assert.notEqual(result.question?.id, 'trunkImportance');
  console.log('✓ Pickup Benzin → keine Wallbox, Kofferraum depriorisiert');
}

testSuvBenzinAllrad();
testSportageFamilyAhk();
testElectricEquipmentBundle();
testEv3HudHeatPumpWorld2();
testPickupBenzinAutomatik();
console.log('\nAlle Need-Recognition-Tests bestanden.');
