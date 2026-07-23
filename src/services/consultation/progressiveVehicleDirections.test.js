/**
 * Progressive Fahrzeugrichtungen + Jahres-km ≠ Langstrecke
 */
import assert from 'node:assert/strict';
import { mergeTextIntoNeedProfile } from './needProfileService.js';
import { parseSearchIntent } from '../search/searchIntentParser.js';
import {
  createHappyPathSession,
  submitOpeningMessage,
  submitVehicleDirectionReaction,
  TURN_TYPE,
} from './consultationHappyPath.js';
import { submitSafeIntakeFallback } from './safeIntakeFallback.js';
import {
  beginOfferHandoff,
  isInOfferWorld,
} from './consultationOfferHandoff.js';
import {
  buildInterestedDirectionLabel,
  hasProgressiveDirectionSignal,
  maybeAppendProgressiveVehicleDirections,
  applyInspirationModelSelection,
} from './progressiveVehicleDirections.js';

function testAnnualKmDoesNotCreateLangstrecke() {
  for (const text of [
    '8.000 – 12.000 km',
    '12000 km',
    '15.000 km/Jahr',
    'bis 8.000 km',
  ]) {
    const profile = mergeTextIntoNeedProfile(text);
    assert.ok(profile.annualKm, `annualKm für „${text}“`);
    assert.equal(profile.longDistance, null, `kein longDistance für „${text}“`);
    assert.ok(
      !(profile.understoodLabels ?? []).some((l) => /^langstrecke$/i.test(l)),
      `kein Langstrecke-Label für „${text}“`,
    );
  }

  const rangeProfile = mergeTextIntoNeedProfile('mindestens 450 km Reichweite Elektro');
  assert.ok(
    (rangeProfile.priorities ?? []).includes('range') || rangeProfile.fuel,
    'echte Reichweite darf range-Priorität setzen',
  );
  assert.ok(
    !(rangeProfile.understoodLabels ?? []).some((l) => /^langstrecke$/i.test(l)),
    'Reichweite allein ≠ Langstrecke-Label',
  );

  const intent = parseSearchIntent('8.000 – 12.000 km');
  assert.ok(intent.mileagePerYear >= 8000);
  assert.ok(!intent.rangeKmMin || intent.rangeKmMin < 400, 'keine Reichweite aus Jahres-km');

  console.log('✓ Jahres-km erzeugt kein Langstrecke');
}

function testProgressiveDirectionsAfterLeasingAndKm() {
  let session = createHappyPathSession('Test');
  session = submitOpeningMessage(session, 'Ich suche ein Auto bis 350 € im Monat');
  session = submitSafeIntakeFallback(session, 'Leasing');
  session = submitSafeIntakeFallback(session, '8.000 – 12.000 km');

  assert.equal(session.needProfile.annualKm, 12000);
  assert.ok(
    !(session.notepadLabels ?? []).some((l) => /^langstrecke$/i.test(l)),
    'Notizzettel ohne Langstrecke',
  );
  assert.ok(hasProgressiveDirectionSignal(session.needProfile), 'Budget+Finanzierung → Signal');

  const directionTurns = (session.turns ?? []).filter((t) => t.type === TURN_TYPE.VEHICLE_DIRECTIONS);
  assert.ok(directionTurns.length >= 1, 'progressive Richtungen nach Substanz');
  assert.ok(directionTurns.some((t) => t.source === 'progressive'));

  // Auch nur Budget + Finanzierung (ohne km) muss Karten zeigen
  let financeOnly = createHappyPathSession('Test');
  financeOnly = submitOpeningMessage(financeOnly, 'Auto unter 350 € / Monat');
  financeOnly = submitSafeIntakeFallback(financeOnly, 'Finanzierung');
  assert.ok(hasProgressiveDirectionSignal(financeOnly.needProfile));
  assert.ok(
    (financeOnly.turns ?? []).some((t) => t.type === TURN_TYPE.VEHICLE_DIRECTIONS),
    'Karten schon nach Budget + Finanzierung',
  );

  const firstModel = directionTurns.at(-1).directionsView.directions[0]?.modelKey;
  assert.ok(firstModel);
  session = submitVehicleDirectionReaction(session, firstModel, 'interested');
  assert.ok(
    (session.notepadLabels ?? []).includes(buildInterestedDirectionLabel(firstModel)),
    'Interessant → Notizzettel',
  );
  assert.equal(session.vehicleDirectionReactions[firstModel], 'interested');

  console.log('✓ Progressive Richtungen + Interessant-Chip');
}

function testMaybeAppendIdempotentWithoutNewSignal() {
  let session = createHappyPathSession('Test');
  session = {
    ...session,
    needProfile: mergeTextIntoNeedProfile('Leasing bis 350 € Elektro'),
  };
  session.needProfile.annualKm = 12000;
  session.needProfile.understoodLabels = ['Leasing', 'Budget bis 350 €/Monat', '12.000 km'];
  session = maybeAppendProgressiveVehicleDirections(session, null);
  const count1 = session.turns.filter((t) => t.type === TURN_TYPE.VEHICLE_DIRECTIONS).length;
  session = maybeAppendProgressiveVehicleDirections(session, session.needProfile);
  const count2 = session.turns.filter((t) => t.type === TURN_TYPE.VEHICLE_DIRECTIONS).length;
  assert.equal(count1, count2, 'ohne neues Signal kein zweites Directions-Turn');
  console.log('✓ Progressive Directions ohne Doppel-Turn');
}

testAnnualKmDoesNotCreateLangstrecke();
testProgressiveDirectionsAfterLeasingAndKm();
testMaybeAppendIdempotentWithoutNewSignal();

function testInspirationModelOpensHandoffPath() {
  let session = createHappyPathSession('Autohaus Trinkle');
  session = applyInspirationModelSelection(session, 'ev3');
  assert.ok(
    (session.notepadLabels ?? []).some((l) => /EV3.*interessant/i.test(l)),
    'Inspiration-Klick → EV3 interessant',
  );
  assert.equal(session.needProfile.selectedModelKey, 'ev3');
  assert.equal(session.vehicleDirectionReactions.ev3, 'interested');

  session = beginOfferHandoff(session, { dealerName: 'Autohaus Trinkle' });
  assert.ok(isInOfferWorld(session), 'danach Soft-Handoff / Offer-World');
  assert.ok(
    (session.turns ?? []).some((t) => t.type === 'personal_handoff'),
    'Personal-Handoff-Turn',
  );
  console.log('✓ Inspiration-Modell → Notizzettel + Soft-Handoff');
}

testInspirationModelOpensHandoffPath();
console.log('\nprogressiveVehicleDirections.test.js: ok');
