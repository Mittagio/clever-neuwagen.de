/**
 * Clever Customer Intake – Golden Cases A–H (deterministisch, keine Live-API).
 * node src/services/consultation/customerIntakeGolden.test.js
 */
import assert from 'node:assert/strict';
import {
  mergeTextIntoNeedProfile,
  buildUnderstoodLabels,
} from './needProfileService.js';
import {
  createHappyPathSession,
  removeNeedLabel,
} from './consultationHappyPath.js';
import { buildCustomerUnderstanding } from '../dealer/customerUnderstanding.js';
import {
  buildContactExitLabel,
  buildIncompleteOfferHandoffCopy,
  buildOfferExitLabel,
} from './customerIntakeExits.js';
import { CLEVER_CONVERSATION_INSTRUCTIONS } from '../clever/openai/cleverConversationInstructions.js';
import { assertGroundedCleverTurn } from '../clever/openai/assertGroundedCleverTurn.js';

function labelsOf(text, base = null) {
  return buildUnderstoodLabels(mergeTextIntoNeedProfile(text, base));
}

function hasApprox(labels, re) {
  return labels.some((label) => re.test(String(label)));
}

// --- A: Elektro + HUD + AHK ---
{
  const profile = mergeTextIntoNeedProfile(
    'Ich suche einen Elektro mit Head-up-Display und Anhängerkupplung. EV3 finde ich interessant.',
  );
  const labels = buildUnderstoodLabels(profile);
  assert.ok(hasApprox(labels, /^Elektro$/i), 'A: Elektro');
  assert.ok(hasApprox(labels, /Head-up|HUD/i), 'A: HUD');
  assert.ok(hasApprox(labels, /Anhänger/i), 'A: AHK');
  assert.ok(hasApprox(labels, /EV3/i), 'A: EV3 interessant');
  assert.equal(profile.towCapacityKg == null || profile.towCapacityKg < 2000, true, 'A: keine 2t-Normierung');
  const offer = buildOfferExitLabel({ notepadLabels: labels, needProfile: profile });
  assert.match(offer, /Angebot/i, 'A: CTA Angebot');
  assert.equal(buildContactExitLabel(), 'Verkäufer kontaktieren', 'A: CTA Kontakt');
  console.log('✓ A Elektro+HUD+AHK → Notizzettel + CTAs');
}

// --- B: Range erhalten ---
{
  const profile = mergeTextIntoNeedProfile(
    'Ich brauche irgendwo zwischen 500 kg und zwei Tonnen Anhängelast.',
  );
  const labels = buildUnderstoodLabels(profile);
  assert.ok(
    hasApprox(labels, /Anhängelast:\s*ca\./i) || hasApprox(labels, /500/),
    'B: Range-Label',
  );
  assert.equal(profile.towCapacityKg, null, 'B: kein towCapacityKg=2000');
  assert.ok(!hasApprox(labels, /^2\.000 kg|^2000 kg|2.000 kg Anhängelast/i), 'B: kein Einzelwert-Sieger');
  console.log('✓ B Anhängelast-Range erhalten');
}

// --- C: Rot / Blau ---
{
  const profile = mergeTextIntoNeedProfile(
    'Rot gefällt mir, aber meine Frau möchte lieber Blau.',
  );
  const labels = buildUnderstoodLabels(profile);
  assert.ok(hasApprox(labels, /Rot\s*\/\s*Blau|Blau\s*\/\s*Rot/i), 'C: Rot / Blau Chip');
  assert.ok(!profile.colorHint, 'C: keine Einzelfarbe');
  console.log('✓ C Farbalternativen erhalten');
}

// --- D: EV3 oder EV6 ---
{
  const profile = mergeTextIntoNeedProfile('EV3 oder EV6.');
  const labels = buildUnderstoodLabels(profile);
  assert.ok(hasApprox(labels, /EV3/i), 'D: EV3');
  assert.ok(hasApprox(labels, /EV6/i), 'D: EV6');
  assert.ok(!profile.selectedModelKey, 'D: kein Model-Sieger');
  console.log('✓ D EV3/EV6 beide interessant');
}

// --- E: HUD Korrektur ---
{
  let profile = mergeTextIntoNeedProfile(
    'Elektro mit Head-up-Display und Anhängerkupplung',
  );
  assert.ok(hasApprox(buildUnderstoodLabels(profile), /Head-up|HUD/i), 'E: HUD zuerst da');
  profile = mergeTextIntoNeedProfile('HUD brauche ich doch nicht.', profile);
  const labels = buildUnderstoodLabels(profile);
  assert.ok(!hasApprox(labels, /Head-up|HUD/i), 'E: HUD entfernt');
  assert.ok(hasApprox(labels, /^Elektro$/i), 'E: Elektro bleibt');
  console.log('✓ E Sprachkorrektur entfernt HUD');
}

// --- F: unvollständiges Angebot ---
{
  const session = createHappyPathSession('Autohaus Test');
  const withWish = {
    ...session,
    needProfile: mergeTextIntoNeedProfile('EV9 gefällt mir. Schicken Sie mir ein Angebot.'),
    notepadLabels: labelsOf('EV9 gefällt mir. Schicken Sie mir ein Angebot.'),
  };
  const copy = buildIncompleteOfferHandoffCopy();
  assert.match(copy.body, /Verkäufer/i, 'F: Copy erwähnt Verkäufer');
  assert.equal(copy.primaryLabel, 'Jetzt anfragen');
  assert.equal(copy.secondaryLabel, 'Leasingdaten ergänzen');
  assert.ok(!withWish.needProfile.annualKm, 'F: km darf fehlen');
  assert.ok(buildOfferExitLabel({ notepadLabels: withWish.notepadLabels, needProfile: withWish.needProfile }), 'F: CTA bleibt');
  console.log('✓ F Handoff ohne vollständige Leasingdaten');
}

