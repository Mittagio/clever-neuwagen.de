/**
 * Customer Understanding – Golden Moments
 */
import assert from 'node:assert/strict';
import {
  buildCustomerUnderstanding,
  buildGespraechseinstieg,
  buildUnderstandingEvolution,
  hasCustomerUnderstanding,
} from './customerUnderstanding.js';
import {
  createEmptyNeedProfile,
  mergeTextIntoNeedProfile,
} from '../consultation/needProfileService.js';
import { appendSellerInsightToLead } from './sellerInsights.js';

function buildProfileFromMessages(messages = []) {
  return messages.reduce(
    (profile, text) => mergeTextIntoNeedProfile(text, profile),
    createEmptyNeedProfile(messages[0] ?? ''),
  );
}

// ── A) EV3-Entwicklung ─────────────────────────────────────────────────────

const ev3Messages = [
  'Ich suche einen EV3.',
  'Wir fahren oft in den Urlaub.',
  'Ich weiß nicht, ob die kleine Batterie reicht.',
];

const ev3Profile = buildProfileFromMessages(ev3Messages);
const ev3Lead = {
  id: 'golden-ev3',
  crm: { needProfile: ev3Profile },
};

assert.ok(hasCustomerUnderstanding(ev3Lead), 'EV3-Lead hat Verständnis');

const ev3Understanding = buildCustomerUnderstanding(ev3Lead);
assert.ok(ev3Understanding, 'EV3 Understanding erstellt');
assert.equal(ev3Understanding.entwicklung.length, 3);

const step1 = ev3Understanding.entwicklung[0];
assert.ok(
  step1.newLabels.some((label) => /ev3/i.test(label)),
  `Schritt 1: EV3 fehlt in ${step1.newLabels.join(', ')}`,
);

const step2 = ev3Understanding.entwicklung[1];
assert.ok(
  step2.newLabels.some((label) => /urlaub|langstrecke/i.test(label)),
  `Schritt 2: Urlaub/Langstrecke fehlt in ${step2.newLabels.join(', ')}`,
);

const step3 = ev3Understanding.entwicklung[2];
assert.ok(
  step3.newLabels.some((label) => /batterie unsicher/i.test(label)),
  `Schritt 3: Batterie unsicher fehlt in ${step3.newLabels.join(', ')}`,
);
assert.ok(
  step3.labelsAfter.some((label) => /batterie unsicher/i.test(label)),
  'Endstand enthält Batterie unsicher',
);

assert.match(
  ev3Understanding.gespraechseinstieg.lead,
  /batteriegröße|reichweite/i,
  'Gesprächseinstieg adressiert Batterie oder Reichweite',
);
assert.ok(ev3Understanding.gespraechseinstieg.context.length > 0);

assert.deepEqual(ev3Understanding.originalton.messages, ev3Messages);
assert.equal(ev3Understanding.originalton.source, 'beratung');

// ── B) Zugfahrzeug ────────────────────────────────────────────────────────

const towMessage = 'Ich habe zwei Kinder und suche ein Zugfahrzeug mit mindestens 2 Tonnen Anhängelast.';
const towProfile = buildProfileFromMessages([towMessage]);
const towLead = {
  id: 'golden-tow',
  crm: { needProfile: towProfile },
};

const towUnderstanding = buildCustomerUnderstanding(towLead);
assert.ok(towUnderstanding);

const towLabels = towUnderstanding.verstaendnis.labels;
for (const expected of ['Familie', '2 Kinder', 'Zugfahrzeug', 'Anhängelast 2.000 kg']) {
  assert.ok(
    towLabels.includes(expected),
    `Label „${expected}“ fehlt: ${towLabels.join(', ')}`,
  );
}

assert.match(
  towUnderstanding.gespraechseinstieg.lead,
  /anhängelast|anhänger/i,
  'Gesprächseinstieg adressiert Anhängelast',
);

// ── C) Nur inquiryBrief ─────────────────────────────────────────────────────

const inquiryLead = {
  id: 'golden-inquiry',
  inquiryBrief: {
    searchQuery: 'SUV für die Familie mit viel Platz',
  },
};

assert.ok(hasCustomerUnderstanding(inquiryLead), 'inquiryBrief allein reicht für Gate');

const inquiryUnderstanding = buildCustomerUnderstanding(inquiryLead);
assert.ok(inquiryUnderstanding, 'Understanding aus inquiryBrief');
assert.ok(
  inquiryUnderstanding.originalton.messages.length >= 1
  || inquiryUnderstanding.verstaendnis.labels.length >= 1,
  'Fallback: Originalton oder Verständnis vorhanden',
);
assert.equal(inquiryUnderstanding.originalton.messages[0], inquiryLead.inquiryBrief.searchQuery);

// ── Evolution-Hilfsfunktion isoliert ───────────────────────────────────────

const evolution = buildUnderstandingEvolution(ev3Messages);
assert.equal(evolution.length, 3);
assert.ok(evolution[2].labelsAfter.some((label) => /ev3/i.test(label)));

// ── Gesprächseinstieg-Priorität Batterie vor Reichweite ─────────────────────

const batteryFirst = buildGespraechseinstieg(
  {
    labels: ['EV3', 'Elektro', 'Urlaub'],
    concerns: ['Batterie unsicher'],
  },
  { selectedModelKey: 'ev3', usage: ['urlaub'] },
);
assert.match(batteryFirst.lead, /batteriegröße/i);

// ── D) sellerInsights + needProfile Merge ───────────────────────────────────

const sellerText = 'Anhängelast jetzt doch 2.500 kg. EV4 gefällt inzwischen besser.';
const mergedLead = appendSellerInsightToLead(ev3Lead, sellerText, {
  context: 'phone_call',
  createdAt: '2026-07-07T14:00:00.000Z',
});

const mergedUnderstanding = buildCustomerUnderstanding(mergedLead);
assert.ok(mergedUnderstanding, 'Understanding mit sellerInsights');
assert.equal(mergedUnderstanding.entwicklung.length, 4, '3 Kunde + 1 Verkäufer');
assert.equal(mergedUnderstanding.entwicklung[3].source, 'seller');
assert.equal(mergedUnderstanding.entwicklung[3].customerText, sellerText);
assert.equal(mergedUnderstanding.meta.source, 'mixed', 'need_profile + seller_insights = mixed');
assert.ok(mergedUnderstanding.meta.sellerInsightCount === 1);

const sellerStepLabels = mergedUnderstanding.entwicklung[3].newLabels.join(' ').toLowerCase();
assert.ok(
  sellerStepLabels.includes('anhängelast') || sellerStepLabels.includes('ev4'),
  `Anhängelast/EV4 in Verkäufer-Schritt: ${mergedUnderstanding.entwicklung[3].newLabels.join(', ')}`,
);

assert.ok(
  mergedUnderstanding.verstaendnis.labels.some((label) => /ev4|anhängelast/i.test(label)),
  'Verständnis enthält Verkäufer-Labels',
);

assert.deepEqual(
  mergedUnderstanding.originalton.messages,
  ev3Messages,
  'Originalton bleibt Kundenstimme',
);

// needProfile unverändert (keine Verkäufer-Texte in rawMessages)
assert.equal(mergedLead.crm.needProfile.rawMessages.length, 3);
assert.ok(!mergedLead.crm.needProfile.rawMessages.includes(sellerText));

console.log('customerUnderstanding.test.js: ok');
