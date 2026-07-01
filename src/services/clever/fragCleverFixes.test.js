/**
 * Frag Clever – Fixes aus IST-Check (Purchase Intent, Technik, Profil, Mixed Intent)
 */
import assert from 'node:assert/strict';
import { classifyWithRules } from './customerQueryRuleFallback.js';
import { orchestrateCustomerQuery } from './cleverCustomerQueryOrchestrator.js';
import { isPurchaseIntentQuery } from './generalCarQueryDetector.js';
import { QUERY_TYPES, UI_COMPONENTS } from './customerQueryTypes.js';

const D12 = 'Ich habe 2 Kinder, einen Hund, einen Wohnwagen und fahre täglich 20 km. Fahre bisher einen Kia XCeed Benziner und möchte jetzt Elektro.';
const D11 = 'Suche einen Elektro mit AHK für 2 Kinder mit Isofix und 400 km Reichweite. Hat der EV3 2 Isofix?';

// A) Purchase Intent
assert.equal(isPurchaseIntentQuery('Ich möchte ein Angebot'), true);
assert.equal(isPurchaseIntentQuery('Ich hätte gerne ein Angebot'), true);
assert.equal(isPurchaseIntentQuery('Bitte Angebot erstellen'), true);
assert.equal(isPurchaseIntentQuery('Angebot anfragen'), true);
assert.equal(isPurchaseIntentQuery('Verkäufer soll mich beraten'), true);
assert.equal(isPurchaseIntentQuery('Ich suche ein Angebot bis 350 €'), false);

const purchaseRules = classifyWithRules('Ich möchte ein Angebot');
assert.equal(purchaseRules.queryType, QUERY_TYPES.PURCHASE_INTENT);

const purchaseOrch = await orchestrateCustomerQuery({
  query: 'Ich möchte ein Angebot',
  useOpenAi: false,
  dealerId: 'autohaus-trinkle',
});
assert.equal(purchaseOrch.classification.queryType, QUERY_TYPES.PURCHASE_INTENT);
assert.notEqual(purchaseOrch.ui.component, UI_COMPONENTS.NEED_SEARCH);

// B) Stützlast EV9
const stuetzlastRules = classifyWithRules('Wie viel Stützlast hat der EV9?');
assert.equal(stuetzlastRules.queryType, QUERY_TYPES.MODEL_EQUIPMENT_QUESTION);
assert.equal(stuetzlastRules.topic, 'vertical_load');
assert.notEqual(stuetzlastRules.topic, 'size');

const stuetzlast = await orchestrateCustomerQuery({
  query: 'Wie viel Stützlast hat der EV9?',
  useOpenAi: false,
  dealerId: 'autohaus-trinkle',
});
assert.ok(stuetzlast.smartAnswer?.title);
assert.doesNotMatch(stuetzlast.smartAnswer.title, /Ausstattung im Überblick/i);
assert.doesNotMatch(stuetzlast.smartAnswer.lead ?? '', /Ausstattung im Überblick/i);
assert.match(stuetzlast.smartAnswer.lead ?? stuetzlast.smartAnswer.title, /Stützlast|Anhängelast|Anhänger/i);

// C) Sitzplätze EV9
const seatsRules = classifyWithRules('Wie viele Sitzplätze hat der EV9?');
assert.equal(seatsRules.topic, 'seating');

const seats = await orchestrateCustomerQuery({
  query: 'Wie viele Sitzplätze hat der EV9?',
  useOpenAi: false,
  dealerId: 'autohaus-trinkle',
});
assert.match(seats.smartAnswer?.lead ?? '', /6|7|Sitz/i);
assert.doesNotMatch(seats.smartAnswer?.title ?? '', /Ausstattung im Überblick/i);

// D) Isofix EV3
const isofixRules = classifyWithRules('Hat der EV3 Isofix?');
assert.equal(isofixRules.topic, 'isofix');

const isofix = await orchestrateCustomerQuery({
  query: 'Hat der EV3 Isofix?',
  useOpenAi: false,
  dealerId: 'autohaus-trinkle',
});
assert.match(isofix.smartAnswer?.lead ?? '', /Isofix|Familie|Rücksitz/i);
assert.doesNotMatch(isofix.smartAnswer?.title ?? '', /Ausstattung im Überblick/i);

// E) Ladegeschwindigkeit EV6
const chargingRules = classifyWithRules('Wie schnell lädt der EV6?');
assert.equal(chargingRules.queryType, QUERY_TYPES.MODEL_EQUIPMENT_QUESTION);
assert.equal(chargingRules.topic, 'charging_speed');

const charging = await orchestrateCustomerQuery({
  query: 'Wie schnell lädt der EV6?',
  useOpenAi: false,
  dealerId: 'autohaus-trinkle',
});
assert.match(charging.smartAnswer?.lead ?? '', /Lade|DC|10|80|Akku/i);
assert.doesNotMatch(charging.smartAnswer?.title ?? '', /Ausstattung im Überblick/i);

// F) Bedarfsprofil D12
const profileRules = classifyWithRules(D12);
assert.equal(profileRules.queryType, QUERY_TYPES.VEHICLE_WISH);
assert.equal(profileRules.topic, 'advisor_profile_assessment');

const profile = await orchestrateCustomerQuery({
  query: D12,
  useOpenAi: false,
  dealerId: 'autohaus-trinkle',
});
assert.equal(profile.ui.component, UI_COMPONENTS.SMART_ANSWER);
assert.notEqual(profile.ui.component, UI_COMPONENTS.SPECIAL_CONTACT);
assert.match(profile.smartAnswer?.title ?? '', /XCeed|Elektro/i);
assert.ok((profile.smartAnswer?.understoodWishes ?? []).length >= 4);
assert.ok((profile.smartAnswer?.modelDirections ?? []).some((d) => /EV5|EV9/i.test(d)));

// G) Mixed Intent D11
const mixedRules = classifyWithRules(D11);
assert.equal(mixedRules.queryType, QUERY_TYPES.MIXED_INTENT);

const mixed = await orchestrateCustomerQuery({
  query: D11,
  useOpenAi: false,
  dealerId: 'autohaus-trinkle',
});
assert.equal(mixed.classification.queryType, QUERY_TYPES.MIXED_INTENT);
assert.equal(mixed.ui.component, UI_COMPONENTS.SMART_ANSWER);
assert.notEqual(mixed.ui.component, UI_COMPONENTS.SPECIAL_CONTACT);

console.log('fragCleverFixes.test.js: OK');
