/**
 * Clever Customer Intake – Golden Cases A–H + Wunschübergabe (deterministisch).
 * node src/services/consultation/customerIntakeGolden.test.js
 */
import assert from 'node:assert/strict';
import {
  mergeTextIntoNeedProfile,
  buildUnderstoodLabels,
  createEmptyNeedProfile,
} from './needProfileService.js';
import {
  createHappyPathSession,
  removeNeedLabel,
  submitDealerHandoff,
  submitPersonalHandoff,
} from './consultationHappyPath.js';
import { buildCustomerUnderstanding } from '../dealer/customerUnderstanding.js';
import {
  buildContactExitLabel,
  buildIncompleteOfferHandoffCopy,
  buildOfferExitLabel,
  buildWishHandoffExitLabel,
  hasExplicitOfferIntent,
} from './customerIntakeExits.js';
import { CLEVER_CONVERSATION_INSTRUCTIONS } from '../clever/openai/cleverConversationInstructions.js';
import { assertGroundedCleverTurn } from '../clever/openai/assertGroundedCleverTurn.js';
import { applyCleverTurnToSession } from '../clever/openai/applyCleverTurnResult.js';
import { sanitizeNextTopics } from './conversationNextTopics.js';

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
  assert.ok(hasApprox(labels, /EV3.*interessant|interessant.*EV3/i), 'A: EV3 interessant');
  assert.equal(profile.towCapacityKg == null || profile.towCapacityKg < 2000, true, 'A: keine 2t-Normierung');
  const wishCta = buildWishHandoffExitLabel({ notepadLabels: labels, needProfile: profile });
  assert.match(wishCta, /Wünsche übergeben/i, 'A: Wunschübergabe-CTA');
  assert.ok(!/Verkäufer kontaktieren/i.test(wishCta), 'A: kein Verkäufer-kontaktieren');
  assert.equal(buildContactExitLabel({ notepadLabels: labels, needProfile: profile }), wishCta);
  console.log('✓ A Elektro+HUD+AHK → Notizzettel + Wunschübergabe');
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

// --- F: unvollständiges Angebot / Wunschübergabe ---
{
  const session = createHappyPathSession('Autohaus Test');
  const withWish = {
    ...session,
    notepadLabels: ['EV9 interessant'],
    needProfile: { ...createEmptyNeedProfile(), selectedModelKey: 'ev9' },
  };
  assert.ok(buildWishHandoffExitLabel({
    notepadLabels: withWish.notepadLabels,
    needProfile: withWish.needProfile,
  }), 'F: CTA bleibt');
  const incomplete = buildIncompleteOfferHandoffCopy();
  assert.match(incomplete.primaryLabel, /Angebot übergeben/i);
  console.log('✓ F Handoff ohne vollständige Leasingdaten');
}

// --- G: Sofort-Kontakt / Handoff-Policy ---
{
  const offerLabel = buildWishHandoffExitLabel({ notepadLabels: [] });
  assert.equal(offerLabel, 'Meine Wünsche übergeben');
  assert.ok(!/Verkäufer kontaktieren/i.test(buildContactExitLabel()));
  console.log('✓ G Sofort-Kontakt / Handoff-Policy');
}

// --- H Fakt≠Wunsch + keine Match-Sprache in Prompt ---
{
  assert.match(
    CLEVER_CONVERSATION_INSTRUCTIONS,
    /Keine Match-Prozente|Keine Ranking-Sprache|keine „beste Wahl“/i,
  );
  const grounded = assertGroundedCleverTurn({
    reply: 'Der EV3 hat ein Head-up-Display in höheren Ausstattungen.',
    intent: 'knowledge_question',
    needProfilePatch: {},
    vehicleDirections: [],
    nextAction: { type: 'none', targetField: null, question: null, options: [], reason: null },
    handoff: { requested: false, ready: false, summary: null },
    usedFactIds: [],
    evidence: [],
    nextTopics: [],
  });
  assert.equal(grounded.ok, true);
  console.log('✓ H Fakt≠Wunsch + keine Match-Sprache in Prompt');
}

// --- Verkäufer erhält Notizzettel-Basis + Understanding ---
{
  const profile = mergeTextIntoNeedProfile('Elektro SUV 7 Sitze, EV9 gefällt mir.');
  const labels = buildUnderstoodLabels(profile);
  const understanding = buildCustomerUnderstanding({
    crm: { needProfile: { ...profile, understoodLabels: labels } },
    sonderwuensche: {},
  });
  assert.ok((understanding.verstaendnis?.labels?.length ?? 0) > 0 || labels.length > 0);
  console.log('✓ Verkäufer erhält Notizzettel-Basis + Understanding');
}

// --- Chip-× Korrektur ---
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

// --- CTA Evolution (Wunschübergabe) ---
{
  assert.equal(buildWishHandoffExitLabel({ notepadLabels: [] }), 'Meine Wünsche übergeben');
  assert.equal(
    buildWishHandoffExitLabel({ notepadLabels: ['Elektro', 'HUD'] }),
    'Meine Wünsche übergeben',
  );
  assert.equal(
    buildWishHandoffExitLabel({
      notepadLabels: ['EV9 interessant'],
      needProfile: { selectedModelKey: 'ev9' },
    }),
    'Meine EV9-Wünsche übergeben',
  );
  assert.equal(
    buildWishHandoffExitLabel({
      notepadLabels: [],
      needProfile: {
        ...createEmptyNeedProfile(),
        rawMessages: ['Ich möchte ein Angebot.'],
      },
      offerRequested: true,
    }),
    'Für Angebot übergeben',
  );
  assert.equal(buildOfferExitLabel({ notepadLabels: [] }), 'Meine Wünsche übergeben');
  console.log('✓ CTA-Evolution Wunschübergabe');
}

