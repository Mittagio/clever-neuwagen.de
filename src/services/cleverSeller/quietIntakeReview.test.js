/**
 * node src/services/cleverSeller/quietIntakeReview.test.js
 */
import assert from 'node:assert/strict';
import {
  applyQuietIntakeSubtaskResult,
  INTAKE_PROTOCOL_PHRASE_RE,
  isQuietIntakeReview,
  isQuietIntakeTurn,
  resolveQuietIntakeSuggestChips,
} from './quietIntakeReview.js';
import {
  buildComposerTaskTitle,
  buildPhoneAddedMicroConfirm,
} from './composerSurfaceState.js';
import {
  buildInboundLeadReviewModel,
  buildIntakeModelChoiceChips,
  buildIntakeNextActions,
  INTAKE_NEXT_ACTION_MAX,
} from './inboundLeadIntake.js';

assert.equal(isQuietIntakeReview({
  reviewType: 'customer_intake_review',
  title: '',
  progressLines: [],
}), true);
assert.equal(isQuietIntakeReview({
  kind: 'multi_source_intake',
  reviewType: 'customer_contract_tradein_intake_review',
}), true);
assert.equal(isQuietIntakeReview({ quietIntake: true }), true);
assert.equal(isQuietIntakeReview({ reviewType: 'offer_prepare' }), false);

assert.equal(isQuietIntakeTurn({ inboundLead: { detected: true } }), true);
assert.equal(isQuietIntakeTurn({ multiSourceIntake: { detected: true } }), true);
assert.equal(isQuietIntakeTurn({ reviewModel: { kind: 'customer_intake' } }), true);
assert.equal(isQuietIntakeTurn({ messageDraft: 'Hallo' }), false);

const protocolSamples = [
  '✓ Seller-Dump und Dokument zusammengeführt',
  'Clever sucht in Ihren Kunden …',
  'Clever wertet aus …',
  'Clever hat erkannt',
  'Clever hat eine Anfrage erkannt',
  '○ Erkannt als neue Anfrage – Kundenakte anlegen?',
  'Clever hat einen Beratungsfall erkannt',
];
for (const sample of protocolSamples) {
  assert.ok(INTAKE_PROTOCOL_PHRASE_RE.test(sample), sample);
}

assert.ok(!INTAKE_PROTOCOL_PHRASE_RE.test('Kundenakte anlegen & weitermachen'));
assert.ok(!INTAKE_PROTOCOL_PHRASE_RE.test('Matthias Wittig · neue Kundenakte'));
assert.ok(!INTAKE_PROTOCOL_PHRASE_RE.test('Von Clever erkannt'));

// Freeze: Task-Titel = Aktionsverb · Name
assert.equal(
  buildComposerTaskTitle({ kind: 'phone_add', name: 'Matthias Wittig' }),
  'TELEFON ERGÄNZEN · Matthias Wittig',
);
assert.equal(
  buildComposerTaskTitle({ kind: 'model_fix', name: 'Matthias Wittig' }),
  'MODELL KORRIGIEREN · Matthias Wittig',
);

