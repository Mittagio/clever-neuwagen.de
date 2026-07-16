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
import { createHappyPathSession, submitOpeningMessage } from './consultationHappyPath.js';
import { CLEVER_WORLD } from './consultationWorlds.js';

function assertLabelsInclude(profile, expected = []) {
  for (const label of expected) {
    assert.ok(
      profile.understoodLabels.includes(label),
      `Label „${label}“ fehlt in: ${profile.understoodLabels.join(', ')}`,
    );
  }
}

function assertLabelsStartWith(profile, orderedPrefix = []) {
  const labels = profile.understoodLabels;
  for (let i = 0; i < orderedPrefix.length; i += 1) {
    assert.equal(
      labels[i],
      orderedPrefix[i],
      `Position ${i}: erwartet „${orderedPrefix[i]}“, ist „${labels[i] ?? '—'}“ — alle: ${labels.join(', ')}`,
    );
  }
}

function testWowSportageDieselBudget() {
  const profile = mergeTextIntoNeedProfile(
    'Ich suche einen Sportage Diesel mit Allrad und Automatik bis 45.000 €.',
  );
  assertLabelsInclude(profile, [
    'Sportage', 'Diesel', 'Allrad', 'Automatik', 'Budget bis 45.000 €',
  ]);
  assertLabelsStartWith(profile, [
    'Sportage', 'Diesel', 'Allrad', 'Automatik', 'Budget bis 45.000 €',
  ]);
  console.log('✓ Wow 1: Sportage Diesel Allrad Automatik bis 45.000 €');
}

function testWowZweitwagenFrau() {
  const profile = mergeTextIntoNeedProfile('Zweitwagen für meine Frau');
  assertLabelsInclude(profile, ['Zweitwagen', 'Fahrerin']);
  assertLabelsStartWith(profile, ['Zweitwagen', 'Fahrerin']);
  console.log('✓ Wow 2: Zweitwagen Fahrerin');
}

function testWowZugfahrzeugFamilie() {
  const profile = mergeTextIntoNeedProfile(
    'zwei Kinder + Zugfahrzeug + 2 Tonnen',
  );
  assertLabelsInclude(profile, ['Familie', '2 Kinder', 'Zugfahrzeug', 'Anhängelast 2.000 kg']);
  assert.equal(profile.towCapacityKg, 2000);
  console.log('✓ Wow 3: Familie, Zugfahrzeug, 2t Anhängelast');
}

function testWowElektroZweitwagenFrauStadt() {
  const profile = mergeTextIntoNeedProfile(
    'Elektroauto als Zweitwagen für meine Frau, Stadt, 20 km am Tag',
  );
  assertLabelsInclude(profile, ['Elektro', 'Zweitwagen', 'Fahrerin', 'Stadt', 'Kurzstrecke']);
  assertLabelsStartWith(profile, ['Elektro', 'Zweitwagen', 'Fahrerin', 'Stadt', 'Kurzstrecke']);
  console.log('✓ Wow 4: Elektro Zweitwagen Fahrerin Stadt Kurzstrecke');
}

function testBudgetRecognition() {
  const cases = [
    { text: 'bis 45.000 €', label: 'Budget bis 45.000 €' },
    { text: '45.000 €', label: 'Budget bis 45.000 €' },
    { text: 'unter 400 €', label: 'Budget bis 400 €/Monat' },
    { text: 'bis 400 Euro im Monat', label: 'Budget bis 400 €/Monat' },
    { text: 'Budget 500 €', label: 'Budget 500 €/Monat' },
  ];
  for (const { text, label } of cases) {
    const profile = mergeTextIntoNeedProfile(text);
    assert.ok(
      profile.understoodLabels.includes(label),
      `„${text}“ → erwartet „${label}“, ist: ${profile.understoodLabels.join(', ')}`,
    );
  }
  console.log('✓ Budget-Erkennung: Kaufpreis und Monatsrate');
}

function testFirstMessageChipsViaOpeningMessage() {
  let session = createHappyPathSession('Test');
  assert.equal(session.notepadLabels.length, 0);

  session = submitOpeningMessage(
    session,
    'Sportage Diesel mit Allrad und Automatik bis 45.000 €',
  );

  assert.ok(session.notepadLabels.length >= 5, `Chips fehlen: ${session.notepadLabels.join(', ')}`);
  for (const label of ['Sportage', 'Diesel', 'Allrad', 'Automatik', 'Budget bis 45.000 €']) {
    assert.ok(
      session.notepadLabels.includes(label),
      `Chip „${label}“ fehlt nach erstem Satz: ${session.notepadLabels.join(', ')}`,
    );
  }
  console.log('✓ Erster Kundensatz → Chips sofort in notepadLabels');
}

function testSuvBenzinAllrad() {
  const profile = mergeTextIntoNeedProfile('SUV Benzin Automatik bis 40.000 € Allrad');
  assertLabelsInclude(profile, ['Benzin', 'SUV', 'Budget bis 40.000 €', 'Allrad']);
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
  assert.equal(result.question?.id, 'towingUsage');
  const readiness = evaluateRecommendationReadiness({ needProfile: profile });
  assert.equal(readiness.ready, false);
  console.log('✓ Sportage Familie AHK → Chips + Anhängerart zuerst, keine EV-Empfehlung');
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

testWowSportageDieselBudget();
testWowZweitwagenFrau();
testWowZugfahrzeugFamilie();
testWowElektroZweitwagenFrauStadt();
testBudgetRecognition();
testFirstMessageChipsViaOpeningMessage();
testSuvBenzinAllrad();
testSportageFamilyAhk();
testElectricEquipmentBundle();
testEv3HudHeatPumpWorld2();
testPickupBenzinAutomatik();

function testCargoLengthWishChips() {
  const factOnly = mergeTextIntoNeedProfile('Wie lang ist der Laderaum beim EV9?');
  assert.ok(
    !(factOnly.understoodLabels ?? []).some((l) => /2\s*m Ladelänge/i.test(l)),
    'Fahrzeugfrage allein erzeugt keinen Ladelängen-Chip',
  );

  const wish = mergeTextIntoNeedProfile(
    'Die dritte Sitzreihe brauche ich nur gelegentlich. Ich möchte aber zwei Meter lange Gegenstände transportieren.',
    factOnly,
  );
  assertLabelsInclude(wish, ['7 Sitze gelegentlich', 'ca. 2 m Ladelänge']);
  assert.equal(wish.persons, 7);
  assert.ok((wish.equipmentWishes ?? []).includes('large_trunk'));
  console.log('✓ Laderaum: Fakt ≠ Wunsch; Bestätigung → Chips');
}

testCargoLengthWishChips();
console.log('\nAlle Need-Recognition-Tests bestanden.');