// --- G: Sofort Verkäufer ---
{
  const offerLabel = buildOfferExitLabel({ notepadLabels: [] });
  assert.equal(offerLabel, 'Angebot anfordern');
  assert.equal(buildContactExitLabel(), 'Verkäufer kontaktieren');
  // Intent-Hinweis: Prompt erlaubt sofortigen Handoff ohne Folgefrage
  assert.match(CLEVER_CONVERSATION_INSTRUCTIONS, /handoff\.ready\s*=\s*true/i);
  assert.match(CLEVER_CONVERSATION_INSTRUCTIONS, /Keine weitere Bedarfsfrage/i);
  console.log('✓ G Sofort-Kontakt / Handoff-Policy');
}

// --- H: Fakt ≠ Wunsch + Prompt-Verbote ---
{
  const factQ = 'Wie lang ist der Laderaum des EV9?';
  const profile = mergeTextIntoNeedProfile(factQ);
  const labels = buildUnderstoodLabels(profile);
  assert.ok(!hasApprox(labels, /Ladelänge|2\s*m/i), 'H: Fakt erzeugt keinen Lade-Chip');

  const grounded = assertGroundedCleverTurn({
    reply: 'Nach unseren verifizierten Daten beträgt die Laderaumlänge 2000 mm.',
    intent: 'knowledge_question',
    needProfilePatch: { towCapacityKg: 2000 },
    vehicleDirections: [],
    nextAction: { type: 'none', targetField: null, question: null, options: [], reason: null },
    handoff: { requested: false, ready: false, summary: null },
    usedFactIds: ['fact-1'],
    evidence: [{
      evidenceId: 'fact-1',
      sourceTier: 'internal_verified',
      status: 'verified',
      factKey: 'cargo',
      modelKey: 'ev9',
      variantKey: null,
      sourceId: 'x',
      sourceUrl: null,
    }],
  }, {
    factIds: new Set(['fact-1']),
    evidenceIds: new Set(['fact-1']),
    evidenceById: new Map([['fact-1', {
      evidenceId: 'fact-1',
      sourceTier: 'internal_verified',
      status: 'verified',
      modelKey: 'ev9',
    }]]),
  });
  assert.ok(grounded.errors.some((e) => e.startsWith('knowledge_fact_as_wish')), 'H: Fact-as-wish geblockt');

  assert.match(CLEVER_CONVERSATION_INSTRUCTIONS, /KEIN digitaler Verkaufsberater/i);
  assert.match(CLEVER_CONVERSATION_INSTRUCTIONS, /Match-Prozent/i);
  assert.match(CLEVER_CONVERSATION_INSTRUCTIONS, /nextAction\.type = "none"/i);
  console.log('✓ H Fakt≠Wunsch + keine Match-Sprache in Prompt');
}

// --- Verkäuferbild ---
{
  const profile = mergeTextIntoNeedProfile(
    'Elektro mit HUD und Anhängerkupplung. Anhängelast irgendwo zwischen 500 kg und 2 Tonnen. EV3 oder EV6.',
  );
  const lead = {
    crm: { needProfile: profile },
    conversation: {
      turns: [
        { role: 'customer', text: 'Elektro mit HUD und AHK' },
        { role: 'clever', text: 'Verstanden – ich habe das notiert.' },
      ],
    },
  };
  const understanding = buildCustomerUnderstanding(lead);
  assert.ok(understanding, 'Verkäufer: Understanding vorhanden');
  const labels = buildUnderstoodLabels(profile);
  assert.ok(labels.length >= 3, 'Verkäufer: Notizzettel wächst');
  console.log('✓ Verkäufer erhält Notizzettel-Basis + Understanding');
}

// --- removeNeedLabel Chip-× ---
{
  let session = createHappyPathSession('Autohaus Test');
  const profile = mergeTextIntoNeedProfile('Elektro mit Head-up-Display');
  session = {
    ...session,
    needProfile: profile,
    notepadLabels: buildUnderstoodLabels(profile),
  };
  session = removeNeedLabel(session, 'Head-up-Display');
  assert.ok(!hasApprox(session.notepadLabels, /Head-up|HUD/i), 'Chip-× entfernt HUD');
  console.log('✓ Chip-× Korrektur');
}

// --- CTA Evolution ---
{
  assert.equal(buildOfferExitLabel({ notepadLabels: [] }), 'Angebot anfordern');
  assert.equal(
    buildOfferExitLabel({ notepadLabels: ['Elektro', 'HUD'] }),
    'Angebot mit meinen Wünschen anfordern',
  );
  assert.equal(
    buildOfferExitLabel({ notepadLabels: ['EV9'], needProfile: { selectedModelKey: 'ev9' } }),
    'EV9-Angebot anfordern',
  );
  assert.match(
    buildOfferExitLabel({
      notepadLabels: [],
      cleverVehicleDirections: [
        { modelKey: 'ev3', status: 'interesting' },
        { modelKey: 'ev6', status: 'candidate' },
      ],
    }),
    /2 Fahrzeuge/,
  );
  console.log('✓ CTA-Evolution');
}

console.log('\ncustomerIntakeGolden.test.js: ok');