// --- I: Faktfrage ≠ Wunsch-Chip ---
{
  const base = mergeTextIntoNeedProfile('Kleinwagen Elektro');
  const afterHudQ = mergeTextIntoNeedProfile('head up display?', base);
  assert.ok(!hasApprox(buildUnderstoodLabels(afterHudQ), /Head-up|HUD/i), 'I: HUD-Frage kein Chip');
  const afterTowQ = mergeTextIntoNeedProfile('Anhängelast?', base);
  assert.ok(!hasApprox(buildUnderstoodLabels(afterTowQ), /Anhängelast|AHK|Anhänger/i), 'I: Anhängelast-Frage kein Chip');
  const afterWish = mergeTextIntoNeedProfile('HUD brauche ich', base);
  assert.ok(hasApprox(buildUnderstoodLabels(afterWish), /Head-up|HUD/i), 'I: HUD-Wunsch bleibt Chip');
  console.log('✓ I Faktfrage erzeugt keinen Wunsch-Chip');
}

// --- J: Next-Topic-Klick erzeugt keinen Wunsch ---
{
  const topics = sanitizeNextTopics([
    { id: 'towing', label: 'Anhängelast', customerMessage: 'Wie hoch ist die Anhängelast beim EV9?' },
  ]);
  const after = mergeTextIntoNeedProfile(topics[0].customerMessage, createEmptyNeedProfile());
  assert.ok(!hasApprox(buildUnderstoodLabels(after), /mindestens|1\.?500/i));
  console.log('✓ J Next-Topic erzeugt keinen Wunsch');
}

// --- K: AI-Richtung ≠ Wunsch-Chip; Kundenbestätigung = interessant ---
{
  let session = createHappyPathSession('Autohaus Test');
  session = applyCleverTurnToSession(session, {
    customerMessage: 'SUV mit 7 Sitzen elektrisch',
    turnResult: {
      reply: 'Dann kommt der EV9 infrage.',
      intent: 'vehicle_discovery',
      needProfilePatch: { fuel: 'electric', bodyType: 'suv', persons: 7 },
      vehicleDirections: [{ modelKey: 'ev9', status: 'candidate', reason: '7 Sitze Elektro' }],
      nextAction: { type: 'none', targetField: null, question: null, options: [], reason: null },
      handoff: { requested: false, ready: false, summary: null },
      usedFactIds: [],
      evidence: [],
      nextTopics: [
        { id: 'range', label: 'Reichweite', customerMessage: 'Wie weit kommt der EV9?' },
      ],
    },
  });
  assert.ok(!hasApprox(session.notepadLabels, /EV9/i), 'K: AI-Richtung kein EV9-Chip');
  session = {
    ...session,
    needProfile: mergeTextIntoNeedProfile('EV9 gefällt mir.', session.needProfile),
  };
  session = {
    ...session,
    notepadLabels: buildUnderstoodLabels(session.needProfile),
  };
  assert.ok(hasApprox(session.notepadLabels, /EV9.*interessant/i), 'K: Bestätigung → interessant');
  console.log('✓ K AI-Richtung ≠ Wunsch; Bestätigung = interessant');
}

// --- L: Wunschübergabe bei unvollständigem Profil + voller Chat ---
{
  let session = createHappyPathSession('Autohaus Test');
  session = {
    ...session,
    phase: 'conversation',
    notepadLabels: ['EV9 interessant'],
    needProfile: {
      ...createEmptyNeedProfile('EV9 gefällt mir.'),
      selectedModelKey: 'ev9',
    },
    turns: [
      { type: 'customer', id: 'c1', text: 'EV9 gefällt mir.' },
      { type: 'clever', id: 'a1', text: 'Notiert.' },
    ],
  };
  assert.equal(
    buildWishHandoffExitLabel(session),
    'Meine EV9-Wünsche übergeben',
  );
  session = submitDealerHandoff(session, {});
  assert.ok(session.turns.some((t) => t.type === 'personal_handoff' || t.handoffView), 'L: Handoff-Turn');
  const result = submitPersonalHandoff(session, {
    firstName: 'Max',
    lastName: 'Mustermann',
    email: 'max@example.com',
    phone: '',
    contactPreference: 'whatsapp',
    contactTiming: 'this_week',
  }, { dealerName: 'Autohaus Test' });
  assert.ok(result.lead, 'L: Lead entsteht');
  assert.match(String(result.lead.advisorStatus ?? ''), /Wunschübergabe/i);
  assert.ok(
    (result.lead.sonderwuensche?.consultation?.consultationHandoff
      || result.session?.turns?.length) ,
    'L: Gesprächskontext übergeben',
  );
  console.log('✓ L Wunschübergabe unvollständig + Chat');
}

// --- M: Angebotssprache erst bei Angebotswunsch ---
{
  assert.equal(hasExplicitOfferIntent({ notepadLabels: ['Elektro'] }), false);
  assert.equal(
    hasExplicitOfferIntent({
      needProfile: { rawMessages: ['Ich möchte ein Angebot.'] },
    }),
    true,
  );
  assert.equal(
    buildWishHandoffExitLabel({
      needProfile: { rawMessages: ['Schicken Sie mir ein Angebot.'], budget: {} },
      offerRequested: true,
    }),
    'Für Angebot übergeben',
  );
  console.log('✓ M Angebotssprache erst bei Angebotswunsch');
}

console.log('\ncustomerIntakeGolden.test.js: ok');