// --- Wittig: Telefon fehlt, EV2 Earth high-confidence, Deal-Facts → max 3, kein Notiz/Modell ---
{
  const inbound = {
    detected: true,
    proposeCreateCustomer: true,
    resolutionStatus: 'none',
    contact: {
      fullName: 'Matthias Wittig',
      email: 'matthias.wittig@example.org',
    },
  };
  const turn = {
    inboundLead: inbound,
    extractedFacts: [
      {
        field: 'vehicleInterest',
        label: 'EV2 Earth',
        value: { model: 'EV2', trim: 'Earth' },
        confidence: 0.95,
        needsConfirmation: false,
      },
      { field: 'paymentType', label: 'Leasing', value: 'leasing', confidence: 0.9 },
      { field: 'termMonths', label: '36 Monate', value: 36, confidence: 0.92 },
      { field: 'annualMileage', label: '12.500 km', value: 12500, confidence: 0.92 },
    ],
  };

  const actions = buildIntakeNextActions(inbound, turn);
  assert.ok(actions.length <= INTAKE_NEXT_ACTION_MAX);
  assert.ok(actions.some((a) => a.id === 'qi_phone'));
  assert.ok(actions.some((a) => a.id === 'qi_offer'));
  assert.ok(!actions.some((a) => a.id === 'qi_model'), 'kein Modell prüfen bei high-confidence');
  assert.ok(!actions.some((a) => a.id === 'qi_note' || /notiz/i.test(a.label || '')));

  const phoneAction = actions.find((a) => a.id === 'qi_phone');
  const offerAction = actions.find((a) => a.id === 'qi_offer');
  assert.equal(phoneAction?.important, true);
  assert.equal(phoneAction?.weight, 'important');
  assert.equal(offerAction?.secondary, true, 'Angebot secondary while Telefon fehlt');
  assert.equal(offerAction?.important, false);
  assert.equal(offerAction?.weight, 'secondary');
  assert.notEqual(
    phoneAction?.weight,
    offerAction?.weight,
    'Telefon und Angebot nicht gleichgewichtig',
  );

  const chips = resolveQuietIntakeSuggestChips(turn);
  assert.equal(chips.length, actions.length);
  assert.ok(chips.length <= 3);
  const phone = chips.find((c) => c.id === 'qi_phone');
  assert.equal(phone?.composerTitle, 'TELEFON ERGÄNZEN · Matthias Wittig');
  assert.match(phone?.placeholder || '', /Telefonnummer/i);
  assert.equal(phone?.label, 'Telefon ergänzen');
  assert.equal(phone?.important, true);
  const offerChip = chips.find((c) => c.id === 'qi_offer');
  assert.equal(offerChip?.secondary, true);
  assert.ok(!chips.some((c) => /Modell korrigieren|Notiz merken/i.test(c.label || '')));

  const review = buildInboundLeadReviewModel(inbound, turn);
  assert.match(review.hero?.name || '', /Wittig.*neue Kundenakte/i);
  assert.ok(!/Neu anlegen\?/i.test(review.hero?.name || ''));
  assert.equal(review.hero?.subtitle, 'Von Clever erkannt');
  assert.equal(review.primaryCta, 'Kundenakte anlegen & weitermachen');
  const openGroup = review.groups.find((g) => g.id === 'open');
  assert.ok(openGroup, 'Noch offen Gruppe');
  assert.equal(openGroup.title, 'Noch offen');
  assert.ok((openGroup.chips || []).some((c) => /Telefon fehlt/i.test(c.label)));
  const facts = review.groups.find((g) => g.id === 'facts');
  assert.ok((facts?.chips || []).every((c) => c.source === 'clever'));
  assert.ok(!review.groups.some((g) => /ERKANNTE ANGABEN/i.test(g.title || '')));
}

// --- High-confidence Modell → kein qi_model; Phone vorhanden → kein Telefon ---
{
  const actions = buildIntakeNextActions(
    {
      detected: true,
      contact: { fullName: 'Max Muster', phone: '0171 111', email: 'a@b.de' },
    },
    {
      extractedFacts: [
        {
          field: 'vehicleInterest',
          label: 'EV2 Earth',
          confidence: 0.93,
          needsConfirmation: false,
        },
        { field: 'paymentType', value: 'leasing', label: 'Leasing' },
        { field: 'termMonths', value: 36, label: '36 Monate' },
      ],
    },
  );
  assert.ok(!actions.some((a) => a.id === 'qi_phone'));
  assert.ok(!actions.some((a) => a.id === 'qi_model'));
  assert.ok(actions.some((a) => a.id === 'qi_offer'));
  const offer = actions.find((a) => a.id === 'qi_offer');
  assert.equal(offer?.secondary, false, 'nach Telefon: Angebot auto-promoted');
  assert.equal(offer?.important, true);
  assert.ok(!actions.some((a) => /notiz/i.test(a.label || '')));
  assert.ok(actions.length <= 3);
}

// --- Unsicheres Modell → Modell korrigieren + Task-Titel ---
{
  const actions = buildIntakeNextActions(
    { detected: true, contact: { fullName: 'Test', phone: '0171' } },
    {
      extractedFacts: [{
        field: 'vehicleInterest',
        label: 'EV?',
        confidence: 0.6,
        needsConfirmation: true,
      }],
    },
  );
  const model = actions.find((a) => a.id === 'qi_model');
  assert.ok(model && model.label === 'Modell korrigieren');
  assert.equal(model.composerTitle, 'MODELL KORRIGIEREN · Test');
  assert.equal(model.important, true);
}

