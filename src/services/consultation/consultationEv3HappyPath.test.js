/**
 * Welt 2 – EV3 Fahrzeugberatung (isolierte Unit-Tests).
 */
import assert from 'node:assert/strict';
import {
  beginEv3VehicleConsultation,
  buildEv3MiniRecommendation,
  mapVehicleFreetextToAnswer,
  submitVehicleQuestionAnswer,
  advanceFromVehicleThinking,
} from './consultationEv3HappyPath.js';
import { createHappyPathSession } from './consultationHappyPath.js';
import { CLEVER_WORLD } from './consultationWorlds.js';

function testBeginVehicleConsultation() {
  const session = beginEv3VehicleConsultation(createHappyPathSession('Test'), 'ev3');
  assert.equal(session.vehicleChapterTitle, 'Fahrzeugberatung · Kia EV3');
  assert.equal(session.pendingQuestion?.id, 'ev3Priority');
  assert.equal(session.pendingQuestion?.world, CLEVER_WORLD.VEHICLE_CONSULTATION);
  assert.ok(session.turns.some((t) => t.type === 'handoff'));
  console.log('✓ EV3 genauer ansehen startet Fahrzeugberatung');
}

function testVehicleNotesSeparate() {
  let session = beginEv3VehicleConsultation(
    { ...createHappyPathSession('Test'), notepadLabels: ['Elektro', 'Familie', '2 Kinder'] },
    'ev3',
  );
  session = submitVehicleQuestionAnswer(session, { answerId: 'range' });
  session = submitVehicleQuestionAnswer(session, { answerId: 'heatPump' });

  assert.deepEqual(session.notepadLabels, ['Elektro', 'Familie', '2 Kinder']);
  assert.ok(session.vehicleNotepadLabels.includes('Größere Reichweite'));
  assert.ok(session.vehicleNotepadLabels.includes('Wärmepumpe'));
  console.log('✓ EV3-Notizen getrennt vom Wunschprofil');
}

function testFreetextVehicleAnswers() {
  assert.equal(mapVehicleFreetextToAnswer('ev3Priority', 'mehr Reichweite'), 'range');
  assert.equal(mapVehicleFreetextToAnswer('ev3Equipment', 'Wärmepumpe bitte'), 'heatPump');
  console.log('✓ Freitext in Welt 2 erkannt');
}

function testMiniRecNoOffer() {
  let session = beginEv3VehicleConsultation(createHappyPathSession('Test'), 'ev3');
  session = submitVehicleQuestionAnswer(session, { answerId: 'balanced' });
  session = submitVehicleQuestionAnswer(session, { answerId: 'none' });
  session = advanceFromVehicleThinking(session);

  assert.ok(session.vehicleMiniRecommendation?.ready);
  assert.equal(session.vehicleMiniRecommendation.hasRate, false);
  assert.equal(session.vehicleMiniRecommendation.hasOffer, false);
  console.log('✓ Mini-Empfehlung enthält keine Rate');
}

testBeginVehicleConsultation();
testVehicleNotesSeparate();
testFreetextVehicleAnswers();
testMiniRecNoOffer();
console.log('\nAlle EV3-Happy-Path-Tests bestanden.');
