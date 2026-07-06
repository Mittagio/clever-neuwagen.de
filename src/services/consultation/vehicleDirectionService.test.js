/**
 * Sprint 3 – Fahrzeugrichtungen
 */
import assert from 'node:assert/strict';
import { mergeTextIntoNeedProfile } from './needProfileService.js';
import {
  VEHICLE_DIRECTION_INTRO,
  buildVehicleDirectionsView,
  isEvDirectionModel,
} from './vehicleDirectionService.js';
import {
  createHappyPathSession,
  submitOpeningMessage,
  submitQuestionAnswer,
  submitVehicleDirectionReaction,
  TURN_TYPE,
} from './consultationHappyPath.js';

function testSportageDirections() {
  const profile = mergeTextIntoNeedProfile(
    'Sportage Diesel mit Allrad und Automatik bis 45.000 €',
  );
  const view = buildVehicleDirectionsView(profile);
  assert.equal(view.intro, VEHICLE_DIRECTION_INTRO);
  assert.ok(view.directions.length >= 2, `Zu wenig Richtungen: ${view.directions.length}`);
  assert.equal(view.directions[0].modelKey, 'sportage');
  assert.ok(view.directions.some((d) => d.modelKey === 'sportage'));
  assert.ok(!view.directions[0].label.toLowerCase().includes('empfehl'));
  console.log('✓ Sportage → Richtungen ohne Empfehlungssprache');
}

function testElektroFamilyDirections() {
  const profile = mergeTextIntoNeedProfile(
    'Ich suche ein Elektroauto für zwei Kinder bis etwa 350 € im Monat.',
  );
  const view = buildVehicleDirectionsView(profile);
  assert.ok(view.directions.some((d) => d.modelKey === 'ev3'));
  assert.ok(view.directions.every((d) => isEvDirectionModel(d.modelKey)));
  console.log('✓ Elektro-Familie → EV-Richtungen');
}

function testCompareSimilarShowsDirections() {
  let session = createHappyPathSession('Test');
  session = submitOpeningMessage(
    session,
    'Sportage Diesel mit Allrad und Automatik bis 45.000 €',
  );
  session = submitQuestionAnswer(session, { answerId: 'compare_similar' });
  const directionsTurn = session.turns.find((t) => t.type === TURN_TYPE.VEHICLE_DIRECTIONS);
  assert.ok(directionsTurn, 'Fahrzeugrichtungen-Turn fehlt');
  assert.match(directionsTurn.directionsView.intro, /grundsätzlich zu Ihrem Wunsch passen/i);
  assert.ok(directionsTurn.directionsView.directions.length >= 2);
  console.log('✓ „Ähnliche einordnen“ → Richtungsübersicht');
}

function testDirectionReactionInterested() {
  let session = createHappyPathSession('Test');
  session = submitOpeningMessage(
    session,
    'Sportage Diesel mit Allrad und Automatik bis 45.000 €',
  );
  session = submitQuestionAnswer(session, { answerId: 'compare_similar' });
  session = submitVehicleDirectionReaction(session, 'sportage', 'interested');
  assert.equal(session.vehicleDirectionReactions.sportage, 'interested');
  const turn = session.turns.find((t) => t.type === TURN_TYPE.VEHICLE_DIRECTIONS);
  assert.equal(turn.directionsView.reactions.sportage, 'interested');
  console.log('✓ Reaktion „interessiert mich“ wird gespeichert');
}

function testDirectionReactionNotFit() {
  let session = createHappyPathSession('Test');
  session = submitOpeningMessage(
    session,
    'Sportage Diesel mit Allrad und Automatik bis 45.000 €',
  );
  session = submitQuestionAnswer(session, { answerId: 'compare_similar' });
  session = submitVehicleDirectionReaction(session, 'sportage-hybrid', 'not_fit');
  assert.equal(session.vehicleDirectionReactions['sportage-hybrid'], 'not_fit');
  console.log('✓ Reaktion „passt eher nicht“ wird gespeichert');
}

testSportageDirections();
testElektroFamilyDirections();
testCompareSimilarShowsDirections();
testDirectionReactionInterested();
testDirectionReactionNotFit();
console.log('\nAlle Vehicle-Direction-Tests bestanden.');