// --- Multi-Modell → prüfen + Choice-Chips ---
{
  const vehicle = {
    field: 'vehicleInterestMulti',
    label: 'EV2 Earth oder EV3 Air',
    value: ['EV2 Earth', 'EV3 Air'],
    confidence: 0.9,
  };
  const actions = buildIntakeNextActions(
    { detected: true, contact: { fullName: 'Test', phone: '0171' } },
    { extractedFacts: [vehicle] },
  );
  const model = actions.find((a) => a.id === 'qi_model');
  assert.ok(model);
  const choices = buildIntakeModelChoiceChips(vehicle);
  assert.ok(choices.some((c) => /EV2/i.test(c.label)));
  assert.ok(choices.some((c) => /EV3/i.test(c.label)));
  assert.ok(choices.some((c) => c.label === 'Anderes'));
  assert.ok((model.choiceChips || []).length >= 2);
}

assert.equal(resolveQuietIntakeSuggestChips({ messageDraft: 'x' }).length, 0);

// --- Nach Telefon-Subtask: mergen + Erfolg + Mode-Reset Signal (kein qi_phone) ---
{
  const preservedTurn = {
    inboundLead: {
      detected: true,
      proposeCreateCustomer: true,
      resolutionStatus: 'none',
      contact: { fullName: 'Matthias Wittig', email: 'a@b.de' },
    },
    extractedFacts: [
      { field: 'vehicleInterest', label: 'EV2 Earth', confidence: 0.95 },
      { field: 'paymentType', label: 'Leasing', value: 'leasing' },
      { field: 'termMonths', value: 36, label: '36 Monate' },
      { field: 'annualMileage', value: 12500, label: '12.500 km' },
    ],
  };
  const merged = applyQuietIntakeSubtaskResult({
    preservedTurn,
    taskId: 'qi_phone',
    completedTurn: {
      sellerInput: '0171 5556677',
      extractedFacts: [{ field: 'phone', value: '01715556677', label: '0171 5556677' }],
      rememberDecision: {
        mode: 'save_with_undo',
        safeFacts: [{ field: 'phone', value: '01715556677', label: '0171 5556677' }],
      },
    },
  });
  assert.match(merged.lastTurn.inboundLead.contact.phone || '', /0171\s*5556677/);
  // Feedback-Freeze: kein grüner Composer-Erfolgssatz
  assert.equal(merged.feedback, null);
  assert.ok(!/vollständig genug für die Kundenakte/i.test(String(merged.feedback || '')));
  assert.deepEqual(merged.microConfirm, buildPhoneAddedMicroConfirm());
  assert.ok(
    (merged.highlightChipLabels || []).some((l) => /0171|5556677/.test(String(l))),
    'Glow-Label für Telefon-Chip',
  );
  assert.deepEqual(merged.reviewModel?.microConfirm, buildPhoneAddedMicroConfirm());
  const next = buildIntakeNextActions(merged.lastTurn.inboundLead, merged.lastTurn);
  assert.ok(!next.some((a) => a.id === 'qi_phone'));
  const offerAfter = next.find((a) => a.id === 'qi_offer');
  assert.equal(offerAfter?.important, true, 'nach Telefon: Angebot promoted');
  assert.equal(offerAfter?.secondary, false);
  assert.match(merged.reviewModel?.primaryCta || '', /Kundenakte anlegen & weitermachen/i);
  assert.match(merged.reviewModel?.hero?.name || '', /Wittig.*neue Kundenakte/i);
  assert.ok(!merged.reviewModel?.groups?.some((g) => g.id === 'open'));
  // Phone erscheint in Clever-Chips
  const factGroup = merged.reviewModel?.groups?.find((g) => g.id === 'facts');
  assert.ok(
    (factGroup?.chips || []).some((c) => /0171|5556677/.test(String(c.label || ''))),
    'Telefon in aktualisierter Karte',
  );
}

console.log('quietIntakeReview.test.js: OK');
