/**
 * Gemischte Eingaben – Fahrzeugwunsch + Modellfrage
 */
import assert from 'node:assert/strict';
import { classifyWithRules } from './customerQueryRuleFallback.js';
import { orchestrateCustomerQuery } from './cleverCustomerQueryOrchestrator.js';
import { QUERY_TYPES, UI_COMPONENTS } from './customerQueryTypes.js';
import { detectMixedIntent } from './mixedIntentDetector.js';

const MIXED_QUERY = 'suche einen elektro mit ahk für 2 kindern mit iso fix und 400 km reichweite. Hat der ev3 2 iso fix?';

const mixedRules = classifyWithRules(MIXED_QUERY);
assert.equal(mixedRules.queryType, QUERY_TYPES.MIXED_INTENT, 'mixed_intent Klassifikation');
assert.equal(mixedRules.shouldAskForContact, false);
assert.equal(mixedRules.modelKey, 'ev3');
assert.ok(mixedRules.questionPart?.includes('ev3'));
assert.equal(mixedRules.primaryIntent, QUERY_TYPES.VEHICLE_WISH);
assert.equal(mixedRules.secondaryIntent, QUERY_TYPES.MODEL_EQUIPMENT_QUESTION);

const mixedOrch = await orchestrateCustomerQuery({
  query: MIXED_QUERY,
  useOpenAi: false,
});
assert.equal(mixedOrch.classification.queryType, QUERY_TYPES.MIXED_INTENT);
assert.equal(mixedOrch.ui.component, UI_COMPONENTS.SMART_ANSWER, 'keine Kontakt-Hauptantwort');
assert.notEqual(mixedOrch.ui.component, UI_COMPONENTS.SPECIAL_CONTACT);
assert.ok(mixedOrch.smartAnswer?.title?.includes('EV3'));
assert.ok(mixedOrch.smartAnswer?.lead?.includes('Isofix'));
assert.ok((mixedOrch.smartAnswer?.understoodWishes ?? []).length >= 3);
assert.ok((mixedOrch.followUpSuggestions ?? []).some((s) => /Verkäufer/i.test(s.label)));
assert.equal(mixedOrch.specialCustomerQuestion, null);

const isofixOnly = classifyWithRules('Hat der EV3 Isofix?');
assert.equal(isofixOnly.queryType, QUERY_TYPES.MODEL_EQUIPMENT_QUESTION);
assert.equal(isofixOnly.modelKey, 'ev3');

const ev3Wish = classifyWithRules('Ich suche EV3 mit Isofix und AHK');
assert.equal(ev3Wish.queryType, QUERY_TYPES.VEHICLE_WISH);
assert.equal(ev3Wish.modelKey, 'ev3');

const ev3Ahk = classifyWithRules('EV3 AHK möglich?');
assert.equal(ev3Ahk.queryType, QUERY_TYPES.MODEL_EQUIPMENT_QUESTION);
assert.equal(ev3Ahk.modelKey, 'ev3');

const familyWish = classifyWithRules('Familienauto mit 2 Kindern und 400 km Reichweite');
assert.equal(familyWish.queryType, QUERY_TYPES.VEHICLE_WISH);

const windabweiser = classifyWithRules('Kann ich Windabweiser am EV4 montieren?');
assert.equal(windabweiser.queryType, QUERY_TYPES.SPECIAL_CHECK_QUESTION);

const detected = detectMixedIntent(MIXED_QUERY);
assert.ok(detected);
assert.equal(detected.topic, 'family_seating');

console.log('mixedIntentFlow.test.js: OK');
